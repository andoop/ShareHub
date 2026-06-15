#!/usr/bin/env bash
# Cross-platform hook launcher. Resolves the hook script next to this file
# and runs it with bash so the same hooks.json works on macOS/Linux/Windows.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOK_NAME="${1:-}"
if [ -z "$HOOK_NAME" ]; then
  echo "用法: run-hook.cmd <hook-name>" >&2
  exit 2
fi
shift || true
exec bash "${SCRIPT_DIR}/${HOOK_NAME}" "$@"
