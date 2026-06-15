# ShareHub · 便捷文件分享枢纽

自托管文件分享服务：网页控制台上传与管理，生成分享链接与二维码，接收者扫码或打开链接即可下载。

## 一键运行（本机）

在项目根目录执行：

```bash
./scripts/start.sh
```

- **有 Docker**：自动 `docker compose up --build`（首次运行会生成 `.env` 和随机管理员密码）
- **无 Docker**：自动构建前端并用 Go 直跑（需本机安装 Go ≥1.22、pnpm）

启动后浏览器打开 `http://<本机局域网IP>:8080/admin`（脚本会打印地址）。

## 快速开始（Docker Compose）

1. 复制环境变量并设置管理员密码：

```bash
cp .env.example .env
# 编辑 .env，设置 SHAREHUB_ADMIN_PASS
```

2. 启动服务：

```bash
docker compose up -d --build
```

3. 在局域网浏览器访问：

- **控制台**：`http://<NAS-IP>:8080/admin`
- **分享页**：`http://<NAS-IP>:8080/s/<token>`

将 `<NAS-IP>` 替换为 NAS 或本机的局域网 IP（如 `192.168.1.10`）。

## 本地开发

### 后端

```bash
cd apps/server
SHAREHUB_ADMIN_PASS=Secret123! go run ./cmd/sharehub
```

### 前端

```bash
cd apps/web
pnpm install
pnpm dev
```

前端开发服务器通过 Vite 代理 `/api` 到 `localhost:8080`。

### 生产构建

```bash
cd apps/web && pnpm build   # 产物输出到 apps/server/cmd/sharehub/static
cd ../server && SHAREHUB_ADMIN_PASS=Secret123! go run ./cmd/sharehub
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SHAREHUB_ADMIN_PASS` | 管理员密码（**必填**） | — |
| `SHAREHUB_ADMIN_USER` | 管理员用户名 | `admin` |
| `SHAREHUB_DATA_DIR` | 数据目录（SQLite + 文件） | `./data` |
| `SHAREHUB_ADDR` | 监听地址 | `:8080` |
| `SHAREHUB_JWT_SECRET` | JWT 签名密钥 | `change-me-in-prod` |
| `SHAREHUB_PUBLIC_BASE_URL` | 公开分享链接前缀（可选） | 自动推断 |
| `SHAREHUB_MAX_UPLOAD_MB` | 单文件上传上限（MB） | `2048` |

## 数据持久化

Docker Compose 将 `./data` 挂载到容器内 `/data`，包含：

- `sharehub.db` — SQLite 数据库（文件元数据、分享记录）
- `blobs/` — 上传文件存储

`docker compose down` 后再 `up`，数据仍保留在 `./data` 卷中。

## HTTPS（生产环境）

应用本身不内置 TLS。生产环境请在前面加反向代理（Caddy / Nginx），例如：

```nginx
server {
    listen 443 ssl;
    server_name share.example.com;
    # ssl_certificate ...
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_request_buffering off;
        client_max_body_size 2048m;
    }
}
```

## 测试

```bash
cd apps/server
go test ./...
```
