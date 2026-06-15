# 待澄清问题 · 2026-06-15-file-share-hub

> `blocked=true` 直至 Q1–Q3 有答复。Q4–Q5 影响实现细节，可在 PRD 确认时一并答复。

## Q1 · 部署与使用范围（阻塞）— ✅ 已答复
- **答复**: A) NAS/本机，主要内网或 VPN 访问（AskQuestion `deploy_scope=nas_lan`）

## Q2 · 访问控制模型（阻塞）— ✅ 已答复
- **答复**: A) 链接 + 提取码/密码，无需接收者账号（AskQuestion `access_model=link_password`）

## Q3 · 技术方案选择（阻塞 PRD 定稿）— ✅ 已答复
- **答复**: 方案 B 轻量自研全栈（AskQuestion `solution=plan_b`）

## Q4 · 规模预期（非阻塞，影响容量设计）
- 单文件典型大小？总存储预算？分享链接默认有效期？

## Q5 · 技术栈偏好（非阻塞）
- 是否有偏好语言/框架（如 Node/Go/Rust + React/Vue）？无偏好则按方案 B 默认选型写入 plan。
