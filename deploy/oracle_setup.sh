#!/usr/bin/env bash
# ProblemHunt one-command server setup (Ubuntu 22.04/24.04, e.g. Oracle Cloud Always Free).
# Usage:  bash deploy/oracle_setup.sh yourdomain.com you@example.com
# It installs Python + Caddy (free automatic HTTPS), opens ports 80/443,
# runs ProblemHunt as a service that restarts on reboot, and backs up data daily.
set -euo pipefail

DOMAIN="${1:-}"; ADMIN_EMAIL="${2:-}"
if [[ -z "$DOMAIN" || -z "$ADMIN_EMAIL" ]]; then
  echo "Usage: bash deploy/oracle_setup.sh yourdomain.com you@example.com"; exit 1
fi
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_USER="$(stat -c %U "$APP_DIR")"
echo "==> App folder: $APP_DIR (user $RUN_USER), domain: $DOMAIN"

echo "==> Installing packages"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3 python3-venv python3-pip unzip caddy iptables-persistent

echo "==> Adding 2 GB swap (helps on 1 GB machines)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Opening ports 80 and 443 in the server firewall"
for p in 80 443; do
  sudo iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport $p -j ACCEPT
done
sudo netfilter-persistent save

echo "==> Writing .env (production settings)"
ENV_FILE="$APP_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
PH_PUBLIC_MODE=1
PH_ADMIN_EMAIL=$ADMIN_EMAIL
PH_AUTH_SECRET=$(python3 -c 'import secrets;print(secrets.token_urlsafe(48))')
PH_CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN
EOF
  chmod 600 "$ENV_FILE"; sudo chown "$RUN_USER" "$ENV_FILE"
fi

echo "==> Creating the ProblemHunt service"
sudo tee /etc/systemd/system/problemhunt.service >/dev/null <<EOF
[Unit]
Description=ProblemHunt
After=network-online.target
Wants=network-online.target

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/python3 $APP_DIR/start_problemhunt.py --no-browser --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now problemhunt

echo "==> Configuring HTTPS (Caddy gets a free certificate automatically)"
sudo tee /etc/caddy/Caddyfile >/dev/null <<EOF
$DOMAIN, www.$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:8000
}
EOF
sudo systemctl restart caddy

echo "==> Daily backup of your data at 02:30 (keeps 14 days in ~/ph-backups)"
BK="/home/$RUN_USER/ph-backups"; mkdir -p "$BK"; sudo chown "$RUN_USER" "$BK"
CRON="30 2 * * * tar czf $BK/data-\$(date +\\%F).tgz -C $APP_DIR/backend data && find $BK -name 'data-*.tgz' -mtime +14 -delete"
( sudo -u "$RUN_USER" crontab -l 2>/dev/null | grep -v ph-backups; echo "$CRON" ) | sudo -u "$RUN_USER" crontab -

echo
echo "First start installs Python packages (2-4 minutes). Check with:  sudo systemctl status problemhunt"
echo "Logs:  journalctl -u problemhunt -f"
echo "When your domain points to this server, open:  https://$DOMAIN"
echo "Sign up with $ADMIN_EMAIL (using a password) — that account becomes the admin."
