import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { readFeatureStateSummary } from "./sandtable.js";
import type { RuntimePaths, RuntimeSession, RuntimeSessionInput, RuntimeSessionStatus } from "./types.js";

interface SessionStoreFile {
  version: 1;
  sessions: RuntimeSession[];
}

function sessionsPath(paths: RuntimePaths): string {
  return path.join(paths.session, "sessions.json");
}

function normalizeStatus(blocked: boolean, phase?: string): RuntimeSessionStatus {
  if (blocked) return "blocked";
  if (phase === "DONE") return "done";
  return "active";
}

function defaultAgent(input: RuntimeSessionInput): RuntimeSession["agent"] {
  const agent = input.agent ?? {};
  const kind = agent.kind ?? "custom";
  const name = agent.name ?? kind;
  return {
    id: agent.id ?? `${kind}-${nanoid(8)}`,
    kind,
    name
  };
}

async function readStore(paths: RuntimePaths): Promise<SessionStoreFile> {
  try {
    const parsed = JSON.parse(await readFile(sessionsPath(paths), "utf8")) as SessionStoreFile;
    return { version: 1, sessions: parsed.sessions ?? [] };
  } catch {
    return { version: 1, sessions: [] };
  }
}

async function writeStore(paths: RuntimePaths, store: SessionStoreFile): Promise<void> {
  const ordered = [...store.sessions].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  await writeFile(sessionsPath(paths), `${JSON.stringify({ version: 1, sessions: ordered }, null, 2)}\n`, "utf8");
}

export async function listSessions(paths: RuntimePaths): Promise<RuntimeSession[]> {
  return (await readStore(paths)).sessions;
}

export async function getSession(paths: RuntimePaths, sessionId: string): Promise<RuntimeSession | null> {
  return (await readStore(paths)).sessions.find((session) => session.id === sessionId) ?? null;
}

export async function upsertSession(paths: RuntimePaths, input: RuntimeSessionInput): Promise<RuntimeSession> {
  const store = await readStore(paths);
  const now = new Date().toISOString();
  const existing = input.id
    ? store.sessions.find((session) => session.id === input.id)
    : store.sessions.find(
        (session) =>
          session.feature === input.feature &&
          session.workspace === (input.workspace ?? "") &&
          session.agent.id === input.agent?.id
      );

  if (existing) {
    existing.title = input.title ?? existing.title;
    existing.feature = input.feature;
    existing.workspace = input.workspace ?? existing.workspace;
    existing.agent = { ...existing.agent, ...input.agent };
    existing.phase = input.phase ?? existing.phase;
    existing.blocked = input.blocked ?? existing.blocked;
    existing.status = normalizeStatus(existing.blocked, existing.phase);
    existing.summary = input.summary ?? existing.summary;
    existing.updatedAt = now;
    existing.lastActivityAt = now;
    await writeStore(paths, store);
    return existing;
  }

  const agent = defaultAgent(input);
  const session: RuntimeSession = {
    id: input.id ?? `sess_${nanoid(12)}`,
    title: input.title ?? input.feature,
    feature: input.feature,
    workspace: input.workspace ?? "",
    agent,
    status: normalizeStatus(input.blocked ?? false, input.phase),
    phase: input.phase,
    blocked: input.blocked ?? false,
    paired: false,
    createdAt: now,
    updatedAt: now,
    lastActivityAt: now,
    summary: input.summary
  };
  store.sessions.push(session);
  await writeStore(paths, store);
  return session;
}

export async function markSessionPaired(paths: RuntimePaths, sessionId: string): Promise<RuntimeSession | null> {
  const store = await readStore(paths);
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) return null;
  const now = new Date().toISOString();
  session.paired = true;
  session.updatedAt = now;
  session.lastActivityAt = now;
  await writeStore(paths, store);
  return session;
}

/** Remove a session from the store. Returns true if it existed. */
export async function deleteSession(paths: RuntimePaths, sessionId: string): Promise<boolean> {
  const store = await readStore(paths);
  const next = store.sessions.filter((session) => session.id !== sessionId);
  if (next.length === store.sessions.length) return false;
  await writeStore(paths, { version: 1, sessions: next });
  return true;
}

export async function touchSession(paths: RuntimePaths, sessionId: string, updates: Partial<RuntimeSession> = {}): Promise<void> {
  const store = await readStore(paths);
  const session = store.sessions.find((item) => item.id === sessionId);
  if (!session) return;
  const now = new Date().toISOString();
  Object.assign(session, updates);
  session.updatedAt = now;
  session.lastActivityAt = now;
  if (updates.blocked !== undefined || updates.phase !== undefined) {
    session.status = normalizeStatus(session.blocked, session.phase);
  }
  await writeStore(paths, store);
}

/**
 * Find the first session bound to a feature, creating one seeded from the
 * feature's `state.md` when none exists. Shared by the HTTP and MCP layers so
 * agents that only know their feature id can still address a session.
 */
export async function ensureFeatureSession(paths: RuntimePaths, feature: string): Promise<RuntimeSession> {
  const existing = (await listSessions(paths)).find((session) => session.feature === feature);
  if (existing) return existing;
  const summary = await readFeatureStateSummary(paths, feature);
  return upsertSession(paths, {
    feature,
    title: feature,
    workspace: paths.repoRoot,
    phase: summary?.phase,
    blocked: summary?.blocked ?? false,
    agent: { kind: "custom", name: "Sandtable agent" }
  });
}
