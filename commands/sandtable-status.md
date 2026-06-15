---
description: 查看当前 Sandtable 需求的状态机、自动模式配额、任务进度与未决问题。
---

查看当前需求战况（只读）；读取并遵循 `skills/state-and-memory/SKILL.md`。

执行（只读，不改动）：
1. 列出 `docs/sandtable/features/` 下的需求目录。
2. 对当前（或我指定的）需求，读 `state.md`，汇报：当前 `phase`、`blocked` 状态、各任务 status、`rehearsals.*` 的 `runs/last`、`autonomy.mode`、`autonomy.min_rounds`、`autonomy.completed_rounds`、`autonomy.last_decision`、`selected_impl`。
3. 读 `questions.md`，列出所有"待答复"的阻塞问题。
4. 读 `journal.md` 最近若干条，给出最近发生了什么的简述。
5. 明确区分：`rehearsals.*` 是报告汇总，`autonomy.completed_rounds` 是 autopilot 配额计数；不要把前者当作后者。
6. 给出「下一步建议动作」**并**按 `closing-the-loop` 输出可复制模版；明确标注「本次未改任何文件」。

用简洁的表格/列表汇报，不要改任何文件。
