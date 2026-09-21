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
PROXY_GATEWAY_TOKEN = os.environ.get("PROXY_GATEWAY_TOKEN", "")
GATEWAY_CONTROL_PORT = int(os.environ.get("GATEWAY_CONTROL_PORT", "8090"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("riyanmee")

HUNT_MODES = ("ultimate", "full", "city", "isp")
TOTAL_POOL = "480M+"
TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace"

PLANS = [
    {"id": "day7", "name": "Paket 7 Hari", "days": 7, "price": 150000, "price_label": "Rp 150.000", "tier": "PREMIUM MEMBER", "popular": False, "features": ["Semua fitur hunting", "5 IP whitelist", "Cek IP"]},
    {"id": "day30", "name": "Paket 30 Hari", "days": 30, "price": 500000, "price_label": "Rp 500.000", "tier": "PREMIUM MEMBER", "popular": True, "features": ["Semua fitur hunting", "IP whitelist tanpa batas", "Prioritas server"]},
    {"id": "day90", "name": "Paket 90 Hari", "days": 90, "price": 1400000, "price_label": "Rp 1.400.000", "tier": "PREMIUM MEMBER", "popular": False, "features": ["Semua fitur Paket 30 Hari", "Server dedicated", "Dukungan prioritas"]},
]

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
    role: str = "customer"  # admin | customer
    tier: str = "PREMIUM MEMBER"
    status: str = "active"  # active | suspended | pending
    country: str = ""  # assigned exit country code (reseller)
    package_id: str = ""
    package_name: str = ""
    bandwidth_limit_mb: int = 0  # 0 = unlimited / not set
    bandwidth_used_mb: int = 0
    bandwidth_used_bytes: int = 0  # precise byte counter reported by the VPS gateway
    server_host: str = "server.riyanmee.web.id"
    server_port: int = 5245
    proxy_password: str = ""
    gateway_host: str = ""
    gateway_port: int = 0
    gateway_user: str = ""
    gateway_pass: str = ""
    gateway_protocol: str = "socks5"
    gateway_online: bool = False
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
    target_ip: str = ""    # IP target; hunting mencari proxy nyata di lokasi yang sama
    country: str = ""      # override negara (opsional, ISO2)
    city: str = ""         # override kota (opsional)
    mode: str = "ultimate"
    count: int = 12        # berapa banyak proxy residential nyata yang dicari


class ProxyServerDoc(BaseDocument):
    user_id: str
    label: str
    host: str
    port: int
    username: str = ""
    password: str = ""
    protocol: str = "socks5"
    created_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = None


class ProxyIn(BaseModel):
    label: str
    host: str
    port: int
    username: str = ""
    password: str = ""
    protocol: str = "socks5"


class ActivateIn(BaseModel):
    plan_id: str


class GatewayIn(BaseModel):
    host: str
    port: int
    username: str = ""
    password: str = ""
    protocol: str = "socks5"


class ImportIn(BaseModel):
    data: str


# ---------------------------------------------------------------------------
# Reseller: packages, orders, settings
# ---------------------------------------------------------------------------
DEFAULT_COUNTRIES = [
    {"code": "US", "name": "Amerika Serikat"},
    {"code": "GB", "name": "Inggris"},
    {"code": "ID", "name": "Indonesia"},
    {"code": "SG", "name": "Singapura"},
    {"code": "JP", "name": "Jepang"},
    {"code": "DE", "name": "Jerman"},
    {"code": "FR", "name": "Prancis"},
    {"code": "CA", "name": "Kanada"},
    {"code": "AU", "name": "Australia"},
    {"code": "NL", "name": "Belanda"},
]

DEFAULT_PACKAGES = [
    {"id": "day7", "name": "Paket 7 Hari", "days": 7, "price": 50000, "price_label": "Rp 50.000",
     "bandwidth_gb": 10, "tier": "RESELLER", "popular": False, "active": True,
     "features": ["Residential Global", "10 GB kuota", "Pilih negara", "1 IP proxy"]},
    {"id": "day30", "name": "Paket 30 Hari", "days": 30, "price": 150000, "price_label": "Rp 150.000",
     "bandwidth_gb": 50, "tier": "RESELLER", "popular": True, "active": True,
     "features": ["Residential Global", "50 GB kuota", "Pilih negara", "Prioritas server"]},
    {"id": "day90", "name": "Paket 90 Hari", "days": 90, "price": 400000, "price_label": "Rp 400.000",
     "bandwidth_gb": 200, "tier": "RESELLER", "popular": False, "active": True,
     "features": ["Residential Global", "200 GB kuota", "Pilih negara", "Dukungan prioritas"]},
]

DEFAULT_SETTINGS = {
    "payment_info": {
        "bank_name": "BCA",
        "account_number": "1462261696",
        "account_holder": "I KADEK RISPO SUGIANTARA",
        "ewallet": "",
        "qris_note": "Transfer sesuai nominal paket, lalu tekan 'Saya Sudah Bayar'. Konfirmasi manual 1x24 jam.",
    },
    "proxy_host": "155.138.227.248",
    "proxy_port": 1080,
    "proxy_protocol": "socks5",
    "upstream": {
        "provider": "brightdata",
        "host": "brd.superproxy.io",
        "port": 44445,
        "zone": "residential",
        "username": "",
        "password": "",
    },
    "countries": DEFAULT_COUNTRIES,
}


class PackageDoc(BaseModel):
    id: str
    name: str
    days: int
    price: int
    price_label: str
    bandwidth_gb: int = 0
    tier: str = "RESELLER"
    popular: bool = False
    active: bool = True
    features: List[str] = Field(default_factory=list)


class OrderCreateIn(BaseModel):
    package_id: str
    country: str = ""


class CustomerCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    country: str = ""
    package_id: str = ""


class CustomerUpdateIn(BaseModel):
    country: Optional[str] = None
    status: Optional[str] = None
    add_days: Optional[int] = None
    bandwidth_limit_mb: Optional[int] = None
    bandwidth_used_mb: Optional[int] = None
    new_password: Optional[str] = None
    regenerate_proxy_password: Optional[bool] = None
    package_id: Optional[str] = None


class PaymentInfoIn(BaseModel):
    bank_name: str = ""
    account_number: str = ""
    account_holder: str = ""
    ewallet: str = ""
    qris_note: str = ""


class SettingsUpdateIn(BaseModel):
    payment_info: Optional[PaymentInfoIn] = None
    proxy_host: Optional[str] = None
    proxy_port: Optional[int] = None
    proxy_protocol: Optional[str] = None
    countries: Optional[List[dict]] = None
    upstream: Optional[dict] = None


class ProxyAuthorizeIn(BaseModel):
    username: str
    password: str


class ProxyUsageIn(BaseModel):
    username: str = ""
    customer_id: str = ""
    bytes_up: int = 0
    bytes_down: int = 0



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


async def require_admin(user: Annotated[UserDoc, Depends(current_user)]) -> UserDoc:
    if getattr(user, "role", "customer") != "admin":
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    return user


async def require_gateway(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer)],
) -> bool:
    """Auth for the VPS proxy gateway. Uses a shared bearer token (PROXY_GATEWAY_TOKEN)."""
    if not PROXY_GATEWAY_TOKEN:
        raise HTTPException(status_code=503, detail="Gateway token belum dikonfigurasi")
    if not credentials or credentials.scheme.lower() != "bearer" or credentials.credentials != PROXY_GATEWAY_TOKEN:
        raise HTTPException(status_code=401, detail="Gateway tidak diizinkan")
    return True


async def get_settings_doc() -> dict:
    doc = await db.settings.find_one({"_id": "app"})
    if not doc:
        doc = {"_id": "app", **DEFAULT_SETTINGS}
        await db.settings.insert_one(doc)
    # backfill any missing top-level keys
    changed = False
    for k, v in DEFAULT_SETTINGS.items():
        if k not in doc:
            doc[k] = v
            changed = True
    if changed:
        await db.settings.update_one({"_id": "app"}, {"$set": {k: doc[k] for k in DEFAULT_SETTINGS}})
    doc.pop("_id", None)
    return doc



def public_user(user: UserDoc) -> dict:
    return {
        "id": str(user.id),
        "username": user.username,
        "role": getattr(user, "role", "customer"),
        "tier": user.tier,
        "status": getattr(user, "status", "active"),
        "country": getattr(user, "country", ""),
        "package_id": getattr(user, "package_id", ""),
        "package_name": getattr(user, "package_name", ""),
        "bandwidth_limit_mb": getattr(user, "bandwidth_limit_mb", 0),
        "bandwidth_used_mb": getattr(user, "bandwidth_used_mb", 0),
        "server_host": user.server_host,
        "server_port": user.server_port,
        "proxy_password": user.proxy_password,
        "gateway_host": user.gateway_host,
        "gateway_port": user.gateway_port,
        "gateway_user": user.gateway_user,
        "gateway_pass": user.gateway_pass,
        "gateway_protocol": user.gateway_protocol,
        "gateway_online": user.gateway_online,
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


async def tcp_check(host: str, port: int, timeout: float = 5.0) -> bool:
    try:
        fut = asyncio.open_connection(host=host, port=port)
        _, writer = await asyncio.wait_for(fut, timeout=timeout)
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return True
    except Exception:
        return False



def gen_ip(seed_ip: str, salt: int) -> str:
    """Generate a proxy IP that matches the target for at least the first 3
    octets (same /24 subnet) so hunting results look accurate to the target.
    Only the 4th octet varies (deterministic, 1-254, never equal to target's)."""
    parts = seed_ip.split(".")
    if len(parts) == 4 and all(p.isdigit() for p in parts) and all(0 <= int(p) <= 255 for p in parts):
        a, b, c, d = (int(x) for x in parts)
        h = int(hashlib.sha256(f"{seed_ip}:{salt}".encode()).hexdigest(), 16)
        last = 1 + (h % 254)  # 1..254
        if last == d:  # avoid returning the exact target IP
            last = 1 + (last % 254)
        return f"{a}.{b}.{c}.{last}"
    # Fallback for IPv6 / invalid input: previous hashed behaviour
    h = hashlib.sha256(f"{seed_ip}:{salt}".encode()).hexdigest()
    octets = [int(h[i : i + 2], 16) for i in range(0, 8, 2)]
    if octets[0] in (0, 10, 127, 169, 172, 192, 224, 255):
        octets[0] = 100 + (octets[0] % 100)
    return ".".join(str(max(1, o)) for o in octets)


def same_subnet_ips(base_ip: str, count: int) -> List[str]:
    """Return `count` UNIQUE IPs that share the first 3 octets (same /24) as
    `base_ip`. Deterministic per target so repeated hunts on the same IP are
    stable, but every IP in a single result set is guaranteed unique."""
    parts = base_ip.split(".")
    if len(parts) == 4 and all(p.isdigit() and 0 <= int(p) <= 255 for p in parts):
        a, b, c, d = (int(x) for x in parts)
        candidates = [x for x in range(1, 255) if x != d]  # 1..254, skip target's own
        seed = int(hashlib.sha256(base_ip.encode()).hexdigest(), 16)
        random.Random(seed).shuffle(candidates)
        return [f"{a}.{b}.{c}.{x}" for x in candidates[:count]]
    # IPv6 / invalid fallback: dedupe generated IPs
    out: List[str] = []
    seen = set()
    i = 0
    while len(out) < count and i < count * 8:
        ip = gen_ip(base_ip, i)
        i += 1
        if ip not in seen:
            seen.add(ip)
            out.append(ip)
    return out


def hunt_pool(geo: dict, mode: str, count: int = 24) -> List[dict]:
    """Generate a realistic proxy list matching the target's geo per mode.

    Every proxy shares the target's first 3 octets (same /24 subnet) and all
    IPs within a result set are unique."""
    results = []
    base = geo.get("ip", "0.0.0.0")
    ips = same_subnet_ips(base, count)
    for i, ip in enumerate(ips):
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
        # Ensure the demo account is the admin/reseller owner.
        await db.users.update_one(
            {"username": username},
            {"$set": {"role": "admin", "status": "active", "tier": "ADMIN"}},
        )
        return
    user = UserDoc(
        username=username,
        password_hash=hash_password(DEMO_PASSWORD),
        role="admin",
        tier="ADMIN",
        proxy_password="rmx-" + hashlib.md5(username.encode()).hexdigest()[:10],
        whitelist_ips=["59.153.131.72"],
        traffic_bytes=1024 * 1024 * 357,
        expires_at=utcnow() + timedelta(days=3650),
    )
    await db.users.insert_one(user.to_mongo())
    logger.info("Admin user '%s' seeded", username)


async def seed_packages() -> None:
    for pkg in DEFAULT_PACKAGES:
        existing = await db.packages.find_one({"id": pkg["id"]})
        if not existing:
            await db.packages.insert_one(dict(pkg))
    logger.info("Packages ensured")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await db.users.create_index("username", unique=True)
    await db.packages.create_index("id", unique=True)
    await seed_demo()
    await seed_packages()
    await get_settings_doc()
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


def _country_name(code: str) -> str:
    cc = (code or "").strip().upper()
    for c in DEFAULT_COUNTRIES:
        if c.get("code", "").upper() == cc:
            return c.get("name", cc)
    return cc


def _asn_of(text: str) -> str:
    m = re.search(r"AS\d+", (text or "").upper())
    return m.group(0) if m else ""


def _octet_match(a: str, b: str) -> int:
    pa, pb = a.split("."), b.split(".")
    if len(pa) != 4 or len(pb) != 4:
        return 0
    n = 0
    for x, y in zip(pa, pb):
        if x == y:
            n += 1
        else:
            break
    return n


async def _gateway_resolve(host: str, country: str, city: str, count: int) -> list:
    """Call the VPS gateway control API to hunt real residential exit IPs."""
    url = f"http://{host}:{GATEWAY_CONTROL_PORT}/resolve"
    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            url,
            headers={"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"},
            json={"country": country, "city": city, "count": count},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Gateway gagal mencari proxy")
    return resp.json().get("results", [])


@api_router.post("/hunt")
async def hunt(body: HuntIn, user: Annotated[UserDoc, Depends(current_user)]):
    """Hunt REAL residential proxies (IPRoyal) that MATCH a target IP's location.

    Enter a target IP -> we geo-locate it (country/city/ISP) -> hunt live IPRoyal
    residential IPs in the same country & city. Each result is a usable endpoint
    (VPS gateway + per-session username) landing on that exact sticky exit IP.
    """
    mode = body.mode if body.mode in HUNT_MODES else "ultimate"
    s = await get_settings_doc()
    host = (s.get("proxy_host", "") or "").strip()
    port = int(s.get("proxy_port", 0) or 0)
    protocol = s.get("proxy_protocol", "socks5") or "socks5"
    if not host or not port:
        raise HTTPException(status_code=503, detail="Gateway proxy belum dikonfigurasi admin")

    count = max(1, min(int(body.count or 12), 30))

    # 1) Determine target location (from target IP, or explicit overrides).
    target_geo = None
    country = (body.country or "").strip().lower()
    city = (body.city or "").strip().lower()
    tip = (body.target_ip or "").strip()
    if tip:
        if not valid_ip(tip):
            raise HTTPException(status_code=400, detail="Masukkan alamat IP target yang valid")
        target_geo = await geo_lookup(tip)
        if not country:
            country = (target_geo.get("country_code", "") or "").lower()
        if not city and mode in ("ultimate", "full", "city"):
            city = (target_geo.get("city", "") or "").lower().replace(" ", "")
    if len(country) != 2 or not country.isalpha():
        country = ""
    if mode == "isp":
        city = ""  # ISP mode: widen to whole country for more provider variety

    # 2) Hunt real IPs via the VPS gateway (try country+city, fallback country-only).
    try:
        items = await _gateway_resolve(host, country, city, count)
        if not items and city:
            items = await _gateway_resolve(host, country, "", count)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=503, detail="Gateway VPS tidak dapat dihubungi")

    # 3) Build usable results + real similarity to the target.
    proxy_pw = user.proxy_password or ensure_proxy_password(user.username)
    tgt_cc = (target_geo.get("country_code", "") if target_geo else country).upper()
    tgt_city = (target_geo.get("city", "") if target_geo else "").strip().lower()
    tgt_asn = _asn_of(f"{target_geo.get('asn','')} {target_geo.get('isp','')}") if target_geo else ""
    results = []
    for item in items:
        ip = item.get("ip", "")
        if not ip:
            continue
        sess = item.get("session", "")
        cc = item.get("country_code", "") or tgt_cc
        rcity = item.get("city", "")
        org = item.get("org", "")
        uname = user.username
        if country:
            uname += f"-country-{country}"
            if city:
                uname += f"-city-{city}"
        if sess:
            uname += f"-session-{sess}"
        parts = []
        if tgt_cc and cc.upper() == tgt_cc:
            parts.append("Negara")
        if tgt_city and rcity.strip().lower() == tgt_city:
            parts.append("Kota")
        if tgt_asn and tgt_asn in _asn_of(org):
            parts.append("ISP")
        match = " + ".join(parts) if parts else (_country_name(cc) or "Global")
        results.append({
            "ip": ip,
            "port": port,
            "country": _country_name(cc),
            "country_code": cc.upper(),
            "city": rcity,
            "isp": org,
            "asn": _asn_of(org) or org,
            "latency_ms": int(item.get("latency_ms", 0) or 0),
            "type": "Residential",
            "match": match,
            "octet_match": _octet_match(ip, tip) if tip else 0,
            "session": sess,
            "username": uname,
            "password": proxy_pw,
            "gateway_host": host,
            "gateway_port": port,
            "protocol": protocol,
        })

    mode_label = {
        "ultimate": "ULTIMATE AUTO",
        "full": "FULL SCAN",
        "city": "KOTA SAJA",
        "isp": "ISP SAJA",
    }[mode]
    if target_geo:
        target = target_geo
    else:
        target = {
            "ip": "", "success": True,
            "country": _country_name(country.upper()) if country else "Global",
            "country_code": country.upper(), "region": "", "city": city,
            "isp": "", "asn": "", "latitude": None, "longitude": None, "timezone": "",
        }
    loc = f"{target.get('city','')}, {target.get('country','')}".strip(" ,") or "Global"
    await db.history.insert_one(
        HistoryDoc(
            user_id=str(user.id),
            kind="hunt",
            title=f"Hunting {mode_label} · {len(results)} proxy",
            subtitle=loc,
            ip=target.get("ip", ""),
            mode=mode,
        ).to_mongo()
    )
    return {
        "target": target,
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


# ---------------------------------------------------------------------------
# My proxies (Sambung Server Asli)
# ---------------------------------------------------------------------------
def proxy_out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "label": doc.get("label", ""),
        "host": doc.get("host", ""),
        "port": doc.get("port", 0),
        "username": doc.get("username", ""),
        "protocol": doc.get("protocol", "socks5"),
        "created_at": doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
    }


@api_router.get("/proxies")
async def list_proxies(user: Annotated[UserDoc, Depends(current_user)]):
    docs = await db.proxies.find({"user_id": str(user.id), "deleted_at": None}).sort("created_at", -1).to_list(200)
    return [proxy_out(d) for d in docs]


@api_router.post("/proxies")
async def create_proxy(body: ProxyIn, user: Annotated[UserDoc, Depends(current_user)]):
    if body.protocol not in ("socks5", "http", "https", "ssh"):
        raise HTTPException(status_code=400, detail="Protokol tidak valid")
    if not (1 <= body.port <= 65535):
        raise HTTPException(status_code=400, detail="Port harus 1-65535")
    if not body.label.strip() or not body.host.strip():
        raise HTTPException(status_code=400, detail="Label dan host wajib diisi")
    doc = ProxyServerDoc(
        user_id=str(user.id),
        label=body.label.strip(),
        host=body.host.strip(),
        port=body.port,
        username=body.username.strip(),
        password=body.password,
        protocol=body.protocol,
    )
    result = await db.proxies.insert_one(doc.to_mongo())
    fresh = await db.proxies.find_one({"_id": result.inserted_id})
    return proxy_out(fresh)


@api_router.delete("/proxies/{proxy_id}")
async def delete_proxy(proxy_id: str, user: Annotated[UserDoc, Depends(current_user)]):
    try:
        oid = ObjectId(proxy_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Proxy tidak ditemukan")
    result = await db.proxies.update_one(
        {"_id": oid, "user_id": str(user.id)}, {"$set": {"deleted_at": utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Proxy tidak ditemukan")
    return {"ok": True}


IMPORT_LINE_RE = re.compile(r"^(?:(?P<label>[^|]+)\|)?\s*(?:(?P<proto>\w+)://)?(?:(?P<user>[^@:]+)@)?(?P<host>[^:@\s]+):(?P<port>\d+)")


@api_router.post("/proxies/import")
async def import_proxies(body: ImportIn, user: Annotated[UserDoc, Depends(current_user)]):
    lines = [ln.strip() for ln in body.data.splitlines() if ln.strip()]
    if not lines:
        raise HTTPException(status_code=400, detail="Tidak ada data untuk diimpor")
    imported = 0
    for ln in lines:
        m = IMPORT_LINE_RE.match(ln)
        if not m:
            continue
        port = int(m.group("port"))
        if not (1 <= port <= 65535):
            continue
        proto = (m.group("proto") or "socks5").lower()
        if proto not in ("socks5", "http", "https", "ssh"):
            proto = "socks5"
        label = (m.group("label") or f"{m.group('host')}").strip()
        doc = ProxyServerDoc(
            user_id=str(user.id),
            label=label,
            host=m.group("host").strip(),
            port=port,
            username=(m.group("user") or "").strip(),
            password="",
            protocol=proto,
        )
        await db.proxies.insert_one(doc.to_mongo())
        imported += 1
    if imported == 0:
        raise HTTPException(status_code=400, detail="Format tidak dikenali. Gunakan host:port per baris")
    return {"imported": imported}


# ---------------------------------------------------------------------------
# Gateway (Sambung Gateway) — user's own rotating-proxy VPS
# ---------------------------------------------------------------------------
@api_router.get("/gateway")
async def get_gateway(user: Annotated[UserDoc, Depends(current_user)]):
    return {
        "host": user.gateway_host,
        "port": user.gateway_port,
        "username": user.gateway_user,
        "password": user.gateway_pass,
        "protocol": user.gateway_protocol,
        "online": user.gateway_online,
        "configured": bool(user.gateway_host and user.gateway_port),
    }


@api_router.put("/gateway")
async def set_gateway(body: GatewayIn, user: Annotated[UserDoc, Depends(current_user)]):
    if body.protocol not in ("socks5", "http", "https", "ssh"):
        raise HTTPException(status_code=400, detail="Protokol tidak valid")
    if not (1 <= body.port <= 65535):
        raise HTTPException(status_code=400, detail="Port harus 1-65535")
    if not body.host.strip():
        raise HTTPException(status_code=400, detail="Host wajib diisi")
    online = await tcp_check(body.host.strip(), body.port)
    await db.users.update_one(
        {"_id": ObjectId(user.id)},
        {"$set": {
            "gateway_host": body.host.strip(),
            "gateway_port": body.port,
            "gateway_user": body.username.strip(),
            "gateway_pass": body.password,
            "gateway_protocol": body.protocol,
            "gateway_online": online,
        }},
    )
    return {
        "host": body.host.strip(),
        "port": body.port,
        "username": body.username.strip(),
        "password": body.password,
        "protocol": body.protocol,
        "online": online,
        "configured": True,
    }


@api_router.post("/gateway/test")
async def test_gateway(user: Annotated[UserDoc, Depends(current_user)]):
    if not (user.gateway_host and user.gateway_port):
        raise HTTPException(status_code=400, detail="Gateway belum dikonfigurasi")
    online = await tcp_check(user.gateway_host, user.gateway_port)
    await db.users.update_one({"_id": ObjectId(user.id)}, {"$set": {"gateway_online": online}})
    return {"online": online}


@api_router.delete("/gateway")
async def clear_gateway(user: Annotated[UserDoc, Depends(current_user)]):
    await db.users.update_one(
        {"_id": ObjectId(user.id)},
        {"$set": {"gateway_host": "", "gateway_port": 0, "gateway_user": "", "gateway_pass": "", "gateway_online": False}},
    )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Subscription plans (mock activation)
# ---------------------------------------------------------------------------
@api_router.get("/plans")
async def get_plans():
    docs = await db.packages.find({"active": True}).to_list(100)
    docs.sort(key=lambda d: d.get("days", 0))
    return [
        {
            "id": d.get("id"),
            "name": d.get("name"),
            "days": d.get("days", 0),
            "price": d.get("price", 0),
            "price_label": d.get("price_label", ""),
            "bandwidth_gb": d.get("bandwidth_gb", 0),
            "tier": d.get("tier", "RESELLER"),
            "popular": d.get("popular", False),
            "features": d.get("features", []),
        }
        for d in docs
    ]


@api_router.post("/subscription/activate")
async def activate_subscription(body: ActivateIn, user: Annotated[UserDoc, Depends(current_user)]):
    plan = await db.packages.find_one({"id": body.plan_id, "active": True})
    if not plan:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    now = utcnow()
    current = user.expires_at
    if current and current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    base = current if current and current > now else now
    new_expiry = base + timedelta(days=plan["days"])
    await db.users.update_one(
        {"_id": ObjectId(user.id)},
        {"$set": {"expires_at": new_expiry, "tier": plan["tier"]}},
    )
    await db.history.insert_one(
        HistoryDoc(
            user_id=str(user.id),
            kind="connect",
            title=f"Aktivasi paket · {plan['name']}",
            subtitle=f"+{plan['days']} hari · {plan['price_label']}",
        ).to_mongo()
    )
    await db.purchases.insert_one(
        {
            "user_id": str(user.id),
            "plan_id": plan["id"],
            "plan_name": plan["name"],
            "days": plan["days"],
            "price": plan["price"],
            "price_label": plan["price_label"],
            "expires_at": new_expiry,
            "ts": now,
        }
    )
    fresh = UserDoc.from_mongo(await db.users.find_one({"_id": ObjectId(user.id)}))
    return public_user(fresh)


@api_router.get("/purchases")
async def get_purchases(user: Annotated[UserDoc, Depends(current_user)]):
    docs = await db.purchases.find({"user_id": str(user.id)}).sort("ts", -1).limit(50).to_list(50)
    return [
        {
            "id": str(d["_id"]),
            "plan_id": d.get("plan_id", ""),
            "plan_name": d.get("plan_name", ""),
            "days": d.get("days", 0),
            "price": d.get("price", 0),
            "price_label": d.get("price_label", ""),
            "ts": d["ts"].isoformat() if isinstance(d.get("ts"), datetime) else d.get("ts"),
            "expires_at": d["expires_at"].isoformat() if isinstance(d.get("expires_at"), datetime) else d.get("expires_at"),
        }
        for d in docs
    ]


# ---------------------------------------------------------------------------
# Reseller helpers
# ---------------------------------------------------------------------------
def _iso(v):
    return v.isoformat() if isinstance(v, datetime) else v


def order_out(d: dict) -> dict:
    return {
        "id": str(d["_id"]),
        "user_id": d.get("user_id", ""),
        "username": d.get("username", ""),
        "package_id": d.get("package_id", ""),
        "package_name": d.get("package_name", ""),
        "days": d.get("days", 0),
        "price": d.get("price", 0),
        "price_label": d.get("price_label", ""),
        "country": d.get("country", ""),
        "status": d.get("status", "pending"),
        "created_at": _iso(d.get("created_at")),
        "confirmed_at": _iso(d.get("confirmed_at")),
    }


def customer_out(u: dict) -> dict:
    return public_user(UserDoc.from_mongo(u))


def ensure_proxy_password(username: str, existing: str = "") -> str:
    if existing:
        return existing
    return "rmx-" + hashlib.md5(f"{username}{random.random()}".encode()).hexdigest()[:10]


# ---------------------------------------------------------------------------
# Customer: payment info, countries, proxy account, orders
# ---------------------------------------------------------------------------
@api_router.get("/payment-info")
async def payment_info(user: Annotated[UserDoc, Depends(current_user)]):
    s = await get_settings_doc()
    return {
        "payment_info": s.get("payment_info", {}),
    }


@api_router.get("/countries")
async def list_countries(user: Annotated[UserDoc, Depends(current_user)]):
    s = await get_settings_doc()
    return s.get("countries", DEFAULT_COUNTRIES)


@api_router.get("/proxy-account")
async def proxy_account(user: Annotated[UserDoc, Depends(current_user)]):
    s = await get_settings_doc()
    now = utcnow()
    exp = user.expires_at
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    active = getattr(user, "status", "active") == "active" and bool(exp and exp > now) and bool(user.package_id)
    return {
        "configured": bool(user.package_id),
        "active": active,
        "status": getattr(user, "status", "active"),
        "host": s.get("proxy_host", ""),
        "port": s.get("proxy_port", 0),
        "protocol": s.get("proxy_protocol", "socks5"),
        "username": user.username,
        "password": user.proxy_password,
        "country": getattr(user, "country", ""),
        "package_id": user.package_id,
        "package_name": user.package_name,
        "bandwidth_limit_mb": getattr(user, "bandwidth_limit_mb", 0),
        "bandwidth_used_mb": getattr(user, "bandwidth_used_mb", 0),
        "expires_at": _iso(user.expires_at),
    }


@api_router.post("/orders", status_code=201)
async def create_order(body: OrderCreateIn, user: Annotated[UserDoc, Depends(current_user)]):
    pkg = await db.packages.find_one({"id": body.package_id, "active": True})
    if not pkg:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    existing = await db.orders.find_one({"user_id": str(user.id), "status": "pending"})
    if existing:
        raise HTTPException(status_code=409, detail="Masih ada pesanan menunggu konfirmasi")
    doc = {
        "user_id": str(user.id),
        "username": user.username,
        "package_id": pkg["id"],
        "package_name": pkg["name"],
        "days": pkg.get("days", 0),
        "price": pkg.get("price", 0),
        "price_label": pkg.get("price_label", ""),
        "country": body.country.strip().upper(),
        "status": "pending",
        "created_at": utcnow(),
        "confirmed_at": None,
    }
    result = await db.orders.insert_one(doc)
    fresh = await db.orders.find_one({"_id": result.inserted_id})
    return order_out(fresh)


@api_router.get("/orders/mine")
async def my_orders(user: Annotated[UserDoc, Depends(current_user)]):
    docs = await db.orders.find({"user_id": str(user.id)}).sort("created_at", -1).limit(50).to_list(50)
    return [order_out(d) for d in docs]


# ---------------------------------------------------------------------------
# Proxy gateway (called by the VPS gateway, protected by PROXY_GATEWAY_TOKEN)
# ---------------------------------------------------------------------------
@api_router.post("/proxy/authorize")
async def proxy_authorize(body: ProxyAuthorizeIn, _: Annotated[bool, Depends(require_gateway)]):
    """Validate an end-customer's proxy credentials and return their exit country.

    Called by the VPS gateway on each new proxy connection. Never returns any
    Bright Data / upstream secrets — those live only in the VPS env file.
    """
    username = normalize_username(body.username)
    doc = await db.users.find_one({"username": username, "deleted_at": None})
    if not doc:
        return {"active": False, "reason": "not_found"}
    user = UserDoc.from_mongo(doc)
    if getattr(user, "role", "customer") == "admin":
        return {"active": False, "reason": "admin_account"}
    if not user.proxy_password or body.password != user.proxy_password:
        return {"active": False, "reason": "bad_credentials"}

    now = utcnow()
    exp = user.expires_at
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    reason = "ok"
    active = True
    if getattr(user, "status", "active") != "active":
        active, reason = False, "suspended"
    elif not user.package_id:
        active, reason = False, "no_package"
    elif not (exp and exp > now):
        active, reason = False, "expired"
    else:
        limit = int(getattr(user, "bandwidth_limit_mb", 0) or 0)
        used = int(getattr(user, "bandwidth_used_mb", 0) or 0)
        if limit > 0 and used >= limit:
            active, reason = False, "quota_exceeded"

    country = (getattr(user, "country", "") or "").strip().lower()
    return {
        "active": active,
        "reason": reason,
        "customer_id": user.username,
        "country": country,
        "package_id": user.package_id,
    }


@api_router.post("/proxy/usage")
async def proxy_usage(body: ProxyUsageIn, _: Annotated[bool, Depends(require_gateway)]):
    """Record bandwidth reported by the VPS gateway and keep quota counters in sync."""
    username = normalize_username(body.username or body.customer_id)
    if not username:
        raise HTTPException(status_code=400, detail="username wajib diisi")
    total = max(0, int(body.bytes_up)) + max(0, int(body.bytes_down))
    if total <= 0:
        return {"ok": True, "bandwidth_used_mb": None}
    updated = await db.users.find_one_and_update(
        {"username": username, "deleted_at": None},
        {"$inc": {"bandwidth_used_bytes": total, "traffic_bytes": total}},
        return_document=True,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    used_mb = int(updated.get("bandwidth_used_bytes", 0)) // (1024 * 1024)
    await db.users.update_one({"username": username}, {"$set": {"bandwidth_used_mb": used_mb}})
    return {"ok": True, "bandwidth_used_mb": used_mb}


@api_router.get("/admin/gateway-status")
async def admin_gateway_status(_: Annotated[UserDoc, Depends(require_admin)]):
    """Live reachability of the configured VPS gateway and the Bright Data upstream."""
    s = await get_settings_doc()
    host = (s.get("proxy_host", "") or "").strip()
    port = int(s.get("proxy_port", 0) or 0)
    gateway_online = bool(host and port) and await tcp_check(host, port)
    up = s.get("upstream", {}) or {}
    brd_host = (up.get("host", "brd.superproxy.io") or "brd.superproxy.io").strip()
    brd_port = int(up.get("port", 44445) or 44445)
    brd_online = bool(brd_host and brd_port) and await tcp_check(brd_host, brd_port)
    return {
        "host": host,
        "port": port,
        "protocol": s.get("proxy_protocol", "http"),
        "configured": bool(host and port),
        "online": gateway_online,
        "upstream": {"provider": up.get("provider", "brightdata"), "host": brd_host, "port": brd_port, "online": brd_online},
    }


# ---------------------------------------------------------------------------
# Admin: stats, customers, orders, packages, settings
# ---------------------------------------------------------------------------
@api_router.get("/admin/stats")
async def admin_stats(admin: Annotated[UserDoc, Depends(require_admin)]):
    total_customers = await db.users.count_documents({"role": "customer", "deleted_at": None})
    active_customers = await db.users.count_documents({"role": "customer", "deleted_at": None, "status": "active"})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    confirmed = await db.orders.find({"status": "confirmed"}).to_list(1000)
    revenue = sum(o.get("price", 0) for o in confirmed)
    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "pending_orders": pending_orders,
        "confirmed_orders": len(confirmed),
        "revenue": revenue,
        "revenue_label": f"Rp {revenue:,.0f}".replace(",", "."),
    }


@api_router.get("/admin/customers")
async def admin_list_customers(admin: Annotated[UserDoc, Depends(require_admin)]):
    docs = await db.users.find({"role": "customer", "deleted_at": None}).sort("created_at", -1).to_list(500)
    return [customer_out(d) for d in docs]


@api_router.post("/admin/customers", status_code=201)
async def admin_create_customer(body: CustomerCreateIn, admin: Annotated[UserDoc, Depends(require_admin)]):
    username = normalize_username(body.username)
    if await db.users.find_one({"username": username}):
        raise HTTPException(status_code=409, detail="Username sudah dipakai")
    pkg = None
    if body.package_id:
        pkg = await db.packages.find_one({"id": body.package_id, "active": True})
    now = utcnow()
    expires = now + timedelta(days=pkg["days"]) if pkg else now
    user = UserDoc(
        username=username,
        password_hash=hash_password(body.password),
        role="customer",
        tier=pkg["tier"] if pkg else "FREE MEMBER",
        status="active" if pkg else "pending",
        country=body.country.strip().upper(),
        package_id=pkg["id"] if pkg else "",
        package_name=pkg["name"] if pkg else "",
        bandwidth_limit_mb=(pkg.get("bandwidth_gb", 0) * 1024) if pkg else 0,
        proxy_password=ensure_proxy_password(username),
        expires_at=expires,
    )
    await db.users.insert_one(user.to_mongo())
    fresh = await db.users.find_one({"username": username})
    return customer_out(fresh)


@api_router.patch("/admin/customers/{customer_id}")
async def admin_update_customer(customer_id: str, body: CustomerUpdateIn, admin: Annotated[UserDoc, Depends(require_admin)]):
    try:
        oid = ObjectId(customer_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    doc = await db.users.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    updates: dict = {}
    if body.country is not None:
        updates["country"] = body.country.strip().upper()
    if body.status is not None:
        if body.status not in ("active", "suspended", "pending"):
            raise HTTPException(status_code=400, detail="Status tidak valid")
        updates["status"] = body.status
    if body.bandwidth_limit_mb is not None:
        updates["bandwidth_limit_mb"] = max(0, body.bandwidth_limit_mb)
    if body.bandwidth_used_mb is not None:
        updates["bandwidth_used_mb"] = max(0, body.bandwidth_used_mb)
    if body.new_password:
        if len(body.new_password) < 6:
            raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
        updates["password_hash"] = hash_password(body.new_password)
    if body.regenerate_proxy_password:
        updates["proxy_password"] = ensure_proxy_password(doc["username"])
    if body.package_id is not None and body.package_id:
        pkg = await db.packages.find_one({"id": body.package_id, "active": True})
        if not pkg:
            raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
        updates["package_id"] = pkg["id"]
        updates["package_name"] = pkg["name"]
        updates["tier"] = pkg["tier"]
        updates["bandwidth_limit_mb"] = pkg.get("bandwidth_gb", 0) * 1024
    if body.add_days:
        current = doc.get("expires_at")
        if isinstance(current, datetime) and current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        now = utcnow()
        base = current if isinstance(current, datetime) and current > now else now
        updates["expires_at"] = base + timedelta(days=body.add_days)
    if not updates:
        raise HTTPException(status_code=400, detail="Tidak ada perubahan")
    await db.users.update_one({"_id": oid}, {"$set": updates})
    fresh = await db.users.find_one({"_id": oid})
    return customer_out(fresh)


@api_router.delete("/admin/customers/{customer_id}")
async def admin_delete_customer(customer_id: str, admin: Annotated[UserDoc, Depends(require_admin)]):
    try:
        oid = ObjectId(customer_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    result = await db.users.update_one({"_id": oid, "role": "customer"}, {"$set": {"deleted_at": utcnow(), "status": "suspended"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    return {"ok": True}


@api_router.get("/admin/orders")
async def admin_list_orders(admin: Annotated[UserDoc, Depends(require_admin)], status: Optional[str] = None):
    query: dict = {}
    if status in ("pending", "confirmed", "rejected"):
        query["status"] = status
    docs = await db.orders.find(query).sort("created_at", -1).limit(200).to_list(200)
    return [order_out(d) for d in docs]


@api_router.post("/admin/orders/{order_id}/confirm")
async def admin_confirm_order(order_id: str, admin: Annotated[UserDoc, Depends(require_admin)]):
    try:
        oid = ObjectId(order_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    order = await db.orders.find_one({"_id": oid})
    if not order:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    if order.get("status") == "confirmed":
        raise HTTPException(status_code=409, detail="Pesanan sudah dikonfirmasi")
    pkg = await db.packages.find_one({"id": order["package_id"]})
    days = order.get("days", 0) or (pkg.get("days", 30) if pkg else 30)
    bw_mb = (pkg.get("bandwidth_gb", 0) * 1024) if pkg else 0
    tier = pkg.get("tier", "RESELLER") if pkg else "RESELLER"
    try:
        cust_oid = ObjectId(order["user_id"])
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    cust = await db.users.find_one({"_id": cust_oid})
    if not cust:
        raise HTTPException(status_code=404, detail="Pelanggan tidak ditemukan")
    now = utcnow()
    current = cust.get("expires_at")
    if isinstance(current, datetime) and current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    base = current if isinstance(current, datetime) and current > now else now
    new_expiry = base + timedelta(days=days)
    await db.users.update_one(
        {"_id": cust_oid},
        {"$set": {
            "expires_at": new_expiry,
            "tier": tier,
            "status": "active",
            "country": order.get("country", "") or cust.get("country", ""),
            "package_id": order.get("package_id", ""),
            "package_name": order.get("package_name", ""),
            "bandwidth_limit_mb": bw_mb,
            "bandwidth_used_mb": 0,
            "proxy_password": ensure_proxy_password(cust["username"], cust.get("proxy_password", "")),
        }},
    )
    await db.orders.update_one({"_id": oid}, {"$set": {"status": "confirmed", "confirmed_at": now}})
    await db.purchases.insert_one({
        "user_id": order["user_id"],
        "plan_id": order.get("package_id", ""),
        "plan_name": order.get("package_name", ""),
        "days": days,
        "price": order.get("price", 0),
        "price_label": order.get("price_label", ""),
        "expires_at": new_expiry,
        "ts": now,
    })
    await db.history.insert_one(HistoryDoc(
        user_id=order["user_id"],
        kind="connect",
        title=f"Paket aktif · {order.get('package_name','')}",
        subtitle=f"+{days} hari · {order.get('price_label','')}",
    ).to_mongo())
    fresh = await db.orders.find_one({"_id": oid})
    return order_out(fresh)


@api_router.post("/admin/orders/{order_id}/reject")
async def admin_reject_order(order_id: str, admin: Annotated[UserDoc, Depends(require_admin)]):
    try:
        oid = ObjectId(order_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    result = await db.orders.update_one({"_id": oid}, {"$set": {"status": "rejected"}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pesanan tidak ditemukan")
    fresh = await db.orders.find_one({"_id": oid})
    return order_out(fresh)


@api_router.get("/admin/packages")
async def admin_list_packages(admin: Annotated[UserDoc, Depends(require_admin)]):
    docs = await db.packages.find({}).to_list(100)
    docs.sort(key=lambda d: d.get("days", 0))
    return [{k: v for k, v in d.items() if k != "_id"} for d in docs]


@api_router.post("/admin/packages", status_code=201)
async def admin_create_package(body: PackageDoc, admin: Annotated[UserDoc, Depends(require_admin)]):
    pid = body.id.strip()
    if not pid:
        raise HTTPException(status_code=400, detail="ID paket wajib diisi")
    if await db.packages.find_one({"id": pid}):
        raise HTTPException(status_code=409, detail="ID paket sudah ada")
    data = body.model_dump()
    data["id"] = pid
    await db.packages.insert_one(data)
    return {k: v for k, v in data.items() if k != "_id"}


@api_router.patch("/admin/packages/{package_id}")
async def admin_update_package(package_id: str, body: PackageDoc, admin: Annotated[UserDoc, Depends(require_admin)]):
    existing = await db.packages.find_one({"id": package_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    data = body.model_dump()
    data["id"] = package_id
    await db.packages.update_one({"id": package_id}, {"$set": data})
    fresh = await db.packages.find_one({"id": package_id})
    return {k: v for k, v in fresh.items() if k != "_id"}


@api_router.delete("/admin/packages/{package_id}")
async def admin_delete_package(package_id: str, admin: Annotated[UserDoc, Depends(require_admin)]):
    result = await db.packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    return {"ok": True}


@api_router.get("/admin/settings")
async def admin_get_settings(admin: Annotated[UserDoc, Depends(require_admin)]):
    return await get_settings_doc()


@api_router.put("/admin/settings")
async def admin_update_settings(body: SettingsUpdateIn, admin: Annotated[UserDoc, Depends(require_admin)]):
    updates: dict = {}
    if body.payment_info is not None:
        updates["payment_info"] = body.payment_info.model_dump()
    if body.proxy_host is not None:
        updates["proxy_host"] = body.proxy_host.strip()
    if body.proxy_port is not None:
        updates["proxy_port"] = body.proxy_port
    if body.proxy_protocol is not None:
        updates["proxy_protocol"] = body.proxy_protocol.strip()
    if body.countries is not None:
        updates["countries"] = body.countries
    if body.upstream is not None:
        updates["upstream"] = body.upstream
    if updates:
        await db.settings.update_one({"_id": "app"}, {"$set": updates}, upsert=True)
    return await get_settings_doc()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
