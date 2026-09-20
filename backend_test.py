#!/usr/bin/env python3
"""
Comprehensive backend test for RIYANMEE PROXY Reseller Platform
Tests all new reseller endpoints + regression tests
"""
import requests
import json
import time
from typing import Optional

# Base URL from frontend/.env
BASE_URL = "https://repo-sync-deploy-3.preview.emergentagent.com/api"

# Test credentials
ADMIN_USERNAME = "idmee"
ADMIN_PASSWORD = "riyanmee123"

# Test customer credentials (will be created)
CUSTOMER_USERNAME = f"testcust_{int(time.time())}"
CUSTOMER_PASSWORD = "testpass123"

# Global tokens
admin_token: Optional[str] = None
customer_token: Optional[str] = None

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
}

def log_pass(test_name: str):
    print(f"✅ PASS: {test_name}")
    test_results["passed"].append(test_name)

def log_fail(test_name: str, reason: str):
    print(f"❌ FAIL: {test_name}")
    print(f"   Reason: {reason}")
    test_results["failed"].append(f"{test_name}: {reason}")

def make_request(method: str, endpoint: str, token: Optional[str] = None, json_data: Optional[dict] = None, params: Optional[dict] = None):
    """Helper to make HTTP requests"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            resp = requests.get(url, headers=headers, params=params, timeout=30)
        elif method == "POST":
            resp = requests.post(url, headers=headers, json=json_data, timeout=30)
        elif method == "PUT":
            resp = requests.put(url, headers=headers, json=json_data, timeout=30)
        elif method == "PATCH":
            resp = requests.patch(url, headers=headers, json=json_data, timeout=30)
        elif method == "DELETE":
            resp = requests.delete(url, headers=headers, timeout=30)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        return resp
    except Exception as e:
        print(f"   Request error: {e}")
        return None

# ============================================================================
# 1. AUTH/ROLE TESTS
# ============================================================================
def test_admin_login():
    """Test admin login with idmee/riyanmee123"""
    global admin_token
    
    resp = make_request("POST", "/auth/login", json_data={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD
    })
    
    if not resp or resp.status_code != 200:
        log_fail("Admin login", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if "access_token" not in data or "user" not in data:
        log_fail("Admin login", "Missing access_token or user in response")
        return False
    
    user = data["user"]
    if user.get("role") != "admin":
        log_fail("Admin login", f"Role is '{user.get('role')}', expected 'admin'")
        return False
    
    admin_token = data["access_token"]
    log_pass("Admin login (idmee role=admin)")
    return True

def test_customer_register():
    """Test customer registration"""
    global customer_token
    
    resp = make_request("POST", "/auth/register", json_data={
        "username": CUSTOMER_USERNAME,
        "password": CUSTOMER_PASSWORD
    })
    
    if not resp or resp.status_code != 201:
        log_fail("Customer register", f"Status {resp.status_code if resp else 'N/A'}, expected 201")
        return False
    
    data = resp.json()
    if "access_token" not in data or "user" not in data:
        log_fail("Customer register", "Missing access_token or user in response")
        return False
    
    user = data["user"]
    if user.get("role") != "customer":
        log_fail("Customer register", f"Role is '{user.get('role')}', expected 'customer'")
        return False
    
    customer_token = data["access_token"]
    log_pass("Customer register (role=customer)")
    return True

def test_require_admin_protection():
    """Test that admin endpoints block non-admin users"""
    # Test with customer token -> expect 403
    resp = make_request("GET", "/admin/stats", token=customer_token)
    if not resp or resp.status_code != 403:
        log_fail("require_admin protection (customer token)", f"Status {resp.status_code if resp else 'N/A'}, expected 403")
        return False
    
    # Test with no token -> expect 401
    resp = make_request("GET", "/admin/stats")
    if not resp or resp.status_code != 401:
        log_fail("require_admin protection (no token)", f"Status {resp.status_code if resp else 'N/A'}, expected 401")
        return False
    
    log_pass("require_admin protection (403 for customer, 401 for no token)")
    return True

# ============================================================================
# 2. PACKAGES TESTS
# ============================================================================
def test_get_plans():
    """Test GET /api/plans returns active packages"""
    resp = make_request("GET", "/plans")
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/plans", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not isinstance(data, list):
        log_fail("GET /api/plans", "Response is not a list")
        return False
    
    # Check for expected packages
    package_ids = [p.get("id") for p in data]
    expected = ["day7", "day30", "day90"]
    for pid in expected:
        if pid not in package_ids:
            log_fail("GET /api/plans", f"Missing package '{pid}'")
            return False
    
    # Check structure
    for pkg in data:
        required_fields = ["id", "name", "days", "price", "bandwidth_gb", "features"]
        for field in required_fields:
            if field not in pkg:
                log_fail("GET /api/plans", f"Package missing field '{field}'")
                return False
    
    log_pass("GET /api/plans (returns day7/day30/day90 with bandwidth_gb, price, features)")
    return True

def test_admin_packages_crud():
    """Test admin packages CRUD operations"""
    # GET /api/admin/packages
    resp = make_request("GET", "/admin/packages", token=admin_token)
    if not resp or resp.status_code != 200:
        log_fail("GET /api/admin/packages", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    # POST /api/admin/packages (create temp package)
    test_pkg_id = f"testpkg_{int(time.time())}"
    resp = make_request("POST", "/admin/packages", token=admin_token, json_data={
        "id": test_pkg_id,
        "name": "Test Package",
        "days": 15,
        "price": 75000,
        "price_label": "Rp 75.000",
        "bandwidth_gb": 25,
        "tier": "RESELLER",
        "popular": False,
        "active": True,
        "features": ["Test feature"]
    })
    if not resp or resp.status_code != 201:
        log_fail("POST /api/admin/packages", f"Status {resp.status_code if resp else 'N/A'}, expected 201")
        return False
    
    # PATCH /api/admin/packages/{id} (update price)
    resp = make_request("PATCH", f"/admin/packages/{test_pkg_id}", token=admin_token, json_data={
        "id": test_pkg_id,
        "name": "Test Package Updated",
        "days": 15,
        "price": 80000,
        "price_label": "Rp 80.000",
        "bandwidth_gb": 25,
        "tier": "RESELLER",
        "popular": False,
        "active": True,
        "features": ["Test feature"]
    })
    if not resp or resp.status_code != 200:
        log_fail("PATCH /api/admin/packages", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if data.get("price") != 80000:
        log_fail("PATCH /api/admin/packages", f"Price not updated, got {data.get('price')}")
        return False
    
    # DELETE /api/admin/packages/{id}
    resp = make_request("DELETE", f"/admin/packages/{test_pkg_id}", token=admin_token)
    if not resp or resp.status_code != 200:
        log_fail("DELETE /api/admin/packages", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    # Verify non-admin is blocked
    resp = make_request("GET", "/admin/packages", token=customer_token)
    if not resp or resp.status_code != 403:
        log_fail("Admin packages CRUD (non-admin block)", f"Status {resp.status_code if resp else 'N/A'}, expected 403")
        return False
    
    log_pass("Admin packages CRUD (GET/POST/PATCH/DELETE, non-admin blocked)")
    return True

# ============================================================================
# 3. ORDER FLOW TESTS
# ============================================================================
order_id_pending: Optional[str] = None
order_id_to_reject: Optional[str] = None

def test_create_order():
    """Test customer creates order"""
    global order_id_pending
    
    resp = make_request("POST", "/orders", token=customer_token, json_data={
        "package_id": "day7",
        "country": "ID"
    })
    
    if not resp or resp.status_code != 201:
        log_fail("POST /api/orders", f"Status {resp.status_code if resp else 'N/A'}, expected 201")
        return False
    
    data = resp.json()
    if data.get("status") != "pending":
        log_fail("POST /api/orders", f"Status is '{data.get('status')}', expected 'pending'")
        return False
    
    if data.get("country") != "ID":
        log_fail("POST /api/orders", f"Country is '{data.get('country')}', expected 'ID'")
        return False
    
    order_id_pending = data.get("id")
    log_pass("POST /api/orders (status=pending, country=ID)")
    return True

def test_duplicate_order():
    """Test duplicate pending order is blocked"""
    resp = make_request("POST", "/orders", token=customer_token, json_data={
        "package_id": "day7",
        "country": "US"
    })
    
    if not resp or resp.status_code != 409:
        log_fail("Duplicate order check", f"Status {resp.status_code if resp else 'N/A'}, expected 409")
        return False
    
    log_pass("Duplicate order blocked (409)")
    return True

def test_get_orders_mine():
    """Test GET /api/orders/mine"""
    resp = make_request("GET", "/orders/mine", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/orders/mine", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not isinstance(data, list) or len(data) == 0:
        log_fail("GET /api/orders/mine", "Expected non-empty list")
        return False
    
    # Check if our pending order is there
    found = any(o.get("id") == order_id_pending for o in data)
    if not found:
        log_fail("GET /api/orders/mine", "Pending order not found in list")
        return False
    
    log_pass("GET /api/orders/mine (shows pending order)")
    return True

def test_admin_get_orders():
    """Test admin GET /api/admin/orders?status=pending"""
    resp = make_request("GET", "/admin/orders", token=admin_token, params={"status": "pending"})
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/admin/orders?status=pending", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not isinstance(data, list):
        log_fail("GET /api/admin/orders?status=pending", "Response is not a list")
        return False
    
    # Check if our pending order is there
    found = any(o.get("id") == order_id_pending for o in data)
    if not found:
        log_fail("GET /api/admin/orders?status=pending", "Pending order not found")
        return False
    
    log_pass("GET /api/admin/orders?status=pending (shows pending order)")
    return True

def test_admin_confirm_order():
    """Test admin confirms order"""
    if not order_id_pending:
        log_fail("Admin confirm order", "No pending order ID")
        return False
    
    resp = make_request("POST", f"/admin/orders/{order_id_pending}/confirm", token=admin_token)
    
    if not resp or resp.status_code != 200:
        log_fail("POST /api/admin/orders/{id}/confirm", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if data.get("status") != "confirmed":
        log_fail("POST /api/admin/orders/{id}/confirm", f"Status is '{data.get('status')}', expected 'confirmed'")
        return False
    
    log_pass("POST /api/admin/orders/{id}/confirm (status=confirmed)")
    return True

def test_proxy_account_after_confirm():
    """Test GET /api/proxy-account after order confirmation"""
    resp = make_request("GET", "/proxy-account", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/proxy-account (after confirm)", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    
    # Check all required fields
    checks = [
        (data.get("active") == True, "active should be true"),
        (data.get("package_id") == "day7", f"package_id should be 'day7', got '{data.get('package_id')}'"),
        (data.get("country") == "ID", f"country should be 'ID', got '{data.get('country')}'"),
        (data.get("host") != "", "host should not be empty"),
        (data.get("port") > 0, "port should be > 0"),
        (data.get("password") != "", "password should not be empty"),
        (data.get("bandwidth_limit_mb") == 10 * 1024, f"bandwidth_limit_mb should be 10240, got {data.get('bandwidth_limit_mb')}"),
    ]
    
    for check, msg in checks:
        if not check:
            log_fail("GET /api/proxy-account (after confirm)", msg)
            return False
    
    # Check expires_at is in future
    expires_at = data.get("expires_at")
    if not expires_at:
        log_fail("GET /api/proxy-account (after confirm)", "expires_at is missing")
        return False
    
    log_pass("GET /api/proxy-account (active=true, package_id=day7, country=ID, host/port/password present, bandwidth_limit_mb=10240, expires_at in future)")
    return True

def test_create_and_reject_order():
    """Test creating a second order and rejecting it"""
    global order_id_to_reject
    
    # First, we need to create another customer since the first one has a confirmed order
    new_customer_username = f"testcust2_{int(time.time())}"
    resp = make_request("POST", "/auth/register", json_data={
        "username": new_customer_username,
        "password": "testpass123"
    })
    
    if not resp or resp.status_code != 201:
        log_fail("Create second customer for reject test", f"Status {resp.status_code if resp else 'N/A'}")
        return False
    
    new_customer_token = resp.json().get("access_token")
    
    # Create order
    resp = make_request("POST", "/orders", token=new_customer_token, json_data={
        "package_id": "day30",
        "country": "US"
    })
    
    if not resp or resp.status_code != 201:
        log_fail("Create order for reject test", f"Status {resp.status_code if resp else 'N/A'}")
        return False
    
    order_id_to_reject = resp.json().get("id")
    
    # Reject order
    resp = make_request("POST", f"/admin/orders/{order_id_to_reject}/reject", token=admin_token)
    
    if not resp or resp.status_code != 200:
        log_fail("POST /api/admin/orders/{id}/reject", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if data.get("status") != "rejected":
        log_fail("POST /api/admin/orders/{id}/reject", f"Status is '{data.get('status')}', expected 'rejected'")
        return False
    
    log_pass("POST /api/admin/orders/{id}/reject (status=rejected)")
    return True

def test_admin_stats():
    """Test GET /api/admin/stats"""
    resp = make_request("GET", "/admin/stats", token=admin_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/admin/stats", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    
    # Check required fields
    required = ["total_customers", "confirmed_orders", "revenue"]
    for field in required:
        if field not in data:
            log_fail("GET /api/admin/stats", f"Missing field '{field}'")
            return False
    
    # Check values are reasonable
    if data.get("total_customers") < 1:
        log_fail("GET /api/admin/stats", f"total_customers should be >= 1, got {data.get('total_customers')}")
        return False
    
    if data.get("confirmed_orders") < 1:
        log_fail("GET /api/admin/stats", f"confirmed_orders should be >= 1, got {data.get('confirmed_orders')}")
        return False
    
    if data.get("revenue") <= 0:
        log_fail("GET /api/admin/stats", f"revenue should be > 0, got {data.get('revenue')}")
        return False
    
    log_pass("GET /api/admin/stats (total_customers>=1, confirmed_orders>=1, revenue>0)")
    return True

# ============================================================================
# 4. ADMIN CUSTOMERS TESTS
# ============================================================================
created_customer_id: Optional[str] = None

def test_admin_create_customer():
    """Test POST /api/admin/customers"""
    global created_customer_id
    
    customer_username = f"admincust_{int(time.time())}"
    resp = make_request("POST", "/admin/customers", token=admin_token, json_data={
        "username": customer_username,
        "password": "adminpass123",
        "country": "US",
        "package_id": "day30"
    })
    
    if not resp or resp.status_code != 201:
        log_fail("POST /api/admin/customers", f"Status {resp.status_code if resp else 'N/A'}, expected 201")
        return False
    
    data = resp.json()
    
    # Check fields
    checks = [
        (data.get("status") == "active", f"status should be 'active', got '{data.get('status')}'"),
        (data.get("bandwidth_limit_mb") == 50 * 1024, f"bandwidth_limit_mb should be 51200, got {data.get('bandwidth_limit_mb')}"),
        (data.get("proxy_password") != "", "proxy_password should not be empty"),
        (data.get("country") == "US", f"country should be 'US', got '{data.get('country')}'"),
        (data.get("package_id") == "day30", f"package_id should be 'day30', got '{data.get('package_id')}'"),
    ]
    
    for check, msg in checks:
        if not check:
            log_fail("POST /api/admin/customers", msg)
            return False
    
    created_customer_id = data.get("id")
    log_pass("POST /api/admin/customers (status=active, bandwidth_limit_mb=51200, proxy_password present)")
    return True

def test_admin_get_customers():
    """Test GET /api/admin/customers"""
    resp = make_request("GET", "/admin/customers", token=admin_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/admin/customers", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not isinstance(data, list):
        log_fail("GET /api/admin/customers", "Response is not a list")
        return False
    
    # Check if our created customer is there
    found = any(c.get("id") == created_customer_id for c in data)
    if not found:
        log_fail("GET /api/admin/customers", "Created customer not found in list")
        return False
    
    log_pass("GET /api/admin/customers (includes created customer)")
    return True

def test_admin_update_customer():
    """Test PATCH /api/admin/customers/{id}"""
    if not created_customer_id:
        log_fail("PATCH /api/admin/customers", "No customer ID")
        return False
    
    # Test 1: Suspend customer
    resp = make_request("PATCH", f"/admin/customers/{created_customer_id}", token=admin_token, json_data={
        "status": "suspended"
    })
    
    if not resp or resp.status_code != 200:
        log_fail("PATCH /api/admin/customers (suspend)", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if data.get("status") != "suspended":
        log_fail("PATCH /api/admin/customers (suspend)", f"Status should be 'suspended', got '{data.get('status')}'")
        return False
    
    # Test 2: Add days
    resp = make_request("PATCH", f"/admin/customers/{created_customer_id}", token=admin_token, json_data={
        "add_days": 30
    })
    
    if not resp or resp.status_code != 200:
        log_fail("PATCH /api/admin/customers (add_days)", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    # Test 3: Regenerate proxy password
    old_password = data.get("proxy_password")
    resp = make_request("PATCH", f"/admin/customers/{created_customer_id}", token=admin_token, json_data={
        "regenerate_proxy_password": True
    })
    
    if not resp or resp.status_code != 200:
        log_fail("PATCH /api/admin/customers (regenerate_proxy_password)", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    new_password = data.get("proxy_password")
    if new_password == old_password:
        log_fail("PATCH /api/admin/customers (regenerate_proxy_password)", "Password not changed")
        return False
    
    log_pass("PATCH /api/admin/customers (status=suspended, add_days=30, regenerate_proxy_password)")
    return True

def test_admin_delete_customer():
    """Test DELETE /api/admin/customers/{id}"""
    if not created_customer_id:
        log_fail("DELETE /api/admin/customers", "No customer ID")
        return False
    
    resp = make_request("DELETE", f"/admin/customers/{created_customer_id}", token=admin_token)
    
    if not resp or resp.status_code != 200:
        log_fail("DELETE /api/admin/customers", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not data.get("ok"):
        log_fail("DELETE /api/admin/customers", "Response should have ok:true")
        return False
    
    # Verify customer is not in list anymore
    resp = make_request("GET", "/admin/customers", token=admin_token)
    if resp and resp.status_code == 200:
        customers = resp.json()
        found = any(c.get("id") == created_customer_id for c in customers)
        if found:
            log_fail("DELETE /api/admin/customers", "Customer still in list after delete")
            return False
    
    log_pass("DELETE /api/admin/customers (soft delete, not in GET list)")
    return True

# ============================================================================
# 5. SETTINGS TESTS
# ============================================================================
def test_admin_get_settings():
    """Test GET /api/admin/settings"""
    resp = make_request("GET", "/admin/settings", token=admin_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/admin/settings", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    
    # Check required fields
    required = ["payment_info", "proxy_host", "proxy_port", "countries", "upstream"]
    for field in required:
        if field not in data:
            log_fail("GET /api/admin/settings", f"Missing field '{field}'")
            return False
    
    # Check payment_info structure
    payment_info = data.get("payment_info", {})
    if payment_info.get("bank_name") != "BCA":
        log_fail("GET /api/admin/settings", f"bank_name should be 'BCA', got '{payment_info.get('bank_name')}'")
        return False
    
    if payment_info.get("account_number") != "1462261696":
        log_fail("GET /api/admin/settings", f"account_number should be '1462261696', got '{payment_info.get('account_number')}'")
        return False
    
    if payment_info.get("account_holder") != "I KADEK RISPO SUGIANTARA":
        log_fail("GET /api/admin/settings", f"account_holder mismatch")
        return False
    
    # Check proxy settings
    if data.get("proxy_host") != "155.138.227.248":
        log_fail("GET /api/admin/settings", f"proxy_host should be '155.138.227.248', got '{data.get('proxy_host')}'")
        return False
    
    if data.get("proxy_port") != 1080:
        log_fail("GET /api/admin/settings", f"proxy_port should be 1080, got {data.get('proxy_port')}")
        return False
    
    log_pass("GET /api/admin/settings (payment_info BCA/1462261696/I KADEK RISPO SUGIANTARA, proxy_host 155.138.227.248, proxy_port 1080, countries, upstream)")
    return True

def test_admin_update_settings():
    """Test PUT /api/admin/settings"""
    # Update payment_info
    resp = make_request("PUT", "/admin/settings", token=admin_token, json_data={
        "payment_info": {
            "bank_name": "Mandiri",
            "account_number": "9999999999",
            "account_holder": "Test Holder",
            "ewallet": "",
            "qris_note": "Test note"
        }
    })
    
    if not resp or resp.status_code != 200:
        log_fail("PUT /api/admin/settings", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    payment_info = data.get("payment_info", {})
    if payment_info.get("bank_name") != "Mandiri":
        log_fail("PUT /api/admin/settings", f"bank_name not updated, got '{payment_info.get('bank_name')}'")
        return False
    
    # Verify persistence by getting again
    resp = make_request("GET", "/admin/settings", token=admin_token)
    if not resp or resp.status_code != 200:
        log_fail("PUT /api/admin/settings (verify persistence)", "Failed to GET after PUT")
        return False
    
    data = resp.json()
    payment_info = data.get("payment_info", {})
    if payment_info.get("bank_name") != "Mandiri":
        log_fail("PUT /api/admin/settings (verify persistence)", "Changes not persisted")
        return False
    
    # Restore original BCA settings
    resp = make_request("PUT", "/admin/settings", token=admin_token, json_data={
        "payment_info": {
            "bank_name": "BCA",
            "account_number": "1462261696",
            "account_holder": "I KADEK RISPO SUGIANTARA",
            "ewallet": "",
            "qris_note": "Transfer sesuai nominal paket, lalu tekan 'Saya Sudah Bayar'. Konfirmasi manual 1x24 jam."
        }
    })
    
    if not resp or resp.status_code != 200:
        log_fail("PUT /api/admin/settings (restore BCA)", f"Status {resp.status_code if resp else 'N/A'}")
        return False
    
    log_pass("PUT /api/admin/settings (persists changes, restored to BCA)")
    return True

def test_customer_payment_info():
    """Test GET /api/payment-info (customer)"""
    resp = make_request("GET", "/payment-info", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/payment-info", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if "payment_info" not in data:
        log_fail("GET /api/payment-info", "Missing payment_info field")
        return False
    
    payment_info = data.get("payment_info", {})
    if not payment_info:
        log_fail("GET /api/payment-info", "payment_info is empty")
        return False
    
    log_pass("GET /api/payment-info (customer token, payment_info present)")
    return True

def test_customer_countries():
    """Test GET /api/countries (customer)"""
    resp = make_request("GET", "/countries", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/countries", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not isinstance(data, list):
        log_fail("GET /api/countries", "Response is not a list")
        return False
    
    # Check for expected countries
    country_codes = [c.get("code") for c in data]
    expected = ["ID", "US"]
    for code in expected:
        if code not in country_codes:
            log_fail("GET /api/countries", f"Missing country '{code}'")
            return False
    
    log_pass("GET /api/countries (customer token, includes ID/US)")
    return True

# ============================================================================
# 6. REGRESSION TESTS
# ============================================================================
def test_regression_subscription_activate():
    """Test POST /api/subscription/activate still works"""
    # Create a new customer for this test
    test_username = f"regresscust_{int(time.time())}"
    resp = make_request("POST", "/auth/register", json_data={
        "username": test_username,
        "password": "testpass123"
    })
    
    if not resp or resp.status_code != 201:
        log_fail("Regression: register for activate test", f"Status {resp.status_code if resp else 'N/A'}")
        return False
    
    test_token = resp.json().get("access_token")
    
    # Activate subscription
    resp = make_request("POST", "/subscription/activate", token=test_token, json_data={
        "plan_id": "day30"
    })
    
    if not resp or resp.status_code != 200:
        log_fail("POST /api/subscription/activate", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not data.get("id"):
        log_fail("POST /api/subscription/activate", "Response missing user data")
        return False
    
    log_pass("POST /api/subscription/activate (reads packages from DB)")
    return True

def test_regression_auth_me():
    """Test GET /api/auth/me"""
    resp = make_request("GET", "/auth/me", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/auth/me", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not data.get("username"):
        log_fail("GET /api/auth/me", "Missing username in response")
        return False
    
    log_pass("GET /api/auth/me")
    return True

def test_regression_profile():
    """Test GET /api/profile"""
    resp = make_request("GET", "/profile", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/profile", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    log_pass("GET /api/profile")
    return True

def test_regression_ip_info():
    """Test POST /api/tools/ip-info"""
    resp = make_request("POST", "/tools/ip-info", token=customer_token, json_data={
        "ip": "8.8.8.8"
    })
    
    if not resp or resp.status_code != 200:
        log_fail("POST /api/tools/ip-info", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if not data.get("success"):
        log_fail("POST /api/tools/ip-info", "Response missing success field")
        return False
    
    log_pass("POST /api/tools/ip-info")
    return True

def test_regression_hunt():
    """Test POST /api/hunt"""
    resp = make_request("POST", "/hunt", token=customer_token, json_data={
        "target_ip": "8.8.8.8",
        "mode": "ultimate"
    })
    
    if not resp or resp.status_code != 200:
        log_fail("POST /api/hunt", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if "results" not in data:
        log_fail("POST /api/hunt", "Response missing results field")
        return False
    
    log_pass("POST /api/hunt")
    return True

def test_regression_gateway():
    """Test GET /api/gateway"""
    resp = make_request("GET", "/gateway", token=customer_token)
    
    if not resp or resp.status_code != 200:
        log_fail("GET /api/gateway", f"Status {resp.status_code if resp else 'N/A'}, expected 200")
        return False
    
    data = resp.json()
    if "configured" not in data:
        log_fail("GET /api/gateway", "Response missing configured field")
        return False
    
    log_pass("GET /api/gateway")
    return True

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def run_all_tests():
    """Run all tests in order"""
    print("=" * 80)
    print("RIYANMEE PROXY RESELLER BACKEND TEST")
    print("=" * 80)
    print()
    
    # 1. AUTH/ROLE
    print("1. AUTH/ROLE TESTS")
    print("-" * 80)
    test_admin_login()
    test_customer_register()
    test_require_admin_protection()
    print()
    
    # 2. PACKAGES
    print("2. PACKAGES TESTS")
    print("-" * 80)
    test_get_plans()
    test_admin_packages_crud()
    print()
    
    # 3. ORDER FLOW
    print("3. ORDER FLOW TESTS")
    print("-" * 80)
    test_create_order()
    test_duplicate_order()
    test_get_orders_mine()
    test_admin_get_orders()
    test_admin_confirm_order()
    test_proxy_account_after_confirm()
    test_create_and_reject_order()
    test_admin_stats()
    print()
    
    # 4. ADMIN CUSTOMERS
    print("4. ADMIN CUSTOMERS TESTS")
    print("-" * 80)
    test_admin_create_customer()
    test_admin_get_customers()
    test_admin_update_customer()
    test_admin_delete_customer()
    print()
    
    # 5. SETTINGS
    print("5. SETTINGS TESTS")
    print("-" * 80)
    test_admin_get_settings()
    test_admin_update_settings()
    test_customer_payment_info()
    test_customer_countries()
    print()
    
    # 6. REGRESSION
    print("6. REGRESSION TESTS")
    print("-" * 80)
    test_regression_subscription_activate()
    test_regression_auth_me()
    test_regression_profile()
    test_regression_ip_info()
    test_regression_hunt()
    test_regression_gateway()
    print()
    
    # Summary
    print("=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)
    print(f"✅ PASSED: {len(test_results['passed'])}")
    print(f"❌ FAILED: {len(test_results['failed'])}")
    print()
    
    if test_results["failed"]:
        print("FAILED TESTS:")
        for fail in test_results["failed"]:
            print(f"  - {fail}")
        print()
    
    print("=" * 80)
    
    return len(test_results["failed"]) == 0

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
