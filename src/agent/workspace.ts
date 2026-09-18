import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";

const MAX_READ_BYTES = 50_000;

// Guardrail: the agent can only touch files inside the directories we allow.
function resolveInside(relPath: string, allowedDirs: readonly string[]): string {
  const abs = path.resolve(config.paths.root, relPath);
  const allowed = allowedDirs.some((dir) => {
    const base = path.resolve(config.paths.root, dir);
    return abs === base || abs.startsWith(base + path.sep);
  });
  if (!allowed) {
    throw new Error(`Path "${relPath}" is outside allowed dirs: ${allowedDirs.join(", ")}`);
  }
  return abs;
}

export async function listFiles(dir: string): Promise<string[]> {
  const abs = resolveInside(dir, config.paths.readableDirs);
  const entries = await fs.readdir(abs, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(config.paths.root, path.join(e.parentPath, e.name)));
}

export async function readFile(relPath: string): Promise<string> {
  const abs = resolveInside(relPath, config.paths.readableDirs);
  const content = await fs.readFile(abs, "utf8");
  return content.length > MAX_READ_BYTES
    ? content.slice(0, MAX_READ_BYTES) + "\n...[truncated]"
    : content;
}

export async function writeFile(
  relPath: string,
  content: string,
  allowedDir: string,
): Promise<string> {
  const abs = resolveInside(relPath, [allowedDir]);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return path.relative(config.paths.root, abs);
}
