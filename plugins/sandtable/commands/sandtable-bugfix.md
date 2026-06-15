---
description: bugfix 模式——对一个缺陷启动证据驱动根因排障闭环：自动收集日志、插桩取证、日志100%锁根因、根因修复、清理。
---

对我接下来描述的缺陷启动 bugfix 闭环；读取并遵循 `skills/bugfix-with-evidence/SKILL.md`。

执行：
1. 复现并定义期望 vs 实际；列 ≥2 条并列假设（思维要广+深+发散）。
2. **先自动收集日志**（能 adb/读文件/抓复现输出就别让用户提供）；采集物落**仓库外/临时目录**（含密钥，绝不入库）；用工程自带日志框架、统一 tag `[SANDTABLE-BUGFIX:<feature-or-bug-id>]` 在关键点插桩。
3. 非平凡缺陷派 ≥3 个并行调查子 agent（采集集中、子 agent 只读分析；可用 mental/recon/红军姿态，红军证伪候选根因）。
4. 证据逐一证伪假设直到锁定单一根因——**根因必须靠日志/运行时证据 100% 确认，只读代码推断不算**；日志确实拿不到（又非纯静态可判定）则置 blocked 写 questions.md 问开发者，不擅自降级。
5. 根因修复（改因不改症，禁表面/临时修复）；验证复现消失；按 tag 清理临时日志。
6. 把根因/修复回写 `feedback.md` 与 journal；回 `triaging-feedback` 产出回归用例（回写 tests.md）+ 三件套（根因/预防/教训），教训沉淀进全局 `lessons.md`。关闭需用户确认收敛。
7. 完成后加载 `skills/closing-the-loop/SKILL.md` 输出收尾。

我要排查的缺陷是：
