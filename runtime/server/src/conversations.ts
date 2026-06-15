import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  AgentIdentity,
  ConversationKind,
  ConversationMessage,
  ConversationRole,
  RuntimePaths
} from "./types.js";

interface ConversationFile {
  version: 1;
  sessionId: string;
  messages: ConversationMessage[];
}

/**
 * Durable per-session conversation transcript. Each session owns one JSON file
 * under `.sandtable-runtime/conversations/<sessionId>.json`, so the mobile chat
 * history survives server restarts. Feature documents remain the source of
 * truth for durable Sandtable decisions; this store is the chat surface.
 */

function safeFileName(sessionId: string): string {
  return `${sessionId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

function conversationPath(paths: RuntimePaths, sessionId: string): string {
  return path.join(paths.conversations, safeFileName(sessionId));
}

async function readFileStore(paths: RuntimePaths, sessionId: string): Promise<ConversationFile> {
  try {
    const parsed = JSON.parse(await readFile(conversationPath(paths, sessionId), "utf8")) as ConversationFile;
    return { version: 1, sessionId, messages: parsed.messages ?? [] };
  } catch {
    return { version: 1, sessionId, messages: [] };
  }
}

async function writeFileStore(paths: RuntimePaths, store: ConversationFile): Promise<void> {
  await writeFile(
    conversationPath(paths, store.sessionId),
    `${JSON.stringify({ version: 1, sessionId: store.sessionId, messages: store.messages }, null, 2)}\n`,
    "utf8"
  );
}

export interface AppendMessageInput {
  sessionId: string;
  feature: string;
  role: ConversationRole;
  kind: ConversationKind;
  text: string;
  payload?: Record<string, unknown>;
  agent?: AgentIdentity;
}

export async function appendConversationMessage(
  paths: RuntimePaths,
  input: AppendMessageInput
): Promise<ConversationMessage> {
  const store = await readFileStore(paths, input.sessionId);
  const message: ConversationMessage = {
    id: `msg_${new Date().toISOString().replace(/[-:.]/g, "")}_${nanoid(8)}`,
    sessionId: input.sessionId,
    feature: input.feature,
    role: input.role,
    kind: input.kind,
    text: input.text,
    payload: input.payload,
    agent: input.agent,
    createdAt: new Date().toISOString()
  };
  store.messages.push(message);
  await writeFileStore(paths, store);
  return message;
}

export async function listConversationMessages(
  paths: RuntimePaths,
  sessionId: string,
  options: { after?: string; limit?: number } = {}
): Promise<ConversationMessage[]> {
  const store = await readFileStore(paths, sessionId);
  let messages = store.messages;
  if (options.after) {
    const index = messages.findIndex((message) => message.id === options.after);
    messages = index >= 0 ? messages.slice(index + 1) : messages;
  }
  if (options.limit && messages.length > options.limit) {
    messages = messages.slice(messages.length - options.limit);
  }
  return messages;
}

/** Delete a session's transcript file. Missing files are ignored. */
export async function deleteConversation(paths: RuntimePaths, sessionId: string): Promise<void> {
  try {
    await rm(conversationPath(paths, sessionId), { force: true });
  } catch {
    // best-effort
  }
}
