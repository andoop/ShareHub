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

detect_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || printf '127.0.0.1\n'
}

latest_feature() {
  local root="$1"
  ls -1dt "$root/docs/sandtable/features"/* 2>/dev/null | head -1 | xargs basename 2>/dev/null || true
}

REPO_ROOT="$(detect_repo_root)"
FEATURE="${1:-$(latest_feature "$REPO_ROOT")}"
PREFERRED_PORT="${SANDTABLE_MOBILE_PORT:-8765}"
LAN_IP="$(detect_lan_ip)"
PID_FILE="$REPO_ROOT/.sandtable-runtime/session/server.pid"
PORT_FILE="$REPO_ROOT/.sandtable-runtime/session/server.port"

mkdir -p "$(dirname "$PID_FILE")"

# Return the repo a running server on $1 reports, or empty if nothing answers.
health_repo() {
  local port="$1"
  curl -fsS --max-time 1 "http://127.0.0.1:${port}/health" 2>/dev/null \
    | python3 -c 'import json,sys; print(json.load(sys.stdin).get("repo",""))' 2>/dev/null || true
}

# Probe whether a TCP port is truly free, without ever hanging.
# curl exit 7 = "couldn't connect" (nobody listening) = free; any other outcome
# (0 response / 28 timeout / 52 empty reply / ...) means something IS listening —
# possibly a half-dead server — so the port is treated as occupied and skipped.
port_state() {
  local p="$1" rc=0
  curl -sS -o /dev/null -m 1 "http://127.0.0.1:${p}/" >/dev/null 2>&1 || rc=$?
  if [[ "$rc" -eq 7 ]]; then printf 'free\n'; else printf 'occupied\n'; fi
}

# Pick a port: reuse the one already serving THIS repo; skip ports held by
# another repo's healthy server OR by an unresponsive half-dead process; else
# the first genuinely free port.
choose_port() {
  local p repo
  for p in $(seq "$PREFERRED_PORT" $((PREFERRED_PORT + 30))); do
    repo="$(health_repo "$p")"
    if [[ "$repo" == "$REPO_ROOT" ]]; then
      printf '%s\n' "$p"; return 0          # our own healthy server, reuse
    fi
    if [[ -n "$repo" ]]; then
      continue                              # another repo's healthy server
    fi
    # /health gave nothing: distinguish a truly free port from a half-dead one.
    if [[ "$(port_state "$p")" == "free" ]]; then
      printf '%s\n' "$p"; return 0          # genuinely free
    fi
    # otherwise: occupied by a half-dead / non-sandtable process — skip it
  done
  printf '%s\n' "$PREFERRED_PORT"; return 0  # fallback; later -m curls error out cleanly
}

PORT="$(choose_port)"
PUBLIC_URL="http://${LAN_IP}:${PORT}"
BASE_URL="http://127.0.0.1:${PORT}"
printf '%s\n' "$PORT" >"$PORT_FILE"

# Start only if our server is not already running on the chosen port.
if [[ "$(health_repo "$PORT")" != "$REPO_ROOT" ]]; then
  node "$REPO_ROOT/runtime/server/scripts/start-daemon.mjs" \
    --repo "$REPO_ROOT" \
    --host 0.0.0.0 \
    --port "$PORT" \
    --public-url "$PUBLIC_URL" >/dev/null 2>&1 || true
  for _ in $(seq 1 30); do
    if curl -fsS -m 2 "$BASE_URL/health" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
fi

if [[ -z "${FEATURE:-}" ]]; then
  echo "错误: 找不到 feature，请传入 feature id" >&2
  exit 1
fi

RESPONSE="$(curl -fsS -m 5 -X POST "$BASE_URL/mobile-sync/start" \
  -H 'content-type: application/json' \
  -d "{\"feature\":\"$FEATURE\"}" 2>/dev/null || true)"

if [[ -z "$RESPONSE" ]]; then
  echo "错误: 无法连接 server（$BASE_URL）。端口 $PORT 可能被一个半死进程占用（TCP 在听但不响应）。" >&2
  echo "      请先运行 /sandtable-mobile-stop，或手动 kill 占用 $PORT 的进程，然后重试。" >&2
  exit 1
fi

CODE="$(printf '%s' "$RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin)["code"])' 2>/dev/null || true)"
if [[ -z "$CODE" ]]; then
  echo "错误: server 返回异常（无配对码）。响应: $RESPONSE" >&2
  exit 1
fi

# Durable token (persisted server-side) for scan-to-connect QR.
PAIRING="$(curl -fsS -m 3 "$BASE_URL/pairing?feature=$FEATURE" 2>/dev/null || echo '{}')"
QR_TOKEN="$(printf '%s' "$PAIRING" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("token",""))' 2>/dev/null || true)"
QR_PAYLOAD=""
if [[ -n "$QR_TOKEN" ]]; then
  QR_PAYLOAD="$(QR_URL="$PUBLIC_URL" QR_TOK="$QR_TOKEN" python3 -c 'import os,urllib.parse as u; print("sandtable://pair?url=%s&token=%s" % (u.quote(os.environ["QR_URL"], safe=""), u.quote(os.environ["QR_TOK"], safe="")))' 2>/dev/null || true)"
fi

cat <<EOF

Sandtable 手机同步
==================

[✓] 电脑 Server 已就绪（Agent 无需额外「连接」）
[ ] 等待手机配对

Feature   : $FEATURE
配对码    : $CODE
Server URL: $PUBLIC_URL

>>> 在 iPhone App 输入上述 URL + 配对码，点「连接」。

成功标志：
  · 手机：显示「已就绪」或「Agent 已同步 · 当前阶段 …」
  · 电脑：运行 /sandtable-mobile-status 看到 phonePaired: true

EOF

if [[ -n "$QR_PAYLOAD" ]]; then
  echo "或直接用 App 扫描下面的二维码连接（免输入）："
  echo
  node "$REPO_ROOT/runtime/server/scripts/qr-print.mjs" --text "$QR_PAYLOAD" 2>/dev/null || echo "（二维码渲染失败，请用上面的 URL + 配对码）"
  echo
fi

# 主 agent 已就绪、空闲，等待手机消息（运行态同步到手机，best-effort）。
curl -fsS -m 3 -X POST "$BASE_URL/mobile-sync/agent-state" \
  -H 'content-type: application/json' \
  -d '{"role":"main","state":"idle","detail":"已就绪，等待手机消息"}' >/dev/null 2>&1 || true

# 不阻塞等待配对：出码后立即返回，把"等配对/等消息"交给 status/wait（避免主 agent 卡在脚本里）。
cat <<EOF3

[✓] Server 与配对码已就绪——本脚本不阻塞等待配对。
    手机输入上面的 URL + 配对码（或扫码）即可；配对后 Agent 会在收到消息时自动处理。
    等待手机消息: /sandtable-mobile-wait   （主 agent 据此拉起单职责等待子 agent）
    查看状态:     /sandtable-mobile-status
    停止同步:     /sandtable-mobile-stop

EOF3
