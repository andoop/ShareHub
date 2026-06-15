#!/usr/bin/env bash
set -euo pipefail

detect_repo_root() {
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if [[ -d "$dir/docs/sandtable" || -d "$dir/.sandtable-runtime" ]]; then
      printf '%s\n' "$dir"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  printf '%s\n' "$PWD"
}

REPO_ROOT="$(detect_repo_root)"
PORT_FILE="$REPO_ROOT/.sandtable-runtime/session/server.port"
PORT="${SANDTABLE_MOBILE_PORT:-$(cat "$PORT_FILE" 2>/dev/null || echo 8765)}"
BASE_URL="http://127.0.0.1:${PORT}"
PID_FILE="$REPO_ROOT/.sandtable-runtime/session/server.pid"

curl -fsS -m 3 -X POST "$BASE_URL/mobile-sync/stop" >/dev/null 2>&1 || true
curl -fsS -m 3 -X POST "$BASE_URL/stop" >/dev/null 2>&1 || true

if [[ -f "$PID_FILE" ]]; then
  PID="$(cat "$PID_FILE")"
  # The daemon is its own process-group leader (started detached), so a negative
  # PID signals the whole group (server + any tsx/node children).
  kill -TERM "-${PID}" 2>/dev/null || kill -TERM "${PID}" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

# Fallback: match this repo's server process specifically (port-independent).
pkill -f "src/index.ts.*--repo ${REPO_ROOT}" 2>/dev/null || true
rm -f "$PORT_FILE" 2>/dev/null || true

echo "Sandtable mobile sync stopped."
