---
description: 受理一条验收反馈/bug，落 feedback.md 并分诊，进入 FEEDBACK 阶段（落地后闭环入口）。
---

受理我接下来描述的验收反馈；读取并遵循 `skills/triaging-feedback/SKILL.md`。

执行：
1. 确认当前 feature（读 `docs/sandtable/`）。**若反馈针对的代码没有对应 feature 目录**，自动新建轻量 feature `<date>-bugfix-<slug>`（最小 state.md/feedback.md，复用 init 幂等逻辑）再继续。把反馈作为一条 BUG 节追加到该 feature 的 `feedback.md`（用 `templates/feedback.md`），填生命周期/复现/期望/实际/严重度。
2. 分诊为三类之一（真缺陷 / 漏需求 / 误解或预期内），结论标来源（file:line 或 PRD 条目）。
3. 真缺陷 → 提示用 `/sandtable-bugfix` 进入根因闭环；漏需求 → 回退 OBJECTIVES 补 PRD/用例；误解 → 说明不改。
4. 更新 `state.md`（phase=FEEDBACK）、journal 追加 `[反馈]`。FEEDBACK 人在环：autopilot 不驱动，未经用户确认收敛不得关闭。
5. 完成后加载 `skills/closing-the-loop/SKILL.md` 输出收尾。

我反馈的问题是：
