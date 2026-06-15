# 实现预演子 agent · Prompt 模板

派发实现子 agent 时使用。每个子 agent 在【独立 worktree/分支】里完整实现同一计划，可并行多个用于择优。

```
Task tool (subagent_type: generalPurpose):
  description: "实现预演 #<n>: <feature>"
  prompt: |
    你是一个【实现预演】子 agent。任务：在给定的隔离工作区里，按下面的计划和 PRD
    【完整实现】代码并验证，不留任何细节（无 TODO、无占位）。这是一次"试做"，
    用于和其他并行预演比较择优，所以请做出你最高质量的实现。

    ## 工作目录（你的隔离 worktree，只在此目录内改动）
    [../<repo>-rehearsal-<n>]  分支: sandtable/rehearse/<feature>-<n>

    ## 计划（逐任务完整文本）
    [粘贴 plan.md 全文 —— 不要让子 agent 自己去找]

    ## PRD 要点 + 验收标准
    [粘贴 prd.md 相关片段]

    ## 待验证用例清单（来自 tests.md，逐条核对的靶标）
    [粘贴 tests.md 中本链路相关的 TC 全文]
    （注：用例是 AI 对需求理解的具体表现，不见得可执行；能执行的逐条执行让 Then 成立，不能执行的作为参考核对实现是否与用例所表达的意图相符。）

    ## 必须遵守的红线（MUST / MUST-NOT）
    [粘贴 constraints.md + prd.md 的 MUST/MUST-NOT]

    ## 起点上下文
    [相关文件、模式、约定，标 file:line]

    ## 你的工作方式
    1. 严格按计划步骤实现；遵循 TDD（先写失败测试→实现→通过→提交）。
    2. 完整实现，不留 TODO/占位/"以后再补"。
    3. 遵循 Karpathy 原则：最简实现、外科手术式改动、不做未要求的兜底、不节外生枝。
    4. 不确定的事不要猜：能从代码/文档确认就确认（引用 file:line），否则上报。
    5. 频繁提交，保持每次提交可验证。
    6. 只在你的 worktree 内改动，不碰其他目录。
    7. 实现完成后逐条核对 TC：能执行的让 Then 真实成立（贴证据）；不能执行的作为参考核对实现是否与用例意图相符。仅当**可执行 TC 的 Then 不成立**、或实现与某 TC 所表达的理解**相悖**时才 ANOMALY；"用例本身不可执行"不算。

    ## 终止规则（最重要）
    只要发现下列任意一种，【立即停止实现】并返回 ANOMALY_FOUND，
    【不要】自行修改计划/PRD 然后接着写：
    - 计划/PRD 与代码现实不符，或步骤无法照做
    - 出现意料之外的行为、副作用、影响范围
    - 有你无法用代码或文档确认的不确定点
    - 任一步骤会违反 MUST / MUST-NOT
    - 你需要做计划没预料到的架构决策

    ## 返回格式（三选一）
    DONE
    - 实现了什么（对照计划逐任务）
    - 测试：跑了什么、结果（贴关键输出）
    - 改动文件清单 + 提交 SHA
    - 自查：完整性 / 质量 / 是否越界 / 是否有未要求的兜底
    - 你认为这版实现的优点与权衡（供主 agent 打分参考）

    ANOMALY_FOUND
    - 偏差/问题：具体是什么
    - 位置：plan.md 哪一处 / 代码哪个 file:line
    - 为什么是问题、影响范围
    - 你已实现到哪一步（便于回滚）
    - 需要的澄清

    BLOCKED
    - 卡在哪、试过什么、需要哪种帮助（更多上下文 / 拆小 / 计划有错）
```

## 实现预演完整性闸门

`DONE` 只是候选自报完成，不得直接进入 `evaluating-rehearsals` / debrief / EVALUATE。全部候选自报 `DONE` 后，主 agent 必须先执行完整性闸门，简单候选可亲自检查，复杂或高风险候选可按需派只读 mental/redteam 风格子 agent 辅助。

闸门必须包含：
- 主 agent 独立读取当前 `prd.md`、`tests.md`、`plan.md`，重算结构化核对基准；候选报告内嵌基准、覆盖矩阵或 TODO 表只能作为输入，不能作为事实来源。
- 稳定键派生：`FRx` 来自 PRD 原编号；`PRD-AC1...n` 来自 PRD 独立验收标准章节顶层 bullet；`MUST-1...n` 与 `MNOT-1...n` 来自 MUST / MUST NOT 顶层 bullet；`TCx` 来自 tests 原编号；`PLAN Tx/步骤x` 来自 `plan.md` checkbox 原文编号和标题，保留小数编号。
- 正文 hash：提取条目的规范化 UTF-8 文本，LF 换行，去除行尾空白，保留条目内部顺序和缩进语义后计算 SHA-256。任一 FR/PRD-AC/MUST/MNOT/TC/PLAN checkbox 的增删、改名、正文变化或 hash 缺失都导致基准不同。
- 闸门结论记录核对时间、候选 worktree/分支、当前三文档结构化基准、真实 diff 或改动文件清单摘要。不得只用 impl 报告 mtime、粗粒度摘要或标识集合判断是否过期。
- 对照真实 diff / 改动文件清单核查覆盖矩阵和 live 执行 TODO 表；diff 为空、缺少计划要求文件族、缺少主 agent diff 核对结论、少报键、聚合键、无依据 `not-applicable`、`missing` 或 `blocked`，均不得通过。

候选 `DONE` 报告必须包含：
- 覆盖矩阵：`PRD 覆盖 FRx`、`PRD 验收标准 PRD-ACx`、`PRD 红线 MUST-x/MNOT-x`、`TESTS TCx`、`PLAN Tx/步骤x`，逐项列状态与证据，不得用任务级汇总代替步骤级 checkbox。
- live 执行 TODO 表：列 `项` / `来源` / `状态` / `证据`；`项` 使用 `PRD FRx`、`PRD-ACx`、`MUST-x`、`MNOT-x`、`TCx`、`PLAN Tx/步骤x`；`状态` 只能是 `done` / `not-applicable` / `blocked` / `missing`。该表只属于候选报告，不新增独立 TODO 文件，不替代 `plan.md` / `state.md`。
- 覆盖矩阵与 live TODO 表在 PRD FR、PRD-AC、MUST/MNOT、TC、PLAN 步骤键集合上一一对应；冲突时以更细粒度的 `missing` / `blocked` 为准。
