---
description: 头脑预演（军事隐喻：图上作业）· 只读子 agent 把整条逻辑链从头推到尾，验证闭环、无漏洞、无意外影响；异常即停上报。
---

对当前需求执行头脑预演；读取并遵循 `skills/mental-rehearsal/SKILL.md`。

执行：
1. 读本需求 `plan.md`、`prd.md`、`tests.md`、`constraints.md`、`state.md`。
2. 为每条独立逻辑链路准备完整上下文，按 `mental-rehearsal-prompt.md` 并行派发**只读**子 agent 推演。
3. 任一返回 `ANOMALY_FOUND` → 你亲自核实 → 必要时写 `questions.md` 问我 → 修正 `prd.md`/`tests.md`/`plan.md` → 重演。
4. 全部 `LOGIC_CLOSED` → 把报告写入 `rehearsals/mental-<n>.md`，更新 `state.md`（mental.last=closed），提示我可用 `/sandtable-redteam` 做红蓝对抗或 `/sandtable-live` 实现预演。

铁律：纯只读不改代码；异常即停；不脑补兜底；不轻信子 agent，抽查其引用。

8. 完成后加载 `skills/closing-the-loop/SKILL.md`，读 `state.md`，输出收尾（本命令已列出的链内后续步骤除外；链内切换用战报 profile）。缺少明确选择或确认时不得越权执行**本命令未列出**的下一阶段（`/sandtable-autopilot`、`/sandtable-rehearse` 除外）；本回合用户已明确选择/确认且必要证据已先/同时落盘的内联后续，属于本命令允许的链内后续。

## 问题分级与克制（P0–P3）

- 按 `skills/_shared/issue-grading.md` 的 P0–P3 口径（触发概率 × 功能影响 × 可恢复性 × 用户感知）分级。
- 只有 **P0/P1**（核心受损·违反红线·难自救，或小概率但后果严重）才返回 `ANOMALY_FOUND` 驱动循环；**P2/P3**（边缘、可重试/可自动救回、用户基本无感）记为残余风险随 `LOGIC_CLOSED` 列出，交我拍板。
- 一轮冒出大量 P0/P1 → 先怀疑方案本身，回 PLAN/OBJECTIVES 重审，别逐条打补丁。
- 用人话向我解释：发现什么、定几级、对用户的真实影响、建议怎么办。
- 不为追求逻辑完美构造无现实触发路径、与本需求无关的偏题场景（`being-truthful` 不猜测不变：关键未知不能带着继续）。

## PRD 确认门禁

完整规则见 `skills/_shared/prd-gate.md`。特别地：若 `prd.md` 已存在但无可核实开发者确认记录，不得派发 mental 子 agent；同条消息确认 PRD 时，必须在派发前或同时把确认证据持久化到 `state.md` 或 `journal.md`。
