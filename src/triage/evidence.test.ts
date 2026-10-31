import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TargetRepo } from "../automate/repo.js";
import type { RunResult, TestOutcome } from "../runners/types.js";
import { codeAround, errorHint, gatherEvidence } from "./evidence.js";

test("codeAround numbers the lines and marks the failing one", () => {
  const source = ["a", "b", "c", "d", "e"].join("\n");
  assert.equal(codeAround(source, 3, 1), "  2 | b\n> 3 | c\n  4 | d");
  // Near the start and end of the file it doesn't go past the edges
  assert.equal(codeAround(source, 1, 1), "> 1 | a\n  2 | b");
});

test("errorHint recognises the common kinds of Playwright errors", () => {
  assert.match(errorHint("Error: locator.click: Timeout 5000ms exceeded.\nwaiting for getByRole('button')"), /locator/);
  assert.match(errorHint("Error: strict mode violation: getByText('Pliers') resolved to 2 elements"), /locator/);
  assert.match(errorHint("Error: page.goto: net::ERR_CONNECTION_RESET"), /network/);
  assert.match(errorHint("Test timeout of 30000ms exceeded."), /timeout/);
  assert.match(errorHint("Error: expect(received).toBe(expected)\n\nExpected: 3\nReceived: 2"), /assertion/);
  assert.match(errorHint("something else"), /no clear pattern/);
});

const outcome = (overrides: Partial<TestOutcome>): TestOutcome => ({
  title: "t", file: "tests/a.spec.ts", line: 3, tags: [], project: "chromium", status: "failed", retries: 0, ...overrides,
});

test("gatherEvidence covers failed and flaky tests only, and stays inside the project", async () => {
  const root = path.join(await mkdtemp(path.join(tmpdir(), "qa-triage-test-")), "project");
  await mkdir(path.join(root, "tests"), { recursive: true });
  await writeFile(path.join(root, "tests", "a.spec.ts"), "line 1\nline 2\nexpect(x).toBe(3);\nline 4");
  const run: RunResult = {
    total: 4, passed: 1, failed: 2, flaky: 1, skipped: 0, seconds: 1,
    tests: [
      outcome({ title: "fails", errorAt: { file: "tests/a.spec.ts", line: 3 }, fullError: "Expected: 3\nReceived: 2" }),
      outcome({ title: "flaky", status: "flaky", error: "Test timeout of 30000ms exceeded." }),
      outcome({ title: "passes", status: "passed" }),
      // A path in run.json pointing outside the project is refused, not read
      outcome({ title: "outside", errorAt: { file: "../../secret.txt", line: 1 } }),
    ],
  };

  const evidence = await gatherEvidence(run, new TargetRepo(root));
  assert.deepEqual(evidence.map((e) => e.test.title), ["fails", "flaky", "outside"]);
  assert.match(evidence[0]!.code, /> 3 \| expect\(x\)\.toBe\(3\);/);
  assert.match(evidence[0]!.hint, /assertion/);
  assert.match(evidence[1]!.hint, /timeout/);
  assert.match(evidence[2]!.code, /code not available: .*outside the project/);
});
