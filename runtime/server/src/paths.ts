import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { RuntimePaths } from "./types.js";

export async function resolveRuntimePaths(repoRoot: string): Promise<RuntimePaths> {
  const resolvedRoot = path.resolve(repoRoot);
  const runtimeRoot = path.join(resolvedRoot, ".sandtable-runtime");
  const inbox = path.join(runtimeRoot, "mailbox", "inbox");
  const processed = path.join(runtimeRoot, "mailbox", "processed");
  const outbox = path.join(runtimeRoot, "mailbox", "outbox");
  const cursors = path.join(runtimeRoot, "mailbox", "cursors");
  const session = path.join(runtimeRoot, "session");
  const conversations = path.join(runtimeRoot, "conversations");
  await Promise.all(
    [inbox, processed, outbox, cursors, session, conversations].map((dir) => mkdir(dir, { recursive: true }))
  );
  return {
    repoRoot: resolvedRoot,
    sandtableRoot: path.join(resolvedRoot, "docs", "sandtable"),
    runtimeRoot,
    inbox,
    processed,
    outbox,
    cursors,
    session,
    conversations
  };
}
