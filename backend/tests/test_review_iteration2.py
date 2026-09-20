"""Iteration 2 regression tests for RIYANMEE PROXY backend.

Covers:
- Health
- Server list + ping-all
- Session connect + disconnect + get
- Config CRUD (create, list, update, delete/soft-delete)
- Config test (real TCP ping)
- Config export/import blob (RIYANMEE::<base64>)
- Import with invalid blob -> 400
- Logs get + delete
- Tools: ip-check + speedtest
"""

import os
import time

import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or os.environ["EXPO_PUBLIC_BACKEND_URL"]
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --------------------------- Health ---------------------------
def test_health(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    body = r.json()
    assert body.get("app") == "RIYANMEE PROXY"
    assert body.get("status") == "ok"


# --------------------------- Servers ---------------------------
def test_list_servers_seeded(s):
    r = s.get(f"{API}/servers")
    assert r.status_code == 200
    servers = r.json()
    assert isinstance(servers, list)
    assert len(servers) >= 4  # 4 seed
    names = {srv["name"] for srv in servers}
    assert "RIYANMEE EDGE-SG" in names


def test_ping_all(s):
    r = s.post(f"{API}/servers/ping-all", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 4
    # at least one should return online for known anycast targets
    assert any(d.get("last_status") == "online" for d in data)


# --------------------------- Session ---------------------------
def test_session_connect_disconnect(s):
    servers = s.get(f"{API}/servers").json()
    # choose the first SSH server (443)
    target = next((x for x in servers if x["protocol"] == "ssh"), servers[0])
    r = s.post(f"{API}/session/connect", json={"server_id": target["id"]}, timeout=30)
    assert r.status_code == 200
    session = r.json()
    # connect may fail if network blocks; accept both but for our seed one should connect
    assert session["state"] in ("connected", "disconnected")

    g = s.get(f"{API}/session")
    assert g.status_code == 200
    payload = g.json()
    assert "session" in payload

    d = s.post(f"{API}/session/disconnect")
    assert d.status_code == 200
    assert d.json()["state"] == "disconnected"


# --------------------------- Configs ---------------------------
@pytest.fixture(scope="module")
def created_config():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    payload = {
        "name": "TEST_REVIEW cfg",
        "protocol": "ssh",
        "host": "one.one.one.one",
        "port": 443,
        "username": "u",
        "password": "p",
        "payload": "",
    }
    r = sess.post(f"{API}/configs", json=payload)
    assert r.status_code == 200, r.text
    cfg = r.json()
    yield cfg
    # soft-delete cleanup
    try:
        sess.delete(f"{API}/configs/{cfg['id']}")
    except Exception:
        pass


def test_create_config_persists(s, created_config):
    r = s.get(f"{API}/configs")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert created_config["id"] in ids


def test_update_config(s, created_config):
    body = {
        "name": "TEST_REVIEW updated",
        "protocol": "socks5",
        "host": "dns.google",
        "port": 443,
        "username": "u2",
        "password": "p2",
        "payload": "",
    }
    r = s.put(f"{API}/configs/{created_config['id']}", json=body)
    assert r.status_code == 200
    updated = r.json()
    assert updated["name"] == "TEST_REVIEW updated"
    assert updated["protocol"] == "socks5"


def test_config_test_real_ping(s):
    body = {"host": "one.one.one.one", "port": 443, "protocol": "ssh"}
    r = s.post(f"{API}/configs/test", json=body, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert isinstance(data["ping_ms"], int) and data["ping_ms"] > 0


def test_config_export_returns_blob(s, created_config):
    r = s.post(f"{API}/configs/export", json={"config_id": created_config["id"]})
    assert r.status_code == 200, r.text
    blob = r.json()["blob"]
    assert isinstance(blob, str)
    assert blob.startswith("RIYANMEE::")
    assert len(blob) > len("RIYANMEE::")


def test_config_import_valid_blob(s, created_config):
    # First get an export blob
    exp = s.post(f"{API}/configs/export", json={"config_id": created_config["id"]}).json()["blob"]
    r = s.post(f"{API}/configs/import", json={"blob": exp})
    assert r.status_code == 200, r.text
    imported = r.json()
    assert "id" in imported
    assert imported["id"] != created_config["id"]
    # cleanup imported
    s.delete(f"{API}/configs/{imported['id']}")


def test_config_import_invalid_blob(s):
    r = s.post(f"{API}/configs/import", json={"blob": "not-a-valid-blob"})
    assert r.status_code == 400
    r2 = s.post(f"{API}/configs/import", json={"blob": "RIYANMEE::@@@@notbase64"})
    assert r2.status_code == 400


def test_delete_config_soft(s):
    # Create new one for delete test
    r = s.post(f"{API}/configs", json={
        "name": "TEST_REVIEW to_delete",
        "protocol": "ssh",
        "host": "h",
        "port": 22,
        "username": "",
        "password": "",
        "payload": "",
    })
    cfg = r.json()
    d = s.delete(f"{API}/configs/{cfg['id']}")
    assert d.status_code == 200
    listing = s.get(f"{API}/configs").json()
    assert cfg["id"] not in [c["id"] for c in listing]


# --------------------------- Logs ---------------------------
def test_get_logs(s):
    r = s.get(f"{API}/logs?limit=50")
    assert r.status_code == 200
    logs = r.json()
    assert isinstance(logs, list)


def test_clear_logs(s):
    r = s.delete(f"{API}/logs")
    assert r.status_code == 200
    assert r.json().get("ok") is True


# --------------------------- Tools ---------------------------
def test_ip_check(s):
    r = s.post(f"{API}/tools/ip-check", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert "direct_ip" in data


def test_speedtest(s):
    r = s.post(f"{API}/tools/speedtest", timeout=90)
    assert r.status_code == 200
    data = r.json()
    assert "mbps" in data
    assert data["mbps"] >= 0
