# ShareHub

[![CI](https://github.com/andoop/ShareHub/actions/workflows/ci.yml/badge.svg)](https://github.com/andoop/ShareHub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**自托管文件分享枢纽** — 在 NAS / 家用电脑上部署，通过网页上传文件、生成分享链接与二维码；接收者扫码或打开链接即可下载，无需经过微信 / 企业微信中转。

适合：个人跨设备同步、局域网内给朋友发大文件、可控的提取码与分享生命周期管理。

## 功能

- 网页控制台：上传、文件列表、分享管理
- 分享链接 + 二维码，手机扫码直达下载页
- 可选提取码、过期时间、最大下载次数、备注
- 分享记录可点击查看详情（链接 + 二维码）
- 响应式 UI，面向手机浏览器优化
- Docker Compose 一键部署，或本机 `./scripts/start.sh` 快速启动
- 数据本地持久化（SQLite + 文件目录）

## 快速开始

### 一键运行（推荐试用）

```bash
git clone git@github.com:andoop/ShareHub.git
cd ShareHub
./scripts/start.sh
```

脚本会检测 Docker：有则 `compose up --build`；无则用 Go + 已构建前端直跑。首次运行自动生成 `.env` 与管理员密码。

浏览器打开 `http://<局域网IP>:8080/admin`。

### Docker Compose（NAS / 生产）

```bash
cp .env.example .env   # 设置 SHAREHUB_ADMIN_PASS
docker compose up -d --build
```

- 控制台：`http://<IP>:8080/admin`
- 分享页：`http://<IP>:8080/s/<token>`

## 架构

```
apps/server   Go (chi) · JWT 鉴权 · SQLite · 本地文件存储 · 嵌入静态前端
apps/web      React + Vite + TypeScript · 控制台 + 公开下载页
data/         SQLite 数据库与上传文件（git 忽略，部署时挂载卷）
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SHAREHUB_ADMIN_PASS` | 管理员密码（**必填**） | — |
| `SHAREHUB_ADMIN_USER` | 管理员用户名 | `admin` |
| `SHAREHUB_DATA_DIR` | 数据目录 | `./data` |
| `SHAREHUB_ADDR` | 监听地址 | `:8080` |
| `SHAREHUB_JWT_SECRET` | JWT 密钥 | `change-me-in-prod` |
| `SHAREHUB_PUBLIC_BASE_URL` | 分享链接公网/局域网前缀 | 自动推断 |
| `SHAREHUB_MAX_UPLOAD_MB` | 单文件上限（MB） | `2048` |

## 开发

```bash
# 后端
cd apps/server && SHAREHUB_ADMIN_PASS=test go run ./cmd/sharehub

# 前端（另开终端）
cd apps/web && pnpm install && pnpm dev

# 生产构建
cd apps/web && pnpm build
cd ../server && SHAREHUB_ADMIN_PASS=test go run ./cmd/sharehub

# 测试
cd apps/server && go test ./...
```

## HTTPS

应用不内置 TLS。生产环境请在前面加 Caddy / Nginx 反向代理，并设置 `client_max_body_size` 以支持大文件上传。

## 仓库说明

本仓库以 **ShareHub 应用**（`apps/`、`Dockerfile`、`docker-compose.yml`）为主。

根目录中的 `docs/sandtable/`、`skills/`、`commands/` 等是开发时使用的 [Sandtable](https://github.com/andoop/sandtable) 方法论资产，与 ShareHub 运行时无关，可自行忽略。

## License

[MIT](LICENSE) · © 2026 [andoop](https://github.com/andoop)
