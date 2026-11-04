import { test } from "node:test";
import assert from "node:assert/strict";
import type { TestOutcome } from "../runners/types.js";
import type { Evidence } from "./evidence.js";
import { buildPrompt, formatTriage, type TriagedTest } from "./triage.js";

const outcome = (overrides: Partial<TestOutcome>): TestOutcome => ({
  title: "logs in", file: "tests/login.spec.ts", line: 3, tags: ["@smoke"], project: "chromium",
  status: "failed", retries: 0, ...overrides,
});
const evidence = (overrides: Partial<TestOutcome>): Evidence => ({
  test: outcome(overrides), code: "> 21 |     await this.emailInput.fill(email);", hint: "locator problem",
});

test("the prompt spells out the status, so the model doesn't have to work it out", () => {
  assert.match(buildPrompt(evidence({ status: "flaky", retries: 1 })), /Status: flaky: failed, then passed on retry 1/);
  assert.match(buildPrompt(evidence({ retries: 2 })), /Status: failed on every attempt \(3 attempts\)/);
  assert.match(buildPrompt(evidence({})), /Status: failed \(no retries\)/);
});

test("the prompt has the full error, the hint, and the code where it failed", () => {
  const prompt = buildPrompt(evidence({
    error: "short", fullError: "Error: locator.fill: Test timeout\n  - waiting for getByRole('textbox')",
    errorAt: { file: "pages/login-page.ts", line: 21 },
  }));
  assert.match(prompt, /waiting for getByRole\('textbox'\)/); // the full error, not the short one
  assert.match(prompt, /Hint from the error text: locator problem/);
  assert.match(prompt, /Code around the failing line \(pages\/login-page\.ts\):\n> 21 \|/);
});

test("the prompt shows the page when the test failed, if Playwright saved it", () => {
  assert.match(buildPrompt(evidence({ pageSnapshot: '- heading "Search"\n- textbox' })), /The page when the test failed \(accessibility tree\):\n- heading "Search"\n- textbox$/);
  assert.doesNotMatch(buildPrompt(evidence({})), /The page when the test failed/);
});

test("the report lists each failure with its verdict, then the counts", () => {
  const triaged: TriagedTest[] = [
    { test: outcome({}), triage: { category: "real bug", confidence: "high", reason: "r1", evidence: "e1", next_step: "n1" } },
    { test: outcome({ title: "searches", file: "tests/search.spec.ts" }), triage: { category: "unclear", confidence: "low", reason: "r2", evidence: "e2", next_step: "n2" } },
  ];
  const report = formatTriage(triaged);
  assert.match(report, /^Triaged 2 failures:/);
  assert.match(report, /1\. tests\/login\.spec\.ts:3 \[chromium\] logs in\n {3}REAL BUG \(high confidence\)\n {3}Why: r1\n {3}Evidence: e1\n {3}Next: n1/);
  assert.match(report, /real bug 1 · broken script 0 · flaky 0 · environment 0 · unclear 1$/);
  assert.equal(formatTriage([]), "No failed or flaky tests: nothing to triage.");
});
