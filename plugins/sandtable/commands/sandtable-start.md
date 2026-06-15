---
description: 启动 Sandtable 前五步流程：从一句需求开始，侦察→目标→用例→计划。
---

对我接下来描述的需求启动 Sandtable 流程；读取并遵循 `skills/using-sandtable/SKILL.md`。

执行（这是前五步入口；推演与复盘请使用单独命令或 `/sandtable-autopilot`）：
1. 加载 `state-and-memory`，在目标项目创建/确认 `docs/sandtable/` 结构；若 `project.md`/`constraints.md` 不存在，先和我确认全局目标与红线（用 `templates/` 拷贝）。
2. 为本需求建 `features/<YYYY-MM-DD>-<slug>/` 目录与 `state.md`（phase=INTAKE），记录原始需求（一句话或我给的产品文档）。
3. **RECON**：加载 `gathering-intel` 侦察情报（摸地形、列未知、攒问题问我）。〔= `/sandtable-recon`〕
4. **OBJECTIVES**：加载 `writing-prd` 定目标、MUST/MUST-NOT、红线、验收。〔= `/sandtable-objectives`〕
   - 写完 `prd.md` 后加载 `skills/closing-the-loop/SKILL.md`，输出**完整收尾** + AskQuestion/确认模版。
   - **本命令在此结束**；不得在本命令内继续步骤5–6。待开发者确认 PRD 后，由确认消息或 `/sandtable-refine` 续跑。
5. **TESTCASES**（PRD 确认**之后**的续跑步骤）：加载 `writing-tests` 产出 `tests.md`。〔= `/sandtable-plan` 前置〕
6. **PLAN**（续跑步骤）：加载 `writing-plan` 写 `plan.md`。
7. PLAN 完成后加载 `skills/closing-the-loop/SKILL.md`，输出**完整收尾**（含 `/sandtable-rehearse`、`/sandtable-autopilot`、`/sandtable-refine` 模版；说明 `/sandtable-rehearse`=四步合一）。

全程严格遵守四条底线（不猜测、先思考、外科手术式改动、目标驱动）。每步更新 `state.md` 与 `journal.md`。若任一步我提出修改，按 `/sandtable-refine` 的方式迭代。

我的需求是：

## PRD 确认门禁与已选择路径直接执行

**开始本动作前，必须完整读取并逐条遵循 `skills/_shared/prd-gate.md`（PRD 确认门禁与已选择路径直接执行），不得跳过或凭记忆简写。**
