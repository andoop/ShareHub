# 验收反馈台账 · Feedback（落地后，只增不改历史结论）

> 每条验收反馈/bug 一节。由 triaging-feedback 受理、bugfix-with-evidence 找根因。
> 回归用例回写本 feature 的 tests.md，不在此另起台账。
> 日志原文落仓库外/临时目录，本文件只记摘录+行号，绝不入库日志原文（含密钥风险）。

## BUG<N>
- 生命周期：OPEN / TRIAGED / INVESTIGATING / ROOT_CAUSED / FIXING / VERIFYING / USER_CONFIRMED / CLOSED
  （排查可反复：VERIFYING 未过弹回 INVESTIGATING；未经用户确认收敛不得 USER_CONFIRMED/CLOSED）
- 来源：（验收 / 线上 / 其他；何时、谁）
- 复现步骤：
- 期望：
- 实际：
- 严重度：（阻断 / 严重 / 一般 / 轻微）
- 日志来源：（自动采集命令 / 用户提供；落点=**仓库外** scratch 路径；只记关键摘录+行号，**原文不入库**，含密钥风险）
- 分诊结论：（真缺陷 / 漏需求 / 误解或预期内；依据 file:line 或 PRD 条目）
- 根因：（带因果链 + 证据出处 file:line / 日志行；**必须有日志/运行时证据**，纯读代码不算；缺陷类修复前不得为空）
- 修复指向：（改了哪个文件/任务）
- 回归用例：（指向 tests.md 的 TC 编号）
- 用户确认：（用户何时确认收敛/解决；未确认不得关闭）
- 怎么预防：（流程/红线/检查项层面措施，非"以后小心"）
- 吸取的教训：（一句可复用经验 → 已写入 lessons.md；候选红线/检查项更新建议）
