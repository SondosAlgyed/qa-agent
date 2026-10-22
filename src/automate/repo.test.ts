import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { TargetRepo } from "./repo.js";

// A tiny fake project in a temp folder, plus a "secret" file next to it (outside)
async function makeRepo(): Promise<TargetRepo> {
  const parent = await mkdtemp(path.join(tmpdir(), "qa-repo-test-"));
  const root = path.join(parent, "project");
  await mkdir(path.join(root, "pages"), { recursive: true });
  await writeFile(path.join(root, "pages", "login-page.ts"), "export class LoginPage {}");
  await writeFile(path.join(root, ".env"), "SECRET=1");
  await writeFile(path.join(parent, "outside.txt"), "not yours");
  return new TargetRepo(root);
}

test("reads a file inside the project", async () => {
  const repo = await makeRepo();
  assert.equal(await repo.readFile("pages/login-page.ts"), "export class LoginPage {}");
});

test("refuses paths outside the project", async () => {
  const repo = await makeRepo();
  await assert.rejects(repo.readFile("../outside.txt"), /outside the project/);
  await assert.rejects(repo.readFile(path.join(repo.root, "..", "outside.txt")), /outside the project/);
});

test("refuses .env, node_modules and .git", async () => {
  const repo = await makeRepo();
  await assert.rejects(repo.readFile(".env"), /not allowed/);
  await assert.rejects(repo.readFile("node_modules/x/index.js"), /not allowed/);
  await assert.rejects(repo.readFile(".git/config"), /not allowed/);
});

test("lists one folder, leaving out off-limits names", async () => {
  const repo = await makeRepo();
  assert.deepEqual(await repo.listFiles(), ["pages/"]);
  assert.deepEqual(await repo.listFiles("pages"), ["login-page.ts"]);
});

test("writes a new file, creating its folder", async () => {
  const repo = await makeRepo();
  await repo.writeFile("tests/TOOL-1-TC-2.spec.ts", "test code");
  assert.equal(await repo.readFile("tests/TOOL-1-TC-2.spec.ts"), "test code");
});

test("never overwrites an existing file", async () => {
  const repo = await makeRepo();
  await assert.rejects(repo.writeFile("pages/login-page.ts", "changed"), /already exists/);
  assert.equal(await repo.readFile("pages/login-page.ts"), "export class LoginPage {}");
});

test("refuses to write outside the project or to .env", async () => {
  const repo = await makeRepo();
  await assert.rejects(repo.writeFile("../evil.ts", "x"), /outside the project/);
  await assert.rejects(repo.writeFile(".env.local", "x"), /not allowed/);
});

test("can rewrite a file it wrote itself", async () => {
  const repo = await makeRepo();
  await repo.writeFile("tests/new.spec.ts", "first try");
  await repo.writeFile("tests/new.spec.ts", "fixed");
  assert.equal(await repo.readFile("tests/new.spec.ts"), "fixed");
});

test("only runs tests it wrote", async () => {
  const repo = await makeRepo();
  await assert.rejects(repo.runTest("pages/login-page.ts"), /not written by you/);
});
