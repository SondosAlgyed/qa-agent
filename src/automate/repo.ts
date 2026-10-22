import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// The tester's project that the automate agent works in. Every tool goes
// through this class, so the agent can never reach a file outside the repo
// (qa-agent's evals and goldens included) or the repo's secrets.
export class TargetRepo {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  // Turns a path the agent asked for into a full path, or refuses it
  resolve(requested: string): string {
    const full = path.resolve(this.root, requested);
    const inside = path.relative(this.root, full);

    if (inside.startsWith("..") || path.isAbsolute(inside)) {
      throw new Error(`"${requested}" is outside the project. Use a path inside it.`);
    }
    if (inside.split(path.sep).some(OFF_LIMITS)) {
      throw new Error(`"${requested}" is not allowed (node_modules, .git and .env files are off limits).`);
    }
    return full;
  }

  async readFile(requested: string): Promise<string> {
    return readFile(this.resolve(requested), "utf8");
  }

  // One folder level; folders end with "/". Off-limits names are left out.
  async listFiles(requested = "."): Promise<string[]> {
    const entries = await readdir(this.resolve(requested), { withFileTypes: true });
    return entries
      .filter((e) => !OFF_LIMITS(e.name))
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort();
  }

  // The agent may create files and rewrite the ones it created, but never
  // change a test or page object someone else wrote
  async writeFile(requested: string, content: string): Promise<void> {
    const full = this.resolve(requested);
    const mine = this.written.has(full);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      // "wx" = create only: the file system itself refuses an existing file
      await writeFile(full, content, { encoding: "utf8", flag: mine ? "w" : "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`"${requested}" already exists. Write a new file instead of changing it.`);
      }
      throw error;
    }
    this.written.add(full);
  }

  // Runs one test file the agent wrote, with a fixed command (no shell), and
  // returns whether it passed plus the end of the output for the agent to read
  async runTest(requested: string): Promise<{ passed: boolean; output: string }> {
    const full = this.resolve(requested);
    if (!this.written.has(full)) {
      throw new Error(`"${requested}" was not written by you. You can only run tests you wrote.`);
    }
    // Running a test runs its code, which could read any file or call any site,
    // going around resolve(). So every file the agent wrote is checked first.
    for (const file of this.written) {
      const problems = codeProblems(await readFile(file, "utf8"));
      // A relative import is fine only if it stays inside the project
      for (const [, from] of (await readFile(file, "utf8")).matchAll(/\bfrom\s+["'](\.[^"']*)["']/g)) {
        try {
          this.resolve(path.relative(this.root, path.resolve(path.dirname(file), from!)));
        } catch {
          problems.push(`an import from outside the project ("${from}")`);
        }
      }
      if (problems.length > 0) {
        const name = path.relative(this.root, file);
        throw new Error(`Not run: ${name} uses ${problems.join(", ")}. Tests may only import @playwright/test and files inside the project.`);
      }
    }
    const cli = path.join(this.root, "node_modules", "@playwright", "test", "cli.js");
    // Playwright reads the file argument as a pattern, so Windows "\" must become "/"
    const file = path.relative(this.root, full).split(path.sep).join("/");
    const args = [cli, "test", file, "--project=chromium", "--reporter=line"];

    return new Promise((resolve) => {
      execFile(
        process.execPath,
        args,
        { cwd: this.root, timeout: 120_000, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } },
        (error, stdout, stderr) => {
          const output = `${stdout}\n${stderr}`.trim().slice(-4000);
          resolve({ passed: !error, output });
        },
      );
    });
  }

  private readonly written = new Set<string>();
}

// A guard, not a sandbox: it blocks the plain ways out (Node's file, process and
// network modules, other packages, require, eval, file:// URLs). Full isolation
// would need running tests in a separate container.
function codeProblems(code: string): string[] {
  const problems: string[] = [];
  for (const [, from] of code.matchAll(/\bfrom\s+["']([^"']+)["']/g)) {
    if (from !== "@playwright/test" && !from!.startsWith(".")) problems.push(`an import of "${from}"`);
  }
  const banned: [RegExp, string][] = [
    [/\brequire\s*\(/, "require()"],
    [/\bimport\s*\(/, "a dynamic import()"],
    [/\bprocess\./, "process"],
    [/\beval\s*\(|\bnew\s+Function\s*\(/, "eval"],
    [/file:\/\//i, "a file:// URL"],
  ];
  for (const [pattern, what] of banned) {
    if (pattern.test(code)) problems.push(what);
  }
  return problems;
}

const OFF_LIMITS = (name: string) => name === "node_modules" || name === ".git" || name.startsWith(".env");
