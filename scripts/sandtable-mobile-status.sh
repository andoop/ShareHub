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

latest_feature() {
  ls -1dt "$REPO_ROOT/docs/sandtable/features"/* 2>/dev/null | head -1 | xargs basename 2>/dev/null || true
}

if ! curl -fsS -m 2 "$BASE_URL/health" >/dev/null 2>&1; then
  echo "Server: 未运行"
  exit 0
fi

STATUS="$(curl -fsS -m 3 "$BASE_URL/mobile-sync/status" 2>/dev/null || true)"
if [[ -z "$STATUS" ]]; then
  echo "Server: 端口 $PORT 有进程但无响应（可能半死）。请 /sandtable-mobile-stop 后重试。"
  exit 0
fi
python3 - <<'PY' "$STATUS"
import json, sys
d = json.loads(sys.argv[1])
steps = d.get("steps") or {}
print("Sandtable 手机同步状态")
print("====================")
print(f"[{'✓' if steps.get('server') else ' '}] Server")
print(f"[{'✓' if steps.get('phonePaired') else ' '}] 手机已配对")
print(f"[{'✓' if steps.get('agentSynced') else ' '}] Agent 已同步")
if d.get("publicUrl"):
    print(f"Server URL: {d['publicUrl']}")
if d.get("phase"):
    print(f"当前阶段: {d['phase']}")
if d.get("feature"):
    print(f"Feature: {d['feature']}")
s = d.get("session") or {}
if s.get("pairedAt"):
    print(f"配对时间: {s['pairedAt']}")
PY

# Resolve feature, public URL, pending code and paired state from the status JSON.
FEATURE="$(printf '%s' "$STATUS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("feature") or "")' 2>/dev/null || true)"
[[ -z "$FEATURE" ]] && FEATURE="$(latest_feature)"
PUBLIC_URL="$(printf '%s' "$STATUS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("publicUrl") or "")' 2>/dev/null || true)"
PENDING="$(printf '%s' "$STATUS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("pendingCode") or "")' 2>/dev/null || true)"
PAIRED="$(printf '%s' "$STATUS" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("steps",{}).get("phonePaired", False))' 2>/dev/null || echo False)"

# Re-issue a fresh 4-digit code if none is pending and the phone is not paired yet
# (e.g. the previous code expired) — no server restart needed.
if [[ "$PAIRED" != "True" && -z "$PENDING" && -n "$FEATURE" ]]; then
  REISSUE="$(curl -fsS -m 5 -X POST "$BASE_URL/mobile-sync/start" -H 'content-type: application/json' -d "{\"feature\":\"$FEATURE\"}" 2>/dev/null || echo '{}')"
  PENDING="$(printf '%s' "$REISSUE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("code") or "")' 2>/dev/null || true)"
  [[ -z "$PUBLIC_URL" ]] && PUBLIC_URL="$(printf '%s' "$REISSUE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("publicUrl") or "")' 2>/dev/null || true)"
fi

# Durable scan-to-connect QR (non-disruptive: /pairing just mints a device token).
QR_PAYLOAD=""
if [[ -n "$FEATURE" && -n "$PUBLIC_URL" ]]; then
  PAIRING="$(curl -fsS -m 3 "$BASE_URL/pairing?feature=$FEATURE" 2>/dev/null || echo '{}')"
  QR_TOKEN="$(printf '%s' "$PAIRING" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token") or "")' 2>/dev/null || true)"
  if [[ -n "$QR_TOKEN" ]]; then
    QR_PAYLOAD="$(QR_URL="$PUBLIC_URL" QR_TOK="$QR_TOKEN" python3 -c 'import os,urllib.parse as u; print("sandtable://pair?url=%s&token=%s" % (u.quote(os.environ["QR_URL"], safe=""), u.quote(os.environ["QR_TOK"], safe="")))' 2>/dev/null || true)"
  fi
fi

if [[ -n "$PENDING" ]]; then
  echo
  echo "待输入配对码: $PENDING"
fi

if [[ -n "$QR_PAYLOAD" ]]; then
  echo
  echo "扫码连接（持久有效，可连接新设备）："
  echo
  node "$REPO_ROOT/runtime/server/scripts/qr-print.mjs" --text "$QR_PAYLOAD" 2>/dev/null || echo "（二维码渲染失败，请用上面的 URL + 配对码）"
fi
