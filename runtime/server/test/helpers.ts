import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveRuntimePaths } from "../src/paths.js";

export async function createTempRepo(feature = "feature-a") {
  const repo = await mkdir(path.join(os.tmpdir(), `sandtable-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`), {
    recursive: true
  }).then(() => path.join(os.tmpdir(), `sandtable-runtime-${Date.now()}-${Math.random().toString(16).slice(2)}`));
  const paths = await resolveRuntimePaths(repo);
  const featureDir = path.join(paths.sandtableRoot, "features", feature);
  await mkdir(featureDir, { recursive: true });
  await writeFile(path.join(featureDir, "state.md"), "---\nphase: VERIFY\nblocked: true\nupdated: old\n---\n", "utf8");
  await writeFile(path.join(featureDir, "journal.md"), "# Journal\n", "utf8");
  await writeFile(path.join(featureDir, "questions.md"), "# Questions\n", "utf8");
  await writeFile(path.join(featureDir, "prd.md"), "# PRD\n", "utf8");
  return { repo, paths, feature, featureDir };
}
