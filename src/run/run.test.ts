import { test } from "node:test";
import assert from "node:assert/strict";
import type { RunResult, TestOutcome } from "../runners/types.js";
import { formatRunSummary } from "./run.js";

const outcome = (overrides: Partial<TestOutcome>): TestOutcome => ({
  title: "a test",
  file: "tests/a.spec.ts",
  line: 3,
  tags: ["@smoke"],
  project: "chromium",
  status: "passed",
  retries: 0,
  ...overrides,
});

const result = (tests: TestOutcome[]): RunResult => {
  const count = (status: TestOutcome["status"]) => tests.filter((t) => t.status === status).length;
  return {
    total: tests.length,
    passed: count("passed"),
    failed: count("failed"),
    flaky: count("flaky"),
    skipped: count("skipped"),
    seconds: 12,
    tests,
  };
};

test("all passed: only the counts, no lists", () => {
  const summary = formatRunSummary(result([outcome({}), outcome({ status: "skipped" })]), ["@smoke"]);
  assert.equal(
    summary,
    "qa run @smoke: 2 tests in 12s\n  passed 1 · failed 0 · flaky 0 · skipped 1",
  );
});

test("failed and flaky tests are listed with where they are and why", () => {
  const summary = formatRunSummary(
    result([
      outcome({ title: "login fails", file: "tests/login.spec.ts", line: 12, project: "firefox", status: "failed", retries: 2, error: "Error: boom\nExpected: 3" }),
      outcome({ title: "cart total", status: "flaky", retries: 1, error: "Error: timeout" }),
      outcome({ title: "search works" }),
    ]),
    ["@smoke", "@regression"],
  );
  assert.match(summary, /^qa run @smoke @regression: 3 tests in 12s/);
  assert.match(summary, /Failed \(1\):\n {2}- tests\/login\.spec\.ts:12 \[firefox\] login fails \(2 retries\)\n {6}Error: boom\n {6}Expected: 3/);
  assert.match(summary, /Flaky, passed on a retry \(1\):\n {2}- tests\/a\.spec\.ts:3 \[chromium\] cart total \(1 retry\)\n {6}Error: timeout/);
  // Passed tests are counted, not listed
  assert.doesNotMatch(summary, /search works/);
});
