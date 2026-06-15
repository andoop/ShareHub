---
feature: 2026-06-15-share
phase: INTAKE            # INTAKE|RECON|OBJECTIVES|TESTCASES|PLAN|MENTAL_REHEARSAL|REDTEAM|IMPL_REHEARSAL|EVALUATE|INTEGRATE|VERIFY|DONE|FEEDBACK
blocked: false
updated: 2026-06-15T10:48:33+08:00
tasks: []                # - { id: T1, title: ..., status: todo }  status: todo|doing|rehearsed|integrated|verified|done
rehearsals:
  mental:  { runs: 0, last: none }  # 报告汇总：none|closed|anomaly
  redteam: { runs: 0, last: none }  # 报告汇总：none|held|breach
  impl:    { runs: 0, last: none }  # 报告汇总：none|done|anomaly|blocked
autonomy:
  mode: manual                       # manual|autopilot；是否处于自动模式的唯一权威开关
  min_rounds: { mental: 1, redteam: 1, impl: 1 } # minimum coverage / 最低覆盖
  min_agents_per_round: { mental: 1, redteam: 1, impl: 1 } # minimum coverage / 最低覆盖
  completed_rounds: { mental: 0, redteam: 0, impl: 0 }  # 仅 autopilot 配额闭包计数，不要用 rehearsals.* 回填
  last_decision: none               # 最近一次自动推进 / 回退重演 / 阻塞裁决
selected_impl: none      # 择优后填入选定的 impl 预演报告文件名
---

## 当前进展
（现在在哪一步，下一步做什么。）

## 关键决策（最近）
（指向 journal.md 近期要点。）
