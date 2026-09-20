#!/usr/bin/env python3
"""RIYANMEE PROXY — VPS gateway.

A lightweight async HTTP/HTTPS (CONNECT) forward proxy that runs on YOUR VPS.

Flow per connection:
  1. Read the client's proxy request + Proxy-Authorization (Basic user:pass).
  2. Ask the RIYANMEE backend whether that customer is active and which exit
     country they are assigned  ->  POST {PLATFORM_AUTH_URL}.
  3. Build the customer's Bright Data username and chain the traffic upstream
     to brd.superproxy.io with per-customer country targeting.
  4. Count the bytes moved and report them back  ->  POST {PLATFORM_USAGE_URL}.

Bright Data credentials NEVER leave this VPS. The backend only ever returns
{active, country} for a customer.

Env vars (see .env.example):
  LISTEN_HOST, LISTEN_PORT
  PLATFORM_AUTH_URL, PLATFORM_USAGE_URL, PLATFORM_TOKEN
  BRD_HOST, BRD_PORT, BRD_CUSTOMER_ID, BRD_ZONE, BRD_ZONE_PASSWORD
"""
import asyncio
import base64
import logging
import os
import time
from urllib.parse import urlsplit

import aiohttp
from dotenv import load_dotenv

load_dotenv()

LISTEN_HOST = os.environ.get("LISTEN_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("LISTEN_PORT", "8080"))

PLATFORM_AUTH_URL = os.environ["PLATFORM_AUTH_URL"]
PLATFORM_USAGE_URL = os.environ["PLATFORM_USAGE_URL"]
PLATFORM_TOKEN = os.environ["PLATFORM_TOKEN"]

BRD_HOST = os.environ.get("BRD_HOST", "brd.superproxy.io")
BRD_PORT = int(os.environ.get("BRD_PORT", "44445"))
BRD_CUSTOMER_ID = os.environ["BRD_CUSTOMER_ID"]
BRD_ZONE = os.environ["BRD_ZONE"]
BRD_ZONE_PASSWORD = os.environ["BRD_ZONE_PASSWORD"]

MAX_CONNECTIONS = int(os.environ.get("MAX_CONNECTIONS", "500"))
AUTH_CACHE_TTL = int(os.environ.get("AUTH_CACHE_TTL", "30"))  # seconds
IO_TIMEOUT = int(os.environ.get("IO_TIMEOUT", "120"))  # idle seconds per pipe

logging.basicConfig(level=logging.INFO, format="%(asctime)s [gateway] %(levelname)s %(message)s")
log = logging.getLogger("gateway")

_sem = asyncio.Semaphore(MAX_CONNECTIONS)
_auth_cache: dict[str, tuple[float, dict]] = {}


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
        _auth_cache[key] = (now, None) if False else (now, {"active": False})
        return {"active": False, "reason": data.get("reason", "inactive")}
    _auth_cache[key] = (now, data)
    return data


def _brd_username(country: str) -> str:
    base = f"brd-customer-{BRD_CUSTOMER_ID}-zone-{BRD_ZONE}"
    cc = (country or "").strip().lower()
    if len(cc) == 2 and cc.isalpha():
        base += f"-country-{cc}"
    return base


async def _open_upstream(target: str, country: str):
    """Open a CONNECT tunnel through Bright Data to `target` (host:port)."""
    reader, writer = await asyncio.open_connection(BRD_HOST, BRD_PORT)
    cred = base64.b64encode(f"{_brd_username(country)}:{BRD_ZONE_PASSWORD}".encode()).decode()
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
    username = None
    async with _sem:
        async with aiohttp.ClientSession() as session:
            try:
                method, target, version, headers = _parse_request(await _read_headers(reader))
                cred = _parse_basic(headers.get("proxy-authorization", ""))
                if not cred:
                    _deny(writer)
                    await writer.drain()
                    return
                username, password = cred
                username = username.strip().lower()
                auth = await _authorize(session, username, password)
                if not auth or not auth.get("active"):
                    _deny(writer)
                    await writer.drain()
                    return
                country = auth.get("country", "")

                if method.upper() == "CONNECT":
                    if ":" not in target:
                        raise ValueError("bad CONNECT target")
                    u_reader, u_writer = await _open_upstream(target, country)
                    writer.write(b"HTTP/1.1 200 Connection Established\r\n\r\n")
                    await writer.drain()
                    up, down = await asyncio.gather(_pipe(reader, u_writer), _pipe(u_reader, writer))
                    u_writer.close()
                else:
                    parts = urlsplit(target)
                    if parts.scheme not in ("http", "https") or not parts.hostname:
                        raise ValueError("bad absolute URL")
                    port = parts.port or (443 if parts.scheme == "https" else 80)
                    u_reader, u_writer = await _open_upstream(f"{parts.hostname}:{port}", country)
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
                if username:
                    await _report_usage(session, username, up, down)
                try:
                    writer.close()
                except Exception:
                    pass


async def main():
    server = await asyncio.start_server(handle, LISTEN_HOST, LISTEN_PORT)
    log.info("RIYANMEE gateway listening on %s:%s -> %s:%s", LISTEN_HOST, LISTEN_PORT, BRD_HOST, BRD_PORT)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
