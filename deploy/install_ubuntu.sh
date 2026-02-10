#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/treehole"
SERVICE_FILE="/etc/systemd/system/treehole.service"
NGINX_SITE="/etc/nginx/sites-available/treehole"
NGINX_LINK="/etc/nginx/sites-enabled/treehole"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root: sudo bash deploy/install_ubuntu.sh"
  exit 1
fi

if [[ ! -f "${PWD}/app.py" ]]; then
  echo "Run this script from the project root directory."
  exit 1
fi

apt update
apt install -y python3 nginx

mkdir -p "${APP_DIR}"
cp app.py "${APP_DIR}/app.py"
chown -R www-data:www-data "${APP_DIR}"

cp deploy/treehole.service "${SERVICE_FILE}"
cp deploy/treehole.nginx.conf "${NGINX_SITE}"

ln -sf "${NGINX_SITE}" "${NGINX_LINK}"
rm -f /etc/nginx/sites-enabled/default

systemctl daemon-reload
systemctl enable --now treehole
nginx -t
systemctl reload nginx

echo "Installed."
echo "Remember to edit ${SERVICE_FILE} and set a strong ADMIN_TOKEN, then run:"
echo "  systemctl daemon-reload && systemctl restart treehole"
