#!/usr/bin/env python3
"""
Backend test for POST /api/hunt endpoint (IPRoyal residential proxy hunting).
Tests the newly rewritten hunt endpoint that calls the VPS gateway control API.
"""
import requests
import time
import json

# Backend URL from frontend/.env
BACKEND_URL = "https://github-branch-main.preview.emergentagent.com/api"

# Admin credentials from test_credentials.md
ADMIN_USERNAME = "idmee"
ADMIN_PASSWORD = "riyanmee123"

# Test configuration
TIMEOUT = 90  # Generous timeout for real upstream calls


def print_section(title):
    """Print a section header."""
    print(f"\n{'='*80}")
    print(f"  {title}")
    print(f"{'='*80}\n")


def print_result(test_name, passed, details=""):
    """Print test result."""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"    {details}")


def login_admin():
    """Login as admin and return access token."""
    print_section("SETUP: Admin Login")
    
    url = f"{BACKEND_URL}/auth/login"
    payload = {"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    
    try:
        resp = requests.post(url, json=payload, timeout=10)
        print(f"POST {url}")
        print(f"Status: {resp.status_code}")
        
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            user = data.get("user", {})
            role = user.get("role")
            
            print(f"✅ Login successful")
            print(f"   Username: {user.get('username')}")
            print(f"   Role: {role}")
            
            if role != "admin":
                print(f"❌ ERROR: Expected role=admin, got role={role}")
                return None
            
            return token
        else:
            print(f"❌ Login failed: {resp.status_code}")
            print(f"   Response: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Login error: {e}")
        return None


def test_hunt_us_ultimate(token):
    """Test 1: Hunt US proxies with ultimate mode."""
    print_section("TEST 1: Hunt US Proxies (ultimate mode, count=5)")
    
    url = f"{BACKEND_URL}/hunt"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"country": "us", "mode": "ultimate", "count": 5}
    
    try:
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Calling VPS gateway (may take 5-30 seconds)...")
        
        start = time.time()
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        print(f"Status: {resp.status_code} (took {elapsed:.1f}s)")
        
        if resp.status_code != 200:
            print_result("HTTP 200 response", False, f"Got {resp.status_code}: {resp.text[:200]}")
            return False
        
        print_result("HTTP 200 response", True)
        
        data = resp.json()
        print(f"\nResponse structure:")
        print(f"  - target: {type(data.get('target'))}")
        print(f"  - mode: {data.get('mode')}")
        print(f"  - mode_label: {data.get('mode_label')}")
        print(f"  - count: {data.get('count')}")
        print(f"  - results: {len(data.get('results', []))} items")
        
        # Verify response structure
        required_fields = ["target", "mode", "mode_label", "count", "results"]
        for field in required_fields:
            if field not in data:
                print_result(f"Response has '{field}' field", False, f"Missing field")
                return False
        print_result("Response has all required fields", True)
        
        # Verify count >= 1
        count = data.get("count", 0)
        if count < 1:
            print_result("count >= 1", False, f"Got count={count}")
            return False
        print_result("count >= 1", True, f"Got {count} results")
        
        # Verify each result
        results = data.get("results", [])
        if not results:
            print_result("Results array not empty", False)
            return False
        
        print(f"\nVerifying {len(results)} results:")
        all_valid = True
        
        for i, item in enumerate(results):
            issues = []
            
            # Check ip (non-empty string, real IPv4)
            ip = item.get("ip", "")
            if not ip or not isinstance(ip, str):
                issues.append("ip is empty or not string")
            elif not all(part.isdigit() and 0 <= int(part) <= 255 for part in ip.split(".")) or len(ip.split(".")) != 4:
                issues.append(f"ip '{ip}' is not valid IPv4")
            
            # Check port > 0
            port = item.get("port", 0)
            if not isinstance(port, int) or port <= 0:
                issues.append(f"port={port} is not > 0")
            
            # Check gateway_host
            gateway_host = item.get("gateway_host", "")
            if gateway_host != "155.138.227.248":
                issues.append(f"gateway_host='{gateway_host}' != '155.138.227.248'")
            
            # Check type
            item_type = item.get("type", "")
            if item_type != "Residential":
                issues.append(f"type='{item_type}' != 'Residential'")
            
            # Check country_code
            country_code = item.get("country_code", "")
            if country_code.upper() != "US":
                issues.append(f"country_code='{country_code}' != 'US'")
            
            # Check username pattern: idmee-country-us-session-<something>
            username = item.get("username", "")
            if not username.startswith("idmee-country-us-session-"):
                issues.append(f"username '{username}' doesn't match pattern 'idmee-country-us-session-<token>'")
            
            # Check password (non-empty, starts with rmx-)
            password = item.get("password", "")
            if not password or not password.startswith("rmx-"):
                issues.append(f"password '{password}' is empty or doesn't start with 'rmx-'")
            
            # Check session (non-empty)
            session = item.get("session", "")
            if not session:
                issues.append("session is empty")
            
            if issues:
                print(f"  Result {i+1}: ❌ FAIL")
                for issue in issues:
                    print(f"    - {issue}")
                all_valid = False
            else:
                print(f"  Result {i+1}: ✅ PASS (ip={ip}, port={port}, session={session[:8]}...)")
        
        if not all_valid:
            print_result("All results valid", False)
            return False
        
        print_result("All results valid", True)
        return True
        
    except requests.Timeout:
        print_result("Request completed", False, f"Timeout after {TIMEOUT}s - VPS gateway may be slow or unreachable")
        return False
    except Exception as e:
        print_result("Request completed", False, f"Error: {e}")
        return False


def test_hunt_gb(token):
    """Test 2: Hunt GB proxies."""
    print_section("TEST 2: Hunt GB Proxies (count=3)")
    
    url = f"{BACKEND_URL}/hunt"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"country": "gb", "count": 3}
    
    try:
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Calling VPS gateway (may take 5-30 seconds)...")
        
        start = time.time()
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        print(f"Status: {resp.status_code} (took {elapsed:.1f}s)")
        
        if resp.status_code != 200:
            print_result("HTTP 200 response", False, f"Got {resp.status_code}: {resp.text[:200]}")
            return False
        
        print_result("HTTP 200 response", True)
        
        data = resp.json()
        results = data.get("results", [])
        count = len(results)
        
        print(f"Got {count} results")
        
        if count < 1:
            print_result("count >= 1", False, f"Got {count} results")
            return False
        
        # Verify all results have country_code == "GB"
        all_gb = True
        for i, item in enumerate(results):
            cc = item.get("country_code", "").upper()
            if cc != "GB":
                print(f"  Result {i+1}: country_code='{cc}' (expected 'GB')")
                all_gb = False
            else:
                print(f"  Result {i+1}: ✅ country_code='GB', ip={item.get('ip')}")
        
        if not all_gb:
            print_result("All results have country_code=GB", False)
            return False
        
        print_result("All results have country_code=GB", True)
        return True
        
    except requests.Timeout:
        print_result("Request completed", False, f"Timeout after {TIMEOUT}s")
        return False
    except Exception as e:
        print_result("Request completed", False, f"Error: {e}")
        return False


def test_hunt_global(token):
    """Test 3: Hunt global proxies (no country specified)."""
    print_section("TEST 3: Hunt Global Proxies (no country, count=3)")
    
    url = f"{BACKEND_URL}/hunt"
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"mode": "ultimate", "count": 3}
    
    try:
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload)}")
        print(f"Calling VPS gateway (may take 5-30 seconds)...")
        
        start = time.time()
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        print(f"Status: {resp.status_code} (took {elapsed:.1f}s)")
        
        if resp.status_code != 200:
            print_result("HTTP 200 response", False, f"Got {resp.status_code}: {resp.text[:200]}")
            return False
        
        print_result("HTTP 200 response", True)
        
        data = resp.json()
        results = data.get("results", [])
        count = len(results)
        
        print(f"Got {count} results")
        
        if count < 1:
            print_result("Results returned", False, f"Got {count} results")
            return False
        
        print_result("Results returned", True, f"Got {count} results")
        
        # Show country codes (may be various or empty for global)
        print("Country codes in results:")
        for i, item in enumerate(results):
            cc = item.get("country_code", "(empty)")
            ip = item.get("ip", "")
            print(f"  Result {i+1}: country_code='{cc}', ip={ip}")
        
        return True
        
    except requests.Timeout:
        print_result("Request completed", False, f"Timeout after {TIMEOUT}s")
        return False
    except Exception as e:
        print_result("Request completed", False, f"Error: {e}")
        return False


def test_count_clamping(token):
    """Test 4: Count clamping (count=100 -> <=30, count=0 -> >=1)."""
    print_section("TEST 4: Count Clamping")
    
    url = f"{BACKEND_URL}/hunt"
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test count=100 -> should return <= 30
    print("Test 4a: count=100 (should clamp to <=30)")
    payload = {"country": "us", "count": 100}
    
    try:
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload)}")
        
        start = time.time()
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        print(f"Status: {resp.status_code} (took {elapsed:.1f}s)")
        
        if resp.status_code != 200:
            print_result("count=100: HTTP 200", False, f"Got {resp.status_code}")
            return False
        
        data = resp.json()
        count = len(data.get("results", []))
        print(f"Got {count} results")
        
        if count > 30:
            print_result("count=100: results <= 30", False, f"Got {count} results")
            return False
        
        print_result("count=100: results <= 30", True, f"Got {count} results")
        
    except Exception as e:
        print_result("count=100 test", False, f"Error: {e}")
        return False
    
    # Test count=0 -> should return >= 1
    print("\nTest 4b: count=0 (should return >=1)")
    payload = {"country": "us", "count": 0}
    
    try:
        print(f"POST {url}")
        print(f"Payload: {json.dumps(payload)}")
        
        start = time.time()
        resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
        elapsed = time.time() - start
        
        print(f"Status: {resp.status_code} (took {elapsed:.1f}s)")
        
        if resp.status_code != 200:
            print_result("count=0: HTTP 200", False, f"Got {resp.status_code}")
            return False
        
        data = resp.json()
        count = len(data.get("results", []))
        print(f"Got {count} results")
        
        if count < 1:
            print_result("count=0: results >= 1", False, f"Got {count} results")
            return False
        
        print_result("count=0: results >= 1", True, f"Got {count} results")
        return True
        
    except Exception as e:
        print_result("count=0 test", False, f"Error: {e}")
        return False


def test_history_entry(token):
    """Test 5: Verify history entry is created with kind=hunt."""
    print_section("TEST 5: History Entry Creation")
    
    url = f"{BACKEND_URL}/history"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        print(f"GET {url}")
        resp = requests.get(url, headers=headers, timeout=10)
        
        print(f"Status: {resp.status_code}")
        
        if resp.status_code != 200:
            print_result("GET /api/history", False, f"Got {resp.status_code}")
            return False
        
        print_result("GET /api/history", True)
        
        history = resp.json()
        print(f"Got {len(history)} history entries")
        
        # Find at least one entry with kind=hunt
        hunt_entries = [h for h in history if h.get("kind") == "hunt"]
        
        if not hunt_entries:
            print_result("History contains kind=hunt entry", False, "No hunt entries found")
            return False
        
        print(f"Found {len(hunt_entries)} hunt entries:")
        for i, entry in enumerate(hunt_entries[:3]):  # Show first 3
            print(f"  {i+1}. {entry.get('title')} - {entry.get('subtitle')}")
        
        print_result("History contains kind=hunt entry", True, f"Found {len(hunt_entries)} hunt entries")
        return True
        
    except Exception as e:
        print_result("History check", False, f"Error: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("  BACKEND TEST: POST /api/hunt (IPRoyal Residential Proxy Hunting)")
    print("="*80)
    print(f"\nBackend URL: {BACKEND_URL}")
    print(f"Admin: {ADMIN_USERNAME}")
    print(f"Timeout: {TIMEOUT}s per request")
    
    # Login
    token = login_admin()
    if not token:
        print("\n❌ FATAL: Admin login failed. Cannot proceed with tests.")
        return
    
    # Run tests
    results = {}
    
    results["Test 1: Hunt US (ultimate, count=5)"] = test_hunt_us_ultimate(token)
    results["Test 2: Hunt GB (count=3)"] = test_hunt_gb(token)
    results["Test 3: Hunt Global (no country)"] = test_hunt_global(token)
    results["Test 4: Count Clamping"] = test_count_clamping(token)
    results["Test 5: History Entry"] = test_history_entry(token)
    
    # Summary
    print_section("TEST SUMMARY")
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\n{'='*80}")
    print(f"  TOTAL: {passed}/{total} tests passed")
    print(f"{'='*80}\n")
    
    if passed == total:
        print("✅ ALL TESTS PASSED - POST /api/hunt endpoint working correctly with real IPRoyal proxies")
    else:
        print(f"❌ {total - passed} TEST(S) FAILED - See details above")


if __name__ == "__main__":
    main()
