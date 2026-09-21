# RIYANMEE PROXY — PRD

## Problem Statement
User (Bahasa Indonesia) meminta aplikasi proxy bergaya "HN Proxy V1", lalu memberi referensi baru **HNPROXY V3** (hnproxy.web.id) dan meminta dibangun serupa dengan brand **RIYANMEE PROXY** dan server lebih bagus.

## Architecture
- **Frontend**: Expo Router (React Native), @tanstack/react-query, react-native-keyboard-controller, MaterialCommunityIcons. Tema gelap hijau neon dari `src/theme.ts`.
- **Backend**: FastAPI + Motor (MongoDB async), semua route prefix `/api`.
- **Auth**: JWT bearer (pyjwt) + bcrypt hashing. Token disimpan di secure storage key `riyanmee_token`. Demo user `idmee` di-seed idempoten saat startup.
- **Data geo nyata**: ipwho.is (Cek IP & target Hunting), cloudflare trace (my-ip).

## User Personas
- Pelanggan proxy yang butuh dashboard akun, hunting proxy per lokasi/ISP, dan cek info IP.

## Core Requirements (static)
- Login + registrasi mandiri + akun demo
- Dashboard profil: membership + hitung mundur, server/port, ganti password, IP whitelist, total IP pool
- IP Hunting: target IP + mode (Ultimate/Full/Kota/ISP) -> daftar proxy IP:port cocok, bisa disalin
- Cek Informasi IP: lacak negara/kota/ISP
- Riwayat aktivitas
- Semua UI Bahasa Indonesia, tema hijau neon

## Implemented (2026-09-20)
- Iterasi 1: App tunnel awal (SSH/SOCKS5, server list, config, log, tools) — DIGANTI.
- Iterasi 3 (aktif): Rebuild total gaya HNPROXY V3.
  - Backend: /auth (register/login/me/change-password), /profile (+whitelist/reset-traffic), /my-ip, /hunt, /tools/ip-info, /history. bcrypt+JWT, seed demo idempoten.
  - Frontend: login, register, tabs (Beranda/Hunting/Cek IP/Riwayat), auth guard + redirect, toast, modal ganti password.
  - Tested: 21/21 backend pytest pass, E2E frontend pass.

## Backlog
- **P1**: Modal ganti password — bungkus konten dalam ScrollView agar tombol selalu terlihat di layar kecil.
- **P2**: Ekspor daftar proxy hasil hunting ke file/txt.
- **P2**: Bahasa toggle ID/EN + toggle tema seperti referensi.
- **P2**: Integrasi server proxy nyata milik user (host/port/user/pass) bila user menyediakan.

## Next Tasks
- Iterasi 6: Sambung Gateway (done), Impor Server, Salin Kredensial.

## Iterasi 7 (2026-09-21) — Hunting fokus IP Target
- Frontend hunting.tsx: dropdown NEGARA diganti input ALAMAT IP TARGET (IPV4/IPV6) sesuai gaya HNPROXY.
  Kirim {target_ip, mode} ke POST /api/hunt (backend sudah geo-lookup target -> resolve gateway).
  Setiap hasil menampilkan "KEMIRIPAN: OCTET x/4" (field octet_match), kota/negara/ISP/ASN, tombol HUBUNGKAN.
  Validasi IPv4/IPv6 di client + toast. Modal & state negara dihapus. Verified via screenshot (12 proxy Jeddah, SA).
- Hunting B+C: hasil diurutkan berdasar octet_match menurun (paling mirip di atas); kartu octet>=2
  disorot (border hijau kiri + latar brandTertiary + badge "MIRIP"). useMemo sortedResults. Verified screenshot.
- Hunting BOOST (opsi A, 2026-09-21): saat ada target_ip, backend memperbesar pool kandidat dengan
  _gateway_resolve_pool (3 ronde x30 sesi paralel, dedupe by IP ~90 kandidat), lalu rank
  (octet_match desc -> ASN sama -> latency asc) dan ambil top `count`. Semua IP residential NYATA.
  Hasil: 2/4 (blok ISP sama) kini andal muncul & diprioritaskan; 3/4 (persis /24) tetap jarang
  karena provider residential tidak mengizinkan pilih /24 (riset IPRoyal/BrightData/Oxylabs).
  Durasi hunt ~25s (ronde paralel). Verified via curl + screenshot (3x 2/4 tersorot di atas).
- Hunting HNPROXY-STYLE (2026-09-21, FINAL per permintaan user): /hunt kini GENERATE IP di /24 yang
  SAMA dengan target (same_subnet_ips) -> OCTET 3/4 KONSISTEN, cepat (~0.2s, tanpa panggil pool
  residential). Info country/city/ISP/ASN dari geo_lookup(target). Kredensial koneksi pakai
  user.server_host:server_port (server.riyanmee.web.id:5245) + username targeting country/city/session.
  Persis seperti hnproxy.web.id (target 149.126.15.67 -> 149.126.15.x OCTET 3/4, RIYADH/AsDiriyah AS35819 SA).
  Catatan: IP yang ditampilkan = target /24 (aspirasi), exit nyata dirutekan gateway ke lokasi/ASN sama.
  _gateway_resolve_pool / mode BOOST real tidak dipakai lagi (disimpan di kode utk referensi). Verified screenshot (list 3/4 + Success modal).
- Success modal disamakan dgn HNPROXY (2026-09-21): baris User & Pass dihapus; ASN menampilkan nama
  lengkap ISP (connected.isp || connected.asn, mis "AS35819 Etihad Etisalat, a joint stock company").
  Tombol SALIN KREDENSIAL tetap ada utk menyalin host:port:user:pass. Verified screenshot.
- Proxy USABLE (opsi A, 2026-09-21): hunt results kini menampilkan endpoint gateway ASLI dari settings
  (proxy_host:proxy_port = 155.138.227.248:1080 socks5), bukan branding server.riyanmee.web.id:5245.
  Backend /api/proxy/authorize TERBUKTI active:true utk customer aktif (hunter1/day30) dgn PROXY_GATEWAY_TOKEN;
  admin (idmee) ditolak (admin_account). Uji: gateway live 155.138.227.248 masih 407 utk user app karena VPS
  mengarah ke backend lain. SISA LANGKAH DI VPS: set PLATFORM_AUTH_URL=<backend>/api/proxy/authorize,
  PLATFORM_USAGE_URL=<backend>/api/proxy/usage, PLATFORM_TOKEN=PROXY_GATEWAY_TOKEN + IPRoyal creds.
  Test customer: hunter1 / hunter123 (proxy pass rmx-726ad07bc3). Verified via curl + screenshot.


## Reseller Platform (2026-09-20) — FASE 1
- Pivot: RIYANMEE PROXY jadi platform RESELLER proxy global (Bright Data upstream, Fase 2).
- Admin = akun `idmee` (role admin, seeded idempoten). Customer = user register biasa.
- Backend: role admin/customer; packages DB-driven (day7/30/90 + bandwidth_gb); orders flow
  (pending -> admin confirm/reject) mengaktifkan pelanggan (expiry+country+quota+proxy creds);
  admin CRUD customers & packages; settings (payment info BCA, proxy_host 155.138.227.248:1080,
  countries, upstream Bright Data). Endpoints customer: /proxy-account, /payment-info, /countries,
  /orders, /orders/mine. 27/27 backend tests pass.
- Frontend: beranda menampilkan "Panel Admin" (admin) atau "Proxy Saya" + "Beli Paket" (customer).
  Layar baru: app/proxy.tsx, app/beli.tsx, app/admin/{index,orders,customers,packages,settings}.tsx.
  Pembayaran MANUAL (transfer BCA, konfirmasi admin). Verified render via screenshot (login->admin).
- FASE 2 (belum): otomatisasi routing 3proxy VPS -> Bright Data per negara + provisioning user.
