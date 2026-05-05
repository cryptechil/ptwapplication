#!/usr/bin/env bash
# One-shot installer for PTW on a fresh Ubuntu 24.04 VPS.
# Run as root. Idempotent — safe to re-run.

set -euo pipefail

DOMAIN="${PTW_DOMAIN:-ptw.crtgeeb.co.il}"
REPO="${PTW_REPO:-https://github.com/cryptechil/ptwapplication.git}"
BRANCH="${PTW_BRANCH:-claude/ptw-request-system-cg4KY}"
APP_DIR=/var/www/ptw/app
WEB_DIR=/var/www/ptw/web
DB_PASSWORD="${PTW_DB_PASSWORD:-$(openssl rand -base64 24 | tr -d '=+/')}"
SESSION_SECRET="${PTW_SESSION_SECRET:-$(openssl rand -base64 48 | tr -d '=+/')}"
ADMIN_EMAIL="${PTW_ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${PTW_ADMIN_PASSWORD:-$(openssl rand -base64 12 | tr -d '=+/')}"

if [[ $EUID -ne 0 ]]; then echo "Run as root."; exit 1; fi

echo "==> 1/8 system packages"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https \
  git build-essential \
  postgresql redis-server \
  xvfb x11vnc novnc websockify

# Caddy from official repo
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq
  apt-get install -y -qq caddy
fi

# Node 20
if ! node -v 2>/dev/null | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

echo "==> 2/8 ptw user"
id -u ptw &>/dev/null || adduser --system --group --home /var/www/ptw ptw
mkdir -p "$APP_DIR" "$WEB_DIR" /var/log/caddy
chown -R ptw:ptw /var/www/ptw

echo "==> 3/8 clone / pull repo"
if [[ ! -d "$APP_DIR/.git" ]]; then
  sudo -u ptw git clone -b "$BRANCH" "$REPO" "$APP_DIR"
else
  sudo -u ptw git -C "$APP_DIR" fetch origin
  sudo -u ptw git -C "$APP_DIR" checkout "$BRANCH"
  sudo -u ptw git -C "$APP_DIR" pull --ff-only
fi

echo "==> 4/8 npm install + build + playwright chromium"
sudo -u ptw bash -lc "cd $APP_DIR && npm install --no-audit --no-fund"
sudo -u ptw bash -lc "cd $APP_DIR && npx playwright install chromium"
# system deps for Playwright (needs root)
npx --prefix "$APP_DIR" playwright install-deps chromium
sudo -u ptw bash -lc "cd $APP_DIR && npm run build"
rm -rf "$WEB_DIR"/*
cp -r "$APP_DIR"/apps/web/dist/* "$WEB_DIR"/
chown -R ptw:ptw "$WEB_DIR"

echo "==> 5/8 postgres"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='ptw'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ptw WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='ptw'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ptw OWNER ptw;"

echo "==> 6/8 .env"
if [[ ! -f "$APP_DIR/.env" ]]; then
  cat >"$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://ptw:$DB_PASSWORD@localhost:5432/ptw
REDIS_URL=redis://localhost:6379
API_PORT=4000
PUBLIC_API_URL=https://$DOMAIN
PUBLIC_WEB_URL=https://$DOMAIN
SESSION_SECRET=$SESSION_SECRET
PLAYWRIGHT_HEADLESS=false
TEVEL_FORM_URL=https://forms.monday.com/forms/10a9b1154e8e65b9db479776224827a5?r=euc1
WORKER_LIVE_VIEW_PORT=7900
UPLOAD_DIR=/var/www/ptw/data/uploads
SNAPSHOT_DIR=/var/www/ptw/data/snapshots
SEED_ADMIN_EMAIL=$ADMIN_EMAIL
SEED_ADMIN_PASSWORD=$ADMIN_PASSWORD
SEED_ADMIN_NAME=Administrator
EOF
  chown ptw:ptw "$APP_DIR/.env"
  chmod 600 "$APP_DIR/.env"
fi
mkdir -p /var/www/ptw/data/uploads /var/www/ptw/data/snapshots
chown -R ptw:ptw /var/www/ptw/data

echo "==> 7/8 prisma migrate"
sudo -u ptw bash -lc "cd $APP_DIR && npx prisma migrate deploy --schema apps/api/prisma/schema.prisma"

echo "==> 8/8 systemd + caddy"
cp "$APP_DIR"/deploy/{xvfb,x11vnc,novnc,worker}.service /etc/systemd/system/
mv /etc/systemd/system/worker.service /etc/systemd/system/ptw-worker.service
cp "$APP_DIR"/deploy/api.service /etc/systemd/system/ptw-api.service
systemctl daemon-reload
systemctl enable --now xvfb.service x11vnc.service novnc.service ptw-api.service ptw-worker.service

# Caddy: only overwrite if not already customized
if ! grep -q 'ptw.crtgeeb.co.il' /etc/caddy/Caddyfile 2>/dev/null; then
  cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
fi
systemctl reload caddy || systemctl restart caddy

cat <<EOF

============================================================
PTW deployed.

URL:           https://$DOMAIN  (TLS issued by Caddy on first hit)
Admin email:   $ADMIN_EMAIL
Admin pass:    $ADMIN_PASSWORD
DB password:   $DB_PASSWORD     (saved in $APP_DIR/.env)

Next steps:
 1. Make sure DNS for $DOMAIN points to this server's public IP.
 2. Set a basic-auth password for /vnc/:
       caddy hash-password
       # paste the hash into /etc/caddy/Caddyfile (replace REPLACE_WITH_HASH)
       systemctl reload caddy
 3. Log in, change the admin password, create users, fill the 5
    dropdown option lists in packages/shared/src/form-schema.ts (or
    trigger /schema/snapshot from the admin UI).
============================================================
EOF
