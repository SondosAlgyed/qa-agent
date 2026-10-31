import type { RunResult, TestOutcome } from "../runners/types.js";

// The human-readable summary of a run. A plain function, so a UI can reuse it.
// Failed and flaky tests are listed; passed and skipped are only counted.
export function formatRunSummary(result: RunResult, tags: string[]): string {
  const lines = [
    `qa run ${tags.join(" ")}: ${result.total} tests in ${result.seconds}s`,
    `  passed ${result.passed} · failed ${result.failed} · flaky ${result.flaky} · skipped ${result.skipped}`,
  ];

  const failed = result.tests.filter((t) => t.status === "failed");
  if (failed.length > 0) {
    lines.push("", `Failed (${failed.length}):`, ...failed.flatMap(describe));
  }
  // Flaky = failed first, passed on a retry: it passed, but it can't be trusted
  const flaky = result.tests.filter((t) => t.status === "flaky");
  if (flaky.length > 0) {
    lines.push("", `Flaky, passed on a retry (${flaky.length}):`, ...flaky.flatMap(describe));
  }
  return lines.join("\n");
}

function describe(test: TestOutcome): string[] {
  const retries = test.retries > 0 ? ` (${test.retries} ${test.retries === 1 ? "retry" : "retries"})` : "";
  const error = (test.error ?? "").split("\n").map((line) => `      ${line}`);
  return [`  - ${test.file}:${test.line} [${test.project}] ${test.title}${retries}`, ...error];
}
