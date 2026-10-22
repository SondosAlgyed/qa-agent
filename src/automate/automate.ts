import type { LLMProvider } from "../llm/types.js";
import { QaError } from "../core/errors.js";
import { parseMarkdown } from "../stores/markdown.js";
import { runAgent } from "./agent.js";
import { buildTask, SYSTEM_PROMPT } from "./prompt.js";
import { TargetRepo } from "./repo.js";

export interface AutomateResult {
  file: string;
  finished: boolean; // the agent stopped by itself (not at the turn limit)
  passedRuns: number; // our own check: how many of 3 runs passed
  report: string; // the agent's last words
  trace: string[];
}

// Turns one reviewed test case into a Playwright test in the target repo.
// The agent writes and fixes the test; we don't trust its word that it passes,
// so our code runs it 3 more times at the end.
export async function automateTestCase(options: {
  llm: LLMProvider;
  repoDir: string;
  appUrl: string;
  key: string;
  caseId: string;
  maxTurns: number;
}): Promise<AutomateResult> {
  const { llm, repoDir, appUrl, key, caseId, maxTurns } = options;
  const repo = new TargetRepo(repoDir);

  let markdown: string;
  try {
    markdown = await repo.readFile(`test-cases/${key}.md`);
  } catch {
    throw new QaError(`No test-cases/${key}.md in ${repo.root}. Run "qa cases ${key}" first, then review it.`);
  }
  const tc = parseMarkdown(markdown).cases.find((c) => c.id === caseId);
  if (!tc) {
    throw new QaError(`${caseId} not found in test-cases/${key}.md.`);
  }

  const file = `tests/${key}-${caseId}.spec.ts`;
  const agent = await runAgent({
    llm,
    repo,
    appUrl,
    system: SYSTEM_PROMPT,
    task: buildTask(key, tc, file, appUrl),
    maxTurns,
  });

  let passedRuns = 0;
  for (let i = 0; i < 3; i++) {
    const run = await repo.runTest(file).catch(() => ({ passed: false }));
    if (run.passed) passedRuns++;
  }
  return { file, finished: agent.finished, passedRuns, report: agent.text, trace: agent.trace };
}
