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
  if (!llm.startAgent) {
    throw new QaError("The configured LLM provider doesn't support agents (tool use), which qa automate needs.");
  }

  const conversation = llm.startAgent(system, task, TOOLS);
  const trace: string[] = [];
  let turn = await conversation.next([]);

  for (let n = 1; turn.toolCalls.length > 0; n++) {
    if (n > maxTurns) {
      return { finished: false, text: turn.text, trace };
    }
    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      trace.push(`${call.name}(${JSON.stringify(call.input.path ?? call.input.url ?? "")})`);
      results.push(await runTool(call, repo, appUrl));
    }
    turn = await conversation.next(results);
  }
  return { finished: true, text: turn.text, trace };
}

// Our code runs every tool, through TargetRepo's limits. A refused or failed
// tool goes back as an error result, so the model can try something else.
async function runTool(call: ToolCall, repo: TargetRepo, appUrl: string): Promise<ToolResult> {
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
