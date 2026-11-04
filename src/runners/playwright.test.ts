import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseReport, type PwReport } from "./playwright.js";

// A real report: one test fails, one is flaky (fails, then passes on retry), one is
// skipped, one passes; three of them inside a describe() block. Paths made anonymous.
const report: PwReport = JSON.parse(readFileSync(new URL("./fixtures/playwright-sample.json", import.meta.url), "utf8"));
const result = parseReport(report, path.resolve("/repo"));
const byTitle = (title: string) => result.tests.find((t) => t.title === title)!;

test("counts every status, including tests inside describe blocks", () => {
  assert.equal(result.total, 4);
  assert.deepEqual(
    { passed: result.passed, failed: result.failed, flaky: result.flaky, skipped: result.skipped },
    { passed: 1, failed: 1, flaky: 1, skipped: 1 },
  );
});

test("a test that passed on a retry is flaky, not passed", () => {
  const flaky = byTitle("fails once, then passes");
  assert.equal(flaky.status, "flaky");
  assert.equal(flaky.retries, 1);
  assert.match(flaky.error!, /toBeGreaterThan/);
});

test("paths are relative to the repo, tags keep their @", () => {
  const failed = byTitle("always fails");
  assert.equal(failed.file, "tests/qa-sample.spec.ts");
  assert.equal(failed.line, 4);
  assert.equal(failed.project, "chromium");
  assert.deepEqual(byTitle("fails once, then passes").tags, ["@qa-sample", "@smoke"]);
});

test("the full error and where it failed are kept for triage", () => {
  const failed = byTitle("always fails");
  assert.deepEqual(failed.errorAt, { file: "tests/qa-sample.spec.ts", line: 5 });
  assert.ok(failed.fullError!.split("\n").length > 3);
  assert.doesNotMatch(failed.fullError!, /\u001b/);
  assert.equal(byTitle("passes").fullError, undefined);
});

test("a test timeout keeps the action that hung and where", () => {
  // The shape of a real report for a test that ran out of time (two errors, one located)
  const timeout: PwReport = {
    config: { rootDir: "/repo/tests" },
    errors: [],
    stats: { duration: 30000 },
    suites: [{
      specs: [{
        title: "logs in", file: "login.spec.ts", line: 3, tags: [],
        tests: [{
          projectName: "chromium", status: "unexpected",
          results: [{
            status: "timedOut",
            errors: [
              { message: "Test timeout of 30000ms exceeded." },
              { message: "Error: locator.fill: Test timeout of 30000ms exceeded.\nCall log:\n  - waiting for getByRole('textbox', { name: 'Email address' })",
                location: { file: "/repo/pages/login-page.ts", line: 21 } },
            ],
          }],
        }],
      }],
    }],
  };
  const hung = parseReport(timeout, path.resolve("/repo")).tests[0]!;
  assert.match(hung.fullError!, /Test timeout of 30000ms exceeded\.\n\nError: locator\.fill/);
  assert.match(hung.fullError!, /waiting for getByRole\('textbox', \{ name: 'Email address' \}\)/);
  assert.deepEqual(hung.errorAt, { file: "pages/login-page.ts", line: 21 });
});

test("errors are short and have no colour codes", () => {
  const error = byTitle("always fails").error!;
  assert.doesNotMatch(error, /\u001b/);
  assert.ok(error.split("\n").length <= 3);
  assert.match(error, /Expected: 3/);
  assert.equal(byTitle("passes").error, undefined);
});
