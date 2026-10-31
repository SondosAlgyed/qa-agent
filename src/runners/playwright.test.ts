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

test("errors are short and have no colour codes", () => {
  const error = byTitle("always fails").error!;
  assert.doesNotMatch(error, /\u001b/);
  assert.ok(error.split("\n").length <= 3);
  assert.match(error, /Expected: 3/);
  assert.equal(byTitle("passes").error, undefined);
});
