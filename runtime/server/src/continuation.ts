import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimePaths, SandtablePhase } from "./types.js";

export interface ContinuationLease {
  feature: string;
  phase: SandtablePhase;
  active: boolean;
  stopped: boolean;
  mainAgent: string;
  waitingWorkers: string[];
  workerMode: "poll" | "subscribe" | "host-wait" | "mixed";
  renewAfter: string;
  expiresAt: string;
  resumeHint: string;
}

export async function renewContinuation(
  paths: RuntimePaths,
  input: Omit<ContinuationLease, "active" | "stopped" | "renewAfter" | "expiresAt" | "resumeHint">
): Promise<ContinuationLease> {
  const now = Date.now();
  const lease: ContinuationLease = {
    ...input,
    active: true,
    stopped: false,
    renewAfter: new Date(now + 5 * 60_000).toISOString(),
    expiresAt: new Date(now + 15 * 60_000).toISOString(),
    resumeHint: "Read docs/sandtable/features/<feature>/state.md and journal.md, then process mailbox message."
  };
  await writeFile(path.join(paths.session, "continuation.json"), `${JSON.stringify(lease, null, 2)}\n`, "utf8");
  return lease;
}

export async function readContinuation(paths: RuntimePaths): Promise<ContinuationLease | null> {
  try {
    return JSON.parse(await readFile(path.join(paths.session, "continuation.json"), "utf8")) as ContinuationLease;
  } catch {
    return null;
  }
}

export async function stopContinuation(paths: RuntimePaths): Promise<ContinuationLease | null> {
  const lease = await readContinuation(paths);
  if (!lease) return null;
  const stopped = { ...lease, active: false, stopped: true };
  await writeFile(path.join(paths.session, "continuation.json"), `${JSON.stringify(stopped, null, 2)}\n`, "utf8");
  return stopped;
}
