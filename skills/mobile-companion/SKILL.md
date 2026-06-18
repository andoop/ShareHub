---
name: mobile-companion
description: Use when the developer enables Sandtable mobile review / 手机同步 / mobile sync / 配对码 / pairing, or runs any /sandtable-mobile-* action (start/status/stop/wait), or asks to review PRD/tests/plan/state on the phone. Defines the on-demand mobile sync loop, the single-job inbox waiter, and worker discipline.
---

# Mobile Review Companion · 手机审阅同步

**开始时声明：** "我在用 mobile-companion 管理 Sandtable 手机同步。"

把当前 feature 的阶段、文档、待确认事项同步到手机，并接收手机端聊天/确认/回答。**可选能力**：未显式启用时不启动 server、不写 mailbox、不改默认流程。

> 触发：Cursor/Claude/Kiro 用 `/sandtable-mobile-*`；Codex 用 `$mobile-companion`。同一套流程。
> 何时启用：开发者运行 `/sandtable-mobile-start`，或 `.sandtable-runtime/session/mobile-sync.json` 的 `active=true`。
> 依赖：仓库内 `runtime/server/` 已 `npm --prefix runtime/server install`（见 `runtime.md`）。

## 主 agent / 子 agent 分工（铁律）

- **`wait`（阻塞轮询 inbox）只能由一个真正的子 agent 执行；主 agent 禁止自己轮询、查 status/health、设超时。**
- **运行 `/sandtable-mobile-start` 或 `/sandtable-mobile-wait` 就是用户对"派子 agent"的显式要求。** 任何"只在用户明确要求时才用多 agent"的默认规则在此**已满足**——必须**硬派**子 agent，**禁止**以"没人明确要求并行代理"为由改用后台脚本 / automation / 定时器替代（Codex 尤其：不要用 automation，也别把 `wait.sh` 当后台 waiter 挂起来代替子 agent）。
- **不必关心**手机是否已配对、是否已有人发消息——只管起服务、硬派 waiter，配对与收信是用户那边的事。
- **主 agent 职责**：①派**一个**等待子 agent，②阻塞等其返回（不限时长、零动作），③拿到消息后处理 + `ack` + 回话/推状态，④再派下一个。绝不自己跑 `wait.sh`、不开 automation。
- **子 agent 职责**：只跑 `scripts/sandtable-mobile-wait.sh <feature>` 拿一条消息、以**纯文本**交回（勿贴裸 JSON，否则 Codex 渲染失败）、退出。绝不处理消息、ack、回话、查状态、读 journal、改文档、循环重启。
- 交互闭环：主 agent 派 → 子 agent 等并交回一条 → 主 agent 处理并 ack → 主 agent 再派。任一环都不串台。
- "派子 agent 并阻塞等返回"的原语：Cursor/Claude=Task，**Kiro=`invoke_sub_agent`**，**Codex=硬派子 agent（非 automation）**。

## 四个动作

| 动作 | 命令 | 脚本 | 作用 |
|------|------|------|------|
| 开启 | `/sandtable-mobile-start` | `sandtable-mobile-start.sh [feature]` | 起 server、出配对码 + URL + 二维码，并拉起等待子 agent |
| 查状态 | `/sandtable-mobile-status` | `sandtable-mobile-status.sh` | 报告 server/feature/配对码/paired/expiresAt |
| 停止 | `/sandtable-mobile-stop` | `sandtable-mobile-stop.sh` | 关 server、停同步（手机显示 Disconnected） |
| 等消息 | `/sandtable-mobile-wait` | `sandtable-mobile-wait.sh <feature>` | 子 agent：阻塞轮询 inbox，拿一条交主 agent 后退出 |

## 主循环

1. **开启**：列出 `docs/sandtable/features/`，用 AskQuestion 让开发者**硬选** feature（不假定、不跳过），再跑 `sandtable-mobile-start.sh <feature>`。服务起来后**必须**按模版展示配对信息（缺 URL 或配对码即视为没开成功）：

   ```
   📱 Sandtable 手机同步已开启
   Server URL : <server_url>
   配对码     : <pairing_code>（10 分钟内有效）
   Feature    : <feature>
   ```
2. **派等待子 agent**：执行 `/sandtable-mobile-wait`（见上「分工铁律」），然后空闲等其返回。
3. **处理 + ack**：子 agent 交回消息后，主 agent 处理 → `POST /mailbox/inbox/ack {"ids":["<id>"]}` → 再 `/sandtable-mobile-wait` 拉下一个。
4. **回话 / 推状态**：回话 `POST /agent/sessions/<sid>/messages`；改完 Sandtable 文档且 sync active 时 `POST /mobile-sync/push-state`。
5. **落盘**：在 feature `journal.md` 追加一条。

端口取自 `.sandtable-runtime/session/server.port`。

## 运行态同步到手机

脚本自动上报（start→main idle、wait→waiter waiting/processing、stop→disconnected/exited）。主 agent 处理消息时补报自身状态：

```
POST /mobile-sync/agent-state {"role":"main","state":"working|idle|error","detail":"…"}
```

手机据此显示 主 agent（空闲/处理中/已断开/出错）与 等待器（就绪/收信中/处理中/已退出）。

## 常驻同步义务（sync server 活着即生效）

只要 mobile-sync **active**（server 在跑 + `.sandtable-runtime/session/mobile-sync.json` 的 `active=true`），同步手机就是**常驻义务**，**与触发来源无关**——无论指令来自手机，还是开发者直接在**电脑端**与你对话，规则一样。

- **不要只在手机发消息时才同步。** 在重要动作的**前 / 中 / 后**主动同步：
  - 阶段切换 → `POST /features/<feature>/sync/phase` 或 `POST /agent/sessions/<sid>/messages {"kind":"status"}`。
  - 关键决策 / 选型 / 取舍 → 同步一句话摘要。
  - 产生待确认问题或阻塞 → 同步 `{"kind":"question"}`，并按 protocol 落 `questions.md` / `state.md`。
  - 改完 Sandtable 文档（PRD/tests/plan/state）→ `POST /mobile-sync/push-state`。
  - 开始 / 完成一项重要工作 → 补报 `agent-state main=working|idle` + 一句话进展。
- **判据"重要时机"**：会影响闭环 / 验收 / 关键决策、或开发者会想在手机上看到的节点。琐碎中间步不刷屏。
- **等待子 agent 永久阻塞、不设超时（纯等待）**：默认**不传** `SANDTABLE_WAIT_MAX_SECONDS`，子 agent 一直阻塞到拿到一条消息才返回。**仅当**宿主对单个子 agent 有**硬执行上限**会截断无限阻塞时，才用该兜底（如 `=240`）；超时返回后主 agent **立即无缝再派一个**等待子 agent，全程不自己轮询、不设别的超时。

## Red Flags

| 念头 | 现实 |
|------|------|
| "起了 server 就算开好了" | 还要拉起等待子 agent，否则手机消息无人处理。 |
| "主 agent 自己跑下 wait / 查下状态" | 禁止。`wait` 只能子 agent 跑；主 agent 派出后零动作、阻塞等返回。 |
| "用 automation / 后台任务跑 wait 更省事" | 禁止（Codex 尤其）。必须派真正的子 agent，主 agent 阻塞等它回话。 |
| "等待子 agent 顺便读 journal / 改文档" | 禁止。单职责：轮询、交付、退出。 |
| "处理完不用 ack" | 必须 ack，否则同一条被反复取出。 |
| "只在手机发消息时才同步" | 错。sync server 活着就是常驻同步义务，电脑端对话也要在重要动作前/中/后同步。 |
| "给等待子 agent 设个超时省心" | 默认永久阻塞、不设超时；仅宿主有硬执行上限才用 `SANDTABLE_WAIT_MAX_SECONDS` 兜底，超时即无缝再派一个。 |

完整协议见 `docs/mobile-review-companion/protocol.md`，启动与真机验证见 `runtime.md` / `verification.md`。
