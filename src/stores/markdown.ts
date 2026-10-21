import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Story } from "../trackers/types.js";
import type { TestCase, TestCaseStore, TestSuite } from "./types.js";
import { QaError } from "../core/errors.js";

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

export function toMarkdown(story: Story, suite: TestSuite): string {
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

// Reads a test case file back, after a human has reviewed and maybe edited it.
// It accepts the format toMarkdown writes; anything else is a clear error, so a
// broken edit never reaches the tracker half-understood.
export function parseMarkdown(markdown: string): TestSuite {
  const suite: TestSuite = { criteria: [], cases: [] };
  let current: TestCase | undefined;
  let inSteps = false;

  markdown.split(/\r?\n/).forEach((line, i) => {
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^## (TC-\d+): (.*)$/))) {
      current = { id: m[1]!, title: m[2]!, covers: [], type: "positive", preconditions: "", steps: [], expected: "" };
      suite.cases.push(current);
      inSteps = false;
    } else if (!current && (m = line.match(/^- (AC\d+): (.*)$/))) {
      suite.criteria.push({ id: m[1]!, text: m[2]! });
    } else if (current && (m = line.match(/^- Covers: (.*)$/))) {
      current.covers = m[1]!.split(",").map((id) => id.trim()).filter(Boolean);
    } else if (current && (m = line.match(/^- Type: (.*)$/))) {
      const type = m[1]!.trim();
      if (type !== "positive" && type !== "negative" && type !== "edge") {
        throw new QaError(`Test case file, line ${i + 1}: type must be positive, negative or edge, not "${type}".`);
      }
      current.type = type;
    } else if (current && (m = line.match(/^- Preconditions: (.*)$/))) {
      current.preconditions = m[1]!;
    } else if (current && line === "Steps:") {
      inSteps = true;
    } else if (current && inSteps && (m = line.match(/^\d+\. (.*)$/))) {
      current.steps.push(m[1]!);
    } else if (current && (m = line.match(/^Expected: (.*)$/))) {
      current.expected = m[1]!;
      inSteps = false;
    }
  });

  for (const tc of suite.cases) {
    if (tc.steps.length === 0 || !tc.expected) {
      throw new QaError(`Test case file: ${tc.id} needs at least one step and an "Expected:" line.`);
    }
  }
  return suite;
}
