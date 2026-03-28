#!/usr/bin/env bash
set -euo pipefail

umask 077

ENV_FILE="${ENV_FILE:-/var/www/minitickets/.env.production}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/minitickets}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_PREFIX="${BACKUP_PREFIX:-minitickets}"
INCLUDE_ENV_FILE="${INCLUDE_ENV_FILE:-0}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE"
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DATABASE_URL="${DATABASE_URL:-}"
if [[ "$DATABASE_URL" != file:* ]]; then
  echo "Only SQLite file: DATABASE_URL values are currently supported."
  exit 1
fi

DB_PATH="${DATABASE_URL#file:}"
if [[ ! -f "$DB_PATH" ]]; then
  echo "Missing SQLite database: $DB_PATH"
  exit 1
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "sqlite3 is required for backups."
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$BACKUP_ROOT/$TIMESTAMP"
mkdir -p "$RUN_DIR"

DB_DIR="$(dirname "$DB_PATH")"
DB_NAME="$(basename "$DB_PATH")"
DB_BACKUP_PATH="$RUN_DIR/${BACKUP_PREFIX}-${DB_NAME}"
DATA_ARCHIVE_PATH="$RUN_DIR/${BACKUP_PREFIX}-data.tar.gz"
MANIFEST_PATH="$RUN_DIR/manifest.txt"

sqlite3 "$DB_PATH" ".backup '$DB_BACKUP_PATH'"
gzip -f "$DB_BACKUP_PATH"

tar \
  --exclude="$DB_NAME" \
  -czf "$DATA_ARCHIVE_PATH" \
  -C "$DB_DIR" .

{
  echo "created_at_utc=$TIMESTAMP"
  echo "database_path=$DB_PATH"
  echo "database_backup=$(basename "$DB_BACKUP_PATH").gz"
  echo "data_archive=$(basename "$DATA_ARCHIVE_PATH")"
  echo "include_env_file=$INCLUDE_ENV_FILE"
} > "$MANIFEST_PATH"

if [[ "$INCLUDE_ENV_FILE" == "1" ]]; then
  cp "$ENV_FILE" "$RUN_DIR/.env.production.backup"
fi

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +

echo "Backup complete: $RUN_DIR"
