import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import { nanoid } from "nanoid";
import { appendConversationMessage, deleteConversation, listConversationMessages } from "./conversations.js";
import { DeviceRegistry } from "./devices.js";
import type { RuntimeEvents } from "./events.js";
import { createMessage, enqueueInbox, markProcessed, readInbox, readOutbox } from "./mailbox.js";
import { clearMobileSyncSession, readMobileSyncSession, writeMobileSyncSession } from "./mobile-sync.js";
import { PairingRegistry } from "./pairing.js";
import { appendMobileJournal, readFeatureDocument, readFeatureStateSummary, recordQuestionAnswer, setBlocked } from "./sandtable.js";
import { deleteSession, ensureFeatureSession, getSession, listSessions, markSessionPaired, touchSession, upsertSession } from "./sessions.js";
import type {
  AgentRole,
  AgentRunState,
  AgentRuntimeState,
  ConversationKind,
  ConversationRole,
  MailboxMessage,
  RuntimePaths,
  RuntimeSession,
  RuntimeSessionInput,
  SandtableDocumentName
} from "./types.js";

export async function createHttpServer(
  paths: RuntimePaths,
  events: RuntimeEvents,
  stop: () => Promise<void>,
  publicUrl = "http://127.0.0.1:8765"
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const pairing = new PairingRegistry();
  const devices = new DeviceRegistry(paths);
  // Restore previously paired device tokens so the phone reconnects after a
  // server restart without re-pairing.
  await devices.load();

  // --- auth helpers -------------------------------------------------------

  function unauthorized(): never {
    const error = new Error("invalid pairing token") as Error & { statusCode?: number };
    error.statusCode = 401;
    throw error;
  }

  function requirePairing(token: string, feature: string): void {
    const session = pairing.getByToken(token, feature);
    if (!session) {
      unauthorized();
    }
  }

  function requireMobileToken(token?: string): void {
    if (!token || (!pairing.getToken(token) && !devices.has(token))) {
      unauthorized();
    }
  }

  // --- session helpers ----------------------------------------------------

  async function sessionForFeature(feature: string): Promise<RuntimeSession> {
    return ensureFeatureSession(paths, feature);
  }

  /** Read the freshest session row and push it to every live `/stream` client. */
  async function broadcastSession(sessionId: string): Promise<void> {
    const session = await getSession(paths, sessionId);
    if (session) events.broadcast({ kind: "session", session });
  }

  /**
   * Append a message to the durable conversation transcript and fan it out to
   * live clients. Optionally advances the owning session row (phase/blocked/
   * summary) and rebroadcasts it so the session list stays in sync.
   */
  async function recordConversation(input: {
    session: RuntimeSession;
    role: ConversationRole;
    kind: ConversationKind;
    text: string;
    payload?: Record<string, unknown>;
    sessionUpdates?: Partial<RuntimeSession>;
  }): Promise<void> {
    const message = await appendConversationMessage(paths, {
      sessionId: input.session.id,
      feature: input.session.feature,
      role: input.role,
      kind: input.kind,
      text: input.text,
      payload: input.payload,
      agent: input.session.agent
    });
    if (input.sessionUpdates) {
      await touchSession(paths, input.session.id, input.sessionUpdates);
    } else {
      await touchSession(paths, input.session.id, {});
    }
    events.broadcast({ kind: "message", message });
    await broadcastSession(input.session.id);
  }

  async function publishMobileInbox(
    feature: string,
    type: "question_answer" | "confirmation" | "mobile_paired",
    payload: Record<string, unknown>,
    sessionId?: string
  ): Promise<MailboxMessage> {
    const message = createMessage(feature, "mobile", type, payload, { sessionId });
    await events.publish(message);
    await enqueueInbox(paths, message);
    if (sessionId) await touchSession(paths, sessionId);
    return message;
  }

  async function publishAgentSnapshot(feature: string, sessionId?: string): Promise<{ synced: boolean; phase?: string }> {
    const summary = await readFeatureStateSummary(paths, feature);
    if (!summary) return { synced: false };
    const runtimeSession = (sessionId ? await getSession(paths, sessionId) : null) ?? (await sessionForFeature(feature));
    const message = createMessage(feature, "agent", "phase_update", {
      phase: summary.phase,
      summary: "Synced from Sandtable state",
      blocked: summary.blocked
    }, { sessionId: runtimeSession.id, agent: runtimeSession.agent });
    await touchSession(paths, runtimeSession.id, {
      phase: summary.phase,
      blocked: summary.blocked,
      summary: "Synced from Sandtable state"
    });
    await events.publish(message);
    await broadcastSession(runtimeSession.id);
    const session = await readMobileSyncSession(paths);
    if (session && session.feature === feature) {
      await writeMobileSyncSession(paths, {
        ...session,
        agentSyncedAt: new Date().toISOString()
      });
    }
    return { synced: true, phase: summary.phase };
  }

  app.get("/health", async () => ({ ok: true, repo: paths.repoRoot, url: publicUrl }));

  // --- agent session registration & messaging ----------------------------

  app.post("/agent/sessions", async (request) => {
    const body = request.body as RuntimeSessionInput;
    if (!body.feature?.trim()) throw new Error("feature is required");
    const summary = await readFeatureStateSummary(paths, body.feature.trim());
    const session = await upsertSession(paths, {
      ...body,
      feature: body.feature.trim(),
      workspace: body.workspace ?? paths.repoRoot,
      phase: body.phase ?? summary?.phase,
      blocked: body.blocked ?? summary?.blocked ?? false
    });
    await events.publish(
      createMessage(
        session.feature,
        "server",
        "phase_update",
        {
          phase: session.phase,
          summary: session.summary ?? "Session registered",
          blocked: session.blocked
        },
        { sessionId: session.id, agent: session.agent }
      )
    );
    events.broadcast({ kind: "session", session });
    return { ok: true, session };
  });

  /**
   * Agent → mobile message. Posts a reply/phase/question/status into a session
   * conversation. Accepts either a `sessionId` path param or, when the agent
   * only knows its feature, resolves the session from `feature` in the body.
   */
  app.post("/agent/sessions/:sessionId/messages", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as {
      kind?: ConversationKind;
      text?: string;
      phase?: string;
      blocked?: boolean;
      summary?: string;
    };
    const session = await getSession(paths, sessionId);
    if (!session) throw new Error("session not found");
    const kind: ConversationKind = body.kind ?? "chat";
    const text = (body.text ?? body.summary ?? "").trim();
    if (!text && !body.phase) throw new Error("text is required");

    const updates: Partial<RuntimeSession> = {};
    if (body.phase) updates.phase = body.phase;
    if (body.blocked !== undefined) updates.blocked = body.blocked;
    if (body.summary) updates.summary = body.summary;
    else if (kind === "chat" && text) updates.summary = text;

    await recordConversation({
      session,
      role: "agent",
      kind,
      text: text || `Phase ${body.phase}`,
      payload: {
        phase: body.phase,
        blocked: body.blocked,
        summary: body.summary
      },
      sessionUpdates: updates
    });
    return { ok: true };
  });

  // --- mobile session browsing -------------------------------------------

  app.get("/sessions", async (request) => {
    const token = ((request.query as { token?: string }).token ?? "").trim();
    requireMobileToken(token);
    const sessions = await listSessions(paths);
    return { ok: true, sessions };
  });

  app.get("/sessions/:sessionId", async (request) => {
    const token = ((request.query as { token?: string }).token ?? "").trim();
    requireMobileToken(token);
    const { sessionId } = request.params as { sessionId: string };
    const session = await getSession(paths, sessionId);
    if (!session) throw new Error("session not found");
    return { ok: true, session };
  });

  /** Remove a session and its conversation from the runtime. */
  app.delete("/sessions/:sessionId", async (request) => {
    const token = ((request.query as { token?: string }).token ?? "").trim();
    requireMobileToken(token);
    const { sessionId } = request.params as { sessionId: string };
    const removed = await deleteSession(paths, sessionId);
    await deleteConversation(paths, sessionId);
    if (removed) events.broadcast({ kind: "session_removed", sessionId });
    return { ok: true, removed };
  });

  /** Durable conversation transcript for a session (survives restarts). */
  app.get("/sessions/:sessionId/messages", async (request) => {
    const query = request.query as { token?: string; after?: string; limit?: string };
    requireMobileToken((query.token ?? "").trim());
    const { sessionId } = request.params as { sessionId: string };
    const session = await getSession(paths, sessionId);
    if (!session) throw new Error("session not found");
    const messages = await listConversationMessages(paths, sessionId, {
      after: query.after?.trim() || undefined,
      limit: query.limit ? Number(query.limit) : undefined
    });
    return { ok: true, messages };
  });

  // Back-compat: legacy in-memory event list, still used by older clients.
  app.get("/sessions/:sessionId/events", async (request) => {
    const token = ((request.query as { token?: string }).token ?? "").trim();
    requireMobileToken(token);
    const { sessionId } = request.params as { sessionId: string };
    const messages = events.list().filter((message) => message.sessionId === sessionId);
    return { ok: true, messages };
  });

  app.get("/sessions/:sessionId/documents/:name", async (request) => {
    const token = ((request.query as { token?: string }).token ?? "").trim();
    requireMobileToken(token);
    const { sessionId, name } = request.params as { sessionId: string; name: SandtableDocumentName };
    const session = await getSession(paths, sessionId);
    if (!session) throw new Error("session not found");
    return readFeatureDocument(paths, session.feature, name);
  });

  /** Mobile → agent message (chat / answer / confirmation). */
  app.post("/sessions/:sessionId/messages", async (request) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { token?: string; text?: string; target?: string; kind?: "chat" | "answer" | "confirmation" };
    requireMobileToken(body.token);
    const session = await getSession(paths, sessionId);
    if (!session) throw new Error("session not found");
    const text = (body.text ?? "").trim();
    if (!text) throw new Error("text is required");
    const kind = body.kind ?? "chat";
    const type = kind === "answer" ? "question_answer" : kind === "confirmation" ? "confirmation" : "chat_message";
    await appendMobileJournal(
      paths,
      session.feature,
      kind === "chat" ? "Mobile message" : `${kind} ${body.target ?? ""}`.trim(),
      `- 内容: ${text}\n- Target: ${body.target ?? "conversation"}\n`,
      `mobile-app:${sessionId}`
    );
    // Durable conversation + live fan-out for the phone UI.
    await recordConversation({
      session,
      role: "mobile",
      kind,
      text,
      payload: { target: body.target ?? "conversation" },
      sessionUpdates: { summary: text }
    });
    // Mailbox message keeps the agent/worker polling path working.
    const message = createMessage(
      session.feature,
      "mobile",
      type,
      { text, target: body.target ?? "conversation", kind },
      { sessionId: session.id, agent: session.agent }
    );
    await events.publish(message);
    await enqueueInbox(paths, message);
    return { ok: true, message };
  });

  // --- structured SSE stream (session + message envelopes) ----------------

  app.get("/stream", async (request, reply) => {
    const token = ((request.query as { token?: string }).token ?? "").trim();
    requireMobileToken(token);
    // Take full control of the socket so Fastify does not end the response when
    // this handler returns; SSE connections must stay open.
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    reply.raw.write(": connected\n\n");
    const keepAlive = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);
    const unsubscribe = events.onBroadcast((envelope) => {
      reply.raw.write(`event: ${envelope.kind}\ndata: ${JSON.stringify(envelope)}\n\n`);
    });
    reply.raw.on("close", () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  // --- pairing ------------------------------------------------------------

  app.get("/pairing", async (request) => {
    const feature = ((request.query as { feature?: string }).feature ?? "").trim();
    const runtimeSession = feature ? await sessionForFeature(feature) : null;
    const token = nanoid(16);
    pairing.registerTokenSession(feature, token, runtimeSession?.id);
    // QR tokens are durable so a scanned pairing survives a server restart.
    await devices.add(token, "qr");
    const qrPayload = `sandtable://pair?url=${encodeURIComponent(publicUrl)}&token=${encodeURIComponent(token)}&feature=${encodeURIComponent(feature)}&sessionId=${encodeURIComponent(runtimeSession?.id ?? "")}`;
    return { url: publicUrl, token, feature, sessionId: runtimeSession?.id ?? null, qrPayload };
  });

  /**
   * Start a pairing window. `feature` is optional: when omitted the phone pairs
   * to the whole runtime (device-level) and can manage every session. When a
   * feature is supplied it is also seeded as the primary session for legacy
   * single-feature flows.
   */
  app.post("/mobile-sync/start", async (request) => {
    const body = request.body as { feature?: string };
    const feature = (body.feature ?? "").trim();
    const runtimeSession = feature ? await sessionForFeature(feature) : null;
    const token = nanoid(16);
    const pin = pairing.createPinSession(feature, token, runtimeSession?.id);
    const session = {
      active: true,
      feature,
      sessionId: runtimeSession?.id,
      code: pin.code,
      token,
      publicUrl,
      paired: false,
      startedAt: pin.createdAt,
      expiresAt: pin.expiresAt,
      workerHint:
        "Poll GET /mobile-sync/outbox or run scripts/sandtable-mobile-wait.sh; notify main agent on mobile messages."
    };
    await writeMobileSyncSession(paths, session);
    return {
      ok: true,
      code: pin.code,
      feature,
      sessionId: runtimeSession?.id ?? null,
      token,
      publicUrl,
      expiresAt: pin.expiresAt
    };
  });

  app.get("/mobile-sync/status", async () => {
    const session = await readMobileSyncSession(paths);
    const activePin = pairing.activePin();
    const summary = session?.feature ? await readFeatureStateSummary(paths, session.feature) : null;
    return {
      ok: true,
      session,
      pendingCode: activePin?.code ?? null,
      publicUrl,
      steps: {
        server: true,
        phonePaired: session?.paired === true,
        agentSynced: Boolean(session?.agentSyncedAt || summary?.phase)
      },
      agent: {
        main: session?.agentMain ?? null,
        waiter: session?.agentWaiter ?? null
      },
      phase: summary?.phase ?? null,
      feature: session?.feature ?? null
    };
  });

  app.post("/mobile-sync/push-state", async () => {
    const session = await readMobileSyncSession(paths);
    if (!session?.active || !session.feature) throw new Error("mobile sync not active");
    const result = await publishAgentSnapshot(session.feature, session.sessionId);
    return { ok: true, ...result };
  });

  // Report the live runtime state of the main agent / waiting sub-agent so the
  // phone can show "idle / working / waiting / processing / disconnected / error".
  app.post("/mobile-sync/agent-state", async (request) => {
    const body = (request.body ?? {}) as { role?: string; state?: string; detail?: string };
    const role = body.role as AgentRole;
    const state = body.state as AgentRunState;
    const validRoles = ["main", "waiter"];
    const validStates = ["idle", "working", "disconnected", "error", "ready", "waiting", "processing", "exited"];
    if (!validRoles.includes(role)) throw new Error("role must be 'main' or 'waiter'");
    if (!validStates.includes(state)) throw new Error("invalid agent state");
    const session = await readMobileSyncSession(paths);
    if (!session) return { ok: false, reason: "mobile sync not active" };
    const entry: AgentRuntimeState = { role, state, at: new Date().toISOString() };
    if (typeof body.detail === "string" && body.detail.trim()) entry.detail = body.detail.trim();
    await writeMobileSyncSession(paths, {
      ...session,
      ...(role === "main" ? { agentMain: entry } : { agentWaiter: entry })
    });
    events.broadcast({ kind: "agent_state", feature: session.feature, agent: entry });
    return { ok: true, agent: entry };
  });

  app.post("/mobile-sync/stop", async () => {
    const session = await readMobileSyncSession(paths);
    if (session?.feature) {
      await events.publish(createMessage(session.feature, "server", "stop", { reason: "mobile-sync-stop" }, { sessionId: session.sessionId }));
      if (session.sessionId) await touchSession(paths, session.sessionId, { status: "stopped" });
      const at = new Date().toISOString();
      events.broadcast({ kind: "agent_state", feature: session.feature, agent: { role: "main", state: "disconnected", at } });
      events.broadcast({ kind: "agent_state", feature: session.feature, agent: { role: "waiter", state: "exited", at } });
    }
    pairing.clear();
    await clearMobileSyncSession(paths);
    return { ok: true, stopped: true };
  });

  app.post("/pair/by-code", async (request) => {
    const body = request.body as { code?: string };
    const code = (body.code ?? "").trim();
    if (!/^\d{4}$/.test(code)) throw new Error("invalid pairing code");
    const claimed = pairing.claimByCode(code);
    if (!claimed) throw new Error("pairing code expired or already used");

    // Promote the claimed token to a durable device so it survives restarts.
    await devices.add(claimed.token, "mobile");

    const session = await readMobileSyncSession(paths);
    if (session && session.code === code) {
      await writeMobileSyncSession(paths, {
        ...session,
        paired: true,
        pairedAt: claimed.pairedAt ?? new Date().toISOString()
      });
    }

    if (claimed.feature) {
      if (claimed.sessionId) await markSessionPaired(paths, claimed.sessionId);
      await publishMobileInbox(claimed.feature, "mobile_paired", { code, publicUrl, sessionId: claimed.sessionId }, claimed.sessionId);
      await publishAgentSnapshot(claimed.feature, claimed.sessionId);
    }

    return {
      ok: true,
      url: publicUrl,
      token: claimed.token,
      feature: claimed.feature,
      sessionId: claimed.sessionId ?? null,
      sessions: await listSessions(paths)
    };
  });

  // --- legacy mailbox & feature endpoints (worker / MCP compatibility) ----

  app.get("/mailbox/inbox", async (request) => {
    const feature = ((request.query as { feature?: string }).feature ?? "").trim();
    const after = ((request.query as { after?: string }).after ?? "").trim();
    const entries = await readInbox(paths);
    const messages = entries
      .map((entry) => entry.message)
      .filter((message) => message.source === "mobile")
      .filter((message) => !feature || message.feature === feature)
      .filter((message) => !after || message.id > after)
      .sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, messages };
  });

  app.post("/mailbox/inbox/ack", async (request) => {
    const body = request.body as { ids?: string[] };
    const ids = body.ids ?? [];
    const entries = await readInbox(paths);
    const byId = new Map(entries.map((entry) => [entry.message.id, entry.file]));
    let acked = 0;
    for (const id of ids) {
      const file = byId.get(id);
      if (file) {
        await markProcessed(paths, file);
        acked += 1;
      }
    }
    return { ok: true, acked };
  });

  app.get("/mobile-sync/outbox", async (request) => {
    const feature = ((request.query as { feature?: string }).feature ?? "").trim();
    const after = ((request.query as { after?: string }).after ?? "").trim();
    const entries = await readOutbox(paths);
    const filtered = entries
      .map((entry) => entry.message)
      .filter((message) => message.source === "mobile" || message.type === "mobile_paired")
      .filter((message) => !feature || message.feature === feature)
      .filter((message) => !after || message.id > after)
      .sort((a, b) => a.id.localeCompare(b.id));
    return { ok: true, messages: filtered };
  });

  // Legacy global event stream (mailbox messages). Kept for older clients.
  app.get("/events", async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    reply.raw.write(": connected\n\n");
    const unsubscribe = events.onMessage((message) => {
      reply.raw.write(`event: ${message.type}\ndata: ${JSON.stringify(message)}\n\n`);
    });
    reply.raw.on("close", unsubscribe);
  });

  app.get("/features/:feature/documents/:name", async (request) => {
    const { feature, name } = request.params as { feature: string; name: SandtableDocumentName };
    return readFeatureDocument(paths, feature, name);
  });

  app.post("/features/:feature/answers", async (request) => {
    const { feature } = request.params as { feature: string };
    const body = request.body as { token: string; questionId: string; answer: string; messageId: string; resolvesBlocked?: boolean };
    requirePairing(body.token, feature);
    await recordQuestionAnswer(paths, feature, body.questionId, body.answer, `mobile-app:${body.messageId}`);
    if (body.resolvesBlocked) await setBlocked(paths, feature, false);
    await publishMobileInbox(feature, "question_answer", {
      questionId: body.questionId,
      answer: body.answer,
      messageId: body.messageId,
      resolvesBlocked: body.resolvesBlocked ?? true
    });
    return { ok: true };
  });

  app.post("/features/:feature/confirmations", async (request) => {
    const { feature } = request.params as { feature: string };
    const body = request.body as { token: string; target: string; text: string; messageId: string };
    requirePairing(body.token, feature);
    await appendMobileJournal(paths, feature, `${body.target} confirmed`, `- 内容: ${body.text}\n`, `mobile-app:${body.messageId}`);
    await publishMobileInbox(feature, "confirmation", {
      target: body.target,
      text: body.text,
      messageId: body.messageId
    });
    return { ok: true };
  });

  app.post("/features/:feature/sync/phase", async (request) => {
    const { feature } = request.params as { feature: string };
    const body = request.body as { token: string; phase: string; summary?: string };
    requirePairing(body.token, feature);
    const message = createMessage(feature, "agent", "phase_update", {
      phase: body.phase,
      summary: body.summary ?? ""
    });
    await events.publish(message);
    return { ok: true, id: message.id };
  });

  app.post("/features/:feature/sync/document", async (request) => {
    const { feature } = request.params as { feature: string };
    const body = request.body as { token: string; name: SandtableDocumentName; content: string };
    requirePairing(body.token, feature);
    const message = createMessage(feature, "agent", "document_snapshot", {
      name: body.name,
      content: body.content
    });
    await events.publish(message);
    return { ok: true, id: message.id };
  });

  app.post("/stop", async () => {
    await clearMobileSyncSession(paths);
    pairing.clear();
    await stop();
    return { ok: true, stopped: true };
  });

  return app;
}
