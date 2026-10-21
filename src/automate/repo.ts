import { readFile } from "node:fs/promises";
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
    const parts = inside.split(path.sep);
    if (parts.some((p) => p === "node_modules" || p === ".git" || p.startsWith(".env"))) {
      throw new Error(`"${requested}" is not allowed (node_modules, .git and .env files are off limits).`);
    }
    return full;
  }

  async readFile(requested: string): Promise<string> {
    return readFile(this.resolve(requested), "utf8");
  }
}
