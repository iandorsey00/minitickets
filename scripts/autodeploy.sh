#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/minitickets/app}"
LOG_FILE="${LOG_FILE:-/var/www/minitickets/deploy.log}"

mkdir -p "$(dirname "$LOG_FILE")"

{
  echo "==== $(date -u +"%Y-%m-%dT%H:%M:%SZ") MiniTickets auto-deploy start ===="
  /bin/bash "$APP_DIR/scripts/deploy.sh"
  echo "==== $(date -u +"%Y-%m-%dT%H:%M:%SZ") MiniTickets auto-deploy success ===="
} >>"$LOG_FILE" 2>&1
