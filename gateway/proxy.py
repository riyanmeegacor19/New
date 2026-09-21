#!/usr/bin/env python3
"""RIYANMEE PROXY — VPS gateway (IPRoyal residential upstream).

A lightweight async HTTP/HTTPS (CONNECT) + SOCKS5 forward proxy that runs on
YOUR VPS. It also exposes a small token-protected control API used by the
RIYANMEE backend to "hunt" real residential IPs.

Flow per client connection:
  1. Read the client's proxy request + Proxy-Authorization (Basic user:pass).
     The username MAY carry targeting suffixes, e.g.
        myuser-country-us-city-newyork-session-a1b2c3d4
     Base username (before the first marker) is used for platform auth.
  2. Ask the RIYANMEE backend whether that customer is active and (optionally)
     which exit country they are assigned  ->  POST {PLATFORM_AUTH_URL}.
  3. Chain the traffic upstream to IPRoyal residential with per-request
     country / city / sticky-session targeting.
  4. Count the bytes moved and report them back  ->  POST {PLATFORM_USAGE_URL}.

IPRoyal credentials NEVER leave this VPS. Targeting for IPRoyal is injected in
the PASSWORD field, e.g.  password_country-us_city-newyork_session-xx_lifetime-30m

Env vars (see .env.example):
  LISTEN_HOST, LISTEN_PORT, LISTEN_PORT_SOCKS, CONTROL_PORT
  PLATFORM_AUTH_URL, PLATFORM_USAGE_URL, PLATFORM_TOKEN
  UPSTREAM_HOST, UPSTREAM_PORT, IPROYAL_USERNAME, IPROYAL_PASSWORD, STICKY_LIFETIME
"""
import asyncio
import base64
import logging
import os
import secrets
import string
import time
from urllib.parse import urlsplit

import aiohttp
from aiohttp import web
from dotenv import load_dotenv

load_dotenv()

LISTEN_HOST = os.environ.get("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8080"))
LISTEN_PORT_SOCKS = int(os.environ.get("LISTEN_PORT_SOCKS", "1080"))  # 0 = disable SOCKS5
CONTROL_PORT = int(os.environ.get("CONTROL_PORT", "8090"))  # 0 = disable control API

PLATFORM_AUTH_URL = os.environ["PLATFORM_AUTH_URL"]
PLATFORM_USAGE_URL = os.environ["PLATFORM_USAGE_URL"]
PLATFORM_TOKEN = os.environ["PLATFORM_TOKEN"]

# Upstream provider (IPRoyal residential by default). Backwards-compatible with
# older BRD_* names if present.
UPSTREAM_HOST = os.environ.get("UPSTREAM_HOST", os.environ.get("BRD_HOST", "geo.iproyal.com"))
UPSTREAM_PORT = int(os.environ.get("UPSTREAM_PORT", os.environ.get("BRD_PORT", "12321")))
IPROYAL_USERNAME = os.environ.get("IPROYAL_USERNAME", "")
IPROYAL_PASSWORD = os.environ.get("IPROYAL_PASSWORD", "")
STICKY_LIFETIME = os.environ.get("STICKY_LIFETIME", "30m")

# Geo endpoint used by the /resolve control API to discover real exit IPs.
GEO_URL = os.environ.get("GEO_URL", "https://ipinfo.io/json")

MAX_CONNECTIONS = int(os.environ.get("MAX_CONNECTIONS", "500"))
AUTH_CACHE_TTL = int(os.environ.get("AUTH_CACHE_TTL", "30"))  # seconds
IO_TIMEOUT = int(os.environ.get("IO_TIMEOUT", "120"))  # idle seconds per pipe

logging.basicConfig(level=logging.INFO, format="%(asctime)s [gateway] %(levelname)s %(message)s")
log = logging.getLogger("gateway")

_sem = asyncio.Semaphore(MAX_CONNECTIONS)
_auth_cache: dict[str, tuple[float, dict]] = {}

# Targeting markers recognised inside a client username.
_MARKERS = ("-country-", "-state-", "-city-", "-session-")
_TARGET_KEYS = ("country", "state", "city", "session")


def _rand_session(n: int = 8) -> str:
    return "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(n))


def _parse_target_username(raw: str):
    """Split a client username into (base_username, targeting dict).

    Example: 'user-country-us-city-newyork-session-a1b2' ->
             ('user', {'country':'us','city':'newyork','session':'a1b2'})
    """
    raw = (raw or "").strip()
    low = raw.lower()
    positions = [low.find(m) for m in _MARKERS if low.find(m) != -1]
    if not positions:
        return low, {}
    cut = min(positions)
    base = low[:cut]
    rest = low[cut:].strip("-")
    tokens = rest.split("-") if rest else []
    params: dict[str, str] = {}
    i = 0
    while i < len(tokens) - 1:
        key = tokens[i]
        if key in _TARGET_KEYS:
            params[key] = tokens[i + 1]
            i += 2
        else:
            i += 1
    return base, params


def _parse_basic(header: str):
    if not header or not header.lower().startswith("basic "):
        return None
    try:
        raw = base64.b64decode(header[6:]).decode("utf-8")
        if ":" not in raw:
            return None
        user, pw = raw.split(":", 1)
        return user.strip(), pw
    except Exception:
        return None


async def _read_headers(reader: asyncio.StreamReader) -> bytes:
    data = await asyncio.wait_for(reader.readuntil(b"\r\n\r\n"), timeout=30)
    if len(data) > 65536:
        raise ValueError("headers too large")
    return data


def _parse_request(block: bytes):
    lines = block[:-4].split(b"\r\n")
    method, target, version = lines[0].decode("latin1").split(" ", 2)
    headers: dict[str, str] = {}
    for line in lines[1:]:
        if b":" in line:
            k, v = line.split(b":", 1)
            headers[k.decode("latin1").lower()] = v.strip().decode("latin1")
    return method, target, version, headers


async def _authorize(session: aiohttp.ClientSession, username: str, password: str):
    key = f"{username}:{password}"
    hit = _auth_cache.get(key)
    now = time.time()
    if hit and now - hit[0] < AUTH_CACHE_TTL:
        return hit[1]
    try:
        async with session.post(
            PLATFORM_AUTH_URL,
            json={"username": username, "password": password},
            headers={"Authorization": f"Bearer {PLATFORM_TOKEN}"},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as resp:
            if resp.status != 200:
                return None
            data = await resp.json()
    except Exception as exc:
        log.warning("authorize failed: %s", exc)
        return None
    if not data.get("active"):
        _auth_cache[key] = (now, {"active": False})
        return {"active": False, "reason": data.get("reason", "inactive")}
    _auth_cache[key] = (now, data)
    return data


def _upstream_credentials(country: str = "", city: str = "", session: str = "") -> tuple[str, str]:
    """Build (username, password) for IPRoyal with targeting in the password."""
    user = IPROYAL_USERNAME
    pw = IPROYAL_PASSWORD
    cc = (country or "").strip().lower()
    if len(cc) == 2 and cc.isalpha():
        pw += f"_country-{cc}"
        ct = (city or "").strip().lower().replace(" ", "")
        if ct:
            pw += f"_city-{ct}"
    s = (session or "").strip()
    if s:
        pw += f"_session-{s}_lifetime-{STICKY_LIFETIME}"
    return user, pw


async def _open_upstream(target: str, country: str = "", city: str = "", session: str = ""):
    """Open a CONNECT tunnel through the upstream (IPRoyal) to `target`."""
    reader, writer = await asyncio.open_connection(UPSTREAM_HOST, UPSTREAM_PORT)
    u, pw = _upstream_credentials(country, city, session)
    cred = base64.b64encode(f"{u}:{pw}".encode()).decode()
    writer.write(
        f"CONNECT {target} HTTP/1.1\r\nHost: {target}\r\n"
        f"Proxy-Authorization: Basic {cred}\r\n\r\n".encode()
    )
    await writer.drain()
    head = await _read_headers(reader)
    status_line = head.split(b"\r\n", 1)[0]
    if b" 200 " not in status_line:
        writer.close()
        raise ConnectionError(f"upstream CONNECT failed: {status_line!r}")
    return reader, writer


async def _pipe(src: asyncio.StreamReader, dst: asyncio.StreamWriter) -> int:
    moved = 0
    try:
        while True:
            chunk = await asyncio.wait_for(src.read(65536), timeout=IO_TIMEOUT)
            if not chunk:
                break
            dst.write(chunk)
            await dst.drain()
            moved += len(chunk)
    except Exception:
        pass
    finally:
        try:
            dst.write_eof()
        except Exception:
            pass
    return moved


async def _report_usage(session: aiohttp.ClientSession, username: str, up: int, down: int):
    if up + down <= 0:
        return
    try:
        await session.post(
            PLATFORM_USAGE_URL,
            json={"username": username, "bytes_up": up, "bytes_down": down},
            headers={"Authorization": f"Bearer {PLATFORM_TOKEN}"},
            timeout=aiohttp.ClientTimeout(total=5),
        )
    except Exception as exc:
        log.warning("usage report failed for %s: %s", username, exc)


def _deny(writer: asyncio.StreamWriter, code: str = "407 Proxy Authentication Required"):
    extra = "Proxy-Authenticate: Basic realm=\"riyanmee\"\r\n" if code.startswith("407") else ""
    writer.write(f"HTTP/1.1 {code}\r\n{extra}Connection: close\r\n\r\n".encode())


async def handle(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    up = down = 0
    base_user = None
    async with _sem:
        async with aiohttp.ClientSession() as session:
            try:
                method, target, version, headers = _parse_request(await _read_headers(reader))
                cred = _parse_basic(headers.get("proxy-authorization", ""))
                if not cred:
                    _deny(writer)
                    await writer.drain()
                    return
                raw_user, password = cred
                base_user, tgt = _parse_target_username(raw_user)
                auth = await _authorize(session, base_user, password)
                if not auth or not auth.get("active"):
                    _deny(writer)
                    await writer.drain()
                    return
                country = tgt.get("country") or auth.get("country", "")
                city = tgt.get("city", "")
                sess = tgt.get("session", "")

                if method.upper() == "CONNECT":
                    if ":" not in target:
                        raise ValueError("bad CONNECT target")
                    u_reader, u_writer = await _open_upstream(target, country, city, sess)
                    writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                    await writer.drain()
                    up, down = await asyncio.gather(_pipe(reader, u_writer), _pipe(u_reader, writer))
                    u_writer.close()
                else:
                    parts = urlsplit(target)
                    if parts.scheme not in ("http", "https") or not parts.hostname:
                        raise ValueError("bad absolute URL")
                    port = parts.port or (443 if parts.scheme == "https" else 80)
                    u_reader, u_writer = await _open_upstream(f"{parts.hostname}:{port}", country, city, sess)
                    path = parts.path or "/"
                    if parts.query:
                        path += f"?{parts.query}"
                    fwd = [f"{method} {path} {version}"]
                    for k, v in headers.items():
                        if k in ("proxy-authorization", "proxy-connection"):
                            continue
                        fwd.append(f"{k}: {v}")
                    u_writer.write(("\r\n".join(fwd) + "\r\n\r\n").encode())
                    await u_writer.drain()
                    up, down = await asyncio.gather(_pipe(reader, u_writer), _pipe(u_reader, writer))
                    u_writer.close()
            except Exception as exc:
                log.info("connection error: %s", exc)
                try:
                    writer.write(b"HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n")
                    await writer.drain()
                except Exception:
                    pass
            finally:
                if base_user:
                    await _report_usage(session, base_user, up, down)
                try:
                    writer.close()
                except Exception:
                    pass


async def _socks_send(writer, data: bytes):
    writer.write(data)
    await writer.drain()


async def handle_socks5(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
    """Minimal SOCKS5 (RFC 1928) with username/password auth (RFC 1929), CONNECT only."""
    up = down = 0
    base_user = None
    async with _sem:
        async with aiohttp.ClientSession() as session:
            try:
                ver, nmethods = await asyncio.wait_for(reader.readexactly(2), timeout=30)
                if ver != 0x05:
                    return
                await reader.readexactly(nmethods)
                await _socks_send(writer, bytes([0x05, 0x02]))
                auth_ver = (await reader.readexactly(1))[0]
                if auth_ver != 0x01:
                    await _socks_send(writer, bytes([0x01, 0x01]))
                    return
                ulen = (await reader.readexactly(1))[0]
                uname = (await reader.readexactly(ulen)).decode("utf-8", "ignore")
                plen = (await reader.readexactly(1))[0]
                passwd = (await reader.readexactly(plen)).decode("utf-8", "ignore")
                base_user, tgt = _parse_target_username(uname)
                auth = await _authorize(session, base_user, passwd)
                if not auth or not auth.get("active"):
                    await _socks_send(writer, bytes([0x01, 0x01]))
                    return
                await _socks_send(writer, bytes([0x01, 0x00]))
                country = tgt.get("country") or auth.get("country", "")
                city = tgt.get("city", "")
                sess = tgt.get("session", "")
                ver, cmd, _rsv, atyp = await asyncio.wait_for(reader.readexactly(4), timeout=30)
                if ver != 0x05:
                    return
                if atyp == 0x01:
                    host = ".".join(str(b) for b in await reader.readexactly(4))
                elif atyp == 0x03:
                    dlen = (await reader.readexactly(1))[0]
                    host = (await reader.readexactly(dlen)).decode("utf-8", "ignore")
                elif atyp == 0x04:
                    raw = await reader.readexactly(16)
                    host = ":".join(raw[i:i + 2].hex() for i in range(0, 16, 2))
                else:
                    await _socks_send(writer, bytes([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
                    return
                port = int.from_bytes(await reader.readexactly(2), "big")
                if cmd != 0x01:
                    await _socks_send(writer, bytes([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
                    return
                target = f"[{host}]:{port}" if atyp == 0x04 else f"{host}:{port}"
                try:
                    u_reader, u_writer = await _open_upstream(target, country, city, sess)
                except Exception:
                    await _socks_send(writer, bytes([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
                    return
                await _socks_send(writer, bytes([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]))
                up, down = await asyncio.gather(_pipe(reader, u_writer), _pipe(u_reader, writer))
                u_writer.close()
            except Exception as exc:
                log.info("socks5 error: %s", exc)
            finally:
                if base_user:
                    await _report_usage(session, base_user, up, down)
                try:
                    writer.close()
                except Exception:
                    pass


# ---------------------------------------------------------------------------
# Control API (token-protected) — used by the RIYANMEE backend for "hunting".
# ---------------------------------------------------------------------------
async def _resolve_one(country: str, city: str, session: str) -> dict | None:
    """Discover the real exit IP for one IPRoyal sticky session."""
    proxy = f"http://{UPSTREAM_HOST}:{UPSTREAM_PORT}"
    u, pw = _upstream_credentials(country, city, session)
    auth = aiohttp.BasicAuth(u, pw)
    try:
        async with aiohttp.ClientSession() as s:
            t0 = time.time()
            async with s.get(GEO_URL, proxy=proxy, proxy_auth=auth,
                             timeout=aiohttp.ClientTimeout(total=25)) as r:
                if r.status != 200:
                    return None
                d = await r.json(content_type=None)
            latency = int((time.time() - t0) * 1000)
    except Exception as exc:
        log.info("resolve session %s failed: %s", session, exc)
        return None
    ip = d.get("ip") or d.get("query") or ""
    if not ip:
        return None
    return {
        "ip": ip,
        "country_code": (d.get("country") or d.get("countryCode") or "").upper(),
        "city": d.get("city", ""),
        "region": d.get("region", ""),
        "org": d.get("org") or d.get("isp") or d.get("asn", ""),
        "session": session,
        "latency_ms": latency,
    }


async def _handle_resolve(request: web.Request):
    if request.headers.get("Authorization", "") != f"Bearer {PLATFORM_TOKEN}":
        return web.json_response({"error": "unauthorized"}, status=401)
    try:
        body = await request.json()
    except Exception:
        body = {}
    country = (body.get("country") or "").strip().lower()
    city = (body.get("city") or "").strip().lower()
    count = max(1, min(int(body.get("count") or 10), 30))
    sessions = [_rand_session() for _ in range(count)]
    results = await asyncio.gather(*[_resolve_one(country, city, s) for s in sessions],
                                   return_exceptions=True)
    seen = set()
    out = []
    for r in results:
        if isinstance(r, dict) and r.get("ip") and r["ip"] not in seen:
            seen.add(r["ip"])
            out.append(r)
    return web.json_response({"count": len(out), "country": country, "city": city, "results": out})


async def _handle_health(request: web.Request):
    return web.json_response({
        "ok": True,
        "upstream": f"{UPSTREAM_HOST}:{UPSTREAM_PORT}",
        "provider": "iproyal",
    })


async def _start_control_api():
    if not CONTROL_PORT:
        return
    app = web.Application()
    app.router.add_post("/resolve", _handle_resolve)
    app.router.add_get("/health", _handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, LISTEN_HOST, CONTROL_PORT)
    await site.start()
    log.info("Control API listening on %s:%s", LISTEN_HOST, CONTROL_PORT)


async def main():
    servers = []
    http_server = await asyncio.start_server(handle, LISTEN_HOST, LISTEN_PORT)
    servers.append(http_server)
    log.info("HTTP/HTTPS proxy listening on %s:%s", LISTEN_HOST, LISTEN_PORT)
    if LISTEN_PORT_SOCKS:
        socks_server = await asyncio.start_server(handle_socks5, LISTEN_HOST, LISTEN_PORT_SOCKS)
        servers.append(socks_server)
        log.info("SOCKS5 proxy listening on %s:%s", LISTEN_HOST, LISTEN_PORT_SOCKS)
    await _start_control_api()
    log.info("Upstream -> %s:%s (IPRoyal)", UPSTREAM_HOST, UPSTREAM_PORT)
    await asyncio.gather(*(s.serve_forever() for s in servers))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
