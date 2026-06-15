import { appendConversationMessage } from "./conversations.js";
import type { RuntimeEvents } from "./events.js";
import { createMessage, enqueueInbox, enqueueOutbox, readInbox } from "./mailbox.js";
import { ensureFeatureSession, touchSession } from "./sessions.js";
import type { ConversationKind, RuntimePaths } from "./types.js";

export function createMcpHandlers(paths: RuntimePaths, events: RuntimeEvents) {
  return {
    async syncPhase(feature: string, phase: string, summary: string) {
      const message = createMessage(feature, "agent", "phase_update", { phase, summary });
      await events.publish(message);
      await enqueueOutbox(paths, createMessage(feature, "server", "phase_update", message.payload));
      // Mirror into the session conversation so the phone sees a phase banner.
      const session = await ensureFeatureSession(paths, feature);
      await touchSession(paths, session.id, { phase, summary });
      const conversation = await appendConversationMessage(paths, {
        sessionId: session.id,
        feature,
        role: "agent",
        kind: "phase",
        text: summary || `Phase ${phase}`,
        payload: { phase, summary },
        agent: session.agent
      });
      events.broadcast({ kind: "message", message: conversation });
      const refreshed = await ensureFeatureSession(paths, feature);
      events.broadcast({ kind: "session", session: refreshed });
      return enqueueInbox(paths, message);
    },

    async publishDocument(feature: string, name: string, content: string) {
      const message = createMessage(feature, "agent", "document_snapshot", { name, content });
      await events.publish(message);
      await enqueueOutbox(paths, createMessage(feature, "server", "document_snapshot", message.payload));
      const session = await ensureFeatureSession(paths, feature);
      const conversation = await appendConversationMessage(paths, {
        sessionId: session.id,
        feature,
        role: "agent",
        kind: "document",
        text: `Updated ${name}`,
        payload: { name },
        agent: session.agent
      });
      events.broadcast({ kind: "message", message: conversation });
      return enqueueInbox(paths, message);
    },

    /** Post a free-form agent message into a session conversation. */
    async postMessage(feature: string, text: string, kind: ConversationKind = "chat") {
      const session = await ensureFeatureSession(paths, feature);
      await touchSession(paths, session.id, kind === "chat" ? { summary: text } : {});
      const conversation = await appendConversationMessage(paths, {
        sessionId: session.id,
        feature,
        role: "agent",
        kind,
        text,
        agent: session.agent
      });
      events.broadcast({ kind: "message", message: conversation });
      const refreshed = await ensureFeatureSession(paths, feature);
      events.broadcast({ kind: "session", session: refreshed });
      return conversation;
    },

    async readMobileMessages(feature: string) {
      const messages = await readInbox(paths);
      return messages.filter((item) => item.message.feature === feature && item.message.source === "mobile");
    }
  };
}
