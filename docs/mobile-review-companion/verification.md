# Mobile Review Companion Verification

- TC1: Start server, note URL/pairing entry, stop server with `POST /stop`.
- TC2: Sync phase and document through MCP handler; confirm server event history and outbox receive updates.
- TC3: Write mailbox JSON manually; confirm server processes it into event stream and outbox.
- TC4: Scan computer QR payload in mobile app and confirm token-bound local/LAN connection.
- TC5: Submit answer from mobile; confirm `journal.md`, `questions.md`, and `state.md` durable writes.
- TC6: Submit PRD confirmation from mobile; confirm journal contains mobile source and feature id.
- TC7: Confirm waiting workers use cursor, report mobile messages to main agent only, and respect stop events.
- TC8: Stop from computer through `/stop` and confirm app disconnect path.
- TC9: Run install/update checks and inspect `docs/sandtable/` is unchanged by default install/update flows.
- TC10: Delete app cache and resume from repository files.
- TC11: Complete a phase action with runtime active; confirm continuation lease exists and no terminal completion semantics are emitted.
- TC12: Run three empty waits across one or more waiting workers, one mobile confirmation, then one stop event; confirm cursor/heartbeat/lease, main-agent notification or worker relay, and stopped lease for all workers.
