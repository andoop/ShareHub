# 最低覆盖、自主裁决与续接门禁

> Sandtable 共享片段（单一真源）。命令与 skill 通过引用本文件使用，**请勿在别处复制全文**；改规则只改这里。

- `autonomy.min_rounds` 和 `autonomy.min_agents_per_round` 表示最低覆盖，默认 `{ mental: 1, redteam: 1, impl: 1 }`；历史 feature 已写入 3/3/2 时不得强制迁移或覆盖。
- 冷启动才初始化 `phase=RECON` 并自动补齐 `RECON -> OBJECTIVES -> TESTCASES -> PLAN`。已有 `state.md` 或任一 feature 文档时按续接处理，保留既有 `min_rounds`、`min_agents_per_round`、`completed_rounds` 与 `phase`。
- 续接进入 TESTCASES/PLAN/MENTAL/REDTEAM/IMPL 前必须先检查 PRD 确认门禁：确认必须可追溯到开发者输入，并在继续前或同时持久化到 `state.md` 或 `journal.md`。AskQuestion 需有 answer id 或 `source: askquestion:<id>`；自然语言确认需记录用户原话摘录、确认时间和用户消息来源。agent 自写推进日志、`autonomy.last_decision`、`phase>=TESTCASES`、仅写“AskQuestion 答复”或无来源的 `prd_confirmed` 不算确认。
- 文档未齐备时从最早缺失阶段补齐；但 `prd.md` 已存在且未确认时必须停在 PRD 确认点，不得因缺 `tests.md` 或 `plan.md` 继续。
- 推演链先补足 mental -> redteam -> impl 最低覆盖。最低覆盖达成后，主 agent 必须依据风险、改动面、历史教训、异常是否刚修复、实现候选差异、测试信心和抽查结果，自主追加或进入 `EVALUATE`，并记录 `autonomy.last_decision`；非真实阻塞不得询问用户是否继续。
- impl 自报 `DONE` 不能直接计入轮次或进入 `EVALUATE`；必须先通过完整性闸门，并在进入 `EVALUATE` 前二次校验当前 PRD/tests/plan 结构化基准、覆盖矩阵、live TODO 表、真实 diff / 改动文件清单。
