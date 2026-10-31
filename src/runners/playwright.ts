import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { QaError } from "../core/errors.js";
import type { RunOptions, RunResult, TestOutcome, TestRunner, TestStatus } from "./types.js";

// The parts of Playwright's JSON report (--reporter=json) that we read
interface PwError {
  message?: string;
  location?: { file: string; line: number }; // an absolute path
}

interface PwResult {
  status: string;
  errors: PwError[];
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

// A whole regression run can be long; this only stops a run that hangs
const TIMEOUT_MS = 30 * 60 * 1000;

// Runs the project's own Playwright with a fixed command (no shell) and reads
// its JSON report. The project's config is used as it is: we only add what the
// user asked for (tags, project, workers).
export class PlaywrightRunner implements TestRunner {
  constructor(private readonly root: string) {}

  async run(options: RunOptions): Promise<RunResult> {
    const cli = path.join(this.root, "node_modules", "@playwright", "test", "cli.js");
    if (!existsSync(cli)) {
      throw new QaError(`Playwright isn't installed in ${this.root}. Run "npm install" there first.`);
    }
    // A test runs if it has any of the tags. Escaped, because --grep is a regular expression.
    const grep = options.tags.map((tag) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const args = [cli, "test", "--reporter=json", "--grep", grep];
    if (options.project) args.push("--project", options.project);
    if (options.workers) args.push("--workers", String(options.workers));

    const stdout = await new Promise<string>((resolve, reject) => {
      execFile(
        process.execPath,
        args,
        { cwd: this.root, timeout: TIMEOUT_MS, maxBuffer: 100 * 1024 * 1024, env: { ...process.env, NO_COLOR: "1" } },
        // Playwright exits with 1 when a test fails: that's a result, not an error
        (error, out, err) => {
          if (out.trim().startsWith("{")) resolve(out);
          else reject(new QaError(`Playwright didn't produce a report: ${(err || error?.message || "").trim().slice(-500)}`));
        },
      );
    });

    const report = JSON.parse(stdout) as PwReport;
    const result = parseReport(report, this.root);
    // e.g. "No tests found", or a broken config: nothing ran, so say why
    if (result.total === 0 && report.errors.length > 0) {
      throw new QaError(`No tests ran: ${stripColours(report.errors[0]!.message ?? "unknown error").split("\n")[0]}`);
    }
    return result;
  }
}

// Turns Playwright's report into our RunResult. No I/O, so it's easy to test.
export function parseReport(report: PwReport, repoRoot: string): RunResult {
  const tests: TestOutcome[] = [];

  // Paths relative to the repo, with "/" on every OS
  const relative = (file: string) => path.relative(repoRoot, file).split(path.sep).join("/");

  const walk = (suite: PwSuite) => {
    for (const spec of suite.specs ?? []) {
      const file = relative(path.join(report.config.rootDir, spec.file));
      for (const test of spec.tests) {
        const status = STATUS[test.status];
        // For a flaky test, this is the error of the attempt that failed
        const error = status === "failed" || status === "flaky" ? firstError(test.results) : undefined;
        const message = error?.message ? stripColours(error.message) : undefined;
        tests.push({
          title: spec.title,
          file,
          line: spec.line,
          tags: spec.tags.map((tag) => `@${tag}`),
          project: test.projectName,
          status,
          retries: Math.max(test.results.length - 1, 0),
          error: message ? shortError(message) : undefined,
          fullError: message?.slice(0, MAX_FULL_ERROR),
          errorAt: error?.location ? { file: relative(error.location.file), line: error.location.line } : undefined,
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

// Enough for triage to read the whole assertion and call log, short enough for a prompt
const MAX_FULL_ERROR = 4000;

function firstError(results: PwResult[]): PwError | undefined {
  return results.flatMap((r) => r.errors).find((e) => e.message);
}

// The first lines, for the summary
function shortError(message: string): string {
  return message
    .split("\n")
    .filter((line) => line.trim())
    .slice(0, 3)
    .join("\n");
}

// The JSON report keeps colour codes in messages, even with NO_COLOR

function stripColours(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}
