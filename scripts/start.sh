#!/usr/bin/env bash
# ShareHub 本机一键启动（优先 Docker Compose，无 Docker 时回退 Go 直跑）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

detect_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "127.0.0.1"
}

ensure_env() {
  if [[ -f .env ]]; then return 0; fi
  echo "首次运行：创建 .env …"
  cp .env.example .env
  if command -v openssl >/dev/null 2>&1; then
    local pass
    pass="$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)"
    if sed --version 2>/dev/null | grep -q GNU; then
      sed -i "s/^SHAREHUB_ADMIN_PASS=.*/SHAREHUB_ADMIN_PASS=${pass}/" .env
    else
      sed -i '' "s/^SHAREHUB_ADMIN_PASS=.*/SHAREHUB_ADMIN_PASS=${pass}/" .env
    fi
    echo "已生成管理员密码（已写入 .env）："
    echo "  用户名: admin"
    echo "  密码:   ${pass}"
  else
    echo "请编辑 .env 设置 SHAREHUB_ADMIN_PASS 后重新运行。"
    exit 1
  fi
}

start_docker() {
  ensure_env
  # shellcheck disable=SC1091
  set -a && source .env && set +a
  if [[ "${SHAREHUB_ADMIN_PASS:-}" == "change-me" || -z "${SHAREHUB_ADMIN_PASS:-}" ]]; then
    echo "请先在 .env 中设置 SHAREHUB_ADMIN_PASS（非 change-me）"
    exit 1
  fi
  echo "使用 Docker Compose 启动 ShareHub …"
  docker compose up --build
}

start_native() {
  ensure_env
  # shellcheck disable=SC1091
  set -a && source .env && set +a
  export SHAREHUB_DATA_DIR="${SHAREHUB_DATA_DIR:-./data}"
  mkdir -p "$SHAREHUB_DATA_DIR"

  if [[ ! -f apps/server/cmd/sharehub/static/index.html ]]; then
    echo "构建前端 …"
    if ! command -v pnpm >/dev/null 2>&1; then
      echo "需要 pnpm 或 Docker。安装 Node/pnpm 后重试，或安装 Docker 使用一键 Docker 模式。"
      exit 1
    fi
    (cd apps/web && pnpm install --frozen-lockfile 2>/dev/null || pnpm install)
    (cd apps/web && pnpm build)
  fi

  local go_bin="go"
  if [[ -x /opt/homebrew/bin/go ]]; then go_bin=/opt/homebrew/bin/go; fi

  LAN="$(detect_lan_ip)"
  export SHAREHUB_PUBLIC_BASE_URL="${SHAREHUB_PUBLIC_BASE_URL:-http://${LAN}:8080}"

  echo ""
  echo "ShareHub 已启动（本机模式）"
  echo "  控制台: http://${LAN}:8080/admin"
  echo "  本机:   http://127.0.0.1:8080/admin"
  echo "  用户:   ${SHAREHUB_ADMIN_USER:-admin}"
  echo "  密码:   见 .env 中 SHAREHUB_ADMIN_PASS"
  echo "  Ctrl-C 停止"
  echo ""

  exec "$go_bin" -C apps/server run ./cmd/sharehub
}

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  start_docker
else
  echo "未检测到可用 Docker，使用本机 Go 模式 …"
  start_native
fi
