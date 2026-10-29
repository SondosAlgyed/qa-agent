import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QaError } from "../core/errors.js";
import type { CompleteOptions, LLMProvider } from "./types.js";

// What `claude -p --output-format json` prints (only the fields we use)
interface ClaudeCliResult {
  result: string;
  is_error: boolean;
  // With --json-schema: the answer as an object, checked against the schema by the CLI
  structured_output?: unknown;
}

// Runs one headless Claude Code call with the user's own login (we never see the token).
// No tools, no CLAUDE.md, memory, plugins or hooks, and an empty working folder,
// so the model sees only our prompt.
export function runClaude(
  system: string,
  prompt: string,
  model: string,
  jsonSchema?: Record<string, unknown>,
): Promise<ClaudeCliResult> {
  const args = [
    "-p",
    "--output-format", "json",
    "--system-prompt", system,
    "--tools", "",
    "--safe-mode",
    "--no-session-persistence",
    "--model", model,
  ];
  if (jsonSchema) {
    args.push("--json-schema", JSON.stringify(jsonSchema));
  }
  const cwd = mkdtempSync(path.join(tmpdir(), "qa-claude-"));

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new QaError('The "claude" CLI was not found. Install Claude Code and log in once.'));
      } else {
        reject(error);
      }
    });

    child.on("close", (code) => {
      let parsed: ClaudeCliResult;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        reject(new QaError(`claude exited with code ${code}: ${stderr.trim() || "no output"}`));
        return;
      }
      if (parsed.is_error) {
        reject(new QaError(`Claude Code returned an error: ${parsed.result}`));
        return;
      }
      resolve(parsed);
    });

    // The prompt goes through stdin: Windows limits the length of command-line arguments
    child.stdin.end(prompt);
  });
}

// LLMProvider through the claude CLI: billed to the user's Claude subscription, not the API.
// No startAgent yet: our agent tools would need an MCP server (Claude Code's own tools have no limits).
export class ClaudeCodeProvider implements LLMProvider {
  private readonly model: string;

  constructor(model?: string) {
    this.model = model ?? "claude-opus-5";
  }

  async complete(system: string, prompt: string, options: CompleteOptions = {}): Promise<string> {
    const answer = await runClaude(system, prompt, this.model, options.jsonSchema);
    // Same contract as the API adapter: structured output comes back as a JSON string
    return options.jsonSchema ? JSON.stringify(answer.structured_output) : answer.result;
  }
}
