#!/usr/bin/env python3
"""
Backend test for Hunting Endpoint (POST /api/hunt)
Tests oct-3 (/24) matching, unique results, and configurable count
"""
import requests
import json
import sys
from collections import Counter

# Configuration
BASE_URL = "https://github-proxy.preview.emergentagent.com/api"
ADMIN_USERNAME = "idmee"
ADMIN_PASSWORD = "riyanmee123"

# Test customer credentials (will be registered)
TEST_CUSTOMER_USERNAME = "hunttest1"
TEST_CUSTOMER_PASSWORD = "huntpass123"

# Global variables
admin_token = None
customer_token = None

def log(message):
    """Print log message"""
    print(f"[TEST] {message}")

def log_response(response, label="Response"):
    """Log response details"""
    log(f"{label}: Status={response.status_code}")
    try:
        body = response.json()
        log(f"{label} Body: {json.dumps(body, indent=2)[:500]}")
    except:
        log(f"{label} Body: {response.text[:200]}")

def extract_oct3(ip):
    """Extract first 3 octets from IP address"""
    parts = ip.split(".")
    if len(parts) >= 3:
        return ".".join(parts[:3])
    return None

def test_admin_login():
    """Test: Admin login"""
    global admin_token
    log("\n=== Test: Admin Login ===")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    log_response(response, "Admin Login")
    
    if response.status_code != 200:
        log("❌ FAILED: Admin login failed")
        return False
    
    data = response.json()
    admin_token = data.get("access_token")
    
    if not admin_token:
        log("❌ FAILED: No access_token in response")
        return False
    
    log(f"✅ PASSED: Admin login successful")
    return True

def test_register_customer():
    """Test: Register a customer for testing"""
    global customer_token
    log("\n=== Test: Register Customer ===")
    
    response = requests.post(
        f"{BASE_URL}/auth/register",
        json={"username": TEST_CUSTOMER_USERNAME, "password": TEST_CUSTOMER_PASSWORD}
    )
    log_response(response, "Register Customer")
    
    if response.status_code not in [200, 201]:
        # Customer might already exist, try login
        log("Customer registration failed, trying login...")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_CUSTOMER_USERNAME, "password": TEST_CUSTOMER_PASSWORD}
        )
        if response.status_code != 200:
            log("❌ FAILED: Customer registration and login both failed")
            return False
    
    data = response.json()
    customer_token = data.get("access_token")
    
    if not customer_token:
        log("❌ FAILED: No access_token in response")
        return False
    
    log(f"✅ PASSED: Customer registered/logged in successfully")
    return True

def test_hunt_admin_default_count():
    """Test 1: Admin hunt with default count (24) - verify oct-3 match and uniqueness"""
    log("\n=== Test 1: Admin Hunt with Default Count (24) ===")
    
    target_ip = "109.228.222.82"
    expected_oct3 = "109.228.222"
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": target_ip, "mode": "full"}
    )
    log_response(response, "Hunt (Admin, Default Count)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    # Check count
    count = data.get("count")
    if count != 24:
        log(f"❌ FAILED: Expected count=24, got count={count}")
        return False
    
    # Check results
    results = data.get("results", [])
    if len(results) != 24:
        log(f"❌ FAILED: Expected 24 results, got {len(results)}")
        return False
    
    # Check oct-3 matching
    oct3_matches = 0
    all_ips = []
    for result in results:
        ip = result.get("ip")
        all_ips.append(ip)
        oct3 = extract_oct3(ip)
        if oct3 == expected_oct3:
            oct3_matches += 1
    
    log(f"Oct-3 matches: {oct3_matches}/{len(results)}")
    
    if oct3_matches != len(results):
        log(f"❌ FAILED: Not all IPs share oct-3 prefix {expected_oct3}")
        log(f"Sample IPs: {all_ips[:5]}")
        return False
    
    # Check uniqueness
    ip_counts = Counter(all_ips)
    duplicates = [ip for ip, count in ip_counts.items() if count > 1]
    
    if duplicates:
        log(f"❌ FAILED: Found duplicate IPs: {duplicates}")
        return False
    
    log(f"✅ PASSED: All 24 IPs share oct-3 prefix {expected_oct3} and are unique")
    return True

def test_hunt_admin_custom_count():
    """Test 2: Admin hunt with custom count (40) - verify oct-3 match and uniqueness"""
    log("\n=== Test 2: Admin Hunt with Custom Count (40) ===")
    
    target_ip = "8.8.8.8"
    expected_oct3 = "8.8.8"
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": target_ip, "mode": "ultimate", "count": 40}
    )
    log_response(response, "Hunt (Admin, Count=40)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    # Check count
    count = data.get("count")
    if count != 40:
        log(f"❌ FAILED: Expected count=40, got count={count}")
        return False
    
    # Check results
    results = data.get("results", [])
    if len(results) != 40:
        log(f"❌ FAILED: Expected 40 results, got {len(results)}")
        return False
    
    # Check oct-3 matching
    oct3_matches = 0
    all_ips = []
    for result in results:
        ip = result.get("ip")
        all_ips.append(ip)
        oct3 = extract_oct3(ip)
        if oct3 == expected_oct3:
            oct3_matches += 1
    
    log(f"Oct-3 matches: {oct3_matches}/{len(results)}")
    
    if oct3_matches != len(results):
        log(f"❌ FAILED: Not all IPs share oct-3 prefix {expected_oct3}")
        log(f"Sample IPs: {all_ips[:5]}")
        return False
    
    # Check uniqueness
    ip_counts = Counter(all_ips)
    duplicates = [ip for ip, count in ip_counts.items() if count > 1]
    
    if duplicates:
        log(f"❌ FAILED: Found duplicate IPs: {duplicates}")
        return False
    
    log(f"✅ PASSED: All 40 IPs share oct-3 prefix {expected_oct3} and are unique")
    return True

def test_hunt_count_clamping():
    """Test 3: Count clamping - verify 500 -> <=100, 0 -> >=1"""
    log("\n=== Test 3: Count Clamping ===")
    
    target_ip = "1.2.3.4"
    expected_oct3 = "1.2.3"
    
    # Test 3a: count=500 should be clamped to <=100
    log("\n--- Test 3a: Count=500 (should clamp to <=100) ---")
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": target_ip, "mode": "full", "count": 500}
    )
    log_response(response, "Hunt (Count=500)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    count = data.get("count")
    results = data.get("results", [])
    
    if count > 100:
        log(f"❌ FAILED: Count not clamped - got count={count}, expected <=100")
        return False
    
    if len(results) > 100:
        log(f"❌ FAILED: Too many results - got {len(results)}, expected <=100")
        return False
    
    if len(results) == 0:
        log(f"❌ FAILED: No results returned")
        return False
    
    log(f"✅ PASSED: Count=500 clamped to {count} (<=100)")
    
    # Test 3b: count=0 should return >=1 result
    log("\n--- Test 3b: Count=0 (should return >=1) ---")
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": target_ip, "mode": "full", "count": 0}
    )
    log_response(response, "Hunt (Count=0)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    count = data.get("count")
    results = data.get("results", [])
    
    if len(results) < 1:
        log(f"❌ FAILED: No results returned for count=0")
        return False
    
    log(f"✅ PASSED: Count=0 returned {count} results (>=1)")
    
    # Test 3c: count=-10 should return >=1 result
    log("\n--- Test 3c: Count=-10 (should return >=1) ---")
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": target_ip, "mode": "full", "count": -10}
    )
    log_response(response, "Hunt (Count=-10)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    count = data.get("count")
    results = data.get("results", [])
    
    if len(results) < 1:
        log(f"❌ FAILED: No results returned for count=-10")
        return False
    
    log(f"✅ PASSED: Count=-10 returned {count} results (>=1)")
    
    return True

def test_hunt_customer():
    """Test 4: Customer hunt - verify accessible to customers"""
    log("\n=== Test 4: Customer Hunt ===")
    
    target_ip = "1.2.3.4"
    expected_oct3 = "1.2.3"
    
    headers = {"Authorization": f"Bearer {customer_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": target_ip, "mode": "city"}
    )
    log_response(response, "Hunt (Customer)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    results = data.get("results", [])
    
    if len(results) == 0:
        log(f"❌ FAILED: No results returned")
        return False
    
    # Check oct-3 matching
    oct3_matches = 0
    all_ips = []
    for result in results:
        ip = result.get("ip")
        all_ips.append(ip)
        oct3 = extract_oct3(ip)
        if oct3 == expected_oct3:
            oct3_matches += 1
    
    log(f"Oct-3 matches: {oct3_matches}/{len(results)}")
    
    if oct3_matches != len(results):
        log(f"❌ FAILED: Not all IPs share oct-3 prefix {expected_oct3}")
        log(f"Sample IPs: {all_ips[:5]}")
        return False
    
    # Check uniqueness
    ip_counts = Counter(all_ips)
    duplicates = [ip for ip, count in ip_counts.items() if count > 1]
    
    if duplicates:
        log(f"❌ FAILED: Found duplicate IPs: {duplicates}")
        return False
    
    log(f"✅ PASSED: Customer can hunt - all IPs share oct-3 prefix {expected_oct3} and are unique")
    return True

def test_hunt_invalid_ip():
    """Test 5: Invalid IP - verify 400 error"""
    log("\n=== Test 5: Invalid IP ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": "not-an-ip", "mode": "ultimate"}
    )
    log_response(response, "Hunt (Invalid IP)")
    
    if response.status_code != 400:
        log(f"❌ FAILED: Expected status 400, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: Invalid IP correctly rejected with 400")
    return True

def test_hunt_history():
    """Test 6: History entry created after hunt"""
    log("\n=== Test 6: History Entry ===")
    
    # Get current history count
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(f"{BASE_URL}/history", headers=headers)
    
    if response.status_code != 200:
        log(f"⚠️  WARNING: Could not get history before hunt")
        history_before = []
    else:
        history_before = response.json()
    
    log(f"History entries before hunt: {len(history_before)}")
    
    # Perform a hunt
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={"target_ip": "5.6.7.8", "mode": "full"}
    )
    
    if response.status_code != 200:
        log(f"❌ FAILED: Hunt failed with status {response.status_code}")
        return False
    
    # Get history after hunt
    response = requests.get(f"{BASE_URL}/history", headers=headers)
    
    if response.status_code != 200:
        log(f"❌ FAILED: Could not get history after hunt")
        return False
    
    history_after = response.json()
    log(f"History entries after hunt: {len(history_after)}")
    
    if len(history_after) <= len(history_before):
        log(f"❌ FAILED: No new history entry created")
        return False
    
    # Check the latest entry
    latest = history_after[0]
    if latest.get("kind") != "hunt":
        log(f"❌ FAILED: Latest history entry is not a hunt (kind={latest.get('kind')})")
        return False
    
    log(f"✅ PASSED: History entry created - kind={latest.get('kind')}, title={latest.get('title')}")
    return True

def main():
    """Run all tests"""
    log("=" * 80)
    log("HUNTING ENDPOINT TEST (POST /api/hunt)")
    log("=" * 80)
    
    tests = [
        ("Admin Login", test_admin_login),
        ("Register Customer", test_register_customer),
        ("Test 1: Admin Hunt Default Count (24)", test_hunt_admin_default_count),
        ("Test 2: Admin Hunt Custom Count (40)", test_hunt_admin_custom_count),
        ("Test 3: Count Clamping", test_hunt_count_clamping),
        ("Test 4: Customer Hunt", test_hunt_customer),
        ("Test 5: Invalid IP", test_hunt_invalid_ip),
        ("Test 6: History Entry", test_hunt_history),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
            if not result and name in ["Admin Login", "Register Customer"]:
                log(f"\n⚠️  Stopping tests - prerequisite failed: {name}")
                break
        except Exception as e:
            log(f"\n❌ EXCEPTION in {name}: {str(e)}")
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = 0
    failed = 0
    for name, result in results:
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{status}: {name}")
        if result:
            passed += 1
        else:
            failed += 1
    
    log("\n" + "=" * 80)
    log(f"Total: {len(results)} tests | Passed: {passed} | Failed: {failed}")
    log("=" * 80)
    
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
