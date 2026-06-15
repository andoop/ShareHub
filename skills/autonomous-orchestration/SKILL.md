---
name: autonomous-orchestration
description: Use when the developer wants Sandtable to advance from intake through debrief without manual handoff between phases. Defines autonomous progression, minimum rehearsal minimum coverages, rollback rules, and on-disk state updates.
---

# 全自主自动沙盘编排

**开始时声明：** "我在用 autonomous-orchestration 执行无人值守的 Sandtable 全流程。"

## 硬门禁

<HARD-GATE>
1. 自动模式必须完整覆盖 `INTAKE → RECON → OBJECTIVES → TESTCASES → PLAN → MENTAL_REHEARSAL → REDTEAM → IMPL_REHEARSAL → EVALUATE`。
2. 最低覆盖是硬底线，不可低于 mental/redteam/impl 各一轮；达标后由主 agent 自主裁决追加或评估：
   - mental：至少 1 轮，每轮至少 1 个只读子 agent；
   - redteam：至少 1 轮，每轮至少 1 个红军子 agent；
   - impl：至少 1 轮，每轮至少 1 个独立 worktree 子 agent。
3. 任一 `ANOMALY_FOUND` / `BREACH_FOUND` / `BLOCKED` 都要先由主 agent 亲自核实；写回 `prd.md` / `tests.md` / `plan.md` / `state.md` / `journal.md` 后，再从最早尚未重新验证的阶段重演。异常轮不计入配额。
4. 只有真正需要开发者提供的产品意图、登录、授权、批准或工具权限时，才允许写 `questions.md` 并停下。
</HARD-GATE>

## AUTOPILOT-OVERRIDE

<AUTOPILOT-OVERRIDE>
1. 只在开发者本回合显式触发 `/sandtable-autopilot`，或显式要求以 autopilot 方式续跑 `/sandtable-resume` 时生效。
2. 作用域只限当前这次命令执行；开发者之后若显式触发手动 slash（如 `/sandtable-mental`、`/sandtable-redteam`、`/sandtable-live`、`/sandtable-rehearse`），必须按该手动命令的边界执行，不能因为 `autonomy.mode=autopilot` 就静默覆盖。
3. 手动命令仍可继续写 `rehearsals/`、`rehearsals.*.runs` 与 `rehearsals.*.last`，但这些手动记录不能抵扣 autopilot 的 `autonomy.completed_rounds`。
</AUTOPILOT-OVERRIDE>

## 自动流程

1. 先加载 `state-and-memory`，确认 `docs/sandtable/`、feature 目录与 `state.md` 存在；若 feature 不存在，按模板创建并把 `phase` 设为 `INTAKE`。
2. 先判断这是冷启动/显式重启，还是续接既有 feature：
   - 冷启动（新 feature、无既有 `state.md`/feature 文档，或开发者显式要求从原始需求重来）才初始化 `autonomy.mode=autopilot`、`autonomy.min_rounds={ mental: 1, redteam: 1, impl: 1 }`、`autonomy.min_agents_per_round={ mental: 1, redteam: 1, impl: 1 }`、`autonomy.completed_rounds={ mental: 0, redteam: 0, impl: 0 }`、`autonomy.last_decision=进入 autopilot，开始 RECON；最低覆盖为 mental/redteam/impl 各一轮`，并把 `phase=RECON`。
   - 续接既有 feature/docs/state 时，只写入/保留 `autonomy.mode=autopilot`，不得覆盖既有 `min_rounds`、`min_agents_per_round`、`completed_rounds` 或 `phase`；只刷新必要的 `autonomy.last_decision` 说明按现状续接。
3. 只有冷启动路径可以自动补齐 `RECON → OBJECTIVES → TESTCASES → PLAN`。续接路径必须先检查文档齐备度和 PRD 确认门禁：进入 TESTCASES/PLAN/MENTAL/REDTEAM/IMPL 前，若 `prd.md` 已存在但没有可追溯开发者确认记录，必须停在 PRD 确认点；本回合明确确认 PRD 时，必须先/同时把确认证据写入 `state.md` 或 `journal.md`，才允许继续。
3.5 自动阶段**切换时**加载 `closing-the-loop` 的**战报收尾** profile；不 AskQuestion；**同一 `/sandtable-autopilot` 命令内**立即执行下一合法阶段。但续接命中 PRD 未确认门禁时必须结束本命令并停在 PRD 确认点；命令完全结束或 `blocked=true` 时输出**完整收尾**。
4. 每次自动推进或回退重演时，都同步更新 `state.md.updated`、`phase` 与 `autonomy.last_decision`，并在 `journal.md` 追加本次裁决的原因。
5. 进入推演链后，先补足最低覆盖，再自主裁决推进：
   - `autonomy.completed_rounds.mental < autonomy.min_rounds.mental` 时，继续 mental；
   - mental 达标后，若 `autonomy.completed_rounds.redteam < autonomy.min_rounds.redteam`，继续 redteam；
   - redteam 达标后，若 `autonomy.completed_rounds.impl < autonomy.min_rounds.impl`，继续 impl；
   - 三类最低覆盖全部达成后，且 impl 完整性闸门仍有效时，主 agent 根据风险、改动面、异常历史、实现差异、测试信心和抽查结果，自主选择追加某类推演/实现预演或进入 `EVALUATE`，并写入 `autonomy.last_decision`。
6. `phase` 在 autopilot 下是记录位；恢复与续跑时，先执行 PRD 确认门禁和文档齐备度检查，再按 `autonomy.completed_rounds`、完整性闸门有效性和自主裁决规则决定下一步。

## 轮次判定

- mental 一轮完成：该轮至少 1 个只读子 agent，且全部返回 `LOGIC_CLOSED`。
- redteam 一轮完成：该轮至少 1 个红军子 agent，且全部返回 `HELD`。
- impl 一轮完成：该轮至少 1 个独立 worktree 子 agent，且全部返回 `DONE`。
- 任一子 agent 在该轮返回异常/攻破/阻塞：本轮不计入 `autonomy.completed_rounds`；先修正，再重跑当前阶段。

## 阻塞与回退裁决

| 信号 | 主 agent 裁决 | `state.md` 动作 |
|------|---------------|-----------------|
| `ANOMALY_FOUND` | 亲自核实后修正文档/计划并重演 | `blocked=false`；`phase` 设为最早尚未重新验证的阶段；刷新 `autonomy.last_decision` |
| `BREACH_FOUND` | 亲自核实后修正文档/计划并从 mental 重新验证 | `blocked=false`；`phase=MENTAL_REHEARSAL`；刷新 `autonomy.last_decision` |
| `BLOCKED`（内部可修正） | 作为可修正阻塞处理，修正后重演 | `blocked=false`；`phase` 设为最早尚未重新验证的阶段；刷新 `autonomy.last_decision` |
| `BLOCKED`（外部依赖） | 升级为真正阻塞，写 `questions.md` 向开发者提问 | `blocked=true`；保留当前 `phase`；刷新 `autonomy.last_decision` 说明阻塞原因 |

## 落盘要求

每完成一次自动动作，都要同时写回：
- `state.md`：`phase`、`updated`、`autonomy.*`、必要时 `selected_impl`
- `journal.md`：为什么推进 / 为什么回退 / 为什么升级阻塞
- `rehearsals/`：每轮独立报告，如 `mental-<n>.md`、`redteam-<n>.md`、`impl-<n>-<branch>.md`

## Red Flags

| 念头 | 现实 |
|------|------|
| "照老习惯先问用户要不要继续下一步" | 自动模式默认自己继续；除非是真阻塞。 |
| "这轮发现异常了，先算完成，后面补轮" | 不行。异常轮不计入配额，修正后重跑。 |
| "手动跑过一次 mental，可以顺手抵掉 autopilot 的一轮" | 不行。手动 `rehearsals.*` 不能回填 `autonomy.completed_rounds`。 |
| "state.md 里已经写了 phase，就不用看 minimum coverage" | 不行。autopilot 恢复与续跑先看最低覆盖与自主裁决，再看 `phase`。 |

## 最低覆盖、自主裁决与续接门禁

**必须完整读取并逐条遵循 `skills/_shared/autopilot-coverage.md`（最低覆盖、自主裁决与续接门禁），不得跳过或凭记忆简写。**
