# RIYANMEE PROXY — VPS Gateway (Fase 2)

Proxy asli yang berjalan di **VPS milik Anda**. Ia meng-autentikasi pelanggan ke
backend RIYANMEE, lalu meneruskan trafik ke **Bright Data** sesuai negara pelanggan,
dan menghitung bandwidth (kuota).

```
Pelanggan (browser/app)
   |  http(s) proxy  user = username RIYANMEE, pass = proxy_password
   v
VPS gateway (proxy.py)  --CONNECT-->  brd.superproxy.io:44445  (Bright Data)
   |  cek aktif/negara/kuota
   v
Backend RIYANMEE (/api/proxy/authorize, /api/proxy/usage)
```

Kredensial Bright Data **hanya** ada di VPS. Backend hanya mengembalikan `{active, country}`.

---

## 1. Prasyarat
- VPS Ubuntu 22.04/24.04 (atau Debian), akses root/sudo.
- Python 3.10+.
- Akun Bright Data + **Residential zone** (customer id, zone, zone password).
- Backend RIYANMEE sudah ter-deploy (punya URL publik).

## 2. Pasang
```bash
sudo useradd -r -m -d /opt/riyanmee-gateway riyanmee 2>/dev/null || true
sudo mkdir -p /opt/riyanmee-gateway
sudo cp proxy.py requirements.txt .env.example /opt/riyanmee-gateway/
cd /opt/riyanmee-gateway
sudo python3 -m venv .venv
sudo .venv/bin/pip install -r requirements.txt
sudo cp .env.example .env
sudo nano .env   # isi semua nilai (lihat langkah 3)
sudo chown -R riyanmee:riyanmee /opt/riyanmee-gateway
sudo chmod 600 /opt/riyanmee-gateway/.env
```

## 3. Isi `.env`
| Variabel | Nilai |
|---|---|
| `LISTEN_PORT` | Port yang dibuka untuk pelanggan (mis. `8080`) |
| `PLATFORM_AUTH_URL` | `https://<APP-ANDA>/api/proxy/authorize` |
| `PLATFORM_USAGE_URL` | `https://<APP-ANDA>/api/proxy/usage` |
| `PLATFORM_TOKEN` | Sama persis dengan `PROXY_GATEWAY_TOKEN` di backend `.env` |
| `BRD_CUSTOMER_ID` | Customer ID Bright Data |
| `BRD_ZONE` | Nama zone residential |
| `BRD_ZONE_PASSWORD` | Password zone |

> Token gateway backend saat ini: lihat `/app/backend/.env` → `PROXY_GATEWAY_TOKEN`.

## 4. Buka firewall
```bash
sudo ufw allow 8080/tcp   # samakan dengan LISTEN_PORT
```

## 5. Jalankan sebagai service
```bash
sudo cp riyanmee-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now riyanmee-gateway
sudo systemctl status riyanmee-gateway
journalctl -u riyanmee-gateway -f    # lihat log
```

## 6. Set di Panel Admin aplikasi
Buka **Panel Admin → Pengaturan**, lalu set:
- **Proxy Host** = IP publik / domain VPS Anda (mis. `server.riyanmee.web.id`)
- **Proxy Port** = `LISTEN_PORT` (mis. `8080`)
- **Protokol** = `http`

Maka layar **Proxy Saya** pelanggan otomatis menampilkan endpoint yang benar.

## 7. Uji coba (dari komputer mana pun)
Ganti `USER`/`PASS` dengan username RIYANMEE pelanggan + `proxy_password`-nya
(bisa dilihat/di-generate admin di **Panel Admin → Pelanggan**), dan `VPS:PORT`.

```bash
# HTTPS (CONNECT) — cek negara exit
curl -v -x http://USER:PASS@VPS:8080 https://geo.brdtest.com/mygeo.json

# HTTP biasa
curl -v -x http://USER:PASS@VPS:8080 http://example.com

# Kredensial salah / pelanggan non-aktif -> harus 407
curl -v -x http://salah:salah@VPS:8080 https://example.com
```
Jika berhasil, `mygeo.json` menampilkan negara sesuai paket pelanggan, dan
kuota pemakaian bertambah di **Panel Admin → Pelanggan**.

## 8. Catatan penting
- Port Bright Data **44445** (HTTP/HTTPS/CONNECT). SOCKS5 pakai `22228` (belum diaktifkan di gateway ini).
- Kuota Bright Data tidak real-time; kuota RIYANMEE dihitung lokal oleh gateway → backend.
- Gateway ini WAJIB pakai auth (sudah). Jangan biarkan port terbuka tanpa firewall.
- Untuk banyak pelanggan bersamaan, naikkan `MAX_CONNECTIONS` dan resource VPS.
