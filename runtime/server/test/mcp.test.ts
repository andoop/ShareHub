import { describe, expect, it } from "vitest";
import { RuntimeEvents } from "../src/events.js";
import { createMcpHandlers } from "../src/mcp.js";
import { createMessage, enqueueInbox, readOutbox } from "../src/mailbox.js";
import { createTempRepo } from "./helpers.js";

describe("mcp handlers", () => {
  it("publishes phase and document messages to events and outbox", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const handlers = createMcpHandlers(paths, events);
    await handlers.syncPhase("feature-a", "PLAN", "Ready");
    await handlers.publishDocument("feature-a", "prd", "# PRD");
    expect(events.list("feature-a")).toHaveLength(2);
    expect(await readOutbox(paths)).toHaveLength(2);
  });

  it("reads mobile inbox messages by feature", async () => {
    const { paths } = await createTempRepo();
    const handlers = createMcpHandlers(paths, new RuntimeEvents());
    await enqueueInbox(paths, createMessage("feature-a", "mobile", "confirmation", { target: "prd" }));
    await enqueueInbox(paths, createMessage("feature-b", "mobile", "confirmation", { target: "prd" }));
    expect(await handlers.readMobileMessages("feature-a")).toHaveLength(1);
  });
});
