export interface RunOptions {
  tags: string[]; // e.g. ["@smoke"]; a test runs if it has any of them
  project?: string; // e.g. "chromium"; default: every project in the repo's config
  workers?: number; // default: the repo's config
}

// flaky = failed first, then passed on a retry
export type TestStatus = "passed" | "failed" | "flaky" | "skipped";

export interface TestOutcome {
  title: string;
  file: string; // relative to the repo
  line: number;
  tags: string[];
  project: string;
  status: TestStatus;
  retries: number; // how many extra attempts it took
  error?: string; // first lines of the error, for failed and flaky tests
  fullError?: string; // the whole error (capped), for qa triage
  errorAt?: { file: string; line: number }; // where it failed, e.g. the expect() line
}

export interface RunResult {
  total: number;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  seconds: number;
  tests: TestOutcome[];
}

export interface TestRunner {
  run(options: RunOptions): Promise<RunResult>;
}
