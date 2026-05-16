#!/usr/bin/env bash
set -u

umask 077

ENV_FILE="${ENV_FILE:-}"
SECURITY_REVIEW_ROOT="${SECURITY_REVIEW_ROOT:-.security-reviews}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$SECURITY_REVIEW_ROOT/$TIMESTAMP"
REPORT_PATH="$RUN_DIR/report.txt"
STATUS=0

mkdir -p "$RUN_DIR"
exec > >(tee -a "$REPORT_PATH") 2>&1

if [[ -n "$ENV_FILE" && -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

run_check() {
  local label="$1"
  shift

  echo
  echo "== $label =="
  if "$@"; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    STATUS=1
  fi
}

echo "MiniTickets security review"
echo "started_at_utc=$TIMESTAMP"
echo "cwd=$(pwd)"
echo "report_path=$REPORT_PATH"
echo "node_version=$(node -v 2>/dev/null || echo unavailable)"
echo "npm_version=$(npm -v 2>/dev/null || echo unavailable)"

run_check "Production dependency audit" npm audit --omit=dev
run_check "Full dependency audit" npm audit
run_check "Lint" npm run lint
run_check "Build" npm run build

echo
echo "== Manual review cues =="
if ! rg -n "dangerouslySetInnerHTML|innerHTML|eval\\(|new Function\\(|child_process|exec\\(|spawn\\(" app components lib scripts prisma deploy; then
  echo "No risky pattern matches found."
fi

echo
if [[ "$STATUS" -eq 0 ]]; then
  echo "Security review completed successfully."
else
  echo "Security review completed with failures."
fi

exit "$STATUS"
