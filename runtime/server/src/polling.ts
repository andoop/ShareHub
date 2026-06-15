import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MailboxMessage, RuntimePaths } from "./types.js";

export interface PollingCursor {
  workerId: string;
  lastSeenMessageId: string | null;
  stopped: boolean;
  heartbeatAt: string;
}

export async function readCursor(paths: RuntimePaths, workerId: string): Promise<PollingCursor> {
  try {
    return JSON.parse(await readFile(path.join(paths.cursors, `${workerId}.json`), "utf8")) as PollingCursor;
  } catch {
    return { workerId, lastSeenMessageId: null, stopped: false, heartbeatAt: new Date().toISOString() };
  }
}

export async function writeCursor(paths: RuntimePaths, cursor: PollingCursor): Promise<void> {
  await writeFile(
    path.join(paths.cursors, `${cursor.workerId}.json`),
    `${JSON.stringify({ ...cursor, heartbeatAt: new Date().toISOString() }, null, 2)}\n`,
    "utf8"
  );
}

export function unseenMessages(messages: MailboxMessage[], cursor: PollingCursor): MailboxMessage[] {
  if (!cursor.lastSeenMessageId) return messages;
  const index = messages.findIndex((message) => message.id === cursor.lastSeenMessageId);
  return index >= 0 ? messages.slice(index + 1) : messages;
}

export function toMainAgentNotification(message: MailboxMessage, responsibleWorker = "main"): string {
  return JSON.stringify({
    feature: message.feature,
    messageId: message.id,
    type: message.type,
    source: message.source,
    responsibleWorker,
    resumeHint: "Read docs/sandtable/features/<feature>/state.md and journal.md, then process mailbox message."
  });
}
