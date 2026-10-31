import { readFile } from "node:fs/promises";
import { QaError } from "../core/errors.js";
import { TargetRepo } from "../automate/repo.js";
import type { RunResult, TestOutcome } from "../runners/types.js";

// Everything the model gets for one failure. Gathered by plain code; the model only judges.
export interface Evidence {
  test: TestOutcome;
  code: string; // the test's code around the failing line, numbered, failing line marked ">"
  hint: string; // what kind of error it looks like, from the text alone (a hint, not a verdict)
}

// Reads a file saved with `qa run --json > run.json`
export async function loadRun(file: string): Promise<RunResult> {
  let run: RunResult;
  try {
    run = JSON.parse(await readFile(file, "utf8"));
  } catch {
    throw new QaError(`Can't read ${file}. Save a run first: qa run --regression --json > ${file}`);
  }
  if (!Array.isArray(run.tests)) {
    throw new QaError(`${file} isn't a qa run result (no "tests" list).`);
  }
  return run;
}

// One Evidence per failed or flaky test. Files are read through TargetRepo, so a
// path in run.json can't reach outside the project or its secrets.
export async function gatherEvidence(run: RunResult, repo: TargetRepo): Promise<Evidence[]> {
  const evidence: Evidence[] = [];
  for (const test of run.tests.filter((t) => t.status === "failed" || t.status === "flaky")) {
    const at = test.errorAt ?? { file: test.file, line: test.line };
    let code: string;
    try {
      code = codeAround(await repo.readFile(at.file), at.line);
    } catch (error) {
      code = `(code not available: ${(error as Error).message})`;
    }
    evidence.push({ test, code, hint: errorHint(test.fullError ?? test.error ?? "") });
  }
  return evidence;
}

// Lines around the failing line, e.g. "> 12 | expect(total).toBe(3);"
export function codeAround(source: string, line: number, context = 15): string {
  const lines = source.split(/\r?\n/);
  const from = Math.max(line - context, 1);
  const to = Math.min(line + context, lines.length);
  const width = String(to).length;
  const out: string[] = [];
  for (let n = from; n <= to; n++) {
    out.push(`${n === line ? ">" : " "} ${String(n).padStart(width)} | ${lines[n - 1]}`);
  }
  return out.join("\n");
}

// A first guess from the error text. Only a hint for the model: e.g. a timeout can be
// a slow server (flaky) or a missing element (broken script or a real bug).
export function errorHint(error: string): string {
  if (/strict mode violation|resolved to \d+ elements|locator\.\w+: Timeout|waiting for (get|locator)|element\(s\) not found/i.test(error)) {
    return "locator problem: the element wasn't found or matched more than one";
  }
  if (/net::ERR_|ECONNRESET|ECONNREFUSED|socket hang up|50[234]\b/i.test(error)) {
    return "network or server problem";
  }
  // "Timeout 5000ms exceeded" (an action) or "Test timeout of 30000ms exceeded" (the whole test)
  if (/timeout (of )?\d+ms exceeded|timed out/i.test(error)) {
    return "timeout";
  }
  if (/Expected[\s\S]*Received/.test(error)) {
    return "assertion: the app returned a different value than the test expects";
  }
  return "no clear pattern";
}
