# 便捷文件分享枢纽 · 改动计划

**目标:** 在 NAS/局域网部署轻量自托管服务：控制台上传与分享管理 + 公开下载页（链接/二维码 + 提取码验证）。

**架构:** Go 单体 API（chi + SQLite + 本地文件存储）提供鉴权、上传、分享 CRUD、下载流；React(Vite) 双入口——`/admin` 控制台与 `/s/:token` 公开下载页；Docker Compose 挂载 `data/` 卷持久化。绑定 `0.0.0.0:8080` 供局域网访问。

**对应 PRD:** `prd.md`（方案 B；Q1 NAS/LAN；Q2 链接+提取码）

**推演要求:** 本计划将由头脑预演、红蓝对抗、实现预演子 agent 逐任务推演。

---

## 文件地图

| 路径 | 职责 |
|------|------|
| `apps/server/cmd/sharehub/main.go` | 进程入口、配置加载、HTTP 服务启动 |
| `apps/server/internal/config/config.go` | 环境变量：端口、数据目录、管理员凭据、JWT 密钥 |
| `apps/server/internal/db/schema.sql` | SQLite 表：`files`、`shares` |
| `apps/server/internal/db/db.go` | 数据库初始化与迁移 |
| `apps/server/internal/store/files.go` | 文件元数据 + 磁盘存储路径 |
| `apps/server/internal/store/shares.go` | 分享 token、提取码哈希、过期/次数 |
| `apps/server/internal/auth/session.go` | 管理员登录、JWT/会话校验中间件 |
| `apps/server/internal/api/router.go` | 路由注册 |
| `apps/server/internal/api/auth_handlers.go` | `POST /api/auth/login` |
| `apps/server/internal/api/file_handlers.go` | 上传、列表 |
| `apps/server/internal/api/share_handlers.go` | 创建/列表/撤销分享、二维码 |
| `apps/server/internal/api/download_handlers.go` | 公开下载页 API、提取码校验、文件流 |
| `apps/server/go.mod` | Go 模块 |
| `apps/web/src/main.tsx` | 前端入口 |
| `apps/web/src/pages/AdminLogin.tsx` | 登录页 |
| `apps/web/src/pages/AdminDashboard.tsx` | 文件列表、上传、分享管理 |
| `apps/web/src/pages/DownloadPage.tsx` | 公开下载 + 提取码表单 |
| `apps/web/src/api/client.ts` | API 封装 |
| `docker-compose.yml` | 单服务 + `data` 卷 |
| `Dockerfile` | 多阶段：构建 web → 嵌入静态资源 → Go 二进制 |
| `README.md` | NAS 部署说明（局域网 IP、默认端口、环境变量） |
| `apps/server/internal/api/*_test.go` | API 级测试 |

---

### 任务 T1: 项目脚手架与配置

**文件:**
- 创建: `apps/server/go.mod`, `apps/server/cmd/sharehub/main.go`, `apps/server/internal/config/config.go`
- 创建: `docker-compose.yml`, `.env.example`

- [ ] 步骤1: 初始化 Go 模块
```bash
mkdir -p apps/server/cmd/sharehub apps/server/internal/config
cd apps/server && go mod init github.com/local/sharehub
```
- [ ] 步骤2: 实现配置加载
```go
// apps/server/internal/config/config.go
package config

import "os"

type Config struct {
    Addr         string // default :8080
    DataDir      string // default ./data
    AdminUser    string
    AdminPass    string
    JWTSecret    string
}

func Load() Config {
    return Config{
        Addr:      getenv("SHAREHUB_ADDR", ":8080"),
        DataDir:   getenv("SHAREHUB_DATA_DIR", "./data"),
        AdminUser: getenv("SHAREHUB_ADMIN_USER", "admin"),
        AdminPass: os.Getenv("SHAREHUB_ADMIN_PASS"), // 必填，无默认
        JWTSecret: getenv("SHAREHUB_JWT_SECRET", "change-me-in-prod"),
    }
}
```
- [ ] 步骤3: main 启动占位 HTTP
```go
// apps/server/cmd/sharehub/main.go
func main() {
    cfg := config.Load()
    if cfg.AdminPass == "" { log.Fatal("SHAREHUB_ADMIN_PASS required") }
    // T2 起挂载 router
}
```
- [ ] 验证: `go run ./cmd/sharehub` 监听 8080（TC12 前置）
  运行: `SHAREHUB_ADMIN_PASS=test go run ./cmd/sharehub`  预期: 进程启动无 panic

---

### 任务 T2: 数据库与存储层

**文件:**
- 创建: `apps/server/internal/db/schema.sql`, `apps/server/internal/db/db.go`
- 创建: `apps/server/internal/store/files.go`, `apps/server/internal/store/shares.go`

- [ ] 步骤1: schema
```sql
-- files: id, original_name, size, storage_path, created_at
-- shares: id, file_id, token, pass_hash NULL, expires_at NULL, max_downloads NULL, download_count, note, revoked, created_at
```
- [ ] 步骤2: 文件落盘 `{DataDir}/blobs/{uuid}`，元数据入 SQLite
- [ ] 步骤3: 分享 token 用 `crypto/rand` 16 字节 hex；提取码存 `bcrypt` 哈希
- [ ] 验证: 单元测试 `store/shares_test.go` 创建分享返回非空 token（映射 TC3）

---

### 任务 T3: 管理员鉴权

**文件:**
- 创建: `apps/server/internal/auth/session.go`, `apps/server/internal/api/auth_handlers.go`

- [ ] 步骤1: `POST /api/auth/login` 校验 AdminUser/AdminPass，签发 JWT（24h）
- [ ] 步骤2: `AuthMiddleware` 保护 `/api/files/*`、`/api/shares/*`
- [ ] 验证: **TC1** 正确凭据返回 200 + token；错误凭据 401
  运行: `curl -X POST localhost:8080/api/auth/login -d '{"user":"admin","pass":"Secret123!"}'`
- [ ] 验证: **TC10** 无 token 上传返回 401

---

### 任务 T4: 文件上传与列表 API

**文件:**
- 创建: `apps/server/internal/api/file_handlers.go`
- 修改: `apps/server/internal/api/router.go`

- [ ] 步骤1: `POST /api/files/upload` multipart，限制单文件大小（默认 2GB，可 env 配置）
- [ ] 步骤2: `GET /api/files` 返回 id、name、size、createdAt
- [ ] 验证: **TC2** 上传后列表含 `vacation.mp4` 及大小字段

---

### 任务 T5: 分享 CRUD 与二维码

**文件:**
- 创建: `apps/server/internal/api/share_handlers.go`

- [ ] 步骤1: `POST /api/shares` body: `{fileId, passphrase?, expiresAt?, maxDownloads?, note?}`
- [ ] 步骤2: `GET /api/shares` 列表含 token、状态、备注
- [ ] 步骤3: `DELETE /api/shares/:id` 或 `POST .../revoke` 设 `revoked=true`
- [ ] 步骤4: `GET /api/shares/:id/qrcode` 返回 PNG（依赖 `github.com/skip2/go-qrcode`）
- [ ] 验证: **TC3** 返回链接与二维码；**TC7** 撤销后状态变更；**TC11** 备注可见

---

### 任务 T6: 公开下载 API

**文件:**
- 创建: `apps/server/internal/api/download_handlers.go`

- [ ] 步骤1: `GET /api/public/shares/:token` 返回文件名、size、是否需要提取码（不返回存储路径）
- [ ] 步骤2: `POST /api/public/shares/:token/verify` body `{passphrase}` 校验 bcrypt
- [ ] 步骤3: `GET /api/public/shares/:token/download` 需有效会话 cookie 或一次性 download ticket；流式 `io.Copy`
- [ ] 步骤4: 过期/撤销/超次数返回 410 + 明确 JSON message
- [ ] 验证: **TC4–TC6、TC8** 各场景；**TC5** 错误提取码 401

---

### 任务 T7: React 前端

**文件:**
- 创建: `apps/web/`（Vite + React + TypeScript）
- 创建: `AdminLogin.tsx`, `AdminDashboard.tsx`, `DownloadPage.tsx`, `api/client.ts`
- 创建: `apps/web/src/components/UploadProgress.tsx`, `apps/web/src/components/ShareDialog.tsx`, `apps/web/src/styles/theme.css`

- [ ] 步骤1: `/admin` 登录页调用 login API，token 存 localStorage；表单即时校验，错误中文提示
- [ ] 步骤2: 控制台核心路径 ≤3 步：选文件拖拽区 → 上传（带进度条 `UploadProgress`）→ 一键「创建分享」弹窗（提取码/过期/备注）→ 展示链接+二维码
- [ ] 步骤3: `/s/:token` 下载页：响应式布局（手机大按钮）；无码直接下载；有码表单；下载按钮触发带进度反馈
- [ ] 步骤4: 统一设计系统 `theme.css`：加载态骨架屏、空状态「还没有文件」、成功/错误 Toast；禁止暴露技术错误
- [ ] 步骤5: 生产构建 `pnpm build`，产物由 Go `embed` 或 `http.FileServer` 托管
- [ ] 验证: **TC9** 手机扫码；**TC13–TC15** 易用性与商业体验（见 tests.md）

---

### 任务 T10: 易用性与商业级体验收尾

**文件:**
- 修改: `apps/web/src/pages/*.tsx`, `apps/server/internal/api/*_handlers.go`（错误 JSON 中文化）

- [ ] 步骤1: 所有 API 错误响应统一 `{ error: "用户可读中文", code: "SHARE_EXPIRED" }`，前端映射为页面文案（FR16）
- [ ] 步骤2: 上传 `XMLHttpRequest`/`fetch` 监听 progress 事件；下载大文件用 `Content-Length` 显示进度（FR17）
- [ ] 步骤3: 走查核心路径步数 ≤3，手机 viewport 375px 下无横向滚动、按钮 ≥44px 高（FR14–FR15）
- [ ] 步骤4: 撤销分享前确认对话框；分享创建成功后复制链接一键按钮（FR18）
- [ ] 验证: 对照 PRD §5.5 FR14–FR18 与 constraints 商业交付标准

---

### 任务 T8: Docker 与 NAS 文档

**文件:**
- 创建: `Dockerfile`, `docker-compose.yml`, `README.md`, `.env.example`

- [ ] 步骤1: compose 映射 `./data:/data`，环境变量 `SHAREHUB_DATA_DIR=/data`
```yaml
services:
  sharehub:
    build: .
    ports: ["8080:8080"]
    volumes: ["./data:/data"]
    environment:
      SHAREHUB_ADMIN_PASS: ${SHAREHUB_ADMIN_PASS}
      SHAREHUB_DATA_DIR: /data
```
- [ ] 步骤2: README 写明局域网访问 `http://<NAS-IP>:8080/admin`
- [ ] 验证: **TC12** down/up 后数据仍在

---

### 任务 T9: 自动化测试收尾

**文件:**
- 创建: `apps/server/internal/api/auth_handlers_test.go`, `share_handlers_test.go`, `download_handlers_test.go`

- [ ] 步骤1: httptest 覆盖 TC1、TC5、TC7、TC10 核心路径
- [ ] 步骤2: 运行 `go test ./...` 全部 PASS
- [ ] 步骤3: 对照 `tests.md` 12 条 TC，在 plan 勾选映射完成表

| TC | 覆盖任务 |
|----|---------|
| TC1 | T3 |
| TC2 | T4 |
| TC3 | T5 |
| TC4–TC6 | T6, T7 |
| TC7 | T5 |
| TC8 | T6 |
| TC9 | T7（人工） |
| TC10 | T3 |
| TC11 | T5, T7 |
| TC12 | T8 |

---

## 技术选型说明（Q5 默认）
- **后端**: Go 1.22+（单二进制，适合 NAS）
- **DB**: SQLite（单文件，随 `data/` 卷持久化）
- **前端**: React + Vite + TypeScript
- **未引入** 对象存储、K8s、多租户账号体系（符合 MUST NOT）

完成本计划后，`phase` → `MENTAL_REHEARSAL`，进入 `/sandtable-rehearse`。
