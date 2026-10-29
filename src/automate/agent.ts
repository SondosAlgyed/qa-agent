import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { LLMProvider, ToolCall, ToolDefinition, ToolResult } from "../llm/types.js";
import { QaError } from "../core/errors.js";
import type { TargetRepo } from "./repo.js";
import { pageSnapshot } from "./snapshot.js";

const pathInput = (description: string) => ({
  type: "object",
  properties: { path: { type: "string", description } },
  required: ["path"],
});

// What the model sees: a name, what the tool does, and its input
export const TOOLS: ToolDefinition[] = [
  { name: "list_files", description: "List one folder of the project. Folders end with /.", inputSchema: pathInput("Folder path, relative to the project root. Use . for the root.") },
  { name: "read_file", description: "Read a file of the project.", inputSchema: pathInput("File path, relative to the project root.") },
  {
    name: "write_file",
    description: "Create a new file, or rewrite a file you created. You can't change files you didn't create.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  { name: "delete_file", description: "Delete a file you created, such as a temporary debug test. Clean these up before you finish.", inputSchema: pathInput("A file you created.") },
  { name: "run_test", description: "Run one Playwright test file you wrote, in Chromium. Returns PASSED or FAILED and the output.", inputSchema: pathInput("The test file you wrote.") },
  {
    name: "page_snapshot",
    description: "Open a page of the app under test and return its accessibility tree (roles and names, what getByRole matches).",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

export interface AgentResult {
  finished: boolean; // false = it hit the turn limit
  text: string; // the model's last words
  trace: string[]; // every tool call in order, for the report and the evals
  turns: number; // how many times we called the model
  inputTokens: number;
  outputTokens: number;
}

// The loop: ask the model, run the tools it asks for, send the results back,
// until it stops asking or hits the turn limit.
export async function runAgent(options: {
  llm: LLMProvider;
  repo: TargetRepo;
  appUrl: string;
  system: string;
  task: string;
  maxTurns: number;
}): Promise<AgentResult> {
  const { llm, repo, appUrl, system, task, maxTurns } = options;
  if (!llm.startAgent && llm.runHostedAgent) {
    return runHosted(options);
  }
  if (!llm.startAgent) {
    throw new QaError("The configured LLM provider doesn't support agents (tool use), which qa automate needs.");
  }

  const conversation = llm.startAgent(system, task, TOOLS);
  const trace: string[] = [];
  const totals = { turns: 0, inputTokens: 0, outputTokens: 0 };
  const ask = async (results: ToolResult[]) => {
    const t = await conversation.next(results);
    totals.turns++;
    totals.inputTokens += t.usage?.inputTokens ?? 0;
    totals.outputTokens += t.usage?.outputTokens ?? 0;
    return t;
  };
  let turn = await ask([]);

  for (let n = 1; turn.toolCalls.length > 0; n++) {
    if (n > maxTurns) {
      return { finished: false, text: turn.text, trace, ...totals };
    }
    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      trace.push(toolTrace(call));
      results.push(await runTool(call, repo, appUrl));
    }
    turn = await ask(results);
  }
  return { finished: true, text: turn.text, trace, ...totals };
}

// The provider runs the loop and calls our tools through mcp-server.ts, which writes the
// trace to a file and enforces the limit. It counts tool calls, not model calls: past runs
// made about 2 tool calls per model call, so maxTurns × 3 leaves the same room.
async function runHosted(options: Parameters<typeof runAgent>[0]): Promise<AgentResult> {
  const { llm, repo, appUrl, system, task, maxTurns } = options;
  const traceDir = mkdtempSync(path.join(tmpdir(), "qa-agent-"));
  const traceFile = path.join(traceDir, "trace.txt");
  writeFileSync(traceFile, "");
  // qa runs through tsx, so the server does too
  const result = await llm.runHostedAgent!(system, task, {
    command: process.execPath,
    args: [
      "--import", import.meta.resolve("tsx"),
      fileURLToPath(new URL("./mcp-server.ts", import.meta.url)),
      repo.root, appUrl, traceFile, String(maxTurns * 3),
    ],
  }).catch((error) => {
    rmSync(traceDir, { recursive: true, force: true });
    throw error;
  });
  const lines = readFileSync(traceFile, "utf-8").split("\n").filter(Boolean);
  rmSync(traceDir, { recursive: true, force: true });
  // Only our MCP server writes the trace, so it's a safe record of what the agent wrote
  for (const line of lines) {
    const written = /^write_file\((".*")\)$/.exec(line);
    if (written) repo.rememberWritten(JSON.parse(written[1]!));
  }
  return {
    finished: !lines.includes("LIMIT"),
    text: result.text,
    trace: lines.filter((line) => line !== "LIMIT"),
    turns: result.turns,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  };
}

// One line of the trace, e.g. read_file("pages/home-page.ts")
export function toolTrace(call: ToolCall): string {
  return `${call.name}(${JSON.stringify(call.input.path ?? call.input.url ?? "")})`;
}

// Our code runs every tool, through TargetRepo's limits. A refused or failed
// tool goes back as an error result, so the model can try something else.
export async function runTool(call: ToolCall, repo: TargetRepo, appUrl: string): Promise<ToolResult> {
  const input = call.input as { path?: string; content?: string; url?: string };
  try {
    let output: string;
    switch (call.name) {
      case "list_files":
        output = (await repo.listFiles(input.path ?? ".")).join("\n");
        break;
      case "read_file":
        output = await repo.readFile(input.path ?? "");
        break;
      case "write_file":
        await repo.writeFile(input.path ?? "", input.content ?? "");
        output = `Wrote ${input.path}.`;
        break;
      case "delete_file":
        await repo.deleteFile(input.path ?? "");
        output = `Deleted ${input.path}.`;
        break;
      case "run_test": {
        const run = await repo.runTest(input.path ?? "");
        output = `${run.passed ? "PASSED" : "FAILED"}\n${run.output}`;
        break;
      }
      case "page_snapshot":
        output = await pageSnapshot(input.url ?? "", appUrl);
        break;
      default:
        throw new Error(`Unknown tool "${call.name}".`);
    }
    return { callId: call.id, output };
  } catch (error) {
    return { callId: call.id, output: (error as Error).message, isError: true };
  }
}
