# 实现预演 #1 · file-share-hub-1

**日期:** 2026-06-15  
**分支:** `sandtable/rehearse/file-share-hub-1`  
**工作目录:** `/Volumes/rsext/projects6/share-rehearsal-1`  
**结论:** **DONE**

---

## 测试通过证据

```text
$ cd apps/server && go test ./... -count=1
?       github.com/local/sharehub/cmd/sharehub          [no test files]
ok      github.com/local/sharehub/internal/api          0.185s
?       github.com/local/sharehub/internal/auth         [no test files]
?       github.com/local/sharehub/internal/config       [no test files]
?       github.com/local/sharehub/internal/db           [no test files]
ok      github.com/local/sharehub/internal/store        0.066s
```

前端生产构建：

```text
$ cd apps/web && pnpm build
✓ built in 353ms
```

Go 二进制构建（含 embed 静态资源）成功。

> **环境说明:** 系统默认 Go 1.19 在 macOS 25 上存在 `dyld LC_UUID` 兼容问题；测试与构建使用 Homebrew Go 1.26.4（`/opt/homebrew/bin/go`）通过。Dockerfile 使用 `golang:1.22-alpine`，满足 plan 要求。

---

## TC 覆盖清单

| TC | 状态 | 覆盖方式 |
|----|------|----------|
| TC1 控制台登录成功 | ✅ | API 测试 + AdminLogin.tsx |
| TC2 上传文件并出现在列表 | ✅ | API 测试 + AdminDashboard 上传/列表 |
| TC3 创建带提取码分享+链接+二维码 | ✅ | API 测试 + ShareDialog（fetch+blob 加载 QR） |
| TC4 无提取码直接下载 | ✅ | API 测试 + DownloadPage |
| TC5 错误提取码被拒绝 | ✅ | API 测试 + DownloadPage 中文提示 |
| TC6 正确提取码后下载 | ✅ | API 测试 + download ticket 流 |
| TC7 撤销分享后链接失效 | ✅ | API 测试 + 确认对话框 + 410 响应 |
| TC8 过期分享被拒绝 | ✅ | API 测试 + DownloadPage 错误页 |
| TC9 设备间自我同步 | ⚠️ 人工 | 二维码+同 LAN 扫码（实现就绪，预演未跑真机） |
| TC10 未登录无法上传 | ✅ | API 测试 |
| TC11 分享备注 | ✅ | API 测试 + ShareDialog 备注字段 |
| TC12 Docker 数据持久化 | ⚠️ 人工 | compose 卷 `./data:/data` 已配置，预演未跑 compose 循环 |
| TC13 核心路径 ≤3 步 | ✅ | 拖拽上传 → 创建分享 → 复制链接（3 步） |
| TC14 手机响应式 | ✅ | theme.css 375px 断点、44px 触控、表格堆叠 |
| TC15 中文错误提示 | ✅ | API `{error,code}` 中文化 + 前端无技术术语 |

---

## 任务完成 (T1–T10)

| 任务 | 状态 |
|------|------|
| T1 脚手架与配置 | ✅ |
| T2 数据库与存储层 | ✅ |
| T3 管理员鉴权 | ✅ |
| T4 文件上传与列表 | ✅ |
| T5 分享 CRUD 与二维码 | ✅ |
| T6 公开下载 API | ✅ |
| T7 React 前端 | ✅ |
| T8 Docker 与 NAS 文档 | ✅ |
| T9 自动化测试 | ✅ |
| T10 商业体验收尾 (FR14–FR18) | ✅ |

---

## 主要文件清单

### 后端 (Go)

- `apps/server/cmd/sharehub/main.go` — 入口、embed 静态资源
- `apps/server/internal/config/config.go` — 环境变量配置
- `apps/server/internal/db/` — SQLite schema 与初始化
- `apps/server/internal/store/files.go` — 文件落盘 `{DataDir}/blobs/{uuid}`
- `apps/server/internal/store/shares.go` — 分享 token、bcrypt 提取码
- `apps/server/internal/auth/session.go` — JWT 登录与中间件
- `apps/server/internal/api/router.go` — chi 路由 + SPA 托管
- `apps/server/internal/api/*_handlers.go` — auth/files/shares/download
- `apps/server/internal/api/api_test.go` — httptest 集成测试

### 前端 (React + Vite)

- `apps/web/src/pages/AdminLogin.tsx` — 登录页
- `apps/web/src/pages/AdminDashboard.tsx` — 控制台（上传/列表/分享管理）
- `apps/web/src/pages/DownloadPage.tsx` — 公开下载页
- `apps/web/src/components/ShareDialog.tsx` — 创建分享弹窗+复制链接+二维码
- `apps/web/src/components/UploadProgress.tsx` — 上传/下载进度条
- `apps/web/src/styles/theme.css` — 设计系统

### 部署

- `Dockerfile` — 多阶段 web + Go 构建
- `docker-compose.yml` — 8080 端口 + data 卷
- `README.md` — NAS 局域网访问说明
- `.env.example` — 环境变量模板

---

## Git 提交记录

1. `feat(server): Go API with auth, files, shares, download`
2. `feat(web): React admin console and download page`
3. `feat(deploy): Docker Compose and NAS deployment docs`
4. `fix(web): load QR code with auth header via fetch blob`

---

## FR14–FR18 商业体验

- **FR14:** 登录后拖拽上传 → 点「创建分享」→ 复制链接，核心路径 3 步
- **FR15:** 响应式 CSS，移动端表格堆叠、按钮 min-height 44px
- **FR16:** 全部 API 错误 `{error: "中文", code: "..."}`；前端 Toast/错误页无堆栈
- **FR17:** XMLHttpRequest upload progress + download Content-Length 进度
- **FR18:** 统一 theme.css、骨架屏、空状态、撤销确认对话框、复制链接按钮

---

## 预演中修复的问题

| 问题 | 级别 | 处理 |
|------|------|------|
| QR 码 `<img src>` 无法携带 Bearer token | P1 | ShareDialog 改为 fetch+blob URL 加载 |
| db.go 多处 `return nil fmt.Errorf` 语法错误 | P0 | 补逗号，测试可编译 |
| macOS 25 + Go 1.19 dyld 失败 | P2 | 使用 Homebrew Go ≥1.22 跑测试 |

---

## 残余风险 (P2/P3)

| 项 | 级别 | 说明 |
|----|------|------|
| TC9/TC12 未跑真机/Docker 循环 | P3 | 实现与配置就绪，建议 EVALUATE 阶段人工验收 |
| 本地开发需 Go ≥1.22 | P2 | README/CI 应注明；Docker 构建不受影响 |
