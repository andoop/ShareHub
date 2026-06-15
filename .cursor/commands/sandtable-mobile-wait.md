---
description: 启动 inbox 等待子 agent（单职责：阻塞等到一条手机消息即交主 agent 并退出）。主 agent 全程安静阻塞等待，不轮询、不设超时、不忙活。
---

## 等待协议（铁律，所有工具一致）

主 agent 派出**一个**等待子 agent，然后**阻塞等待它返回，不限时长**。等待期间主 agent **零动作**——不自己查 inbox / status / health、不设超时、不反复检查子 agent、不做任何"忙活"。这正是 Cursor 的行为；**Kiro / Claude Code / Codex / 其它工具也必须照此**：不要把"派子 agent"理解成"起个后台再自己继续盯着"。

> **禁止用 automation / 后台任务 / 定时器 / 计划任务 / 后台脚本 跑 `wait`（Codex 尤其注意：不要用 automation，也不要把 `wait.sh` 当后台 waiter 直接挂起来代替子 agent）。`wait` 必须由一个真正的子 agent 执行，主 agent 阻塞等它回话。** 用 automation/后台脚本会让主 agent 失去"阻塞等待"的语义、变成自己轮询/骚动，正是要消除的行为。

> **关于"只在用户明确要求时才派子 agent"**：用户运行 `/sandtable-mobile-start` 或 `/sandtable-mobile-wait` **就是**那个显式要求。此处**必须硬派**一个子 agent，不得以"没人明确要求并行代理"为由改用后台脚本/automation 替代。无需关心手机是否已配对、是否已有人发消息——只管派子 agent 等待即可。

**职责边界（主 / 子 严格分工）：**
- **主 agent**：只负责①派子 agent，②阻塞等返回（零动作），③拿到消息后处理 + `ack` + 回话/推状态，④再派下一个。**绝不**自己跑 `wait.sh`、不轮询 inbox、不开 automation。
- **子 agent**：只做一件事——阻塞轮询 inbox，拿到一条消息就以纯文本交回主 agent，然后退出。**绝不**处理消息、ack、回话、改文档、循环重启。

## 执行

1. 确定 **feature id**（读 `docs/sandtable/features/*/state.md` 或 mobile-sync session；用户可指定）。
2. 用当前工具的「派子 agent 并**阻塞等其返回**」原语，派**一个**等待子 agent：
   - **Cursor / Claude Code**：Task 工具派 subagent。
   - **Kiro**：`invoke_sub_agent`（如 `general-task-execution`）。
   - **Codex**：派一个子 agent 执行（**不要用 automation / 后台任务**）。
   - 其它：任何"派子 agent 并阻塞等返回"的等价机制（同样禁用 automation/定时器）。
   - 子 agent 的 prompt **仅**包含：
     - 运行 `scripts/sandtable-mobile-wait.sh <feature-id>`——脚本会**阻塞轮询 inbox 直到拿到一条消息才返回**（无消息就一直等，不超时退出）。
     - 拿到后**不要贴裸 JSON**（Codex 会 "Markdown couldn't render"）；以纯文本逐条转述 `- [message-id] <text>`（附 feature/sessionId），末尾单列 `ack-ids: <id…>`；必要时原文用 ```json 代码块``` 包裹。然后**退出**。
     - **禁止**子 agent 查 status/health、读 journal、改文档、循环重启。
3. 主 agent **阻塞**等该子 agent 返回（多久都等，不打断、不轮询）。返回后才动作：处理消息 → `POST /mailbox/inbox/ack`（端口取自 `.sandtable-runtime/session/server.port`）→ 再次执行本命令派**下一个**等待子 agent。
4. 无消息时主 agent 保持**空闲**，不自己查 inbox、不查 status/health、不设超时。

> 兜底（仅当你的工具对子 agent 有**硬执行上限**、无限阻塞会被截断时）：派子 agent 时设环境变量 `SANDTABLE_WAIT_MAX_SECONDS=240`。脚本到时返回 `{"messages":[],"timeout":true}`（"暂无消息"），主 agent 据此**再派一个**等待子 agent——仍是"派子 agent 并阻塞等返回"，主 agent **不自己轮询、不设别的超时**。

不要询问是否继续。
