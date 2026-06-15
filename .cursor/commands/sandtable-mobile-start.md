---
description: 按需开启手机同步：启动 runtime、生成 4 位配对码、拉起监听子 agent
---

按需开启 Sandtable 手机同步。细节见 `docs/mobile-review-companion/runtime.md` § On-demand sync。

> **运行本命令 = 用户已显式要求你派一个子 agent 来执行 `wait`。** 任何"只在用户明确要求时才用多 agent"的默认规则，在此**已被满足**——你**必须**硬派一个真正的子 agent，**不得**以"没人明确要求并行代理"为由改用后台脚本 / automation / 定时器替代。`wait` 必须由子 agent 跑，主 agent 派出后只空闲阻塞等其返回，不轮询、不查 status/health、不设超时。

执行：
1. **硬选 feature**：列出 `docs/sandtable/features/`，**必须**用 **AskQuestion** 让我选一个；不要自行假定、不要跳过这一步（最新的列在最前作推荐）。
2. **起服务**：用选定的 `<feature>` 跑 `scripts/sandtable-mobile-start.sh <feature>`（秒回）。**不要**因"手机还没配对 / 还没人发消息"而犹豫或不开——只管起服务、派 waiter，配对与收信是用户那边的事。
3. **同步配对信息（必做）**：服务起来后，**一定**按下面模版把 Server URL 与配对码原样展示给我（缺任一项都算没开成功，需排查）：

   ```
   📱 Sandtable 手机同步已开启
   Server URL : <server_url>
   配对码     : <pairing_code>（10 分钟内有效）
   Feature    : <feature>
   操作        : 手机输入以上 URL + 4 位配对码（或扫码）即可
   ```

4. **硬派等待子 agent**：执行 `/sandtable-mobile-wait` 派**一个**子 agent 阻塞等 inbox，然后空闲等它返回。
5. **处理消息**：子 agent 交回消息后才动作——上报 `agent-state main=working` → 处理 → `POST /mailbox/inbox/ack` → `main=idle` → 再 `/sandtable-mobile-wait`。出错报 `main=error`。

端口取自 `.sandtable-runtime/session/server.port`。除第 1 步选 feature 外，不就推进与否反复询问。
