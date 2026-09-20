import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("riyanmee")

PROTOCOLS = ("ssh", "socks5", "http")
LOG_LEVELS = ("info", "success", "warn", "error")
MAX_LOGS = 400
TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace"
SPEED_URL = "https://speed.cloudflare.com/__down?bytes=6000000"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Base document pattern (Mongo <-> Pydantic)
# ---------------------------------------------------------------------------
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v))]


class BaseDocument(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    id: Optional[PyObjectId] = Field(default=None, alias="_id")

    def to_mongo(self) -> dict:
        data = self.model_dump(by_alias=True, exclude_none=True)
        if not data.get("_id"):
            data.pop("_id", None)
        return data

    @classmethod
    def from_mongo(cls, doc: Optional[dict]):
        if not doc:
            return None
        doc = dict(doc)
        doc["id"] = str(doc.pop("_id", None))
        return cls(**doc)


class ServerDoc(BaseDocument):
    name: str
    host: str
    port: int
    protocol: str = "ssh"
    location: str = ""
    username: str = ""
    password: str = ""
    is_builtin: bool = False
    last_ping_ms: Optional[int] = None
    last_ping_at: Optional[datetime] = None
    last_status: str = "unknown"
    created_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = None


class ServerIn(BaseModel):
    name: str
    host: str
    port: int
    protocol: str = "ssh"
    location: str = ""
    username: str = ""
    password: str = ""


class SessionDoc(BaseDocument):
    state: str = "disconnected"
    server_id: Optional[str] = None
    server_name: str = ""
    connected_at: Optional[datetime] = None
    banner: str = ""
    ping_ms: Optional[int] = None
    error: str = ""


class LogDoc(BaseDocument):
    ts: datetime = Field(default_factory=utcnow)
    level: str = "info"
    tag: str = "SYS"
    message: str = ""


class ConfigDoc(BaseDocument):
    name: str
    protocol: str = "ssh"
    host: str = ""
    port: int = 443
    username: str = ""
    password: str = ""
    payload: str = ""
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = None


class ConfigIn(BaseModel):
    name: str
    protocol: str = "ssh"
    host: str = ""
    port: int = 443
    username: str = ""
    password: str = ""
    payload: str = ""


class ConfigTestIn(BaseModel):
    host: str
    port: int
    protocol: str = "ssh"


class ConnectIn(BaseModel):
    server_id: str


class ExportIn(BaseModel):
    config_id: str


class ImportIn(BaseModel):
    blob: str


class ToolResultDoc(BaseDocument):
    kind: str
    ts: datetime = Field(default_factory=utcnow)
    data: dict = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def oid_or_404(raw_id: str, kind: str = "item") -> ObjectId:
    try:
        return ObjectId(raw_id)
    except (InvalidId, TypeError, ValueError):
        raise HTTPException(status_code=404, detail=f"{kind} tidak ditemukan")


def doc_out(model: BaseDocument) -> dict:
    return model.model_dump(mode="json")


async def add_log(level: str, tag: str, message: str) -> None:
    entry = LogDoc(
        level=level if level in LOG_LEVELS else "info",
        tag=tag[:16] or "SYS",
        message=message[:500],
    )
    await db.logs.insert_one(entry.to_mongo())


async def trim_logs() -> None:
    count = await db.logs.count_documents({})
    if count > MAX_LOGS:
        excess = count - MAX_LOGS
        cursor = db.logs.find({}, {"_id": 1}).sort("ts", 1).limit(excess)
        ids = [d["_id"] async for d in cursor]
        if ids:
            await db.logs.delete_many({"_id": {"$in": ids}})


async def tcp_ping(host: str, port: int, timeout: float = 4.0) -> int:
    loop = asyncio.get_running_loop()
    start = loop.time()
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
    except Exception as exc:
        raise RuntimeError(f"host {host}:{port} tidak merespons ({exc.__class__.__name__})")
    elapsed = int((loop.time() - start) * 1000)
    writer.close()
    try:
        await writer.wait_closed()
    except Exception:
        pass
    return elapsed


async def grab_banner(host: str, port: int, timeout: float = 3.0) -> str:
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=timeout)
        try:
            line = await asyncio.wait_for(reader.read(256), timeout=2.0)
            text = line.decode("utf-8", "ignore").strip()
            return text.splitlines()[0][:120] if text else ""
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
    except Exception:
        return ""


async def get_session_doc() -> SessionDoc:
    doc = await db.sessions.find_one({"_id": "active"})
    if not doc:
        session = SessionDoc()
        raw = session.to_mongo()
        raw["_id"] = "active"
        await db.sessions.insert_one(raw)
        return session
    return SessionDoc.from_mongo(doc)


async def save_session(session: SessionDoc) -> SessionDoc:
    raw = session.to_mongo()
    raw["_id"] = "active"
    await db.sessions.replace_one({"_id": "active"}, raw, upsert=True)
    return session


async def ping_server_doc(doc: dict) -> ServerDoc:
    server = ServerDoc.from_mongo(doc)
    update: dict
    try:
        ms = await tcp_ping(server.host, server.port)
        update = {"last_ping_ms": ms, "last_ping_at": utcnow(), "last_status": "online"}
    except Exception:
        update = {"last_ping_ms": None, "last_ping_at": utcnow(), "last_status": "offline"}
    await db.servers.update_one({"_id": doc["_id"]}, {"$set": update})
    fresh = await db.servers.find_one({"_id": doc["_id"]})
    return ServerDoc.from_mongo(fresh)


async def active_proxy_url() -> tuple[Optional[dict], Optional[str]]:
    """Return (server_doc, proxy_url) for the connected server when it is a usable proxy."""
    session = await get_session_doc()
    if session.state != "connected" or not session.server_id:
        return None, None
    try:
        oid = oid_or_404(session.server_id, "Server")
    except HTTPException:
        return None, None
    doc = await db.servers.find_one({"_id": oid, "deleted_at": None})
    if not doc or doc.get("protocol") not in ("socks5", "http"):
        return doc, None
    scheme = "socks5" if doc["protocol"] == "socks5" else "http"
    auth = ""
    if doc.get("username"):
        auth = f"{quote(str(doc['username']))}:{quote(str(doc.get('password') or ''))}@"
    return doc, f"{scheme}://{auth}{doc['host']}:{doc['port']}"


async def fetch_trace(proxy_url: Optional[str] = None) -> dict:
    async with httpx.AsyncClient(proxy=proxy_url, timeout=15) as ac:
        res = await ac.get(TRACE_URL)
        res.raise_for_status()
        data = {}
        for part in res.text.strip().splitlines():
            if "=" in part:
                key, value = part.split("=", 1)
                data[key.strip()] = value.strip()
        return data


async def whois_details(ip: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as ac:
            res = await ac.get(f"https://ipwho.is/{ip}")
            data = res.json()
            connection = data.get("connection") or {}
            return {
                "country": data.get("country"),
                "country_code": data.get("country_code"),
                "isp": connection.get("isp"),
            }
    except Exception:
        return {}


# ---------------------------------------------------------------------------
# Seed
# ---------------------------------------------------------------------------
BUILTIN_SERVERS = [
    {"name": "RIYANMEE EDGE-SG", "host": "one.one.one.one", "port": 443, "protocol": "ssh", "location": "Singapura · Anycast"},
    {"name": "RIYANMEE SSH-GLOBAL", "host": "ssh.github.com", "port": 443, "protocol": "ssh", "location": "Global · Anycast"},
    {"name": "RIYANMEE CORE-US", "host": "dns.google", "port": 443, "protocol": "socks5", "location": "Amerika · Anycast"},
    {"name": "RIYANMEE CORE-EU", "host": "dns.quad9.net", "port": 443, "protocol": "http", "location": "Eropa · Anycast"},
]


async def seed_servers() -> None:
    if await db.servers.count_documents({}) == 0:
        for item in BUILTIN_SERVERS:
            server = ServerDoc(**item, is_builtin=True)
            await db.servers.insert_one(server.to_mongo())
        await add_log("info", "SYS", "Server demo bawaan diaktifkan")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await seed_servers()
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "RIYANMEE PROXY", "status": "ok"}


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------
@api_router.get("/session")
async def get_session():
    session = await get_session_doc()
    server = None
    if session.server_id:
        raw = await db.servers.find_one({"_id": oid_or_404(session.server_id, "Server")})
        if raw:
            server = doc_out(ServerDoc.from_mongo(raw))
    return {"session": doc_out(session), "server": server}


@api_router.post("/session/connect")
async def connect_session(body: ConnectIn):
    oid = oid_or_404(body.server_id, "Server")
    raw = await db.servers.find_one({"_id": oid, "deleted_at": None})
    if not raw:
        raise HTTPException(status_code=404, detail="Server tidak ditemukan")
    server = ServerDoc.from_mongo(raw)

    session = await get_session_doc()
    session.error = ""
    await save_session(session)

    await add_log("info", "CONN", f"Menghubungi {server.host}:{server.port} ({server.protocol.upper()})...")
    try:
        ms = await tcp_ping(server.host, server.port)
        await add_log("success", "CONN", f"TCP handshake OK · {ms} ms")
    except Exception as exc:
        await add_log("error", "CONN", f"Koneksi gagal: {exc}")
        session.state = "disconnected"
        session.server_id = str(server.id)
        session.server_name = server.name
        session.error = str(exc)
        session.connected_at = None
        session.ping_ms = None
        session.banner = ""
        await save_session(session)
        await trim_logs()
        return doc_out(session)

    banner = ""
    if server.protocol == "ssh":
        banner = await grab_banner(server.host, server.port)
        if banner:
            await add_log("success", "SSH", f"Banner: {banner}")
        else:
            await add_log("warn", "SSH", "Banner tidak tersedia, lanjut tanpa handshake banner")
    elif server.protocol in ("socks5", "http"):
        await add_log("info", server.protocol.upper(), f"Relay {server.protocol.upper()} disiapkan ke {server.host}:{server.port}")

    session.state = "connected"
    session.server_id = str(server.id)
    session.server_name = server.name
    session.connected_at = utcnow()
    session.ping_ms = ms
    session.banner = banner
    session.error = ""
    await save_session(session)
    await add_log("success", "TUNNEL", f"Tunnel aktif via {server.name}")
    await trim_logs()
    return doc_out(session)


@api_router.post("/session/disconnect")
async def disconnect_session():
    session = await get_session_doc()
    if session.state == "connected":
        await add_log("info", "CONN", f"Tunnel diputus dari {session.server_name}")
    session.state = "disconnected"
    session.connected_at = None
    session.ping_ms = None
    session.error = ""
    await save_session(session)
    await trim_logs()
    return doc_out(session)


@api_router.post("/session/select")
async def select_session(body: ConnectIn):
    oid = oid_or_404(body.server_id, "Server")
    raw = await db.servers.find_one({"_id": oid, "deleted_at": None})
    if not raw:
        raise HTTPException(status_code=404, detail="Server tidak ditemukan")

    session = await get_session_doc()
    new_id = str(raw["_id"])
    if session.state == "connected" and session.server_id and session.server_id != new_id:
        await add_log("info", "CONN", f"Tunnel diputus (ganti server ke {raw['name']})")
        session.state = "disconnected"
        session.connected_at = None
        session.ping_ms = None
    session.server_id = new_id
    session.server_name = raw["name"]
    session.error = ""
    await save_session(session)
    return doc_out(session)


# ---------------------------------------------------------------------------
# Servers
# ---------------------------------------------------------------------------
@api_router.get("/servers")
async def list_servers():
    docs = await db.servers.find({"deleted_at": None}).sort("created_at", 1).to_list(500)
    return [doc_out(ServerDoc.from_mongo(d)) for d in docs]


@api_router.post("/servers")
async def create_server(body: ServerIn):
    if body.protocol not in PROTOCOLS:
        raise HTTPException(status_code=400, detail="Protokol tidak valid (ssh / socks5 / http)")
    if not (1 <= body.port <= 65535):
        raise HTTPException(status_code=400, detail="Port harus 1-65535")
    if not body.name.strip() or not body.host.strip():
        raise HTTPException(status_code=400, detail="Nama dan host wajib diisi")
    server = ServerDoc(
        name=body.name.strip(),
        host=body.host.strip(),
        port=body.port,
        protocol=body.protocol,
        location=body.location.strip(),
        username=body.username.strip(),
        password=body.password,
        is_builtin=False,
    )
    result = await db.servers.insert_one(server.to_mongo())
    await add_log("info", "SERVER", f"Server baru ditambahkan: {server.name}")
    fresh = await db.servers.find_one({"_id": result.inserted_id})
    return doc_out(ServerDoc.from_mongo(fresh))


@api_router.post("/servers/ping-all")
async def ping_all_servers():
    docs = await db.servers.find({"deleted_at": None}).to_list(500)
    results = await asyncio.gather(
        *[ping_server_doc(d) for d in docs], return_exceptions=True
    )
    return [doc_out(r) for r in results if isinstance(r, ServerDoc)]


@api_router.post("/servers/{server_id}/ping")
async def ping_one_server(server_id: str):
    oid = oid_or_404(server_id, "Server")
    raw = await db.servers.find_one({"_id": oid, "deleted_at": None})
    if not raw:
        raise HTTPException(status_code=404, detail="Server tidak ditemukan")
    fresh = await ping_server_doc(raw)
    return doc_out(fresh)


@api_router.delete("/servers/{server_id}")
async def delete_server(server_id: str):
    oid = oid_or_404(server_id, "Server")
    result = await db.servers.update_one({"_id": oid}, {"$set": {"deleted_at": utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Server tidak ditemukan")
    session = await get_session_doc()
    if session.server_id == server_id and session.state != "disconnected":
        session.state = "disconnected"
        session.connected_at = None
        session.ping_ms = None
        await save_session(session)
        await add_log("warn", "SERVER", "Server aktif dihapus, tunnel diputus")
    await add_log("warn", "SERVER", "Server dihapus dari daftar")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------
@api_router.get("/logs")
async def get_logs(limit: int = 200):
    await trim_logs()
    docs = await db.logs.find().sort("ts", -1).limit(min(max(limit, 1), MAX_LOGS)).to_list(MAX_LOGS)
    return [doc_out(LogDoc.from_mongo(d)) for d in docs]


@api_router.delete("/logs")
async def clear_logs():
    await db.logs.delete_many({})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Configs
# ---------------------------------------------------------------------------
@api_router.get("/configs")
async def list_configs():
    docs = await db.configs.find({"deleted_at": None}).sort("updated_at", -1).to_list(500)
    return [doc_out(ConfigDoc.from_mongo(d)) for d in docs]


@api_router.post("/configs")
async def create_config(body: ConfigIn):
    if body.protocol not in PROTOCOLS:
        raise HTTPException(status_code=400, detail="Protokol tidak valid (ssh / socks5 / http)")
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nama config wajib diisi")
    if not (1 <= body.port <= 65535):
        raise HTTPException(status_code=400, detail="Port harus 1-65535")
    config = ConfigDoc(
        name=body.name.strip(),
        protocol=body.protocol,
        host=body.host.strip(),
        port=body.port,
        username=body.username.strip(),
        password=body.password,
        payload=body.payload,
    )
    result = await db.configs.insert_one(config.to_mongo())
    await add_log("info", "CONFIG", f"Config disimpan: {config.name}")
    fresh = await db.configs.find_one({"_id": result.inserted_id})
    return doc_out(ConfigDoc.from_mongo(fresh))


@api_router.put("/configs/{config_id}")
async def update_config(config_id: str, body: ConfigIn):
    oid = oid_or_404(config_id, "Config")
    if body.protocol not in PROTOCOLS:
        raise HTTPException(status_code=400, detail="Protokol tidak valid (ssh / socks5 / http)")
    if not (1 <= body.port <= 65535):
        raise HTTPException(status_code=400, detail="Port harus 1-65535")
    update = {
        "name": body.name.strip(),
        "protocol": body.protocol,
        "host": body.host.strip(),
        "port": body.port,
        "username": body.username.strip(),
        "password": body.password,
        "payload": body.payload,
        "updated_at": utcnow(),
    }
    result = await db.configs.update_one({"_id": oid, "deleted_at": None}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Config tidak ditemukan")
    fresh = await db.configs.find_one({"_id": oid})
    return doc_out(ConfigDoc.from_mongo(fresh))


@api_router.delete("/configs/{config_id}")
async def delete_config(config_id: str):
    oid = oid_or_404(config_id, "Config")
    result = await db.configs.update_one({"_id": oid}, {"$set": {"deleted_at": utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Config tidak ditemukan")
    await add_log("warn", "CONFIG", "Config dihapus")
    return {"ok": True}


@api_router.post("/configs/test")
async def test_config(body: ConfigTestIn):
    if body.protocol not in PROTOCOLS:
        raise HTTPException(status_code=400, detail="Protokol tidak valid")
    await add_log("info", "CONFIG", f"Tes config ke {body.host}:{body.port}...")
    try:
        ms = await tcp_ping(body.host, body.port)
    except Exception as exc:
        await add_log("error", "CONFIG", f"Tes gagal: {exc}")
        return {"ok": False, "ping_ms": None, "banner": "", "error": str(exc)}
    banner = ""
    if body.protocol == "ssh":
        banner = await grab_banner(body.host, body.port)
    await add_log("success", "CONFIG", f"Tes OK · {ms} ms")
    return {"ok": True, "ping_ms": ms, "banner": banner, "error": ""}


@api_router.post("/configs/export")
async def export_config(body: ExportIn):
    oid = oid_or_404(body.config_id, "Config")
    raw = await db.configs.find_one({"_id": oid, "deleted_at": None})
    if not raw:
        raise HTTPException(status_code=404, detail="Config tidak ditemukan")
    config = ConfigDoc.from_mongo(raw)
    payload = json.dumps(
        {
            "name": config.name,
            "protocol": config.protocol,
            "host": config.host,
            "port": config.port,
            "username": config.username,
            "password": config.password,
            "payload": config.payload,
        }
    )
    blob = "RIYANMEE::" + base64.b64encode(payload.encode()).decode()
    return {"blob": blob}


@api_router.post("/configs/import")
async def import_config(body: ImportIn):
    blob = body.blob.strip()
    if not blob.startswith("RIYANMEE::"):
        raise HTTPException(status_code=400, detail="Format kode config tidak dikenal (harus RIYANMEE::...)")
    try:
        decoded = base64.b64decode(blob[len("RIYANMEE::"):]).decode()
        data = json.loads(decoded)
    except Exception:
        raise HTTPException(status_code=400, detail="Kode config rusak atau tidak valid")
    config = ConfigDoc(
        name=str(data.get("name") or "Config Impor"),
        protocol=data.get("protocol") if data.get("protocol") in PROTOCOLS else "ssh",
        host=str(data.get("host") or ""),
        port=int(data.get("port") or 443),
        username=str(data.get("username") or ""),
        password=str(data.get("password") or ""),
        payload=str(data.get("payload") or ""),
    )
    result = await db.configs.insert_one(config.to_mongo())
    await add_log("success", "CONFIG", f"Config diimpor: {config.name}")
    fresh = await db.configs.find_one({"_id": result.inserted_id})
    return doc_out(ConfigDoc.from_mongo(fresh))


# ---------------------------------------------------------------------------
# Tools: IP check + speed test
# ---------------------------------------------------------------------------
@api_router.post("/tools/ip-check")
async def ip_check():
    try:
        direct = await fetch_trace()
    except Exception as exc:
        await add_log("error", "IPCHK", f"Gagal cek IP langsung: {exc}")
        raise HTTPException(status_code=502, detail="Gagal memeriksa IP, jaringan bermasalah")

    direct_who = await whois_details(direct.get("ip", ""))
    result = {
        "direct_ip": direct.get("ip", ""),
        "direct_country": direct_who.get("country") or direct.get("loc", ""),
        "direct_isp": direct_who.get("isp") or "",
        "spoofed": False,
    }

    server_doc, proxy_url = await active_proxy_url()
    if proxy_url:
        server_name = server_doc.get("name") if server_doc else ""
        try:
            await add_log("info", "IPCHK", f"Memeriksa IP melalui {server_name}...")
            via = await fetch_trace(proxy_url)
            via_who = await whois_details(via.get("ip", ""))
            result.update(
                {
                    "proxy_server": server_name,
                    "proxy_ip": via.get("ip", ""),
                    "proxy_country": via_who.get("country") or via.get("loc", ""),
                    "proxy_isp": via_who.get("isp") or "",
                    "spoofed": via.get("ip") != direct.get("ip"),
                }
            )
            await add_log("success", "IPCHK", f"IP via proxy: {result['proxy_ip']}")
        except Exception as exc:
            result["proxy_error"] = f"Relay proxy gagal: {exc.__class__.__name__}"
            await add_log("error", "IPCHK", result["proxy_error"])
    else:
        result["note"] = "Hubungkan ke server SOCKS5/HTTP untuk menguji penyamaran IP."

    await db.tool_results.insert_one(ToolResultDoc(kind="ip", data=result).to_mongo())
    return result


@api_router.post("/tools/speedtest")
async def speedtest():
    server_doc, proxy_url = await active_proxy_url()
    start = time.perf_counter()
    total = 0
    try:
        async with httpx.AsyncClient(proxy=proxy_url, timeout=60) as ac:
            async with ac.stream("GET", SPEED_URL) as resp:
                resp.raise_for_status()
                async for chunk in resp.aiter_bytes(65536):
                    total += len(chunk)
        elapsed = time.perf_counter() - start
    except Exception as exc:
        await add_log("error", "SPEED", f"Speed test gagal: {exc.__class__.__name__}")
        raise HTTPException(status_code=502, detail="Speed test gagal: jaringan/server tidak merespons")

    mbps = round(total * 8 / elapsed / 1_000_000, 2) if elapsed > 0 else 0.0
    result = {
        "mbps": mbps,
        "bytes": total,
        "seconds": round(elapsed, 2),
        "via_proxy": bool(proxy_url),
        "server_name": server_doc.get("name") if server_doc else None,
    }
    await db.tool_results.insert_one(ToolResultDoc(kind="speed", data=result).to_mongo())
    await add_log("success", "SPEED", f"Unduh {mbps} Mbps ({'via proxy' if proxy_url else 'langsung'})")
    return result


@api_router.get("/tools/history")
async def tool_history():
    docs = await db.tool_results.find().sort("ts", -1).limit(12).to_list(12)
    return [doc_out(ToolResultDoc.from_mongo(d)) for d in docs]


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
