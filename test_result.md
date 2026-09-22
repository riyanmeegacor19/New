#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: >
  User (Bahasa Indonesia) ingin mengubah RIYANMEE PROXY menjadi platform RESELLER proxy global.
  Fase 1: Panel Reseller. Admin = akun 'idmee'. Model jual per paket (7/30/90 hari), pembayaran
  MANUAL (transfer BCA, konfirmasi admin). Provider upstream nanti Bright Data (Fase 2 routing).
  Backend baru menambahkan: role admin/customer, manajemen pelanggan, paket DB-driven, pesanan
  (order) dengan konfirmasi manual, pengaturan (payment info + proxy host + countries + upstream),
  dan endpoint proxy-account untuk pelanggan.

backend:
  - task: "NodeMaven upstream integration in POST /api/hunt (real HTTP 8080 + SOCKS5 1080 creds)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: true
        -agent: "main"
        -comment: "FASE 1 NodeMaven. Config via backend/.env. nodemaven_username() builds dynamic username country/region/city + unique sid per result + filter. /api/hunt emits gateway_host=gate.nodemaven.com, http_port=8080, socks_port=1080 when configured; falls back to VPS otherwise. Verified: real connection through gate.nodemaven.com (socks5:1080 & http:8080) returned live US residential exit IP 47.141.220.162. End-to-end working."
  - task: "Real proxy hunting via VPS gateway (IPRoyal residential upstream) - POST /api/hunt"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "REWROTE /api/hunt. Old behaviour generated FAKE same-/24 IPs. New behaviour: input is country (ISO2, optional) + mode + count; backend calls the VPS gateway control API POST http://<proxy_host>:8090/resolve (Bearer PROXY_GATEWAY_TOKEN) which opens N IPRoyal sticky sessions and returns REAL residential exit IPs. Each result includes real ip, gateway_host, gateway_port, a per-session username ({username}-country-{cc}-session-{token}) and the customer's proxy_password so the customer lands on that exact sticky IP. HuntIn model changed (country/city/mode/count; target_ip kept but ignored). Added GATEWAY_CONTROL_PORT env (default 8090) and _country_name helper. Manually verified end-to-end: /resolve returns real distinct US/GB IPs; round-trip confirmed (session from resolve reproduces same exit IP when a real customer connects through gateway). Requires settings.proxy_host + proxy_port configured (already set to 155.138.227.248:1080). Note: DEPLOYED app still runs OLD code until user re-publishes; this task tests the LOCAL backend which shares the same live VPS gateway."
        -working: true
        -agent: "testing"
        -comment: "PASSED ALL TESTS (5/5). POST /api/hunt endpoint working perfectly with real IPRoyal residential proxies via VPS gateway. Test 1: Hunt US proxies (count=5) returned 5 REAL residential IPs (158.46.196.218, 107.180.180.69, 76.233.91.233, 96.3.96.69, 67.177.112.105), all with gateway_host=155.138.227.248, port=1080, type=Residential, country_code=US, username pattern 'idmee-country-us-session-<token>', password starts with 'rmx-', session present. Test 2: Hunt GB proxies (count=3) returned 3 results with country_code=GB (90.254.189.62, 86.148.144.254, 86.186.97.26). Test 3: Hunt global (no country, count=3) returned 3 results with various country codes (KE, BR, VE). Test 4: Count clamping verified - count=100 returned 29 results (<=30 as expected), count=0 returned 11 results (>=1 as expected). Test 5: History entries created with kind=hunt. VPS gateway response times: 2-26 seconds (acceptable for real upstream calls). All response structures correct with required fields (target, mode, mode_label, count, results). Real IPRoyal integration working correctly."

  - task: "Admin role + seed idmee as admin"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "UserDoc extended with role/status/country/package/bandwidth. seed_demo now sets idmee role=admin idempotently. public_user exposes new fields. require_admin dependency added. Manual curl verified idmee logs in as role=admin."
        -working: true
        -agent: "testing"
        -comment: "PASSED. Admin login with idmee/riyanmee123 returns role=admin. Customer registration returns role=customer. require_admin protection working: returns 403 for customer token, 401 for no token. All auth/role functionality verified working correctly."

  - task: "Packages DB-driven (GET /api/plans) + admin packages CRUD"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Packages seeded into db.packages (day7/day30/day90 with bandwidth_gb). GET /api/plans reads active packages. Admin CRUD: GET/POST/PATCH/DELETE /api/admin/packages (admin only)."
        -working: true
        -agent: "testing"
        -comment: "PASSED. GET /api/plans returns day7/day30/day90 with all required fields (bandwidth_gb, price, features). Admin CRUD fully functional: created test package, updated price, deleted package. Non-admin correctly blocked with 403. All packages functionality verified working."

  - task: "Customer orders flow (create/list/mine) + manual confirm/reject"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "POST /api/orders (customer, pending; blocks duplicate pending). GET /api/orders/mine. Admin: GET /api/admin/orders?status=, POST /api/admin/orders/{id}/confirm (extends expiry, sets country/package/quota, ensures proxy_password, logs purchase+history), POST /api/admin/orders/{id}/reject. Manual curl verified full flow + stats/revenue update."
        -working: true
        -agent: "testing"
        -comment: "PASSED. Complete order flow verified: (1) Customer creates order with status=pending, country=ID. (2) Duplicate pending order correctly blocked with 409. (3) GET /api/orders/mine shows pending order. (4) Admin GET /api/admin/orders?status=pending shows order. (5) Admin confirm order sets status=confirmed. (6) After confirm, GET /api/proxy-account returns active=true, package_id=day7, country=ID, host=155.138.227.248, port=1080, password present, bandwidth_limit_mb=10240, expires_at in future. (7) Admin reject order sets status=rejected. (8) GET /api/admin/stats shows total_customers>=1, confirmed_orders>=1, revenue>0. All order flow functionality working perfectly."

  - task: "Admin customers management (list/create/update/delete)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET/POST/PATCH/DELETE /api/admin/customers. Create can assign package (sets expiry+quota+active). PATCH supports country/status/add_days/bandwidth/new_password/regenerate_proxy_password/package_id. DELETE soft-deletes. All require admin."
        -working: true
        -agent: "testing"
        -comment: "PASSED. Admin customer management fully functional: (1) POST /api/admin/customers with package_id=day30 creates customer with status=active, bandwidth_limit_mb=51200 (50GB), proxy_password present, country=US. (2) GET /api/admin/customers includes created customer. (3) PATCH /api/admin/customers successfully updates status to suspended, adds 30 days, regenerates proxy_password. (4) DELETE /api/admin/customers soft-deletes customer (ok:true), customer no longer in GET list. All CRUD operations verified working."

  - task: "Settings (payment info, proxy host, countries, upstream) + proxy-account + payment-info + countries"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "GET/PUT /api/admin/settings (admin). Defaults seeded incl BCA payment info + proxy_host 155.138.227.248:1080. Customer: GET /api/payment-info, GET /api/countries, GET /api/proxy-account (returns creds+country+expiry+quota+active). require_admin returns 403 for non-admin."
        -working: true
        -agent: "testing"
        -comment: "PASSED. Settings management fully functional: (1) GET /api/admin/settings returns payment_info (BCA/1462261696/I KADEK RISPO SUGIANTARA), proxy_host=155.138.227.248, proxy_port=1080, countries list, upstream config. (2) PUT /api/admin/settings successfully updates payment_info to Mandiri, persists changes verified by GET. Restored to BCA successfully. (3) GET /api/payment-info (customer token) returns payment_info. (4) GET /api/countries (customer token) returns countries list including ID/US. All settings endpoints verified working."

  - task: "Hunting oct-3 (/24) match + unique results + configurable count"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: >
          User requirement (Bahasa Indonesia): hunting is the MOST important feature. When a customer
          enters an IP, hunting must return proxies with the SAME first 3 octets (same /24 subnet).
          Enhanced: added same_subnet_ips() guaranteeing UNIQUE IPs all sharing the target's first 3
          octets; hunt_pool default count raised 12 -> 24; HuntIn accepts optional count (clamped 1..100
          in /hunt). Accessible to BOTH admin and customer (any authenticated user). TEST: POST /api/hunt
          {target_ip, mode, count?} as (a) admin idmee and (b) a customer. Verify all result IPs share
          target first-3-octets, all unique, count respected (default 24, custom e.g. 40), history entry
          created. Verified via curl (24/24 & 40/40 oct3, all unique); confirm for customer token too.
        -working: true
        -agent: "testing"
        -comment: >
          PASSED. All 8 test scenarios verified successfully: (1) Admin login with idmee/riyanmee123 
          successful. (2) Customer registration (hunttest1) successful. (3) Admin hunt with target_ip 
          109.228.222.82, mode=full, default count -> HTTP 200, count=24, ALL 24 IPs share oct-3 prefix 
          109.228.222, ALL unique (no duplicates). (4) Admin hunt with target_ip 8.8.8.8, mode=ultimate, 
          count=40 -> HTTP 200, count=40, ALL 40 IPs share oct-3 prefix 8.8.8, ALL unique. (5) Count 
          clamping verified: count=500 clamped to 100 (<=100), count=0 returned 24 results (>=1), 
          count=-10 returned 1 result (>=1). (6) Customer hunt with target_ip 1.2.3.4, mode=city -> 
          HTTP 200, ALL 24 IPs share oct-3 prefix 1.2.3, ALL unique - confirms hunting accessible to 
          customers. (7) Invalid IP "not-an-ip" -> HTTP 400 with proper error message. (8) History 
          entry created after hunt (kind=hunt, title present). Hunting endpoint working perfectly with 
          correct oct-3 matching, uniqueness guarantee, count clamping, and accessibility to both admin 
          and customer roles.

  - task: "Existing endpoints regression (auth/gateway/hunt/ip-info/proxies/history)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Existing endpoints unchanged except /plans and /subscription/activate now read packages from DB. Verify no regression."
        -working: true
        -agent: "testing"
        -comment: "PASSED. All existing endpoints verified working with no regression."

  - task: "Proxy gateway endpoints (/api/proxy/authorize + /api/proxy/usage) for real Bright Data routing (Fase 2)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: >
          NEW Fase 2 endpoints for the VPS proxy gateway. Both protected by Bearer PROXY_GATEWAY_TOKEN
          (env, value in backend/.env). (1) POST /api/proxy/authorize {username,password}: returns
          {active,reason,customer_id,country,package_id}. active=false with reason for: not_found,
          admin_account, bad_credentials, suspended, no_package, expired, quota_exceeded. Validates
          proxy_password (plaintext match), status active, package_id present, expires_at>now, and
          bandwidth_used_mb < bandwidth_limit_mb (if limit>0). Never returns any upstream/BrightData secret.
          (2) POST /api/proxy/usage {username,bytes_up,bytes_down}: increments bandwidth_used_bytes and
          traffic_bytes via find_one_and_update(return_document=True), then sets bandwidth_used_mb =
          bytes//1048576. Added UserDoc.bandwidth_used_bytes field. require_gateway returns 401 for
          missing/wrong token, 503 if token unset. TEST NEEDED: create a customer (admin) with a package
          (day7) so proxy_password/country/bandwidth_limit_mb are set, read proxy_password from
          GET /api/admin/customers, then: authorize with correct creds+token -> active=true, country set;
          authorize wrong password -> active=false reason=bad_credentials; authorize without/with wrong
          token -> 401; usage POST bytes -> bandwidth_used_mb increases and reflects in
          GET /api/admin/customers; over-quota (set bandwidth_used_mb>=limit via PATCH customer) ->
          authorize active=false reason=quota_exceeded.
        -working: true
        -agent: "testing"
        -comment: >
          PASSED. All 10 test scenarios verified successfully: (1) Admin login with idmee/riyanmee123 
          returns access_token. (2) Created test customer gwtest1 with package_id=day7, country=US - 
          customer created with proxy_password=rmx-35d88199ef, bandwidth_limit_mb=10240 (10GB). 
          (3) Retrieved proxy_password from GET /api/admin/customers. (4) POST /api/proxy/authorize 
          with correct credentials + Bearer PROXY_GATEWAY_TOKEN returns HTTP 200, active=true, 
          reason="ok", customer_id="gwtest1", country="us", package_id="day7". (5) Authorize with 
          wrong password returns HTTP 200, active=false, reason="bad_credentials". (6) Authorize 
          without Authorization header returns HTTP 401. (7) Authorize with wrong Bearer token 
          returns HTTP 401. (8) POST /api/proxy/usage with bytes_up=52428800, bytes_down=52428800 
          (100MB total) returns HTTP 200, ok=true, bandwidth_used_mb=100. Verified via 
          GET /api/admin/customers that bandwidth_used_mb=100. (9) Set bandwidth_used_mb=10240 
          (at limit) via PATCH /api/admin/customers, then authorize returns HTTP 200, active=false, 
          reason="quota_exceeded". (10) DELETE /api/admin/customers cleanup successful. Both proxy 
          gateway endpoints working perfectly with correct authentication, authorization logic, 
          bandwidth tracking, and quota enforcement.

  - task: "HNPROXY-style hunt (same /24, octet 3/4) + credentials point to REAL gateway - POST /api/hunt"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: >
          CHANGED per user (replicate hnproxy.web.id): POST /api/hunt now REQUIRES target_ip. It
          geo-locates the target (ipwho.is) then GENERATES same-/24 IPs (same_subnet_ips) so every
          result shares the target's first 3 octets => octet_match=3 (OCTET 3/4). Location info
          (country/country_code/city/isp/asn) comes from the target geo. Credentials now point to the
          REAL reachable gateway from settings (gateway_host=proxy_host=155.138.227.248,
          gateway_port=proxy_port=1080, protocol=socks5, port=1080) instead of the branded
          server.riyanmee.web.id:5245. username pattern '{username}-country-{cc}-city-{city}-session-{hex8}',
          password=user proxy_password. Results sorted by octet_match desc then latency. Fast (no upstream
          calls). VERIFY: (1) POST /api/hunt {"target_ip":"149.126.15.67","mode":"full","count":12} as an
          authenticated user (use admin idmee OR customer hunter1) -> HTTP 200, count==12, EVERY result ip
          starts with "149.126.15." and octet_match==3, gateway_host=="155.138.227.248", gateway_port==1080,
          protocol=="socks5", non-empty username+password, type=="Residential". (2) target city/country in
          response.target reflects real geo (Ad Dir'iyah / SA, asn AS35819). (3) invalid target_ip
          "not-an-ip" -> HTTP 400. (4) empty target_ip -> HTTP 400. (5) history entry kind=hunt created.
        -working: true
        -agent: "testing"
        -comment: >
          PASSED ALL TESTS (6/6). POST /api/hunt endpoint working perfectly with HNPROXY-style same /24 
          subnet matching. Test results: (1) Admin login successful. (2) Customer login successful. 
          (3) Hunt with target_ip="149.126.15.67", mode="full", count=12 returned exactly 12 results. 
          ALL 12 results verified: IP starts with "149.126.15." (octet_match=3), gateway_host="155.138.227.248", 
          gateway_port=1080, protocol="socks5", username non-empty (pattern: idmee-country-sa-city-addir'iyah-session-<hex8>), 
          password non-empty (rmx-c01ef22e63), type="Residential". Sample IPs: 149.126.15.96, 149.126.15.101, 
          149.126.15.100, 149.126.15.226, 149.126.15.39, 149.126.15.82, 149.126.15.118, 149.126.15.20, 
          149.126.15.136, 149.126.15.23, 149.126.15.243, 149.126.15.160. (4) Target geo correctly shows 
          country_code=SA (Saudi Arabia), city=Ad Dir'iyah, asn=AS35819. (5) Invalid IP "not-an-ip" 
          correctly rejected with HTTP 400. (6) Empty target_ip correctly rejected with HTTP 400. 
          (7) History entry with kind=hunt created and verified. All HNPROXY-style requirements met: 
          same /24 subnet (octet 3/4 match), credentials point to real gateway (155.138.227.248:1080), 
          real geo-location data. No issues found.

  - task: "Proxy authorize/usage point-of-truth for gateway (customer active, admin rejected) - POST /api/proxy/authorize + /api/proxy/usage"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: >
          Re-verify after hunt change (endpoints themselves unchanged but critical for usability). Use
          Authorization: Bearer <PROXY_GATEWAY_TOKEN> from backend/.env. Test customer already seeded:
          username 'hunter1', proxy_password 'rmx-726ad07bc3', package day30 active, country sa. Scenarios:
          (1) authorize {username:"hunter1", password:"rmx-726ad07bc3"} + valid token -> active:true,
          reason:"ok", country:"sa", package_id:"day30". (2) authorize admin {username:"idmee",
          password:"rmx-c01ef22e63"} -> active:false reason:"admin_account". (3) wrong password ->
          active:false reason:"bad_credentials". (4) no token / wrong token -> HTTP 401. (5) usage
          {username:"hunter1", bytes_up:1048576, bytes_down:1048576} + token -> ok:true and
          bandwidth_used_mb increases. Do NOT delete hunter1 (used as the standing test customer).
        -working: true
        -agent: "testing"
        -comment: >
          PASSED ALL TESTS (6/6). Both /api/proxy/authorize and /api/proxy/usage endpoints working 
          perfectly. Test results: (1) Authorize hunter1 with correct credentials (username="hunter1", 
          password="rmx-726ad07bc3") + valid Bearer token (PROXY_GATEWAY_TOKEN) returned HTTP 200, 
          active=true, reason="ok", country="sa", package_id="day30", customer_id="hunter1". 
          (2) Authorize admin account (username="idmee", password="rmx-c01ef22e63") correctly rejected 
          with HTTP 200, active=false, reason="admin_account". (3) Authorize hunter1 with wrong password 
          ("WRONGPASS") correctly rejected with HTTP 200, active=false, reason="bad_credentials". 
          (4) Authorize without Authorization header correctly rejected with HTTP 401. (5) Authorize 
          with wrong Bearer token ("wrongtoken123") correctly rejected with HTTP 401. (6) Usage report 
          with username="hunter1", bytes_up=1048576 (1MB), bytes_down=1048576 (1MB) returned HTTP 200, 
          ok=true, bandwidth_used_mb=2. Verified via GET /api/admin/customers that bandwidth_used_mb 
          increased from 0MB to 2MB and persisted correctly. Gateway authentication (PROXY_GATEWAY_TOKEN) 
          working correctly. Customer hunter1 NOT deleted as requested. All scenarios verified successfully.

frontend:
  - task: "Hans-style connect: Establishing Connection animation + NodeMaven creds (HTTP+SOCKS5) in Success modal"
    implemented: true
    working: "NA"
    file: "frontend/app/(tabs)/hunting.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "HUBUNGKAN memicu modal 'Establishing Connection' 2 fase (INITIALIZING SESSION -> SYNCING TUNNEL PORT, progress bar Animated) sebelum modal Success. Success modal kini menampilkan IP Proxy/Location/ASN/Server + HTTP Port(8080) + SOCKS5 Port(1080) + Username + Password, dengan tombol SALIN HTTP & SALIN SOCKS5 (string host:port:user:pass yang benar-benar berfungsi ke NodeMaven). Copy/export daftar pakai string SOCKS5. Lint clean, web bundle sukses. Belum diuji via automated frontend agent (menunggu izin user)."
  - task: "Reseller frontend (admin panel + customer proxy/buy screens)"
    implemented: true
    working: "NA"
    file: "frontend/app"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        -working: "NA"
        -agent: "main"
        -comment: "Built. beranda role-based entry cards. New screens: app/proxy.tsx (customer proxy creds+quota), app/beli.tsx (pick package+country, manual payment info, order+history), app/admin/{_layout,index,orders,customers,packages,settings}.tsx. admin/_layout guards role=admin. Lint clean. Verified via screenshot: login idmee -> beranda -> Panel Admin renders with nav cards. NOT yet run through automated frontend test (awaiting user permission)."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 4
  run_ui: false

test_plan:
  current_focus:
    - "HNPROXY-style hunt (same /24, octet 3/4) + credentials point to REAL gateway - POST /api/hunt"
    - "Proxy authorize/usage point-of-truth for gateway (customer active, admin rejected) - POST /api/proxy/authorize + /api/proxy/usage"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    -agent: "main"
    -message: >
      FASE 2: Tolong test HANYA endpoint gateway baru: POST /api/proxy/authorize dan POST /api/proxy/usage.
      Keduanya butuh header Authorization: Bearer <PROXY_GATEWAY_TOKEN> (ambil nilainya dari backend/.env,
      key PROXY_GATEWAY_TOKEN). Skenario: (1) login admin idmee/riyanmee123, buat customer baru via
      POST /api/admin/customers dengan package_id=day7 & country=us (ini otomatis set proxy_password,
      country, bandwidth_limit_mb). Ambil proxy_password dari GET /api/admin/customers. (2) authorize
      dengan {username, password=proxy_password} + token benar -> active=true, country=us. (3) authorize
      password salah -> active=false reason=bad_credentials (HTTP 200). (4) authorize tanpa token / token
      salah -> 401. (5) usage POST {username, bytes_up, bytes_down} + token -> ok:true dan bandwidth_used_mb
      naik; verifikasi lewat GET /api/admin/customers. (6) set kuota habis via PATCH
      /api/admin/customers/{id} {bandwidth_used_mb: <= besar>=limit} lalu authorize -> active=false
      reason=quota_exceeded. Bersihkan customer test bila memungkinkan. Jangan test fitur lain.
    -agent: "testing"
    -message: >
      FASE 2 PROXY GATEWAY TESTING COMPLETE - ALL TESTS PASSED (10/10). Both /api/proxy/authorize and 
      /api/proxy/usage endpoints are working perfectly. All scenarios verified: (1) Admin login successful, 
      (2) Customer creation with package sets proxy_password and bandwidth_limit_mb correctly, 
      (3) Authorize with correct credentials returns active=true with country and customer_id, 
      (4) Authorize with wrong password returns active=false reason=bad_credentials, (5) Authorize 
      without token or with wrong token returns 401, (6) Usage reporting increments bandwidth_used_mb 
      correctly and persists to database, (7) Quota exceeded scenario returns active=false 
      reason=quota_exceeded when bandwidth_used_mb >= bandwidth_limit_mb. Gateway authentication 
      (PROXY_GATEWAY_TOKEN) working correctly. No issues found. Ready for production use.
    -agent: "testing"
    -message: >
      HUNTING ENDPOINT TESTING COMPLETE - ALL TESTS PASSED (8/8). POST /api/hunt endpoint verified 
      working perfectly with all requested scenarios: (1) Admin hunt with default count=24 returns 
      exactly 24 results, ALL sharing first 3 octets (109.228.222.x), ALL unique. (2) Admin hunt with 
      custom count=40 returns exactly 40 results, ALL sharing first 3 octets (8.8.8.x), ALL unique. 
      (3) Count clamping working correctly: count=500 clamped to 100, count=0 returns >=1, count=-10 
      returns >=1. (4) Customer access verified: registered customer can successfully hunt, results 
      share oct-3 prefix and are unique. (5) Invalid IP validation working: "not-an-ip" returns HTTP 400. 
      (6) History entry created after each hunt with kind=hunt. Oct-3 matching (same /24 subnet) and 
      uniqueness guarantee working as designed. Hunting accessible to both admin and customer roles. 
      No issues found.

    -agent: "main"
    -message: >
      RETEST NEEDED - only POST /api/hunt (new IPRoyal-backed real hunting). The VPS gateway control API
      (http://155.138.227.248:8090/resolve) is LIVE. Scenarios: (1) login admin idmee/riyanmee123.
      (2) POST /api/hunt {"country":"us","mode":"ultimate","count":5} -> HTTP 200, count>=1, and EACH result
      MUST contain non-empty real ip, port>0, gateway_host="155.138.227.248", a username matching pattern
      "<admin>-country-us-session-<token>", non-empty password, type="Residential", and country_code="US".
      (3) POST /api/hunt {"country":"gb","count":3} -> results country_code should be "GB". (4) POST /api/hunt
      {"mode":"ultimate","count":3} with NO country -> HTTP 200, results returned (global). (5) count clamp:
      count=100 -> at most 30 results; count=0 -> >=1. (6) A history entry with kind=hunt is created.
      NOTE: this hits the real IPRoyal upstream (consumes a tiny bit of bandwidth). Keep counts small.
      Do NOT test other endpoints. target_ip field is deprecated/ignored.
    -agent: "testing"
    -message: >
      REAL PROXY HUNTING TESTING COMPLETE - ALL TESTS PASSED (5/5). POST /api/hunt endpoint working 
      perfectly with real IPRoyal residential proxies via VPS gateway control API. Test results: 
      (1) Hunt US proxies (ultimate mode, count=5): Returned 5 REAL residential IPs with all required 
      fields validated - gateway_host=155.138.227.248, port=1080, type=Residential, country_code=US, 
      username pattern 'idmee-country-us-session-<token>', password starts with 'rmx-', session present. 
      Sample IPs: 158.46.196.218, 107.180.180.69, 76.233.91.233, 96.3.96.69, 67.177.112.105. 
      (2) Hunt GB proxies (count=3): All 3 results have country_code=GB. Sample IPs: 90.254.189.62, 
      86.148.144.254, 86.186.97.26. (3) Hunt global (no country, count=3): Returned 3 results with 
      various country codes (KE, BR, VE) as expected for global hunt. (4) Count clamping verified: 
      count=100 returned 29 results (<=30 ✓), count=0 returned 11 results (>=1 ✓). (5) History entries 
      created with kind=hunt. VPS gateway response times: 2-26 seconds (acceptable for real upstream). 
      All response structures correct with required fields (target, mode, mode_label, count, results). 
      Real IPRoyal integration working correctly. No issues found.

    -agent: "main"
    -message: >
      RETEST after HNPROXY-style change. Test ONLY the two current_focus backend tasks. Auth: obtain
      JWT via POST /api/auth/login. Gateway endpoints need Authorization: Bearer <PROXY_GATEWAY_TOKEN>
      (read from backend/.env, key PROXY_GATEWAY_TOKEN). Standing test customer already exists:
      login idmee/riyanmee123 (admin) and customer hunter1/hunter123 (proxy_password rmx-726ad07bc3,
      package day30, country sa). (A) POST /api/hunt {"target_ip":"149.126.15.67","mode":"full","count":12}
      with a valid JWT (admin OR customer) -> HTTP 200, count==12, EVERY result: ip startswith "149.126.15.",
      octet_match==3, gateway_host=="155.138.227.248", gateway_port==1080, protocol=="socks5", username+password
      non-empty, type=="Residential"; response.target.city/country_code reflect real geo; invalid ip "not-an-ip"
      -> 400; empty target_ip -> 400; history kind=hunt created. (B) /api/proxy/authorize + /api/proxy/usage
      with PROXY_GATEWAY_TOKEN: hunter1+rmx-726ad07bc3 -> active:true reason ok country sa package day30;
      idmee -> active:false reason admin_account; wrong password -> active:false bad_credentials; no/wrong token
      -> 401; usage {username:hunter1, bytes_up:1048576, bytes_down:1048576} -> ok:true and bandwidth_used_mb up.
      Do NOT delete hunter1. Do NOT test other endpoints/frontend.
    -agent: "testing"
    -message: >
      HNPROXY-STYLE HUNT + PROXY GATEWAY TESTING COMPLETE - ALL TESTS PASSED (12/12). Both backend tasks 
      verified working perfectly. Test A (POST /api/hunt): (1) Admin and customer login successful. 
      (2) Hunt with target_ip="149.126.15.67", mode="full", count=12 returned exactly 12 results. ALL 12 
      results verified with correct same /24 subnet matching: IP starts with "149.126.15." (octet_match=3), 
      gateway_host="155.138.227.248", gateway_port=1080, protocol="socks5", username non-empty (pattern: 
      idmee-country-sa-city-addir'iyah-session-<hex8>), password non-empty (rmx-c01ef22e63), 
      type="Residential". Sample IPs: 149.126.15.96, 149.126.15.101, 149.126.15.100, 149.126.15.226, 
      149.126.15.39, 149.126.15.82, 149.126.15.118, 149.126.15.20, 149.126.15.136, 149.126.15.23, 
      149.126.15.243, 149.126.15.160. (3) Target geo correctly shows country_code=SA (Saudi Arabia), 
      city=Ad Dir'iyah, asn=AS35819. (4) Invalid IP "not-an-ip" correctly rejected with HTTP 400. 
      (5) Empty target_ip correctly rejected with HTTP 400. (6) History entry with kind=hunt created. 
      Test B (POST /api/proxy/authorize + /api/proxy/usage): (1) Authorize hunter1 with correct credentials 
      + valid Bearer token returned active=true, reason="ok", country="sa", package_id="day30". 
      (2) Authorize admin account (idmee) correctly rejected with active=false, reason="admin_account". 
      (3) Authorize with wrong password correctly rejected with active=false, reason="bad_credentials". 
      (4) Authorize without Authorization header correctly rejected with HTTP 401. (5) Authorize with 
      wrong Bearer token correctly rejected with HTTP 401. (6) Usage report (1MB up + 1MB down = 2MB) 
      returned ok=true, bandwidth_used_mb increased from 0MB to 2MB (verified via admin API). Customer 
      hunter1 NOT deleted as requested. All HNPROXY-style requirements met: same /24 subnet (octet 3/4 
      match), credentials point to real gateway (155.138.227.248:1080), real geo-location data. Gateway 
      authentication and bandwidth tracking working correctly. No issues found.
