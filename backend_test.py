#!/usr/bin/env python3
"""
Backend test for Fase 2 Proxy Gateway Endpoints
Tests /api/proxy/authorize and /api/proxy/usage
"""
import requests
import json
import sys

# Configuration
BASE_URL = "https://github-import-setup-11.preview.emergentagent.com/api"
ADMIN_USERNAME = "idmee"
ADMIN_PASSWORD = "riyanmee123"
PROXY_GATEWAY_TOKEN = "MhWCrBdJf-KjjEwIY3L0Z6dDT6WCECZSe1pW66Die7M"

# Test customer credentials
TEST_CUSTOMER_USERNAME = "gwtest1"
TEST_CUSTOMER_PASSWORD = "secret123"
TEST_CUSTOMER_COUNTRY = "us"
TEST_PACKAGE_ID = "day7"

# Global variables
admin_token = None
test_customer_id = None
test_customer_proxy_password = None

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
    """Test 1: Admin login"""
    global admin_token
    log("\n=== Test 1: Admin Login ===")
    
    response = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    log_response(response, "Admin Login")
    
    if response.status_code != 200:
        log("❌ FAILED: Admin login failed")
        return False
    
    data = response.json()
    # Check for both "token" and "access_token" fields
    if "access_token" in data:
        admin_token = data["access_token"]
    elif "token" in data:
        admin_token = data["token"]
    else:
        log("❌ FAILED: No token or access_token in response")
        return False
    
    log(f"✅ PASSED: Admin login successful, token obtained")
    return True

def test_create_customer():
    """Test 2: Create test customer with package"""
    global test_customer_id, test_customer_proxy_password
    log("\n=== Test 2: Create Test Customer ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.post(
        f"{BASE_URL}/admin/customers",
        headers=headers,
        json={
            "username": TEST_CUSTOMER_USERNAME,
            "password": TEST_CUSTOMER_PASSWORD,
            "country": TEST_CUSTOMER_COUNTRY,
            "package_id": TEST_PACKAGE_ID
        }
    )
    log_response(response, "Create Customer")
    
    if response.status_code not in [200, 201]:
        log("❌ FAILED: Customer creation failed")
        return False
    
    data = response.json()
    test_customer_id = data.get("id")
    
    if not test_customer_id:
        log("❌ FAILED: No customer ID in response")
        return False
    
    log(f"✅ PASSED: Customer created with ID: {test_customer_id}")
    return True

def test_get_customer_proxy_password():
    """Test 3: Get customer details to retrieve proxy_password"""
    global test_customer_proxy_password
    log("\n=== Test 3: Get Customer Proxy Password ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/admin/customers",
        headers=headers
    )
    log_response(response, "Get Customers")
    
    if response.status_code != 200:
        log("❌ FAILED: Failed to get customers list")
        return False
    
    customers = response.json()
    test_customer = None
    for customer in customers:
        if customer.get("username") == TEST_CUSTOMER_USERNAME:
            test_customer = customer
            break
    
    if not test_customer:
        log("❌ FAILED: Test customer not found in list")
        return False
    
    test_customer_proxy_password = test_customer.get("proxy_password")
    
    if not test_customer_proxy_password:
        log("❌ FAILED: No proxy_password set for customer")
        return False
    
    log(f"✅ PASSED: Retrieved proxy_password: {test_customer_proxy_password}")
    log(f"Customer details: country={test_customer.get('country')}, bandwidth_limit_mb={test_customer.get('bandwidth_limit_mb')}")
    return True

def test_authorize_correct_credentials():
    """Test 4: Authorize with correct credentials"""
    log("\n=== Test 4: Authorize with Correct Credentials ===")
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": TEST_CUSTOMER_USERNAME,
            "password": test_customer_proxy_password
        }
    )
    log_response(response, "Authorize (Correct)")
    
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
    
    if data.get("customer_id") != TEST_CUSTOMER_USERNAME:
        log(f"❌ FAILED: Expected customer_id={TEST_CUSTOMER_USERNAME}, got {data.get('customer_id')}")
        return False
    
    if data.get("country") != TEST_CUSTOMER_COUNTRY:
        log(f"❌ FAILED: Expected country={TEST_CUSTOMER_COUNTRY}, got {data.get('country')}")
        return False
    
    log(f"✅ PASSED: Authorize successful - active=true, country={data.get('country')}, customer_id={data.get('customer_id')}")
    return True

def test_authorize_wrong_password():
    """Test 5: Authorize with wrong password"""
    log("\n=== Test 5: Authorize with Wrong Password ===")
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": TEST_CUSTOMER_USERNAME,
            "password": "wrongpassword123"
        }
    )
    log_response(response, "Authorize (Wrong Password)")
    
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
    
    log(f"✅ PASSED: Authorize correctly rejected - active=false, reason=bad_credentials")
    return True

def test_authorize_no_token():
    """Test 6: Authorize without Authorization header"""
    log("\n=== Test 6: Authorize without Authorization Header ===")
    
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        json={
            "username": TEST_CUSTOMER_USERNAME,
            "password": test_customer_proxy_password
        }
    )
    log_response(response, "Authorize (No Token)")
    
    if response.status_code != 401:
        log(f"❌ FAILED: Expected status 401, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: Authorize correctly rejected with 401 (no token)")
    return True

def test_authorize_wrong_token():
    """Test 7: Authorize with wrong Bearer token"""
    log("\n=== Test 7: Authorize with Wrong Bearer Token ===")
    
    headers = {"Authorization": f"Bearer wrongtoken123"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": TEST_CUSTOMER_USERNAME,
            "password": test_customer_proxy_password
        }
    )
    log_response(response, "Authorize (Wrong Token)")
    
    if response.status_code != 401:
        log(f"❌ FAILED: Expected status 401, got {response.status_code}")
        return False
    
    log(f"✅ PASSED: Authorize correctly rejected with 401 (wrong token)")
    return True

def test_usage_report():
    """Test 8: Report usage and verify bandwidth tracking"""
    log("\n=== Test 8: Report Usage ===")
    
    # Report 50MB up + 50MB down = 100MB total
    bytes_up = 52428800  # 50MB
    bytes_down = 52428800  # 50MB
    
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/usage",
        headers=headers,
        json={
            "username": TEST_CUSTOMER_USERNAME,
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
    
    # Should be approximately 100MB (allowing for rounding)
    if bandwidth_used_mb < 95 or bandwidth_used_mb > 105:
        log(f"⚠️  WARNING: Expected ~100MB, got {bandwidth_used_mb}MB")
    
    log(f"✅ PASSED: Usage reported successfully - bandwidth_used_mb={bandwidth_used_mb}")
    
    # Verify via admin API
    log("\n=== Test 8b: Verify Usage via Admin API ===")
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.get(
        f"{BASE_URL}/admin/customers",
        headers=headers
    )
    
    if response.status_code != 200:
        log("❌ FAILED: Failed to get customers list for verification")
        return False
    
    customers = response.json()
    test_customer = None
    for customer in customers:
        if customer.get("username") == TEST_CUSTOMER_USERNAME:
            test_customer = customer
            break
    
    if not test_customer:
        log("❌ FAILED: Test customer not found for verification")
        return False
    
    verified_usage = test_customer.get("bandwidth_used_mb")
    log(f"Verified bandwidth_used_mb from admin API: {verified_usage}MB")
    
    if verified_usage != bandwidth_used_mb:
        log(f"⚠️  WARNING: Usage mismatch - usage API returned {bandwidth_used_mb}MB, admin API shows {verified_usage}MB")
    else:
        log(f"✅ PASSED: Usage verified via admin API - {verified_usage}MB")
    
    return True

def test_quota_exceeded():
    """Test 9: Set quota to limit and verify authorize returns quota_exceeded"""
    log("\n=== Test 9: Test Quota Exceeded ===")
    
    # First, set bandwidth_used_mb to the limit (day7 = 10GB = 10240MB)
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.patch(
        f"{BASE_URL}/admin/customers/{test_customer_id}",
        headers=headers,
        json={"bandwidth_used_mb": 10240}
    )
    log_response(response, "Set Quota to Limit")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Failed to update customer quota, status={response.status_code}")
        return False
    
    log("Customer quota set to limit (10240MB)")
    
    # Now try to authorize
    headers = {"Authorization": f"Bearer {PROXY_GATEWAY_TOKEN}"}
    response = requests.post(
        f"{BASE_URL}/proxy/authorize",
        headers=headers,
        json={
            "username": TEST_CUSTOMER_USERNAME,
            "password": test_customer_proxy_password
        }
    )
    log_response(response, "Authorize (Over Quota)")
    
    if response.status_code != 200:
        log(f"❌ FAILED: Expected status 200, got {response.status_code}")
        return False
    
    data = response.json()
    
    if data.get("active") != False:
        log(f"❌ FAILED: Expected active=false, got active={data.get('active')}")
        return False
    
    if data.get("reason") != "quota_exceeded":
        log(f"❌ FAILED: Expected reason='quota_exceeded', got reason={data.get('reason')}")
        return False
    
    log(f"✅ PASSED: Authorize correctly rejected - active=false, reason=quota_exceeded")
    return True

def test_cleanup():
    """Test 10: Cleanup - delete test customer"""
    log("\n=== Test 10: Cleanup - Delete Test Customer ===")
    
    headers = {"Authorization": f"Bearer {admin_token}"}
    response = requests.delete(
        f"{BASE_URL}/admin/customers/{test_customer_id}",
        headers=headers
    )
    log_response(response, "Delete Customer")
    
    if response.status_code != 200:
        log(f"⚠️  WARNING: Failed to delete customer, status={response.status_code}")
        return False
    
    data = response.json()
    if data.get("ok") != True:
        log(f"⚠️  WARNING: Delete response ok={data.get('ok')}")
        return False
    
    log(f"✅ PASSED: Test customer deleted successfully")
    return True

def main():
    """Run all tests"""
    log("=" * 80)
    log("FASE 2 PROXY GATEWAY ENDPOINTS TEST")
    log("=" * 80)
    
    tests = [
        ("Admin Login", test_admin_login),
        ("Create Test Customer", test_create_customer),
        ("Get Customer Proxy Password", test_get_customer_proxy_password),
        ("Authorize with Correct Credentials", test_authorize_correct_credentials),
        ("Authorize with Wrong Password", test_authorize_wrong_password),
        ("Authorize without Token", test_authorize_no_token),
        ("Authorize with Wrong Token", test_authorize_wrong_token),
        ("Report Usage", test_usage_report),
        ("Quota Exceeded", test_quota_exceeded),
        ("Cleanup", test_cleanup),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
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
