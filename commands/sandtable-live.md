---
description: 实现预演（军事隐喻：实兵演习）· 在隔离 git worktree 里真按计划完整实现并验证，可并行多个子 agent；异常即停，全过则交复盘择优。
---

对当前需求执行实现预演；读取并遵循 `skills/implementation-rehearsal/SKILL.md`。

执行：
1. 读本需求 `plan.md`、`prd.md`、`constraints.md`、`state.md`；确认头脑预演已 closed（否则先 `/sandtable-mental`）。
2. 为每个预演创建**独立 git worktree/分支**，按 `implementation-rehearsal-prompt.md` 并行派发实现子 agent，要求完整实现、不留细节（无 TODO/占位）。
3. 任一 `ANOMALY_FOUND`/`BLOCKED` → 你亲自核实 → 问我 → 修正计划 → 重演。
4. 全部 `DONE` → 把报告写入 `rehearsals/impl-<n>-<branch>.md`，更新 `state.md`（impl.last=done），提示我可用 `/sandtable-redteam`（对实现打）或 `/sandtable-debrief` 复盘择优。

铁律：每个预演独立 worktree 互不污染；异常即停不自行改计划；不越界不兜底；不轻信 DONE，抽查真实 diff。

8. 完成后加载 `skills/closing-the-loop/SKILL.md`，读 `state.md`，输出收尾（本命令已列出的链内后续步骤除外；链内切换用战报 profile）。缺少明确选择或确认时不得越权执行**本命令未列出**的下一阶段（`/sandtable-autopilot`、`/sandtable-rehearse` 除外）；本回合用户已明确选择/确认且必要证据已先/同时落盘的内联后续，属于本命令允许的链内后续。

## 实现预演完整性闸门

**执行完整性闸门时，必须完整读取并逐条遵循 `skills/_shared/integrity-gate.md`（含“闸门必须包含”与“候选 DONE 报告必须包含”全部条目），不得跳过或凭记忆简写。**
