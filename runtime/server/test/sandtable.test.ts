import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { appendMobileJournal, readFeatureDocument, recordQuestionAnswer, setBlocked } from "../src/sandtable.js";
import { createTempRepo } from "./helpers.js";

describe("sandtable persistence", () => {
  it("appends mobile confirmations to durable journal memory", async () => {
    const { paths } = await createTempRepo();
    await appendMobileJournal(paths, "feature-a", "PRD confirmed", "- 内容: PRD 方向确认\n", "mobile-app:msg-1");
    const journal = await readFeatureDocument(paths, "feature-a", "journal");
    expect(journal.status).toBe("ok");
    expect(journal.status === "ok" ? journal.content : "").toContain("mobile-app:msg-1");
    expect(journal.status === "ok" ? journal.content : "").toContain("Feature: feature-a");
  });

  it("records question answers and unblocks state", async () => {
    const { paths, featureDir } = await createTempRepo();
    await recordQuestionAnswer(paths, "feature-a", "Q1", "Yes", "mobile-app:msg-2");
    await setBlocked(paths, "feature-a", false);
    expect(await readFile(path.join(featureDir, "questions.md"), "utf8")).toContain("Resolved: true");
    expect(await readFile(path.join(featureDir, "state.md"), "utf8")).toContain("blocked: false");
  });

  it("returns missing for documents that do not exist", async () => {
    const { paths } = await createTempRepo();
    const doc = await readFeatureDocument(paths, "feature-a", "plan");
    expect(doc.status).toBe("missing");
  });
});
