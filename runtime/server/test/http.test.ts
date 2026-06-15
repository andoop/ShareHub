import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RuntimeEvents } from "../src/events.js";
import { createHttpServer } from "../src/http.js";
import { createMessage } from "../src/mailbox.js";
import { createTempRepo } from "./helpers.js";

describe("http server", () => {
  it("pairs, validates token, writes confirmations, and stops", async () => {
    const { paths, featureDir } = await createTempRepo();
    let stopped = false;
    const app = await createHttpServer(paths, new RuntimeEvents(), async () => {
      stopped = true;
    }, "http://127.0.0.1:8765");

    const pairing = await app.inject({ method: "GET", url: "/pairing?feature=feature-a" });
    const paired = pairing.json() as { token: string; qrPayload: string };
    expect(paired.qrPayload).toContain("sandtable://pair");

    const rejected = await app.inject({
      method: "POST",
      url: "/features/feature-a/confirmations",
      payload: { token: "bad", target: "prd", text: "ok", messageId: "msg-1" }
    });
    expect(rejected.statusCode).toBeGreaterThanOrEqual(400);

    const accepted = await app.inject({
      method: "POST",
      url: "/features/feature-a/confirmations",
      payload: { token: paired.token, target: "prd", text: "ok", messageId: "msg-1" }
    });
    expect(accepted.statusCode).toBe(200);
    expect(await readFile(path.join(featureDir, "journal.md"), "utf8")).toContain("mobile-app:msg-1");

    const answer = await app.inject({
      method: "POST",
      url: "/features/feature-a/answers",
      payload: { token: paired.token, questionId: "Q1", answer: "Yes", messageId: "msg-2", resolvesBlocked: true }
    });
    expect(answer.statusCode).toBe(200);
    expect(await readFile(path.join(featureDir, "questions.md"), "utf8")).toContain("Resolved: true");
    expect(await readFile(path.join(featureDir, "state.md"), "utf8")).toContain("blocked: false");

    const stop = await app.inject({ method: "POST", url: "/stop" });
    expect(stop.statusCode).toBe(200);
    expect(stopped).toBe(true);
  });

  it("pairs by 4-digit code and updates mobile sync session", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {}, "http://127.0.0.1:8765");

    const start = await app.inject({
      method: "POST",
      url: "/mobile-sync/start",
      payload: { feature: "feature-a" }
    });
    expect(start.statusCode).toBe(200);
    const { code, token } = start.json() as { code: string; token: string };
    expect(code).toMatch(/^\d{4}$/);

    const claim = await app.inject({
      method: "POST",
      url: "/pair/by-code",
      payload: { code }
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.json()).toMatchObject({ token, feature: "feature-a" });
    expect((claim.json() as { sessionId: string }).sessionId).toMatch(/^sess_/);
    expect(events.list("feature-a").some((item) => item.type === "mobile_paired")).toBe(true);

    const inbox = await app.inject({ method: "GET", url: "/mailbox/inbox?feature=feature-a" });
    expect((inbox.json() as { messages: unknown[] }).messages.length).toBeGreaterThan(0);

    const status = await app.inject({ method: "GET", url: "/mobile-sync/status" });
    expect((status.json() as { session: { paired: boolean }; steps: { phonePaired: boolean } }).session.paired).toBe(true);
    expect((status.json() as { steps: { agentSynced: boolean } }).steps.agentSynced).toBe(true);
  });

  it("manages multiple agent sessions from one paired mobile client", async () => {
    const { paths } = await createTempRepo();
    const featureB = path.join(paths.sandtableRoot, "features", "feature-b");
    await mkdir(featureB, { recursive: true });
    await writeFile(path.join(featureB, "state.md"), "---\nphase: TESTCASES\nblocked: false\nupdated: old\n---\n", "utf8");
    await writeFile(path.join(featureB, "journal.md"), "# Journal\n", "utf8");
    await writeFile(path.join(featureB, "questions.md"), "# Questions\n", "utf8");
    await writeFile(path.join(featureB, "prd.md"), "# PRD\n", "utf8");
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {}, "http://127.0.0.1:8765");

    const codex = await app.inject({
      method: "POST",
      url: "/agent/sessions",
      payload: {
        feature: "feature-a",
        title: "Codex plan",
        agent: { id: "codex-local", kind: "codex", name: "Codex" },
        phase: "PLAN"
      }
    });
    const cursor = await app.inject({
      method: "POST",
      url: "/agent/sessions",
      payload: {
        feature: "feature-b",
        title: "Cursor tests",
        agent: { id: "cursor-local", kind: "cursor", name: "Cursor" },
        phase: "TESTCASES"
      }
    });
    expect(codex.statusCode).toBe(200);
    expect(cursor.statusCode).toBe(200);

    const start = await app.inject({
      method: "POST",
      url: "/mobile-sync/start",
      payload: { feature: "feature-a" }
    });
    const { code } = start.json() as { code: string };
    const claim = await app.inject({ method: "POST", url: "/pair/by-code", payload: { code } });
    const token = (claim.json() as { token: string }).token;

    const list = await app.inject({ method: "GET", url: `/sessions?token=${token}` });
    expect(list.statusCode).toBe(200);
    const sessions = (list.json() as { sessions: Array<{ id: string; agent: { kind: string } }> }).sessions;
    expect(sessions.map((session) => session.agent.kind).sort()).toEqual(["codex", "cursor"]);

    const cursorSession = sessions.find((session) => session.agent.kind === "cursor")!;
    const message = await app.inject({
      method: "POST",
      url: `/sessions/${cursorSession.id}/messages`,
      payload: { token, text: "请继续补测试", kind: "chat" }
    });
    expect(message.statusCode).toBe(200);
    expect(events.list().some((item) => item.sessionId === cursorSession.id && item.type === "chat_message")).toBe(true);
  });

  it("publishes sync events for paired mobile clients", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {}, "http://127.0.0.1:8765");
    const pairing = await app.inject({ method: "GET", url: "/pairing?feature=feature-a" });
    const { token } = pairing.json() as { token: string };

    const phase = await app.inject({
      method: "POST",
      url: "/features/feature-a/sync/phase",
      payload: { token, phase: "PLAN", summary: "from test" }
    });
    expect(phase.statusCode).toBe(200);
    expect(events.list("feature-a")).toHaveLength(1);

    const document = await app.inject({
      method: "POST",
      url: "/features/feature-a/sync/document",
      payload: { token, name: "prd", content: "hello" }
    });
    expect(document.statusCode).toBe(200);
    expect(events.list("feature-a")).toHaveLength(2);
  });

  it("reads missing documents and stores event history", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const app = await createHttpServer(paths, events, async () => {});
    const missing = await app.inject({ method: "GET", url: "/features/feature-a/documents/plan" });
    expect(missing.json()).toMatchObject({ status: "missing", name: "plan" });
    await events.publish(createMessage("feature-a", "agent", "phase_update", { phase: "PLAN" }));
    expect(events.list("feature-a")).toHaveLength(1);
  });
});
