import os
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")


def test_core_review_flows():
    s = requests.Session()
    root = s.get(f"{BASE}/api/")
    assert root.status_code == 200 and root.json() == {"app": "RIYANMEE PROXY", "status": "ok"}
    servers = s.get(f"{BASE}/api/servers")
    assert servers.status_code == 200
    data = servers.json()
    assert {x["name"] for x in data} >= {"RIYANMEE EDGE-SG", "RIYANMEE SSH-GLOBAL", "RIYANMEE CORE-US", "RIYANMEE CORE-EU"}
    assert all("last_ping_ms" in x and "last_status" in x for x in data)
    bad = s.post(f"{BASE}/api/servers", json={"name": "TEST_BAD", "host": "example.com", "port": 443, "protocol": "invalid"})
    assert bad.status_code == 400
    created = s.post(f"{BASE}/api/configs", json={"name": "TEST_REVIEW", "protocol": "ssh", "host": "ssh.github.com", "port": 443})
    assert created.status_code == 200
    cid = created.json()["id"]
    exported = s.post(f"{BASE}/api/configs/export", json={"config_id": cid})
    assert exported.status_code == 200 and exported.json()["blob"].startswith("RIYANMEE::")
    imported = s.post(f"{BASE}/api/configs/import", json={"blob": exported.json()["blob"]})
    assert imported.status_code == 200 and imported.json()["name"] == "TEST_REVIEW"
    assert s.post(f"{BASE}/api/configs/import", json={"blob": "bad"}).status_code == 400
    s.delete(f"{BASE}/api/configs/{cid}")
    s.delete(f"{BASE}/api/configs/{imported.json()['id']}")


def test_session_invalid_id_and_logs():
    s = requests.Session()
    assert s.post(f"{BASE}/api/session/connect", json={"server_id": "000000000000000000000000"}).status_code == 404
    logs = s.get(f"{BASE}/api/logs")
    assert logs.status_code == 200 and isinstance(logs.json(), list)