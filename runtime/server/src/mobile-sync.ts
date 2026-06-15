import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentRuntimeState, RuntimePaths } from "./types.js";

export interface MobileSyncSession {
  active: boolean;
  feature: string;
  sessionId?: string;
  code: string;
  token: string;
  publicUrl: string;
  paired: boolean;
  pairedAt?: string;
  agentSyncedAt?: string;
  startedAt: string;
  expiresAt: string;
  workerHint: string;
  /** Latest runtime state of the main agent and the waiting sub-agent. */
  agentMain?: AgentRuntimeState;
  agentWaiter?: AgentRuntimeState;
}

export function mobileSyncPath(paths: RuntimePaths): string {
  return path.join(paths.session, "mobile-sync.json");
}

export async function readMobileSyncSession(paths: RuntimePaths): Promise<MobileSyncSession | null> {
  try {
    return JSON.parse(await readFile(mobileSyncPath(paths), "utf8")) as MobileSyncSession;
  } catch {
    return null;
  }
}

export async function writeMobileSyncSession(paths: RuntimePaths, session: MobileSyncSession): Promise<void> {
  await writeFile(mobileSyncPath(paths), `${JSON.stringify(session, null, 2)}\n`, "utf8");
}

export async function clearMobileSyncSession(paths: RuntimePaths): Promise<void> {
  const session = await readMobileSyncSession(paths);
  if (!session) return;
  await writeMobileSyncSession(paths, { ...session, active: false, paired: false });
}
