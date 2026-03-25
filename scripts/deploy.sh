#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/minitickets/app}"
BRANCH="${BRANCH:-main}"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/homebrew/opt/node@24/bin}"
SERVICE_NAME="${SERVICE_NAME:-minitickets}"

export PATH="$NODE_BIN_DIR:$PATH"

echo "Deploying MiniTickets from branch: $BRANCH"
cd "$APP_DIR"

git fetch origin
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

npm ci
npx prisma generate
npm run db:push
npm run build

sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --full status "$SERVICE_NAME"
