---
name: closing-the-loop
description: Use at the end of every Sandtable work turn—after a slash command or phase artifact update—to report status, offer copy-paste next-message templates, and invoke AskQuestion in manual mode when multiple valid branches exist. In autopilot, auto-continue without asking.
---

# 回合收尾 · 让沙盘机制可被感知

**开始时声明：** "我在用 closing-the-loop 做回合收尾。"

<HARD-GATE>
1. **正触发**：本回合为 Sandtable 工作步，且阶段动作完成或需用户确认/选下一步 → 必须输出收尾（见 profile）。
2. **负触发 · 第三态**：本回合**非 Sandtable 工作步** → **禁止**收尾（即使已读写 `docs/sandtable/`，TC8b）。
3. **负触发**：与 Sandtable 无关 → **禁止**收尾（无论是否触达 `docs/sandtable/`）。
4. `autonomy.mode=manual` 且 ≥2 条合理下一步、且本回合用户尚未明确选择路径 → **必须**调用 AskQuestion（工具可用时）；无工具时用编号模版列表。
5. `autonomy.mode=autopilot` 且 `blocked=false` → **禁止** AskQuestion 问「是否继续」；同命令内续跑；但续接命中 PRD 未确认门禁时必须停在 PRD 确认点。`blocked=true` → 完整收尾 + FR5 AskQuestion（阻塞优先）。
6. 有活跃 feature 时读其 `state.md`；**不得**为 typo 等非 Sandtable 任务主动读盘以触发收尾。
</HARD-GATE>

## 两种收尾 profile

| profile | 何时用 | 结构 |
|---------|--------|------|
| **完整收尾** | manual；命令边界结束；blocked；PRD 待确认 | 四段：战况 / 推荐 / 可复制模版 / 其他路径 |
| **战报收尾** | autopilot 非阻塞阶段切换；rehearse/autopilot 链内中间切换 | 战况 + `autonomy.last_decision` +「已自动续跑至 \<phase\>」；省略 AskQuestion 与完整模版 |

## 回合收尾区块（完整 profile）

### 🧭 战况
- feature: `<id>`
- phase: `<PHASE>` · blocked: `<true|false>` · mode: `<manual|autopilot>`

### ➡️ 推荐下一步
（一句话，与 phase 映射表一致）

### 📋 复制即用
```text
（未选择路径时提供完整下一条用户消息；已选择且已执行时不得重复当前选择）
```

### 🔀 其他路径（可选）
```text
（备选模版，每条独立 fenced block）
```

## phase → 默认下一步

| phase | 默认下一步 | 主推 |
|-------|-----------|------|
| INTAKE / RECON | 定目标 | `/sandtable-objectives` 或 `/sandtable-start` |
| OBJECTIVES · PRD 待确认 | 确认 PRD（**不得**推荐进入 TESTCASES；遵守 `writing-prd`） | AskQuestion + 确认/修改模版；`/sandtable-refine` |
| OBJECTIVES · PRD 已确认 | 写用例 | `/sandtable-refine` 或写 `tests.md` |
| TESTCASES | 写计划 | `/sandtable-plan` |
| PLAN | 进入推演 | `/sandtable-rehearse` |
| MENTAL_REHEARSAL | 继续 mental 或 redteam | `/sandtable-mental` / `/sandtable-redteam` |
| REDTEAM | 继续 redteam 或 impl | `/sandtable-redteam` / `/sandtable-live` |
| IMPL_REHEARSAL | 继续 impl 或复盘 | `/sandtable-live` / `/sandtable-debrief` |
| EVALUATE | 落地 / 择优后确认 | 确认合并选定实现 或 `/sandtable-status` |
| INTEGRATE | 验证 | VERIFY 清单 |
| VERIFY / DONE | 战报 / 新需求 / 验收反馈 | `/sandtable-status` / `/sandtable-start` / `/sandtable-bug` |
| FEEDBACK | 分诊 / 根因 / 关闭(需用户确认) | `/sandtable-bug`(受理) · `/sandtable-bugfix`(根因) · 修复后 `/sandtable-status`；FEEDBACK 人在环, autopilot 不驱动 |
| blocked=true | 解阻塞 | 答复 `questions.md` 或 `/sandtable-resume` |
| 异常回退 | 重演 | 依 `autonomy.last_decision` → OBJECTIVES / mental / redteam / plan |

## 样例 · OBJECTIVES, PRD 待确认

```text
PRD 方向认可。请记录可追溯 PRD 确认证据，并继续写 tests.md。
```

```text
/sandtable-refine

先改 PRD：<具体修改点>
```

## 样例 · PLAN, manual

```text
/sandtable-rehearse

对 feature `<id>` 执行联合预演（mental → redteam → impl → debrief）。
```

```text
/sandtable-autopilot

从当前 feature 续跑自动模式，完成推演链路与复盘择优。
```

## Red Flags

| 念头 | 现实 |
|------|------|
| "读过 state.md 就该收尾" | 非 Sandtable 工作步禁止收尾（第三态）。 |
| "autopilot 每阶段都弹 AskQuestion" | 非阻塞 autopilot 用战报收尾，不弹。 |
| "链内切换可以省略战报" | 禁止省略；至少战报收尾。 |
| "PRD 待确认时推荐进 TESTCASES" | 违反 writing-prd 硬门禁。 |

## PRD 确认门禁与已选择路径直接执行

**开始本动作前，必须完整读取并逐条遵循 `skills/_shared/prd-gate.md`（PRD 确认门禁与已选择路径直接执行），不得跳过或凭记忆简写。**
