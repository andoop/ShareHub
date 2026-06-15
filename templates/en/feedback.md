# Acceptance Feedback Ledger · Feedback (post-landing; conclusions append-only)

> One section per acceptance feedback/bug. Intake via triaging-feedback; root cause via bugfix-with-evidence.
> Regression cases go back into this feature's tests.md, not a separate ledger here.
> Raw logs land outside the repo / in a temp dir; this file keeps only excerpts + line numbers, never raw logs (secret risk).

## BUG<N>
- Lifecycle: OPEN / TRIAGED / INVESTIGATING / ROOT_CAUSED / FIXING / VERIFYING / USER_CONFIRMED / CLOSED
  (investigation is iterative: VERIFYING-not-passed bounces back to INVESTIGATING; no USER_CONFIRMED/CLOSED without user-confirmed convergence)
- Source: (acceptance / production / other; when, who)
- Repro steps:
- Expected:
- Actual:
- Severity: (blocker / major / minor / trivial)
- Log source: (auto-collect command / user-provided; location = **outside-repo** scratch path; keep only excerpts + line numbers, **never commit raw logs**, secret risk)
- Triage: (real defect / missing requirement / misread or expected; basis file:line or PRD item)
- Root cause: (causal chain + evidence location file:line / log lines; **must be backed by log/runtime evidence**, code-reading alone doesn't count; not empty before a defect fix)
- Fix pointer: (which file/task changed)
- Regression case: (TC id in tests.md)
- User confirmation: (when the user confirmed convergence/resolution; no close without it)
- Prevention: (process/redline/checklist-level measure, not "be careful next time")
- Lesson: (one reusable takeaway -> written to lessons.md; candidate redline/checklist update)
