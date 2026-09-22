#!/usr/bin/env python3
"""
Backend test for HNPROXY-style hunt and proxy gateway endpoints
Tests:
- POST /api/hunt (HNPROXY-style same /24 subnet matching)
- POST /api/proxy/authorize (gateway authentication)
- POST /api/proxy/usage (bandwidth tracking)
"""
import requests
import json
import sys

# Configuration
BASE_URL = "https://github-branch-main.preview.emergentagent.com/api"
ADMIN_USERNAME = "idmee"
ADMIN_PASSWORD = "riyanmee123"
CUSTOMER_USERNAME = "hunter1"
CUSTOMER_PASSWORD = "hunter123"
CUSTOMER_PROXY_PASSWORD = "rmx-726ad07bc3"
PROXY_GATEWAY_TOKEN = "MhWCrBdJf-KjjEwIY3L0Z6dDT6WCECZSe1pW66Die7M"

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
        log(f"{label} Body: {json.dumps(body, indent=2)}")
    except:
        log(f"{label} Body: {response.text[:200]}")

def test_admin_login():
    """Test A.1: Admin login"""
    global admin_token
    log("\n=== Test A.1: Admin Login ===")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    log_response(response, "Admin Login")
    
    if response.status_code != 200:
        log("❌ FAILED: Admin login failed")
        return False
    
    data = response.json()
    if "access_token" in data:
        admin_token = data["access_token"]
    elif "token" in data:
        admin_token = data["token"]
    else:
        log("❌ FAILED: No token or access_token in response")
        return False
    
    log(f"✅ PASSED: Admin login successful, token obtained")
    return True

def test_customer_login():
    """Test A.1b: Customer login"""
    global customer_token
    log("\n=== Test A.1b: Customer Login ===")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": CUSTOMER_USERNAME, "password": CUSTOMER_PASSWORD}
    )
    log_response(response, "Customer Login")
    
    if response.status_code != 200:
        log("❌ FAILED: Customer login failed")
        return False
    
    data = response.json()
    if "access_token" in data:
        customer_token = data["access_token"]
    elif "token" in data:
        customer_token = data["token"]
    else:
        log("❌ FAILED: No token or access_token in response")
        return False
    
    log(f"✅ PASSED: Customer login successful, token obtained")
    return True

def test_hunt_same_subnet():
    """Test A.2: POST /api/hunt with target_ip - verify same /24 subnet"""
    log("\n=== Test A.2: Hunt Same /24 Subnet (149.126.15.67) ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={
            "target_ip": "149.126.15.67",
            "mode": "full",
            "count": 12
        }
    )
    log_response(response, "Hunt Response")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    # Check count
    results = data.get("results", [])
    if len(results) != 12:
        log(f"❌ FAILED: Expected count=12, got {len(results)}")
        return False
    
    log(f"✅ Count check passed: {len(results)} results")
    
    # Check each result
    failed_checks = []
    for i, result in enumerate(results):
        ip = result.get("ip", "")
        octet_match = result.get("octet_match")
        gateway_host = result.get("gateway_host")
        gateway_port = result.get("gateway_port")
        protocol = result.get("protocol")
        username = result.get("username")
        password = result.get("password")
        result_type = result.get("type")
        
        # Check IP starts with 149.126.15.
        if not ip.startswith("149.126.15."):
            failed_checks.append(f"Result {i}: IP {ip} does not start with 149.126.15.")
        
        # Check octet_match == 3
        if octet_match != 3:
            failed_checks.append(f"Result {i}: octet_match={octet_match}, expected 3")
        
        # Check gateway_host
        if gateway_host != "155.138.227.248":
            failed_checks.append(f"Result {i}: gateway_host={gateway_host}, expected 155.138.227.248")
        
        # Check gateway_port
        if gateway_port != 1080:
            failed_checks.append(f"Result {i}: gateway_port={gateway_port}, expected 1080")
        
        # Check protocol
        if protocol != "socks5":
            failed_checks.append(f"Result {i}: protocol={protocol}, expected socks5")
        
        # Check username non-empty
        if not username:
            failed_checks.append(f"Result {i}: username is empty")
        
        # Check password non-empty
        if not password:
            failed_checks.append(f"Result {i}: password is empty")
        
        # Check type
        if result_type != "Residential":
            failed_checks.append(f"Result {i}: type={result_type}, expected Residential")
    
    if failed_checks:
        log("❌ FAILED: Result validation errors:")
        for error in failed_checks[:10]:  # Show first 10 errors
            log(f"  - {error}")
        return False
    
    log(f"✅ PASSED: All 12 results have correct IP prefix (149.126.15.x), octet_match=3, gateway_host=155.138.227.248, gateway_port=1080, protocol=socks5, type=Residential")
    
    # Check target geo
    target = data.get("target", {})
    target_country_code = target.get("country_code", "")
    target_city = target.get("city", "")
    
    log(f"Target geo: city={target_city}, country_code={target_country_code}")
    
    if target_country_code.upper() != "SA":
        log(f"⚠️  WARNING: Expected country_code=SA (Saudi Arabia), got {target_country_code}")
    else:
        log(f"✅ Target country_code=SA verified")
    
    return True

def test_hunt_invalid_ip():
    """Test A.3: POST /api/hunt with invalid IP"""
    log("\n=== Test A.3: Hunt with Invalid IP ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={
            "target_ip": "not-an-ip",
            "mode": "full"
        }
    )
    log_response(response, "Hunt Invalid IP")
    
    if response.status_code != 400:
        log(f"❌ FAILED: Expected status 400, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: Invalid IP correctly rejected with 400")
    return True

def test_hunt_empty_ip():
    """Test A.4: POST /api/hunt with empty IP"""
    log("\n=== Test A.4: Hunt with Empty IP ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/hunt",
        headers=headers,
        json={
            "target_ip": "",
            "mode": "full"
        }
    )
    log_response(response, "Hunt Empty IP")
    
    if response.status_code != 400:
        log(f"❌ FAILED: Expected status 400, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: Empty IP correctly rejected with 400")
    return True

def test_hunt_history():
    """Test A.5: Verify history entry created"""
    log("\n=== Test A.5: Verify Hunt History Entry ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/history",
        headers=headers
    )
    log_response(response, "History")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Failed to get history, status={response.status_code}")
        return False
    
    history = response.json()
    
    # Find a hunt entry
    hunt_entries = [h for h in history if h.get("kind") == "hunt"]
    
    if not hunt_entries:
        log(f"❌ FAILED: No hunt entries found in history")
        return False
    
    log(f"✅ PASSED: Found {len(hunt_entries)} hunt entries in history")
    return True

def test_authorize_customer_correct():
    """Test B.1: Authorize customer with correct credentials"""
    log("\n=== Test B.1: Authorize Customer (Correct Credentials) ===")
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": CUSTOMER_USERNAME,
            "password": CUSTOMER_PROXY_PASSWORD
        }
    )
    log_response(response, "Authorize Customer")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    if data.get("active") != True:
        log(f"❌ FAILED: Expected active=true, got active={data.get('active')}, reason={data.get('reason')}")
        return False
    
    if data.get("reason") != "ok":
        log(f"❌ FAILED: Expected reason='ok', got reason={data.get('reason')}")
        return False
    
    if data.get("country") != "sa":
        log(f"❌ FAILED: Expected country='sa', got country={data.get('country')}")
        return False
    
    if data.get("package_id") != "day30":
        log(f"❌ FAILED: Expected package_id='day30', got package_id={data.get('package_id')}")
        return False
    
    log(f"✅ PASSED: Authorize successful - active=true, reason=ok, country=sa, package_id=day30")
    return True

def test_authorize_admin():
    """Test B.2: Authorize admin account (should be rejected)"""
    log("\n=== Test B.2: Authorize Admin Account ===")
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": ADMIN_USERNAME,
            "password": "rmx-c01ef22e63"
        }
    )
    log_response(response, "Authorize Admin")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    if data.get("active") != False:
        log(f"❌ FAILED: Expected active=false, got active={data.get('active')}")
        return False
    
    if data.get("reason") != "admin_account":
        log(f"❌ FAILED: Expected reason='admin_account', got reason={data.get('reason')}")
        return False
    
    log(f"✅ PASSED: Admin account correctly rejected - active=false, reason=admin_account")
    return True

def test_authorize_wrong_password():
    """Test B.3: Authorize with wrong password"""
    log("\n=== Test B.3: Authorize with Wrong Password ===")
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": CUSTOMER_USERNAME,
            "password": "WRONGPASS"
        }
    )
    log_response(response, "Authorize Wrong Password")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    if data.get("active") != False:
        log(f"❌ FAILED: Expected active=false, got active={data.get('active')}")
        return False
    
    if data.get("reason") != "bad_credentials":
        log(f"❌ FAILED: Expected reason='bad_credentials', got reason={data.get('reason')}")
        return False
    
    log(f"✅ PASSED: Wrong password correctly rejected - active=false, reason=bad_credentials")
    return True

def test_authorize_no_token():
    """Test B.4: Authorize without Authorization header"""
    log("\n=== Test B.4: Authorize without Authorization Header ===")
    
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        json={
            "username": CUSTOMER_USERNAME,
            "password": CUSTOMER_PROXY_PASSWORD
        }
    )
    log_response(response, "Authorize No Token")
    
    if response.status_code != 401:
        log(f"❌ FAILED: Expected status 401, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: No token correctly rejected with 401")
    return True

def test_authorize_wrong_token():
    """Test B.5: Authorize with wrong Bearer token"""
    log("\n=== Test B.5: Authorize with Wrong Bearer Token ===")
    
    headers = {"Authorization": f"Bearer wrongtoken123"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": CUSTOMER_USERNAME,
            "password": CUSTOMER_PROXY_PASSWORD
        }
    )
    log_response(response, "Authorize Wrong Token")
    
    if response.status_code != 401:
        log(f"❌ FAILED: Expected status 401, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: Wrong token correctly rejected with 401")
    return True

def test_usage_report():
    """Test B.6: Report usage and verify bandwidth tracking"""
    log("\n=== Test B.6: Report Usage ===")
    
    # Get current bandwidth usage first
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/admin/customers",
        headers=headers
    )
    
    if response.status_code != 200:
        log("❌ FAILED: Failed to get customers list")
        return False
    
    customers = response.json()
    hunter1 = None
    for customer in customers:
        if customer.get("username") == CUSTOMER_USERNAME:
            hunter1 = customer
            break
    
    if not hunter1:
        log("❌ FAILED: hunter1 customer not found")
        return False
    
    initial_usage = hunter1.get("bandwidth_used_mb", 0)
    log(f"Initial bandwidth_used_mb: {initial_usage}MB")
    
    # Report 1MB up + 1MB down = 2MB total
    bytes_up = 1048576  # 1MB
    bytes_down = 1048576  # 1MB
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/usage",
        headers=headers,
        json={
            "username": CUSTOMER_USERNAME,
            "bytes_up": bytes_up,
            "bytes_down": bytes_down
        }
    )
    log_response(response, "Usage Report")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    if data.get("ok") != True:
        log(f"❌ FAILED: Expected ok=true, got ok={data.get('ok')}")
        return False
    
    bandwidth_used_mb = data.get("bandwidth_used_mb")
    if bandwidth_used_mb is None:
        log(f"❌ FAILED: No bandwidth_used_mb in response")
        return False
    
    log(f"✅ PASSED: Usage reported successfully - bandwidth_used_mb={bandwidth_used_mb}MB")
    
    # Verify via admin API
    log("\n=== Test B.6b: Verify Usage via Admin API ===")
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/admin/customers",
        headers=headers
    )
    
    if response.status_code != 200:
        log("❌ FAILED: Failed to get customers list for verification")
        return False
    
    customers = response.json()
    hunter1 = None
    for customer in customers:
        if customer.get("username") == CUSTOMER_USERNAME:
            hunter1 = customer
            break
    
    if not hunter1:
        log("❌ FAILED: hunter1 customer not found for verification")
        return False
    
    verified_usage = hunter1.get("bandwidth_used_mb")
    log(f"Verified bandwidth_used_mb from admin API: {verified_usage}MB")
    
    if verified_usage < initial_usage:
        log(f"❌ FAILED: Usage decreased from {initial_usage}MB to {verified_usage}MB")
        return False
    
    if verified_usage == initial_usage:
        log(f"⚠️  WARNING: Usage did not increase (still {initial_usage}MB)")
    else:
        log(f"✅ PASSED: Usage increased from {initial_usage}MB to {verified_usage}MB")
    
    return True

def main():
    """Run all tests"""
    log("=" * 80)
    log("HNPROXY-STYLE HUNT + PROXY GATEWAY ENDPOINTS TEST")
    log("=" * 80)
    
    tests = [
        ("A.1: Admin Login", test_admin_login),
        ("A.1b: Customer Login", test_customer_login),
        ("A.2: Hunt Same /24 Subnet", test_hunt_same_subnet),
        ("A.3: Hunt Invalid IP", test_hunt_invalid_ip),
        ("A.4: Hunt Empty IP", test_hunt_empty_ip),
        ("A.5: Hunt History Entry", test_hunt_history),
        ("B.1: Authorize Customer (Correct)", test_authorize_customer_correct),
        ("B.2: Authorize Admin Account", test_authorize_admin),
        ("B.3: Authorize Wrong Password", test_authorize_wrong_password),
        ("B.4: Authorize No Token", test_authorize_no_token),
        ("B.5: Authorize Wrong Token", test_authorize_wrong_token),
        ("B.6: Usage Report", test_usage_report),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
            if not result:
                # Continue with other tests even if one fails
                pass
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
