---
description: 指挥官意图 · 基于情报制定作战目标：要达成什么、必须做什么(MUST)、绝对不能做什么(MUST-NOT)、红线与验收标准。
---

基于已有情报为当前需求确立作战目标；读取并遵循 `skills/writing-prd/SKILL.md`。

执行：
1. 读本需求 `journal.md` 的情报简报、`project.md` 北极星、`constraints.md` 全局红线。若情报不足，先提示我去跑 `/sandtable-recon`。
2. 一次一个问题，和我对齐意图与成功标准（不猜测，缺失就问，不发明需求）。
3. 写/更新 `prd.md`，重点产出：
   - **目标**（与北极星的关系）
   - **MUST**：这个需求绝对要做的
   - **MUST NOT**：绝对不能做的（含不做未要求的兜底、不节外生枝），继承全局红线
   - **验收标准**：可验证、可测试
4. 自查占位/矛盾/歧义/范围，请我确认。
5. 确认后更新 `state.md`（phase=TESTCASES），加载 `writing-tests` 产出 `tests.md`，提示我可用 `/sandtable-refine` 迭代用例。

目标必须可验证；红线缺失会让后续预演无法识别"越界"，务必写全。

8. 完成后加载 `skills/closing-the-loop/SKILL.md`，读 `state.md`，输出收尾（本命令已列出的链内后续步骤除外；链内切换用战报 profile）。缺少明确选择或确认时不得越权执行**本命令未列出**的下一阶段（`/sandtable-autopilot`、`/sandtable-rehearse` 除外）；本回合用户已明确选择/确认且必要证据已先/同时落盘的内联后续，属于本命令允许的链内后续。

## PRD 确认门禁与已选择路径直接执行

**开始本动作前，必须完整读取并逐条遵循 `skills/_shared/prd-gate.md`（PRD 确认门禁与已选择路径直接执行），不得跳过或凭记忆简写。**
