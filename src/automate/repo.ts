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

  // New files only: the agent never changes a test or page object someone wrote
  async writeFile(requested: string, content: string): Promise<void> {
    const full = this.resolve(requested);
    await mkdir(path.dirname(full), { recursive: true });
    try {
      await writeFile(full, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`"${requested}" already exists. Write a new file instead of changing it.`);
      }
      throw error;
    }
  }
}

const OFF_LIMITS = (name: string) => name === "node_modules" || name === ".git" || name.startsWith(".env");
