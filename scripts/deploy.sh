#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/minitickets/app}"
BRANCH="${BRANCH:-main}"
NODE_BIN_DIR="${NODE_BIN_DIR:-/opt/homebrew/opt/node@24/bin}"
SERVICE_NAME="${SERVICE_NAME:-minitickets}"
ENV_FILE="${ENV_FILE:-/var/www/minitickets/.env.production}"

export PATH="$NODE_BIN_DIR:$PATH"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

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
