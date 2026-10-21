import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Story } from "../trackers/types.js";
import type { TestCaseStore, TestSuite } from "./types.js";

export class MarkdownTestCaseStore implements TestCaseStore {
  // `dir` is relative to where qa runs (the tester's project)
  constructor(private readonly dir: string = "test-cases") {}

  async save(story: Story, suite: TestSuite): Promise<string> {
    const file = path.join(this.dir, `${story.key}.md`);
    const content = toMarkdown(story, suite);

    // Write to a temp file, then rename: a run that fails halfway never
    // leaves a half-written file that looks normal.
    await mkdir(this.dir, { recursive: true });
    const tempFile = `${file}.tmp`;
    await writeFile(tempFile, content, "utf8");
    await rename(tempFile, file);

    return file;
  }
}

function toMarkdown(story: Story, suite: TestSuite): string {
  const lines = [`# ${story.key}: ${story.summary}`, "", "## Acceptance criteria"];
  for (const c of suite.criteria) lines.push(`- ${c.id}: ${c.text}`);
  lines.push("");

  for (const tc of suite.cases) {
    lines.push(`## ${tc.id}: ${tc.title}`);
    lines.push(`- Covers: ${tc.covers.join(", ")}`);
    lines.push(`- Type: ${tc.type}`);
    lines.push(`- Preconditions: ${tc.preconditions}`);
    lines.push("", "Steps:");
    tc.steps.forEach((step, i) => lines.push(`${i + 1}. ${step}`));
    lines.push("", `Expected: ${tc.expected}`, "");
  }

  return lines.join("\n");
}
