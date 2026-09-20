import asyncio
import hashlib
import logging
import os
import random
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Optional

import bcrypt
import httpx
import jwt
from dotenv import load_dotenv
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, BeforeValidator, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
JWT_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", "43200"))
DEMO_USERNAME = os.environ.get("DEMO_USERNAME", "idmee")
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "riyanmee123")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("riyanmee")

HUNT_MODES = ("ultimate", "full", "city", "isp")
TOTAL_POOL = "480M+"
TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace"

bearer = HTTPBearer(auto_error=False)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Base document pattern
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


class UserDoc(BaseDocument):
    username: str
    password_hash: str
    tier: str = "PREMIUM MEMBER"
    server_host: str = "server.riyanmee.web.id"
    server_port: int = 5245
    proxy_password: str = ""
    whitelist_ips: List[str] = Field(default_factory=list)
    traffic_bytes: int = 0
    expires_at: datetime = Field(default_factory=lambda: utcnow() + timedelta(days=30))
    created_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = None


class HistoryDoc(BaseDocument):
    user_id: str
    ts: datetime = Field(default_factory=utcnow)
    kind: str = "hunt"  # hunt | ipinfo | connect
    title: str = ""
    subtitle: str = ""
    ip: str = ""
    mode: str = ""


# ---- request models -------------------------------------------------------
class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=128)


class WhitelistIn(BaseModel):
    ip: str


class IpInfoIn(BaseModel):
    ip: str


class HuntIn(BaseModel):
    target_ip: str
    mode: str = "ultimate"


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def hash_password(raw: str) -> str:
    return bcrypt.hashpw(raw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(raw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def normalize_username(value: str) -> str:
    return value.strip().lower()


def make_token(username: str) -> str:
    now = utcnow()
    claims = {"sub": username, "iat": now, "exp": now + timedelta(minutes=JWT_MINUTES)}
    return jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
) -> UserDoc:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Sesi tidak ditemukan, silakan login")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        username = payload.get("sub")
        if not username:
            raise ValueError()
    except (jwt.InvalidTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Token tidak valid atau kedaluwarsa")
    doc = await db.users.find_one({"username": username, "deleted_at": None})
    if not doc:
        raise HTTPException(status_code=401, detail="Akun tidak ditemukan")
    return UserDoc.from_mongo(doc)


def public_user(user: UserDoc) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "tier": user.tier,
        "server_host": user.server_host,
        "server_port": user.server_port,
        "proxy_password": user.proxy_password,
        "whitelist_ips": user.whitelist_ips,
        "traffic_bytes": user.traffic_bytes,
        "total_pool": TOTAL_POOL,
        "expires_at": user.expires_at.isoformat() if user.expires_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


# ---------------------------------------------------------------------------
# IP / geo helpers
# ---------------------------------------------------------------------------
IPV4_RE = re.compile(r"^(\d{1,3})(\.\d{1,3}){3}$")


def valid_ip(value: str) -> bool:
    value = value.strip()
    if IPV4_RE.match(value):
        return all(0 <= int(p) <= 255 for p in value.split("."))
    return ":" in value and len(value) >= 3  # loose IPv6 acceptance


async def geo_lookup(ip: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as ac:
        res = await ac.get(f"https://ipwho.is/{ip}")
        data = res.json()
    if not data.get("success", False):
        raise HTTPException(status_code=422, detail=data.get("message") or "IP tidak dapat dilacak")
    connection = data.get("connection") or {}
    return {
        "ip": data.get("ip", ip),
        "success": True,
        "country": data.get("country", ""),
        "country_code": data.get("country_code", ""),
        "region": data.get("region", ""),
        "city": data.get("city", ""),
        "isp": connection.get("isp") or connection.get("org") or "",
        "asn": f"AS{connection.get('asn')}" if connection.get("asn") else "",
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "timezone": (data.get("timezone") or {}).get("id", ""),
    }


def gen_ip(seed_ip: str, salt: int) -> str:
    h = hashlib.sha256(f"{seed_ip}:{salt}".encode()).hexdigest()
    octets = [int(h[i : i + 2], 16) for i in range(0, 8, 2)]
    # avoid reserved / bogon ranges roughly
    if octets[0] in (0, 10, 127, 169, 172, 192, 224, 255):
        octets[0] = 100 + (octets[0] % 100)
    return ".".join(str(max(1, o)) for o in octets)


def hunt_pool(geo: dict, mode: str, count: int = 12) -> List[dict]:
    """Generate a realistic proxy list matching the target's geo per mode."""
    results = []
    base = geo.get("ip", "0.0.0.0")
    for i in range(count):
        ip = gen_ip(base, i)
        port = 10000 + (int(hashlib.md5(f"{ip}{i}".encode()).hexdigest(), 16) % 55000)
        item = {
            "ip": ip,
            "port": port,
            "country": geo.get("country", ""),
            "country_code": geo.get("country_code", ""),
            "city": geo.get("city", ""),
            "isp": geo.get("isp", ""),
            "asn": geo.get("asn", ""),
            "latency_ms": 20 + (i * 7) % 160,
            "type": random.choice(["Residential", "Residential", "Mobile", "Datacenter"]),
        }
        if mode == "city":
            # focus city, vary isp
            item["isp"] = geo.get("isp", "") if i % 2 else f"{geo.get('isp','ISP')} Regional"
        elif mode == "isp":
            # focus same isp, vary city
            item["city"] = geo.get("city", "") if i % 2 else geo.get("region", geo.get("city", ""))
        elif mode == "full":
            item["match"] = "Negara + Kota + ISP/ASN"
        results.append(item)
    return results


# ---------------------------------------------------------------------------
# Seed demo
# ---------------------------------------------------------------------------
async def seed_demo() -> None:
    username = normalize_username(DEMO_USERNAME)
    existing = await db.users.find_one({"username": username})
    if existing:
        return
    user = UserDoc(
        username=username,
        password_hash=hash_password(DEMO_PASSWORD),
        proxy_password="rmx-" + hashlib.md5(username.encode()).hexdigest()[:10],
        whitelist_ips=["59.153.131.72"],
        traffic_bytes=1024 * 1024 * 357,
        expires_at=utcnow() + timedelta(days=30, hours=12, minutes=55),
    )
    await db.users.insert_one(user.to_mongo())
    logger.info("Demo user '%s' seeded", username)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await db.users.create_index("username", unique=True)
    await seed_demo()
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"app": "RIYANMEE PROXY", "status": "ok"}


@api_router.post("/auth/register", status_code=201)
async def register(body: RegisterIn):
    username = normalize_username(body.username)
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="Username sudah dipakai")
    user = UserDoc(
        username=username,
        password_hash=hash_password(body.password),
        tier="FREE MEMBER",
        proxy_password="rmx-" + hashlib.md5(username.encode()).hexdigest()[:10],
        traffic_bytes=0,
        expires_at=utcnow() + timedelta(days=7),
    )
    await db.users.insert_one(user.to_mongo())
    token = make_token(username)
    fresh = UserDoc.from_mongo(await db.users.find_one({"username": username}))
    return {"access_token": token, "token_type": "bearer", "user": public_user(fresh)}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    username = normalize_username(body.username)
    doc = await db.users.find_one({"username": username, "deleted_at": None})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Username atau password salah")
    token = make_token(username)
    return {"access_token": token, "token_type": "bearer", "user": public_user(UserDoc.from_mongo(doc))}


@api_router.get("/auth/me")
async def me(user: Annotated[UserDoc, Depends(current_user)]):
    return public_user(user)


@api_router.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user: Annotated[UserDoc, Depends(current_user)]):
    doc = await db.users.find_one({"_id": ObjectId(user.id)})
    if not verify_password(body.current_password, doc["password_hash"]):
        raise HTTPException(status_code=400, detail="Password saat ini salah")
    await db.users.update_one(
        {"_id": ObjectId(user.id)}, {"$set": {"password_hash": hash_password(body.new_password)}}
    )
    return {"ok": True}


@api_router.get("/profile")
async def get_profile(user: Annotated[UserDoc, Depends(current_user)]):
    return public_user(user)


@api_router.post("/profile/whitelist")
async def add_whitelist(body: WhitelistIn, user: Annotated[UserDoc, Depends(current_user)]):
    ip = body.ip.strip()
    if not valid_ip(ip):
        raise HTTPException(status_code=400, detail="Alamat IP tidak valid")
    if ip in user.whitelist_ips:
        raise HTTPException(status_code=409, detail="IP sudah ada di whitelist")
    await db.users.update_one({"_id": ObjectId(user.id)}, {"$addToSet": {"whitelist_ips": ip}})
    fresh = UserDoc.from_mongo(await db.users.find_one({"_id": ObjectId(user.id)}))
    return public_user(fresh)


@api_router.delete("/profile/whitelist/{ip}")
async def remove_whitelist(ip: str, user: Annotated[UserDoc, Depends(current_user)]):
    await db.users.update_one({"_id": ObjectId(user.id)}, {"$pull": {"whitelist_ips": ip}})
    fresh = UserDoc.from_mongo(await db.users.find_one({"_id": ObjectId(user.id)}))
    return public_user(fresh)


@api_router.post("/profile/reset-traffic")
async def reset_traffic(user: Annotated[UserDoc, Depends(current_user)]):
    await db.users.update_one({"_id": ObjectId(user.id)}, {"$set": {"traffic_bytes": 0}})
    fresh = UserDoc.from_mongo(await db.users.find_one({"_id": ObjectId(user.id)}))
    return public_user(fresh)


@api_router.get("/my-ip")
async def my_ip():
    """Best-effort public IP of the backend (used to prefill 'Whitelist My IP')."""
    try:
        async with httpx.AsyncClient(timeout=10) as ac:
            res = await ac.get(TRACE_URL)
        for part in res.text.strip().splitlines():
            if part.startswith("ip="):
                return {"ip": part.split("=", 1)[1].strip()}
    except Exception:
        pass
    raise HTTPException(status_code=502, detail="Gagal mendeteksi IP")


@api_router.post("/tools/ip-info")
async def ip_info(body: IpInfoIn, user: Annotated[UserDoc, Depends(current_user)]):
    ip = body.ip.strip()
    if not valid_ip(ip):
        raise HTTPException(status_code=400, detail="Masukkan alamat IP yang valid")
    geo = await geo_lookup(ip)
    await db.history.insert_one(
        HistoryDoc(
            user_id=str(user.id),
            kind="ipinfo",
            title=f"Cek IP · {geo['ip']}",
            subtitle=f"{geo['city']}, {geo['country']} · {geo['isp']}".strip(" ,·"),
            ip=geo["ip"],
        ).to_mongo()
    )
    return geo


@api_router.post("/hunt")
async def hunt(body: HuntIn, user: Annotated[UserDoc, Depends(current_user)]):
    mode = body.mode if body.mode in HUNT_MODES else "ultimate"
    ip = body.target_ip.strip()
    if not valid_ip(ip):
        raise HTTPException(status_code=400, detail="Masukkan alamat IP target yang valid")
    geo = await geo_lookup(ip)
    results = hunt_pool(geo, mode)
    mode_label = {
        "ultimate": "ULTIMATE AUTO",
        "full": "FULL SCAN",
        "city": "KOTA SAJA",
        "isp": "ISP SAJA",
    }[mode]
    await db.history.insert_one(
        HistoryDoc(
            user_id=str(user.id),
            kind="hunt",
            title=f"Hunting {mode_label} · {len(results)} proxy",
            subtitle=f"{geo['city']}, {geo['country']} · {geo['isp']}".strip(" ,·"),
            ip=geo["ip"],
            mode=mode,
        ).to_mongo()
    )
    return {
        "target": geo,
        "mode": mode,
        "mode_label": mode_label,
        "count": len(results),
        "results": results,
    }


@api_router.get("/history")
async def get_history(user: Annotated[UserDoc, Depends(current_user)]):
    docs = await db.history.find({"user_id": str(user.id)}).sort("ts", -1).limit(60).to_list(60)
    return [
        {
            "id": str(d["_id"]),
            "ts": d["ts"].isoformat() if isinstance(d.get("ts"), datetime) else d.get("ts"),
            "kind": d.get("kind", ""),
            "title": d.get("title", ""),
            "subtitle": d.get("subtitle", ""),
            "ip": d.get("ip", ""),
            "mode": d.get("mode", ""),
        }
        for d in docs
    ]


@api_router.delete("/history")
async def clear_history(user: Annotated[UserDoc, Depends(current_user)]):
    await db.history.delete_many({"user_id": str(user.id)})
    return {"ok": True}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
