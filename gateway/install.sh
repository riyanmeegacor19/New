#!/usr/bin/env bash
# ============================================================
# RIYANMEE PROXY — VPS Gateway one-shot installer
# Jalankan di VPS Ubuntu/Debian (root/sudo), dari dalam folder gateway/:
#   sudo bash install.sh
# ============================================================
set -euo pipefail

APP_DIR=/opt/riyanmee-gateway
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Memasang dependency sistem (python3-venv)"
apt-get update -y >/dev/null 2>&1 || true
apt-get install -y python3-venv python3-pip >/dev/null 2>&1 || true

echo "==> Membuat user & folder aplikasi"
id riyanmee >/dev/null 2>&1 || useradd -r -m -d "$APP_DIR" riyanmee
mkdir -p "$APP_DIR"
cp "$SRC_DIR/proxy.py" "$SRC_DIR/requirements.txt" "$APP_DIR/"

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$SRC_DIR/.env.example" "$APP_DIR/.env"
  echo "==> .env dibuat dari .env.example — WAJIB diedit: nano $APP_DIR/.env"
else
  echo "==> .env sudah ada, dibiarkan"
fi

echo "==> Membuat virtualenv & install paket python"
python3 -m venv "$APP_DIR/.venv"
"$APP_DIR/.venv/bin/pip" install -q --upgrade pip
"$APP_DIR/.venv/bin/pip" install -q -r "$APP_DIR/requirements.txt"

chown -R riyanmee:riyanmee "$APP_DIR"
chmod 600 "$APP_DIR/.env"

echo "==> Memasang systemd service"
cp "$SRC_DIR/riyanmee-gateway.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable riyanmee-gateway >/dev/null 2>&1 || true

echo
echo "============================================================"
echo " SELESAI dasar. Langkah berikut:"
echo " 1) Edit kredensial:   sudo nano $APP_DIR/.env"
echo " 2) Buka firewall:     sudo ufw allow 8080/tcp && sudo ufw allow 1080/tcp"
echo " 3) Start service:     sudo systemctl restart riyanmee-gateway"
echo " 4) Cek log:           journalctl -u riyanmee-gateway -f"
echo "============================================================"
