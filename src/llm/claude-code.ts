import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { QaError } from "../core/errors.js";
import type { CompleteOptions, HostedAgentResult, LLMProvider, McpServerCommand } from "./types.js";

// What `claude -p --output-format json` prints (only the fields we use)
interface ClaudeCliResult {
  result: string;
  is_error: boolean;
  // With --json-schema: the answer as an object, checked against the schema by the CLI
  structured_output?: unknown;
  num_turns?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

// An agent run takes about a minute; this only catches a claude process that hangs
const TIMEOUT_MS = 10 * 60 * 1000;

interface RunOptions {
  jsonSchema?: Record<string, unknown>;
  // Agent mode: our MCP server is the only source of tools
  mcpServer?: McpServerCommand;
}

// Runs one headless Claude Code call with the user's own login (we never see the token).
// No built-in tools, no CLAUDE.md, memory, plugins or hooks, and an empty working folder,
// so the model sees only our prompt (and, in agent mode, our MCP tools).
export function runClaude(system: string, prompt: string, model: string, options: RunOptions = {}): Promise<ClaudeCliResult> {
  const args = [
    "-p",
    "--output-format", "json",
    "--system-prompt", system,
    "--tools", "",
    "--no-session-persistence",
    "--model", model,
  ];
  if (options.jsonSchema) {
    args.push("--json-schema", JSON.stringify(options.jsonSchema));
  }
  if (options.mcpServer) {
    // --safe-mode would also turn off MCP servers. --restricted ignores the user's
    // settings too, and --strict-mcp-config leaves only our server.
    const config = { mcpServers: { qa: { type: "stdio", ...options.mcpServer } } };
    args.push("--restricted", "--strict-mcp-config", "--mcp-config", JSON.stringify(config), "--allowedTools", "mcp__qa");
  } else {
    args.push("--safe-mode");
  }
  const cwd = mkdtempSync(path.join(tmpdir(), "qa-claude-"));

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, TIMEOUT_MS);
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
      clearTimeout(timer);
      rmSync(cwd, { recursive: true, force: true });
      if (timedOut) {
        reject(new QaError(`claude didn't answer within ${TIMEOUT_MS / 60000} minutes and was stopped.`));
        return;
      }
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
// Agents run through runHostedAgent, never with Claude Code's own tools (they have no limits).
export class ClaudeCodeProvider implements LLMProvider {
  private readonly model: string;
  private readonly agentModel: string;

  constructor(model?: string, agentModel?: string) {
    this.model = model ?? "claude-opus-5";
    this.agentModel = agentModel ?? this.model;
  }

  async complete(system: string, prompt: string, options: CompleteOptions = {}): Promise<string> {
    const answer = await runClaude(system, prompt, this.model, { jsonSchema: options.jsonSchema });
    // Same contract as the API adapter: structured output comes back as a JSON string
    return options.jsonSchema ? JSON.stringify(answer.structured_output) : answer.result;
  }

  // Claude Code runs the loop; every tool call goes to our MCP server
  async runHostedAgent(system: string, task: string, server: McpServerCommand): Promise<HostedAgentResult> {
    const answer = await runClaude(system, task, this.agentModel, { mcpServer: server });
    const usage = answer.usage;
    return {
      text: answer.result,
      turns: answer.num_turns ?? 0,
      // Cached input still counts as input, as in the API adapter's numbers
      inputTokens: (usage?.input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0),
      outputTokens: usage?.output_tokens ?? 0,
    };
  }
}
