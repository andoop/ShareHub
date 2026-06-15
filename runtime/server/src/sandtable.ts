import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimePaths, SandtableDocumentName } from "./types.js";

export async function readFeatureDocument(
  paths: RuntimePaths,
  feature: string,
  name: SandtableDocumentName
): Promise<{ status: "ok"; name: SandtableDocumentName; content: string } | { status: "missing"; name: SandtableDocumentName }> {
  try {
    const content = await readFile(path.join(paths.sandtableRoot, "features", feature, `${name}.md`), "utf8");
    return { status: "ok", name, content };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { status: "missing", name };
    throw error;
  }
}

export async function appendMobileJournal(
  paths: RuntimePaths,
  feature: string,
  title: string,
  body: string,
  source: string
): Promise<void> {
  const target = path.join(paths.sandtableRoot, "features", feature, "journal.md");
  const receivedAt = new Date().toISOString();
  const entry = `\n## ${receivedAt} · [问答]\n- 背景: 手机端提交开发者确认。\n- Feature: ${feature}\n- 内容: ${title}\n${body}\n- 来源: ${source}\n`;
  await appendFile(target, entry, "utf8");
}

export async function recordQuestionAnswer(
  paths: RuntimePaths,
  feature: string,
  questionId: string,
  answer: string,
  source: string
): Promise<void> {
  await appendMobileJournal(paths, feature, `Question ${questionId} answered`, `- Answer: ${answer}\n- Resolved: true\n`, source);
  const questionsPath = path.join(paths.sandtableRoot, "features", feature, "questions.md");
  await appendFile(
    questionsPath,
    `\n## ${questionId} · mobile answer\n- Answer: ${answer}\n- Source: ${source}\n- Resolved: true\n`,
    "utf8"
  );
}

export async function setBlocked(paths: RuntimePaths, feature: string, blocked: boolean): Promise<void> {
  const statePath = path.join(paths.sandtableRoot, "features", feature, "state.md");
  const current = await readFile(statePath, "utf8");
  const next = current
    .replace(/^blocked: .*/m, `blocked: ${blocked}`)
    .replace(/^updated: .*/m, `updated: ${new Date().toISOString()}`);
  await writeFile(statePath, next, "utf8");
}

export interface FeatureStateSummary {
  phase: string;
  blocked: boolean;
}

export async function readFeatureStateSummary(
  paths: RuntimePaths,
  feature: string
): Promise<FeatureStateSummary | null> {
  const doc = await readFeatureDocument(paths, feature, "state");
  if (doc.status === "missing") return null;
  const end = doc.content.indexOf("---", 3);
  if (!doc.content.startsWith("---") || end < 0) return null;
  const frontmatter = doc.content.slice(3, end);
  let phase: string | undefined;
  let blocked = false;
  for (const rawLine of frontmatter.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("phase:")) phase = line.slice(6).trim();
    if (line.startsWith("blocked:")) blocked = line.slice(8).trim().toLowerCase() === "true";
  }
  if (!phase) return null;
  return { phase, blocked };
}
