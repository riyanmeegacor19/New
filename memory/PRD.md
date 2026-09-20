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
