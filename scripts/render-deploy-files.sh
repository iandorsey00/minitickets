#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-.env.deploy}"

if [[ ! -f "$DEPLOY_ENV_FILE" ]]; then
  echo "Missing $DEPLOY_ENV_FILE"
  echo "Copy .env.deploy.example to .env.deploy and fill in the values."
  exit 1
fi

set -a
source "$DEPLOY_ENV_FILE"
set +a

OUTPUT_DIR="${OUTPUT_DIR:-deploy/rendered}"
mkdir -p "$OUTPUT_DIR/nginx"

envsubst < deploy/minitickets.service.example > "$OUTPUT_DIR/${SERVICE_NAME}.service"
envsubst < deploy/minitickets-backup.service.example > "$OUTPUT_DIR/${BACKUP_SERVICE_NAME}.service"
envsubst < deploy/minitickets-backup.timer.example > "$OUTPUT_DIR/${BACKUP_SERVICE_NAME}.timer"
envsubst < deploy/minitickets-reminders.service.example > "$OUTPUT_DIR/${REMINDER_SERVICE_NAME}.service"
envsubst < deploy/minitickets-reminders.timer.example > "$OUTPUT_DIR/${REMINDER_SERVICE_NAME}.timer"
envsubst < deploy/nginx/site.conf.example > "$OUTPUT_DIR/nginx/${APP_DOMAIN}.conf"

echo "Rendered deployment files:"
echo "- $OUTPUT_DIR/${SERVICE_NAME}.service"
echo "- $OUTPUT_DIR/${BACKUP_SERVICE_NAME}.service"
echo "- $OUTPUT_DIR/${BACKUP_SERVICE_NAME}.timer"
echo "- $OUTPUT_DIR/${REMINDER_SERVICE_NAME}.service"
echo "- $OUTPUT_DIR/${REMINDER_SERVICE_NAME}.timer"
echo "- $OUTPUT_DIR/nginx/${APP_DOMAIN}.conf"
