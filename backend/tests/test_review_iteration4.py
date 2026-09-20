"""Iteration 4 regression tests for RIYANMEE PROXY.

Covers new features:
- MY PROXIES CRUD + validation + soft delete
- Owned proxy prioritization in /api/hunt
- SUBSCRIPTION plans + activation + invalid plan
- Auth-guard on protected endpoints (401 without token)
- Regression: login demo, hunt, ip-info, history, logout no-op safe
"""

import os
import time

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_BACKEND_URL") or os.environ["EXPO_PUBLIC_BACKEND_URL"]).rstrip("/")
API = f"{BASE_URL}/api"

DEMO_USER = "idmee"
DEMO_PASS = "riyanmee123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"username": DEMO_USER, "password": DEMO_PASS}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth(token):
    return {"Authorization": f"Bearer {token}"}


# --------------------------- Auth guard ---------------------------
def test_proxies_requires_auth():
    r = requests.get(f"{API}/proxies", timeout=10)
    assert r.status_code == 401


def test_activate_requires_auth():
    r = requests.post(f"{API}/subscription/activate", json={"plan_id": "basic30"}, timeout=10)
    assert r.status_code == 401


# --------------------------- Plans ---------------------------
def test_get_plans_public():
    r = requests.get(f"{API}/plans", timeout=10)
    assert r.status_code == 200
    plans = r.json()
    assert isinstance(plans, list)
    ids = [p["id"] for p in plans]
    for pid in ("trial7", "basic30", "pro90", "ultimate365"):
        assert pid in ids, f"missing plan {pid}"
    # sanity fields
    p0 = next(p for p in plans if p["id"] == "basic30")
    assert p0["days"] == 30
    assert p0["tier"] == "PREMIUM MEMBER"


# --------------------------- Subscription activate ---------------------------
def test_activate_invalid_plan_404(auth):
    r = requests.post(f"{API}/subscription/activate", json={"plan_id": "nope-plan"}, headers=auth, timeout=10)
    assert r.status_code == 404


def test_activate_pro90_extends_expiry(auth):
    me_before = requests.get(f"{API}/auth/me", headers=auth, timeout=10).json()
    r = requests.post(f"{API}/subscription/activate", json={"plan_id": "pro90"}, headers=auth, timeout=15)
    assert r.status_code == 200, r.text
    me_after = r.json()
    assert me_after["tier"] == "PREMIUM MEMBER"
    # expires_at moved forward by ~90 days
    from datetime import datetime
    def _p(iso: str):
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    delta_days = (_p(me_after["expires_at"]) - _p(me_before["expires_at"])).days
    assert 89 <= delta_days <= 91, f"expected +~90 days, got {delta_days}"

    # history has entry
    hist = requests.get(f"{API}/history", headers=auth, timeout=10).json()
    assert any("Aktivasi paket" in h.get("title", "") for h in hist)


# --------------------------- My Proxies CRUD ---------------------------
@pytest.fixture()
def clean_proxies(auth):
    # cleanup any prior TEST_ proxies
    existing = requests.get(f"{API}/proxies", headers=auth, timeout=10).json()
    for p in existing:
        if p["label"].startswith("TEST_"):
            requests.delete(f"{API}/proxies/{p['id']}", headers=auth, timeout=10)
    yield
    existing = requests.get(f"{API}/proxies", headers=auth, timeout=10).json()
    for p in existing:
        if p["label"].startswith("TEST_"):
            requests.delete(f"{API}/proxies/{p['id']}", headers=auth, timeout=10)


def test_create_proxy_invalid_port(auth, clean_proxies):
    r = requests.post(f"{API}/proxies", json={"label": "TEST_p", "host": "1.2.3.4", "port": 0, "protocol": "socks5"}, headers=auth, timeout=10)
    assert r.status_code == 400
    r2 = requests.post(f"{API}/proxies", json={"label": "TEST_p", "host": "1.2.3.4", "port": 70000, "protocol": "socks5"}, headers=auth, timeout=10)
    assert r2.status_code == 400


def test_create_proxy_missing_label_or_host(auth, clean_proxies):
    r = requests.post(f"{API}/proxies", json={"label": "  ", "host": "1.2.3.4", "port": 1080}, headers=auth, timeout=10)
    assert r.status_code == 400
    r2 = requests.post(f"{API}/proxies", json={"label": "TEST_x", "host": "", "port": 1080}, headers=auth, timeout=10)
    assert r2.status_code == 400


def test_create_and_list_and_soft_delete(auth, clean_proxies):
    payload = {"label": "TEST_proxy_A", "host": "1.2.3.4", "port": 1080, "protocol": "socks5", "username": "u", "password": "p"}
    r = requests.post(f"{API}/proxies", json=payload, headers=auth, timeout=10)
    assert r.status_code == 200, r.text
    created = r.json()
    assert created["label"] == "TEST_proxy_A"
    assert created["host"] == "1.2.3.4"
    assert created["port"] == 1080
    assert created["protocol"] == "socks5"
    pid = created["id"]

    # list contains it
    lst = requests.get(f"{API}/proxies", headers=auth, timeout=10).json()
    assert any(p["id"] == pid for p in lst)

    # soft delete
    d = requests.delete(f"{API}/proxies/{pid}", headers=auth, timeout=10)
    assert d.status_code == 200

    # gone from list
    lst2 = requests.get(f"{API}/proxies", headers=auth, timeout=10).json()
    assert not any(p["id"] == pid for p in lst2)

    # delete a bogus id -> 404
    d2 = requests.delete(f"{API}/proxies/507f1f77bcf86cd799439011", headers=auth, timeout=10)
    assert d2.status_code == 404


# --------------------------- Hunt prioritization ---------------------------
def test_hunt_prioritizes_owned_proxy(auth, clean_proxies):
    payload = {"label": "TEST_prio", "host": "9.9.9.9", "port": 4321, "protocol": "socks5"}
    c = requests.post(f"{API}/proxies", json=payload, headers=auth, timeout=10)
    assert c.status_code == 200

    r = requests.post(f"{API}/hunt", json={"target_ip": "8.8.8.8", "mode": "ultimate"}, headers=auth, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["count"] >= 13  # 12 generated + at least 1 owned
    # Owned proxies come first
    first = body["results"][0]
    assert first.get("owned") is True
    # All owned entries must appear before the first non-owned entry
    seen_non_owned = False
    for item in body["results"]:
        if item.get("owned"):
            assert not seen_non_owned, "owned entry appeared after non-owned"
        else:
            seen_non_owned = True
    # Our new proxy must be present with correct fields
    ours = [i for i in body["results"] if i.get("owned") and i["ip"] == "9.9.9.9" and i["port"] == 4321]
    assert len(ours) == 1
    assert ours[0]["type"] == "SOCKS5"


# --------------------------- Regression sanity ---------------------------
def test_regression_hunt_and_ipinfo(auth):
    r = requests.post(f"{API}/hunt", json={"target_ip": "8.8.8.8", "mode": "full"}, headers=auth, timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body["mode_label"] == "FULL SCAN"

    r2 = requests.post(f"{API}/tools/ip-info", json={"ip": "1.1.1.1"}, headers=auth, timeout=15)
    assert r2.status_code == 200
    data = r2.json()
    assert data["country_code"] in ("AU", "US")  # cloudflare anycast
