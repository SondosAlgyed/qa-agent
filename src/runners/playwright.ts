import path from "node:path";
import type { RunResult, TestOutcome, TestStatus } from "./types.js";

// The parts of Playwright's JSON report (--reporter=json) that we read
interface PwResult {
  status: string;
  errors: { message?: string }[];
}

interface PwTest {
  projectName: string;
  status: "expected" | "unexpected" | "flaky" | "skipped";
  results: PwResult[];
}

interface PwSpec {
  title: string;
  file: string; // relative to config.rootDir (the testDir)
  line: number;
  tags: string[]; // without the "@"
  tests: PwTest[]; // one per project (browser)
}

interface PwSuite {
  specs?: PwSpec[];
  suites?: PwSuite[]; // describe() blocks nest
}

export interface PwReport {
  config: { rootDir: string };
  suites: PwSuite[];
  errors: { message?: string }[];
  stats: { duration: number };
}

const STATUS: Record<PwTest["status"], TestStatus> = {
  expected: "passed",
  unexpected: "failed",
  flaky: "flaky",
  skipped: "skipped",
};

// Turns Playwright's report into our RunResult. No I/O, so it's easy to test.
export function parseReport(report: PwReport, repoRoot: string): RunResult {
  const tests: TestOutcome[] = [];

  const walk = (suite: PwSuite) => {
    for (const spec of suite.specs ?? []) {
      // Paths relative to the repo, with "/" on every OS
      const file = path.relative(repoRoot, path.join(report.config.rootDir, spec.file)).split(path.sep).join("/");
      for (const test of spec.tests) {
        const status = STATUS[test.status];
        tests.push({
          title: spec.title,
          file,
          line: spec.line,
          tags: spec.tags.map((tag) => `@${tag}`),
          project: test.projectName,
          status,
          retries: Math.max(test.results.length - 1, 0),
          error: status === "failed" || status === "flaky" ? firstError(test.results) : undefined,
        });
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  report.suites.forEach(walk);

  const count = (status: TestStatus) => tests.filter((t) => t.status === status).length;
  return {
    total: tests.length,
    passed: count("passed"),
    failed: count("failed"),
    flaky: count("flaky"),
    skipped: count("skipped"),
    seconds: Math.round(report.stats.duration / 1000),
    tests,
  };
}

// The first lines of the first error, without colour codes (the JSON keeps them)
function firstError(results: PwResult[]): string | undefined {
  const message = results.flatMap((r) => r.errors).find((e) => e.message)?.message;
  if (!message) return undefined;
  return message
    .replace(/\u001b\[[0-9;]*m/g, "")
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 3)
    .join("\n");
}
