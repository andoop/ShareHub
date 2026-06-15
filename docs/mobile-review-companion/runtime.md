# Mobile Review Companion Runtime

The runtime is optional. Installing or updating Sandtable methodology assets does not install Node, Flutter, Dart, or runtime dependencies.

## Start

```bash
npm --prefix runtime/server install
npm --prefix runtime/server run dev -- --repo "$PWD" --host 0.0.0.0 --port 8765
```

## MCP

Agents that support stdio MCP can launch:

```bash
npm --prefix runtime/server run mcp -- --repo "$PWD"
```

Tools:

- `sandtable_sync_phase` — publish current phase; mirrored into the session conversation as a phase banner.
- `sandtable_publish_document` — publish a document snapshot; mirrored as a document notice.
- `sandtable_post_message` — post a free-form reply into the session conversation (kind: `chat` | `question` | `status`).
- `sandtable_read_mobile_messages` — read pending mobile-origin messages for a feature.

## Stop

Press `Ctrl-C` in the server terminal or call:

```bash
curl -X POST http://127.0.0.1:8765/stop
```

## Pairing

Open `GET /pairing?feature=<feature-id>` on the computer. The response contains a `qrPayload` shaped as `sandtable://pair?...`; the Flutter app scans it and uses the token for write requests.

## iOS Real-Device Listening Test

1. Start server with LAN URL embedded in pairing payloads:

```bash
npm --prefix runtime/server run dev -- \
  --repo "$PWD" \
  --host 0.0.0.0 \
  --port 8765 \
  --public-url "http://<your-lan-ip>:8765"
```

2. Pair the iOS app (scan QR or paste `qrPayload`).
3. Confirm the feature screen shows **Listening** and the current phase from `state.md`.
4. Publish a test phase update:

```bash
chmod +x scripts/mobile-listening-e2e.sh
./scripts/mobile-listening-e2e.sh \
  --base-url "http://127.0.0.1:8765" \
  --feature "<feature-id>" \
  --token "<pairing-token>" \
  --phase PLAN \
  --summary "Test from script"
```

5. Without restarting the app, the phase card should update to `PLAN`.
6. Optional document badge test:

```bash
./scripts/mobile-listening-e2e.sh \
  --base-url "http://127.0.0.1:8765" \
  --feature "<feature-id>" \
  --token "<pairing-token>" \
  --document-name prd \
  --document-content "Updated body"
```

The `prd` row should show **Updated on server** until opened.

## On-demand sync (slash commands)

Start only when needed; stop when done.

```bash
# In Cursor chat:
/sandtable-mobile-start

# Or manually from repo root:
./scripts/sandtable-mobile-start.sh [feature-id]
```

This prints a **4-digit pairing code**, the LAN server URL, and a **scannable QR
code rendered directly in the terminal**. On iPhone: either scan the QR in the
Sandtable app (instant, no typing) or enter the URL + 4-digit code manually.

The terminal QR is generated locally with a bundled, dependency-free encoder
(`runtime/server/scripts/qrcodegen.mjs` + `qr-print.mjs`, a self-contained port
of Project Nayuki's QR library, MIT). It needs nothing beyond Node — no agent,
no extra packages, no network. It encodes a durable pairing token
(`sandtable://pair?url=...&token=...`) so the scan connects immediately and
survives server restarts. The renderer uses half-block characters with forced
black/white (ANSI), so it scans regardless of the terminal's light/dark theme.

The slash command launches the server as a **detached daemon** (`runtime/server/scripts/start-daemon.mjs`, started with `detached: true` → its own session/process group). This is deliberate: a plain background `&` stays in the agent's process group and gets reaped when the agent finishes the command or the terminal closes, which would silently kill the server shortly after pairing. The daemon survives the agent turn and runs until `/sandtable-mobile-stop` (or `/stop`). Its PID is recorded at `.sandtable-runtime/session/server.pid` (a process-group leader, so stop signals the whole group) and logs go to `.sandtable-runtime/session/server.log`.

### Per-repo ports (no conflicts)

`GET /health` returns `{ ok, repo, url }`. The start script uses this to pick a
port: it reuses the port already serving **this** repo, and skips ports held by a
**different** repo's server, scanning upward from the preferred port (default
8765). The chosen port is written to `.sandtable-runtime/session/server.port`
(read by stop/status). So several repos can run their own servers at once, and
the phone connects to each as a separate server (managed in the app's Servers
screen).

Stop sync and server:

```bash
/sandtable-mobile-stop
# or: ./scripts/sandtable-mobile-stop.sh
```

Status:

```bash
/sandtable-mobile-status
```

Waiting worker (sub-agent polls mobile messages for the main agent):

```bash
./scripts/sandtable-mobile-wait.sh <feature-id>
```

## Persistent Workers

When the runtime is active, the main agent must not treat a phase handoff as session termination. Before ending any phase action, it renews `.sandtable-runtime/session/continuation.json` and hands mailbox waiting to one or more cheap/free waiting workers.

Workers may poll, subscribe, block on a host-supported wait primitive, or use any other cheap waiting operation. All workers follow the same mailbox cursor and continuation lease protocol. Empty waits only refresh heartbeat/cursor/lease. Workers must not edit PRD/tests/plan unless explicitly assigned that responsibility. Only a computer-side stop, stop mailbox event, or explicit developer stop request may mark the continuation stopped.
