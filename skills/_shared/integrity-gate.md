# 实现预演完整性闸门

> Sandtable 共享片段（单一真源）。命令与 skill 通过引用本文件使用，**请勿在别处复制全文**；改规则只改这里。

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
