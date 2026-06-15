import { describe, expect, it } from "vitest";
import { RuntimeEvents } from "../src/events.js";
import { createHttpServer } from "../src/http.js";
import { createMcpHandlers } from "../src/mcp.js";
import { createTempRepo } from "./helpers.js";

async function pairDevice(app: Awaited<ReturnType<typeof createHttpServer>>, feature?: string): Promise<string> {
  const start = await app.inject({
    method: "POST",
    url: "/mobile-sync/start",
    payload: feature ? { feature } : {}
  });
  const { code } = start.json() as { code: string };
  const claim = await app.inject({ method: "POST", url: "/pair/by-code", payload: { code } });
  return (claim.json() as { token: string }).token;
}

describe("conversation layer", () => {
  it("pairs at device level without a feature and lists all sessions", async () => {
    const { paths } = await createTempRepo();
    const app = await createHttpServer(paths, new RuntimeEvents(), async () => {});

    await app.inject({
      method: "POST",
      url: "/agent/sessions",
      payload: { feature: "feature-a", agent: { id: "codex-1", kind: "codex", name: "Codex" }, phase: "PLAN" }
    });

    const token = await pairDevice(app);
    expect(token).toBeTruthy();

    const list = await app.inject({ method: "GET", url: `/sessions?token=${token}` });
    expect(list.statusCode).toBe(200);
    expect((list.json() as { sessions: unknown[] }).sessions.length).toBe(1);
  });

  it("persists a two-way conversation and exposes durable history", async () => {
    const { paths } = await createTempRepo();
    const app = await createHttpServer(paths, new RuntimeEvents(), async () => {});

    const register = await app.inject({
      method: "POST",
      url: "/agent/sessions",
      payload: { feature: "feature-a", agent: { id: "cursor-1", kind: "cursor", name: "Cursor" }, phase: "PLAN" }
    });
    const sessionId = (register.json() as { session: { id: string } }).session.id;
    const token = await pairDevice(app);

    const mobile = await app.inject({
      method: "POST",
      url: `/sessions/${sessionId}/messages`,
      payload: { token, text: "继续推进 PLAN", kind: "chat" }
    });
    expect(mobile.statusCode).toBe(200);

    const agentReply = await app.inject({
      method: "POST",
      url: `/agent/sessions/${sessionId}/messages`,
      payload: { kind: "chat", text: "收到，正在更新计划" }
    });
    expect(agentReply.statusCode).toBe(200);

    const history = await app.inject({ method: "GET", url: `/sessions/${sessionId}/messages?token=${token}` });
    const messages = (history.json() as { messages: Array<{ role: string; text: string }> }).messages;
    expect(messages.map((m) => m.role)).toEqual(["mobile", "agent"]);
    expect(messages[1].text).toContain("更新计划");
  });

  it("streams session and message envelopes over /stream", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {});
    const register = await app.inject({
      method: "POST",
      url: "/agent/sessions",
      payload: { feature: "feature-a", agent: { id: "codex-2", kind: "codex", name: "Codex" } }
    });
    const sessionId = (register.json() as { session: { id: string } }).session.id;
    const token = await pairDevice(app);

    const received: string[] = [];
    const unsubscribe = events.onBroadcast((envelope) => received.push(envelope.kind));

    await app.inject({
      method: "POST",
      url: `/agent/sessions/${sessionId}/messages`,
      payload: { kind: "chat", text: "hi from agent" }
    });
    unsubscribe();
    expect(received).toContain("message");
    expect(received).toContain("session");

    // /stream requires a valid token.
    const denied = await app.inject({ method: "GET", url: "/stream?token=bad" });
    expect(denied.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("mirrors MCP phase + message updates into the conversation", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {});
    const mcp = createMcpHandlers(paths, events);
    const token = await pairDevice(app);

    await mcp.syncPhase("feature-a", "MENTAL_REHEARSAL", "Rehearsing happy path");
    await mcp.postMessage("feature-a", "需要你确认登录流程");

    const list = await app.inject({ method: "GET", url: `/sessions?token=${token}` });
    const sessions = (list.json() as { sessions: Array<{ id: string; feature: string }> }).sessions;
    const session = sessions.find((s) => s.feature === "feature-a")!;
    expect(session).toBeTruthy();

    const history = await app.inject({ method: "GET", url: `/sessions/${session.id}/messages?token=${token}` });
    const kinds = (history.json() as { messages: Array<{ kind: string }> }).messages.map((m) => m.kind);
    expect(kinds).toContain("phase");
    expect(kinds).toContain("chat");
  });

  it("deletes a session and broadcasts its removal", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {});
    const register = await app.inject({
      method: "POST",
      url: "/agent/sessions",
      payload: { feature: "feature-a", agent: { id: "codex-9", kind: "codex", name: "Codex" } }
    });
    const sessionId = (register.json() as { session: { id: string } }).session.id;
    const token = await pairDevice(app);

    const removedKinds: string[] = [];
    const unsubscribe = events.onBroadcast((envelope) => removedKinds.push(envelope.kind));

    const del = await app.inject({ method: "DELETE", url: `/sessions/${sessionId}?token=${token}` });
    unsubscribe();
    expect(del.statusCode).toBe(200);
    expect((del.json() as { removed: boolean }).removed).toBe(true);
    expect(removedKinds).toContain("session_removed");

    const list = await app.inject({ method: "GET", url: `/sessions?token=${token}` });
    const ids = (list.json() as { sessions: Array<{ id: string }> }).sessions.map((s) => s.id);
    expect(ids).not.toContain(sessionId);
  });
});