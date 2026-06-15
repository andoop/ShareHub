# Mobile Review Companion Protocol

Sandtable files remain the durable source of truth. The runtime mailbox is a transport queue for agent/mobile/server events.

## Sessions & Conversations (mobile-facing)

The mobile app is session-centric: one runtime can host many sessions (one per
agent × feature), and a single device pairing grants access to all of them.

- `GET /sessions?token=` → all sessions with live status.
- `GET /sessions/:id?token=` → one session.
- `GET /sessions/:id/messages?token=` → durable conversation transcript.
  Conversations persist under `.sandtable-runtime/conversations/<sessionId>.json`
  so chat history survives server restarts.
- `POST /sessions/:id/messages` body `{ token, text, kind?, target? }`
  (`kind`: `chat` | `answer` | `confirmation`) → mobile → agent message. Also
  mirrored into the mailbox so the worker polling path keeps working.
- `POST /agent/sessions` body `RuntimeSessionInput` → register/update a session.
- `POST /agent/sessions/:id/messages` body `{ kind?, text?, phase?, blocked?, summary? }`
  → agent → mobile message (reply / phase / question / status).

### Structured stream

- `GET /stream?token=` returns `text/event-stream` carrying typed envelopes:
  - `event: session` `data: { kind:"session", session }`
  - `event: message` `data: { kind:"message", message }`
- Clients keep a single subscription and route by `kind`. A `: ping` comment is
  sent every 25s to keep the connection alive.

The legacy global `GET /events` (raw mailbox messages) remains for older clients.

## Mailbox

- `inbox`: messages written by agents or mobile clients for the server to process.
- `processed`: messages moved after successful processing.
- `outbox`: server-originated notifications for agents that do not use MCP.
- `cursors`: per-worker cursor and heartbeat files.

Messages live under `.sandtable-runtime/mailbox/` and use JSON files. Durable decisions and developer answers must be written back to `docs/sandtable/features/<feature>/`.

## Message Shape

```json
{
  "id": "20260613T185150Z-mobile-abc123",
  "feature": "2026-06-13-mobile-review-companion",
  "source": "agent",
  "type": "phase_update",
  "createdAt": "2026-06-13T18:51:50.000Z",
  "payload": {}
}
```

## Continuation

When the runtime is active, a phase handoff is not a terminal state. The main agent renews `.sandtable-runtime/session/continuation.json` and assigns one or more cheap/free waiting workers. Workers may poll, subscribe, block on host-supported wait primitives, or use mixed waiting, but they all follow cursor and lease rules.

Empty waits only refresh heartbeat/cursor/lease. Mobile messages notify the main agent or a specifically responsible worker. Stop events mark the lease stopped and end all waiting workers.

## Durable Writes

Mobile answers and confirmations must be appended to `journal.md`. Question answers must also append an answer/resolution record to `questions.md`; when an answer resolves a blocker, `state.md` must be updated with `blocked: false`.

## Mobile Event Stream

- `GET /events` returns `text/event-stream`.
- Each frame uses `event: <message.type>` and `data: <MailboxMessage JSON>`.
- The Flutter app filters events by paired `feature` id client-side.

## Pairing-Authenticated Sync (E2E / manual test)

These endpoints publish the same mailbox events as MCP tools, using the pairing token:

- `POST /features/:feature/sync/phase` body: `{ "token", "phase", "summary?" }`
- `POST /features/:feature/sync/document` body: `{ "token", "name", "content" }`

## Worker discipline

- Waiting sub-agent **only** polls `GET /mailbox/inbox?feature=&after=` every 5s via `scripts/sandtable-mobile-wait.sh`.
- On first new mobile message: print JSON and **exit**; main agent handles; then `POST /mailbox/inbox/ack` and restart wait via `/sandtable-mobile-wait`.
- Mobile events (`mobile_paired`, `question_answer`, `confirmation`) are written to **inbox**, not checked via status/outbox.

- `POST /mobile-sync/start` body: `{ "feature"? }` → `{ code, token, publicUrl, expiresAt }`.
  `feature` is optional: omit it to pair at the device level (the phone then
  manages every session); supply it to also seed a primary session for legacy
  single-feature flows.
- `POST /pair/by-code` body: `{ "code" }` → `{ token, feature, url }` (mobile App)
- `GET /mobile-sync/status` → active session + pending code
- `POST /mobile-sync/stop` → end sync (slash `/sandtable-mobile-stop` also stops server)
- `GET /mobile-sync/outbox?feature=&after=` → mobile messages for waiting worker

### Durable pairing

A successful pairing (4-digit `/pair/by-code` claim, or a `GET /pairing` QR token)
is persisted to `.sandtable-runtime/session/devices.json`. The server loads these
tokens on startup, so the phone keeps working across a server restart without
re-pairing — the device token is independent of the short-lived PIN TTL. Invalid
tokens get HTTP `401` so clients can distinguish an expired pairing from a
transient network error. Delete `devices.json` to revoke all paired devices.
