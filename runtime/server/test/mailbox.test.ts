import { describe, expect, it } from "vitest";
import { RuntimeEvents } from "../src/events.js";
import { createMessage, enqueueInbox, processInboxOnce, readInbox, readOutbox } from "../src/mailbox.js";
import { readCursor, toMainAgentNotification, unseenMessages, writeCursor } from "../src/polling.js";
import { createTempRepo } from "./helpers.js";

describe("mailbox", () => {
  it("bridges a generic agent message to events and outbox without MCP", async () => {
    const { paths } = await createTempRepo();
    const events = new RuntimeEvents();
    const message = createMessage("feature-a", "agent", "phase_update", { phase: "PLAN" });
    await enqueueInbox(paths, message);
    await processInboxOnce(paths, (event) => events.publish(event));
    expect(await readInbox(paths)).toHaveLength(0);
    expect(events.list("feature-a")[0].payload).toEqual({ phase: "PLAN" });
    expect((await readOutbox(paths))[0].message.type).toBe("phase_update");
  });

  it("creates polling notifications with cursor and resume context", async () => {
    const { paths } = await createTempRepo();
    const cursor = await readCursor(paths, "cheap-worker");
    expect(cursor.stopped).toBe(false);
    await writeCursor(paths, { ...cursor, lastSeenMessageId: "msg-1" });
    const messages = [
      createMessage("feature-a", "mobile", "confirmation", { target: "prd" }),
      createMessage("feature-a", "mobile", "stop", {})
    ];
    expect(unseenMessages(messages, { ...cursor, lastSeenMessageId: messages[0].id })).toHaveLength(1);
    const notification = toMainAgentNotification(messages[0], "review-worker");
    expect(notification).toContain("resumeHint");
    expect(notification).toContain("review-worker");
  });
});
