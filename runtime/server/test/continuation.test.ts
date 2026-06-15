import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renewContinuation, stopContinuation } from "../src/continuation.js";
import { createTempRepo } from "./helpers.js";

describe("continuation lease", () => {
  it("keeps the session active until explicit stop", async () => {
    const { paths } = await createTempRepo();
    const lease = await renewContinuation(paths, {
      feature: "feature-a",
      phase: "PLAN",
      mainAgent: "main",
      waitingWorkers: ["cheap-worker-a", "cheap-worker-b"],
      workerMode: "mixed"
    });
    expect(lease.active).toBe(true);
    expect(lease.stopped).toBe(false);
    expect(lease.waitingWorkers).toHaveLength(2);
    await stopContinuation(paths);
    const stored = JSON.parse(await readFile(path.join(paths.session, "continuation.json"), "utf8"));
    expect(stored.active).toBe(false);
    expect(stored.stopped).toBe(true);
  });
});
