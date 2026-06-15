---
description: 战场侦察 · 主动收集代码/文档情报，摸清地形，列出未知，自主向开发者提问（不猜测）。
---

对当前需求执行情报侦察；读取并遵循 `skills/gathering-intel/SKILL.md`。

执行：
1. 读 `docs/sandtable/project.md`、`constraints.md` 与本需求的原始记录。
2. 系统性扫地形：相关代码（标 file:line）、既有约定、依赖与边界、相关历史/commit、风险雷区。大型侦察可派只读子 agent 并行扫不同子系统再汇总。
3. 整理两张清单：**已确认事实（带来源）** 与 **未知/待澄清**。
4. 未知能自查的继续读代码/文档确认；不能确认的，攒成一批写入 `questions.md` 一次性问我。
5. 把情报简报写入 `journal.md`，更新 `state.md`（phase=OBJECTIVES）。

纪律：不猜测、不捏造；每条事实标来源；问题一次问清关键的，不挤牙膏也不憋着。

8. 完成后加载 `skills/closing-the-loop/SKILL.md`，读 `state.md`，输出收尾（本命令已列出的链内后续步骤除外；链内切换用战报 profile）。不得越权执行**本命令未列出**的下一阶段（`/sandtable-autopilot`、`/sandtable-rehearse` 除外）。
