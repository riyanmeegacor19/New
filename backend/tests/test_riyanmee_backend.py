"""Backend regression tests for RIYANMEE PROXY (iteration 3).

Covers:
- Health root
- Auth: register (201, duplicate 409), login demo, /me protected (401 without token), change-password wrong current (400)
- Profile: whitelist add valid/invalid/duplicate, delete, reset-traffic, /my-ip
- Hunt: valid target for each mode returns 12 proxies + real geo; invalid IP -> 400; history recorded
- IP Info: valid IP returns geo; invalid -> 400; history recorded
- History: GET sorted desc, DELETE clears
"""

import os
import time

import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "http://localhost:8001"
).rstrip("/")
API = f"{BASE_URL}/api"

DEMO_USER = "idmee"
DEMO_PASS = "riyanmee123"


# ---------------- fixtures ----------------
@pytest.fixture(scope="session")
def demo_token() -> str:
    r = requests.post(f"{API}/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == DEMO_USER
    return body["access_token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token) -> dict:
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def new_user_creds() -> dict:
    ts = int(time.time())
    return {"username": f"test_regr_{ts}", "password": "secret123"}


# ---------------- health ----------------
def test_root_ok():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body.get("app") == "RIYANMEE PROXY"
    assert body.get("status") == "ok"


# ---------------- auth ----------------
def test_register_creates_free_member(new_user_creds):
    r = requests.post(f"{API}/auth/register", json=new_user_creds, timeout=15)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["user"]["username"] == new_user_creds["username"].lower()
    assert body["user"]["tier"] == "FREE MEMBER"
    assert "access_token" in body and len(body["access_token"]) > 20


def test_register_duplicate_conflict(new_user_creds):
    # Register a fresh user, then try same username again -> 409
    r = requests.post(f"{API}/auth/register", json=new_user_creds, timeout=15)
    assert r.status_code == 409, r.text


def test_login_demo_success():
    r = requests.post(f"{API}/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["tier"] == "PREMIUM MEMBER"
    assert body["user"]["total_pool"] == "480M+"
    assert isinstance(body["user"]["whitelist_ips"], list)


def test_login_wrong_password_401():
    r = requests.post(f"{API}/auth/login", json={"username": DEMO_USER, "password": "wrong-pass"}, timeout=15)
    assert r.status_code == 401


def test_me_without_token_401():
    r = requests.get(f"{API}/auth/me", timeout=15)
    assert r.status_code == 401


def test_me_with_token(demo_headers):
    r = requests.get(f"{API}/auth/me", headers=demo_headers, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == DEMO_USER
    assert body["server_host"]
    assert isinstance(body["server_port"], int)


def test_change_password_wrong_current_400(demo_headers):
    r = requests.post(
        f"{API}/auth/change-password",
        headers=demo_headers,
        json={"current_password": "wrong", "new_password": "newpass123"},
        timeout=15,
    )
    assert r.status_code == 400


# ---------------- profile / whitelist ----------------
def test_whitelist_invalid_ip_400(demo_headers):
    r = requests.post(f"{API}/profile/whitelist", headers=demo_headers, json={"ip": "not-an-ip"}, timeout=15)
    assert r.status_code == 400


def test_whitelist_add_and_remove(demo_headers):
    test_ip = "203.0.113.99"
    # cleanup first
    requests.delete(f"{API}/profile/whitelist/{test_ip}", headers=demo_headers, timeout=15)

    r = requests.post(f"{API}/profile/whitelist", headers=demo_headers, json={"ip": test_ip}, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert test_ip in body["whitelist_ips"]

    # duplicate -> 409
    d = requests.post(f"{API}/profile/whitelist", headers=demo_headers, json={"ip": test_ip}, timeout=15)
    assert d.status_code == 409

    # remove
    rm = requests.delete(f"{API}/profile/whitelist/{test_ip}", headers=demo_headers, timeout=15)
    assert rm.status_code == 200
    assert test_ip not in rm.json()["whitelist_ips"]


def test_reset_traffic_zeroes(demo_headers):
    r = requests.post(f"{API}/profile/reset-traffic", headers=demo_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["traffic_bytes"] == 0


def test_my_ip_returns_ip():
    r = requests.get(f"{API}/my-ip", timeout=15)
    # 200 with ip if internet available; 502 otherwise. Accept either.
    assert r.status_code in (200, 502)
    if r.status_code == 200:
        assert "ip" in r.json() and r.json()["ip"]


# ---------------- ip-info ----------------
def test_ip_info_valid(demo_headers):
    r = requests.post(f"{API}/tools/ip-info", headers=demo_headers, json={"ip": "8.8.8.8"}, timeout=25)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ip"] == "8.8.8.8"
    assert body["success"] is True
    assert body["country"]  # non-empty
    assert body["isp"]  # non-empty


def test_ip_info_invalid_400(demo_headers):
    r = requests.post(f"{API}/tools/ip-info", headers=demo_headers, json={"ip": "999.abc"}, timeout=15)
    assert r.status_code == 400


# ---------------- hunt ----------------
@pytest.mark.parametrize("mode", ["ultimate", "full", "city", "isp"])
def test_hunt_each_mode_returns_12(demo_headers, mode):
    r = requests.post(
        f"{API}/hunt",
        headers=demo_headers,
        json={"target_ip": "1.1.1.1", "mode": mode},
        timeout=25,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["mode"] == mode
    assert body["count"] == 12
    assert len(body["results"]) == 12
    first = body["results"][0]
    for key in ("ip", "port", "country", "city", "isp", "type", "latency_ms"):
        assert key in first
    assert body["target"]["success"] is True
    assert body["target"]["country"]  # e.g. Australia (Cloudflare)


def test_hunt_invalid_ip_400(demo_headers):
    r = requests.post(
        f"{API}/hunt",
        headers=demo_headers,
        json={"target_ip": "not-ip", "mode": "ultimate"},
        timeout=15,
    )
    assert r.status_code == 400


# ---------------- history ----------------
def test_history_records_and_clear(demo_headers):
    # do a hunt + ip-info first to generate entries
    requests.post(f"{API}/hunt", headers=demo_headers, json={"target_ip": "8.8.4.4", "mode": "full"}, timeout=25)
    requests.post(f"{API}/tools/ip-info", headers=demo_headers, json={"ip": "1.0.0.1"}, timeout=25)

    r = requests.get(f"{API}/history", headers=demo_headers, timeout=15)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    assert len(rows) >= 2
    # sorted desc: first ts >= last ts
    if len(rows) >= 2:
        assert rows[0]["ts"] >= rows[-1]["ts"]
    kinds = {row["kind"] for row in rows}
    assert kinds & {"hunt", "ipinfo"}

    # clear
    d = requests.delete(f"{API}/history", headers=demo_headers, timeout=15)
    assert d.status_code == 200
    assert d.json().get("ok") is True

    after = requests.get(f"{API}/history", headers=demo_headers, timeout=15).json()
    assert after == []


def test_history_requires_auth():
    r = requests.get(f"{API}/history", timeout=15)
    assert r.status_code == 401
