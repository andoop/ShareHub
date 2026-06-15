---
feature: <YYYY-MM-DD>-<slug>
phase: INTAKE            # INTAKE|RECON|OBJECTIVES|TESTCASES|PLAN|MENTAL_REHEARSAL|REDTEAM|IMPL_REHEARSAL|EVALUATE|INTEGRATE|VERIFY|DONE
blocked: false
updated: <ISO8601>
tasks: []                # - { id: T1, title: ..., status: todo }  status: todo|doing|rehearsed|integrated|verified|done
rehearsals:
  mental:  { runs: 0, last: none }  # report summary: none|closed|anomaly
  redteam: { runs: 0, last: none }  # report summary: none|held|breach
  impl:    { runs: 0, last: none }  # report summary: none|done|anomaly|blocked
autonomy:
  mode: manual                       # manual|autopilot; the only authoritative switch for autonomous mode
  min_rounds: { mental: 1, redteam: 1, impl: 1 } # minimum coverage / 最低覆盖
  min_agents_per_round: { mental: 1, redteam: 1, impl: 1 } # minimum coverage / 最低覆盖
  completed_rounds: { mental: 0, redteam: 0, impl: 0 }  # autopilot quota counts only; do not backfill from rehearsals.*
  last_decision: none               # latest automatic advance / rollback / blocker decision
selected_impl: none                 # fill in the chosen implementation rehearsal report after debrief
---

## Current Progress
(Which step we are on now, and what happens next.)

## Key Decisions (Recent)
(Point to the latest notes in `journal.md`.)
