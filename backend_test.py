#!/usr/bin/env python3
"""
Backend test for POST /api/hunt endpoint with NodeMaven integration (OPSI 2 - REAL IP mode).
Tests ONLY the hunt endpoint as requested, keeping counts small to conserve NodeMaven 2GB quota.
"""

import json
import subprocess
import sys
import time
import requests

# Backend URL - using localhost:8001 as specified in review request
BACKEND_URL = "http://localhost:8001"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials from test_credentials.md
ADMIN_USERNAME = "idmee"
ADMIN_PASSWORD = "riyanmee123"

# NodeMaven expected values
EXPECTED_GATEWAY_HOST = "gate.nodemaven.com"
EXPECTED_HTTP_PORT = 8080
EXPECTED_SOCKS_PORT = 1080
EXPECTED_PROTOCOL = "socks5"
EXPECTED_UPSTREAM = "nodemaven"
EXPECTED_PASSWORD = "ig1zt57cx1"

def log(msg):
    """Print timestamped log message."""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def test_login():
    """Test 1: Login as idmee to get access_token."""
    log("TEST 1: Login as admin (idmee)")
    
    response = requests.post(
        f"{API_BASE}/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        timeout=30
    )
    
    assert response.status_code == 200, f"Login failed with status {response.status_code}: {response.text}"
    
    data = response.json()
    assert "access_token" in data, "No access_token in login response"
    assert data.get("token_type") == "bearer", "Token type is not bearer"
    
    token = data["access_token"]
    log(f"✓ Login successful, got access_token (length: {len(token)})")
    
    return token

def test_hunt_basic(token):
    """Test 2: POST /api/hunt with target_ip=8.8.8.8, mode=ultimate, count=3."""
    log("TEST 2: POST /api/hunt with target_ip=8.8.8.8, mode=ultimate, count=3")
    
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "target_ip": "8.8.8.8",
        "mode": "ultimate",
        "count": 3
    }
    
    log("  Sending hunt request (may take up to 120s for real NodeMaven calls)...")
    start_time = time.time()
    
    response = requests.post(
        f"{API_BASE}/hunt",
        json=payload,
        headers=headers,
        timeout=120
    )
    
    elapsed = time.time() - start_time
    log(f"  Response received in {elapsed:.1f}s")
    
    assert response.status_code == 200, f"Hunt failed with status {response.status_code}: {response.text}"
    
    data = response.json()
    
    # Verify response structure
    assert "target" in data, "No 'target' in response"
    assert "count" in data, "No 'count' in response"
    assert "results" in data, "No 'results' in response"
    
    target = data["target"]
    count = data["count"]
    results = data["results"]
    
    log(f"  Target: {target.get('city', 'N/A')}, {target.get('country_code', 'N/A')}")
    log(f"  Count: {count} (requested 3, got {count})")
    
    # Verify we got at least 1 result (up to 3)
    assert count >= 1, f"Expected count >= 1, got {count}"
    assert len(results) >= 1, f"Expected at least 1 result, got {len(results)}"
    
    log(f"✓ Hunt successful, got {len(results)} results")
    
    # Verify each result has all required fields
    log("  Verifying result fields...")
    for i, result in enumerate(results):
        log(f"  Result {i+1}: {result.get('ip', 'N/A')}")
        
        # Required fields
        assert "ip" in result, f"Result {i+1} missing 'ip'"
        assert "gateway_host" in result, f"Result {i+1} missing 'gateway_host'"
        assert "http_port" in result, f"Result {i+1} missing 'http_port'"
        assert "socks_port" in result, f"Result {i+1} missing 'socks_port'"
        assert "protocol" in result, f"Result {i+1} missing 'protocol'"
        assert "upstream" in result, f"Result {i+1} missing 'upstream'"
        assert "username" in result, f"Result {i+1} missing 'username'"
        assert "password" in result, f"Result {i+1} missing 'password'"
        assert "session" in result, f"Result {i+1} missing 'session'"
        assert "country_code" in result, f"Result {i+1} missing 'country_code'"
        assert "city" in result, f"Result {i+1} missing 'city'"
        assert "isp" in result, f"Result {i+1} missing 'isp'"
        assert "latency_ms" in result, f"Result {i+1} missing 'latency_ms'"
        
        # Verify field values
        ip = result["ip"]
        assert ip and len(ip.split(".")) == 4, f"Result {i+1} has invalid IP: {ip}"
        
        assert result["gateway_host"] == EXPECTED_GATEWAY_HOST, \
            f"Result {i+1} gateway_host={result['gateway_host']}, expected {EXPECTED_GATEWAY_HOST}"
        
        assert result["http_port"] == EXPECTED_HTTP_PORT, \
            f"Result {i+1} http_port={result['http_port']}, expected {EXPECTED_HTTP_PORT}"
        
        assert result["socks_port"] == EXPECTED_SOCKS_PORT, \
            f"Result {i+1} socks_port={result['socks_port']}, expected {EXPECTED_SOCKS_PORT}"
        
        assert result["protocol"] == EXPECTED_PROTOCOL, \
            f"Result {i+1} protocol={result['protocol']}, expected {EXPECTED_PROTOCOL}"
        
        assert result["upstream"] == EXPECTED_UPSTREAM, \
            f"Result {i+1} upstream={result['upstream']}, expected {EXPECTED_UPSTREAM}"
        
        username = result["username"]
        assert username and len(username) > 0, f"Result {i+1} has empty username"
        assert username.startswith("riyanmeegacor19_gmail_com-country-"), \
            f"Result {i+1} username doesn't start with expected prefix: {username}"
        assert "-sid-" in username, f"Result {i+1} username missing '-sid-': {username}"
        
        password = result["password"]
        assert password == EXPECTED_PASSWORD, \
            f"Result {i+1} password={password}, expected {EXPECTED_PASSWORD}"
        
        session = result["session"]
        assert session and len(session) > 0, f"Result {i+1} has empty session"
        
        country_code = result["country_code"]
        assert country_code and len(country_code) > 0, f"Result {i+1} has empty country_code"
        
        city = result["city"]
        assert city and len(city) > 0, f"Result {i+1} has empty city"
        
        isp = result["isp"]
        assert isp and len(isp) > 0, f"Result {i+1} has empty isp"
        
        latency_ms = result["latency_ms"]
        assert isinstance(latency_ms, (int, float)) and latency_ms > 0, \
            f"Result {i+1} latency_ms={latency_ms} is not a positive number"
        
        # Note: octet_match will usually be 0 for residential IPs (NOT same /24 as target)
        # This is EXPECTED and correct for NodeMaven residential proxies
        octet_match = result.get("octet_match", 0)
        log(f"    IP: {ip}, Country: {country_code}, City: {city}")
        log(f"    Username: {username}")
        log(f"    Session: {session}, Latency: {latency_ms}ms, Octet match: {octet_match}")
    
    log("✓ All result fields verified")
    
    return results

def test_sticky_reproducibility(results):
    """Test 3: Verify sticky reproducibility - use first result's creds to connect through NodeMaven."""
    log("TEST 3: CRITICAL - Verify sticky reproducibility")
    
    if not results:
        log("  ⚠ No results to test, skipping")
        return
    
    first_result = results[0]
    username = first_result["username"]
    password = first_result["password"]
    expected_ip = first_result["ip"]
    gateway_host = first_result["gateway_host"]
    http_port = first_result["http_port"]
    
    log(f"  Testing first result: IP={expected_ip}")
    log(f"  Username: {username}")
    log(f"  Making request through NodeMaven proxy to verify exit IP...")
    
    # Use curl to make a request through the NodeMaven proxy
    proxy_url = f"http://{username}:{password}@{gateway_host}:{http_port}"
    
    try:
        # Use subprocess to run curl with the proxy
        cmd = [
            "curl", "-s", "--max-time", "40",
            "-x", proxy_url,
            "https://api.ipify.org?format=json"
        ]
        
        log(f"  Running: curl -s --max-time 40 -x 'http://{username}:***@{gateway_host}:{http_port}' https://api.ipify.org?format=json")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=45
        )
        
        if result.returncode != 0:
            log(f"  ✗ curl failed with return code {result.returncode}")
            log(f"  stderr: {result.stderr}")
            raise AssertionError(f"curl failed: {result.stderr}")
        
        output = result.stdout.strip()
        log(f"  curl output: {output}")
        
        # Parse JSON response
        try:
            ip_data = json.loads(output)
            actual_ip = ip_data.get("ip", "")
        except json.JSONDecodeError as e:
            log(f"  ✗ Failed to parse JSON: {e}")
            raise AssertionError(f"Failed to parse curl output as JSON: {output}")
        
        log(f"  Expected IP: {expected_ip}")
        log(f"  Actual IP:   {actual_ip}")
        
        if actual_ip == expected_ip:
            log(f"✓ STICKY REPRODUCIBILITY VERIFIED: Exit IP matches exactly!")
        else:
            log(f"✗ STICKY REPRODUCIBILITY FAILED: Exit IP does not match!")
            raise AssertionError(
                f"Sticky reproducibility failed: expected IP {expected_ip}, got {actual_ip}"
            )
    
    except subprocess.TimeoutExpired:
        log("  ✗ curl timed out after 45 seconds")
        raise AssertionError("curl timed out")
    except Exception as e:
        log(f"  ✗ Error during sticky reproducibility test: {e}")
        raise

def test_validation(token):
    """Test 4: Validation - invalid IP and empty target_ip should return 400."""
    log("TEST 4: Validation tests")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test 4a: Invalid IP
    log("  4a: Testing invalid IP 'not-an-ip'")
    response = requests.post(
        f"{API_BASE}/hunt",
        json={"target_ip": "not-an-ip", "mode": "ultimate", "count": 2},
        headers=headers,
        timeout=30
    )
    
    assert response.status_code == 400, \
        f"Expected 400 for invalid IP, got {response.status_code}: {response.text}"
    log("  ✓ Invalid IP correctly rejected with 400")
    
    # Test 4b: Empty target_ip
    log("  4b: Testing empty target_ip")
    response = requests.post(
        f"{API_BASE}/hunt",
        json={"mode": "ultimate", "count": 2},
        headers=headers,
        timeout=30
    )
    
    assert response.status_code == 400, \
        f"Expected 400 for empty target_ip, got {response.status_code}: {response.text}"
    log("  ✓ Empty target_ip correctly rejected with 400")
    
    log("✓ All validation tests passed")

def test_history(token):
    """Test 5: Verify history entry with kind=hunt is created."""
    log("TEST 5: Verify history entry created")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(
        f"{API_BASE}/history",
        headers=headers,
        timeout=30
    )
    
    assert response.status_code == 200, \
        f"Failed to get history with status {response.status_code}: {response.text}"
    
    history = response.json()
    assert isinstance(history, list), "History is not a list"
    
    # Find hunt entries
    hunt_entries = [h for h in history if h.get("kind") == "hunt"]
    
    assert len(hunt_entries) > 0, "No hunt entries found in history"
    
    log(f"  Found {len(hunt_entries)} hunt entries in history")
    log(f"  Latest hunt: {hunt_entries[0].get('title', 'N/A')}")
    
    log("✓ History entry verified")

def main():
    """Run all tests."""
    log("=" * 80)
    log("BACKEND TEST: POST /api/hunt with NodeMaven integration (OPSI 2 - REAL IP)")
    log("=" * 80)
    log("")
    log("NOTE: Using SMALL counts (3) to conserve NodeMaven 2GB quota")
    log("NOTE: Real upstream calls may take up to 120 seconds")
    log("")
    
    try:
        # Test 1: Login
        token = test_login()
        log("")
        
        # Test 2: Hunt with NodeMaven
        results = test_hunt_basic(token)
        log("")
        
        # Test 3: CRITICAL - Sticky reproducibility
        test_sticky_reproducibility(results)
        log("")
        
        # Test 4: Validation
        test_validation(token)
        log("")
        
        # Test 5: History
        test_history(token)
        log("")
        
        log("=" * 80)
        log("ALL TESTS PASSED ✓")
        log("=" * 80)
        log("")
        log("Summary:")
        log("  ✓ Login successful")
        log("  ✓ Hunt returns real NodeMaven IPs with correct fields")
        log("  ✓ STICKY REPRODUCIBILITY VERIFIED (exit IP matches)")
        log("  ✓ Validation working (invalid/empty IP rejected)")
        log("  ✓ History entry created")
        log("")
        log("NodeMaven integration (OPSI 2 - REAL IP mode) is WORKING CORRECTLY!")
        
        return 0
    
    except AssertionError as e:
        log("")
        log("=" * 80)
        log(f"TEST FAILED: {e}")
        log("=" * 80)
        return 1
    
    except Exception as e:
        log("")
        log("=" * 80)
        log(f"ERROR: {e}")
        log("=" * 80)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
