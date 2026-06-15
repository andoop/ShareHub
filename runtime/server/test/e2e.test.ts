import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renewContinuation } from "../src/continuation.js";
import { RuntimeEvents } from "../src/events.js";
import { createMessage, enqueueInbox, processInboxOnce, readInbox, readOutbox } from "../src/mailbox.js";
import { recordQuestionAnswer, readFeatureDocument, setBlocked } from "../src/sandtable.js";
import { createTempRepo } from "./helpers.js";

describe("mobile review runtime e2e", () => {
  it("moves from agent message to mobile-visible event and durable mobile answer", async () => {
    const { paths, featureDir } = await createTempRepo();
    const events = new RuntimeEvents();
    await renewContinuation(paths, {
      feature: "feature-a",
      phase: "PLAN",
      mainAgent: "main",
      waitingWorkers: ["cheap-worker-a"],
      workerMode: "mixed"
    });
    await enqueueInbox(paths, createMessage("feature-a", "agent", "phase_update", { phase: "PLAN" }));
    await processInboxOnce(paths, (message) => events.publish(message));
    await recordQuestionAnswer(paths, "feature-a", "Q1", "Yes", "mobile-app:msg-1");
    await setBlocked(paths, "feature-a", false);

    const journal = await readFile(path.join(featureDir, "journal.md"), "utf8");
    const questions = await readFile(path.join(featureDir, "questions.md"), "utf8");
    const state = await readFile(path.join(featureDir, "state.md"), "utf8");
    const document = await readFeatureDocument(paths, "feature-a", "prd");
    const outboxMessages = await readOutbox(paths);

    expect(journal).toContain("mobile-app:");
    expect(journal).toContain("Feature:");
    expect(document.status).toBe("ok");
    expect(await readInbox(paths)).toHaveLength(0);
    expect(events.list("feature-a")).toHaveLength(1);
    expect(outboxMessages[0].message.type).toBe("phase_update");
    expect(questions).toContain("Resolved: true");
    expect(state).toContain("blocked: false");
  });
});
