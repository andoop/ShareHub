---
description: 从需求到复盘全流程无人值守推进
---

对当前需求执行 Sandtable 自动模式；读取并遵循 `skills/autonomous-orchestration/SKILL.md`。

执行：
1. 本命令显式启用 `<AUTOPILOT-OVERRIDE>`，且只对这次 `/sandtable-autopilot` 生效；之后若我显式触发手动 slash，按该手动命令的边界执行，不要静默延续 override。
2. 读 `docs/sandtable/project.md`、`constraints.md` 与当前需求；必要时创建/续接 feature 目录与 `state.md`。
3. 先判断冷启动/显式重启还是续接：只有新 feature、无既有 `state.md`/feature 文档，或我显式要求从原始需求重来时，才初始化 `phase=RECON`、`autonomy.min_rounds`、`autonomy.min_agents_per_round`、`autonomy.completed_rounds` 与 `autonomy.last_decision`；续接既有 feature/docs/state 时保留既有 `min_rounds`、`min_agents_per_round`、`completed_rounds` 与 `phase`，只写入/保留 `autonomy.mode=autopilot` 并刷新必要的 `last_decision`。
4. 只有冷启动路径可自动完成 `RECON → OBJECTIVES → TESTCASES → PLAN`。续接路径必须先检查 PRD 确认门禁和文档齐备度；进入 TESTCASES/PLAN/MENTAL/REDTEAM/IMPL 前，若 `prd.md` 已存在但无可追溯开发者确认记录，必须停在 PRD 确认点；同条消息确认 PRD 时，必须先/同时把确认证据写入 `state.md` 或 `journal.md`。
5. 按硬门槛继续推进：
   - 头脑预演至少 1 轮，每轮至少 1 个只读子 agent；
   - 红蓝对抗至少 1 轮，每轮至少 1 个红军子 agent；
   - 实现预演至少 1 轮，每轮至少 1 个独立 worktree 子 agent。
6. 任一 `ANOMALY_FOUND` / `BREACH_FOUND` / `BLOCKED`：先亲自核实，写回 `prd.md` / `tests.md` / `plan.md` / `state.md` / `journal.md`，然后按最早尚未重新验证的阶段重演；只有真正阻塞才写 `questions.md` 并向我提问。
7. 各阶段之间不等待用户确认；阶段切换时更新 state、输出**战报收尾** profile，并在同一命令内继续执行。最低覆盖达成并完成自主裁决并完成复盘择优后，加载 `closing-the-loop` 输出**完整收尾**（含可复制模版）。`blocked=true` 时输出**完整收尾**并可用 AskQuestion（FR5 优先于 autopilot 静默纪律）。

## 最低覆盖、自主裁决与续接门禁

**必须完整读取并逐条遵循 `skills/_shared/autopilot-coverage.md`（最低覆盖、自主裁决与续接门禁），不得跳过或凭记忆简写。**
