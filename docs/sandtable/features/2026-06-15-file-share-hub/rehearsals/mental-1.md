# 头脑预演报告 · mental-1

**结论:** LOGIC_CLOSED（修补 plan T7/T10 后）

## 首轮发现（已修正）
- **ANOMALY（P1，已消化）**: 手机反馈写入 PRD FR14–FR18 后，原 plan T7 未覆盖进度反馈、设计系统、≤3 步路径、中文错误页。
- **修正**: 扩展 T7、新增 T10；tests 增补 TC13–TC15。

## 端到端逻辑链（修补后）
1. 管理员 `POST /api/auth/login` → JWT → `AuthMiddleware` 保护上传/分享 API（T3）
2. `POST /api/files/upload` multipart → `{DataDir}/blobs/{uuid}` + SQLite `files`（T2,T4）
3. `POST /api/shares` → token + 可选 bcrypt(passphrase) → 返回 link `/s/{token}` + QR PNG（T5）
4. 公开 `GET /api/public/shares/:token` → 需码则 `POST verify` → download ticket cookie → 流式 `GET download`（T6）
5. React `/admin` 三步分享 + `/s/:token` 响应式下载 + T10 中文错误与进度（T7,T10）
6. Docker 持久化 `data/` 卷（T8）→ TC12 闭环

## 边界/异常
- 过期/撤销/超次数：T6 步骤4 返回 410 + 中文 JSON → 前端 TC15
- 无鉴权上传：T3 中间件 → TC10
- 大文件：T4 流式写盘 + T6 `io.Copy` 流式读，避免 OOM

## 红线核对
- MUST 提取码验证：T5 bcrypt + T6 verify ✓
- MUST 易用性首要：T7/T10 显式任务 ✓
- MUST NOT 无鉴权上传：T3 ✓
- MUST NOT 技术错误暴露用户：T10 步骤1 ✓

## 残余风险（P2/P3）
- P2: JWT 24h 无刷新，NAS 单用户可接受
- P2: 下载 ticket cookie 未设 Secure（内网 HTTP 场景；HTTPS 部署文档已要求 FR13）
- P3: 2GB 单文件上限未在 UI 预提示（可 T10 补一句）
