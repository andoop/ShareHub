import { readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type { AgentIdentity, MailboxMessage, MessageSource, MessageType, RuntimePaths } from "./types.js";

export function createMessage<T>(
  feature: string,
  source: MessageSource,
  type: MessageType,
  payload: T,
  options: { sessionId?: string; agent?: AgentIdentity } = {}
): MailboxMessage<T> {
  return {
    id: `${new Date().toISOString().replace(/[-:.]/g, "")}-${source}-${nanoid(8)}`,
    feature,
    sessionId: options.sessionId,
    agent: options.agent,
    source,
    type,
    createdAt: new Date().toISOString(),
    payload
  };
}

export async function enqueueInbox(paths: RuntimePaths, message: MailboxMessage): Promise<string> {
  const target = path.join(paths.inbox, `${message.id}.json`);
  await writeFile(target, `${JSON.stringify(message, null, 2)}\n`, "utf8");
  return target;
}

export async function enqueueOutbox(paths: RuntimePaths, message: MailboxMessage): Promise<string> {
  const target = path.join(paths.outbox, `${message.id}.json`);
  await writeFile(target, `${JSON.stringify(message, null, 2)}\n`, "utf8");
  return target;
}

export async function readMailboxDir(dir: string): Promise<Array<{ file: string; message: MailboxMessage }>> {
  const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  const results: Array<{ file: string; message: MailboxMessage }> = [];
  for (const file of files) {
    const message = JSON.parse(await readFile(path.join(dir, file), "utf8")) as MailboxMessage;
    results.push({ file, message });
  }
  return results;
}

export function readInbox(paths: RuntimePaths): Promise<Array<{ file: string; message: MailboxMessage }>> {
  return readMailboxDir(paths.inbox);
}

export function readOutbox(paths: RuntimePaths): Promise<Array<{ file: string; message: MailboxMessage }>> {
  return readMailboxDir(paths.outbox);
}

export async function markProcessed(paths: RuntimePaths, file: string): Promise<void> {
  await rename(path.join(paths.inbox, file), path.join(paths.processed, file));
}

export async function processInboxOnce(
  paths: RuntimePaths,
  publish: (message: MailboxMessage) => Promise<void>
): Promise<number> {
  const entries = await readInbox(paths);
  for (const entry of entries) {
    await publish(entry.message);
    await enqueueOutbox(
      paths,
      createMessage(entry.message.feature, "server", entry.message.type, entry.message.payload, {
        sessionId: entry.message.sessionId,
        agent: entry.message.agent
      })
    );
    await markProcessed(paths, entry.file);
  }
  return entries.length;
}
