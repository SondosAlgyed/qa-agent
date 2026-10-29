import { appendFileSync } from "node:fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { runTool, toolTrace, TOOLS } from "./agent.js";
import { TargetRepo } from "./repo.js";

// Our agent tools as an MCP server, for providers that run the agent loop themselves
// (the claude CLI). Same TOOLS, same runTool, so TargetRepo's limits still apply.
// Started by the claude CLI: node --import tsx mcp-server.ts <repoDir> <appUrl> <traceFile> <maxToolCalls>
const [repoDir, appUrl, traceFile, maxToolCalls] = process.argv.slice(2);
const repo = new TargetRepo(repoDir);
let calls = 0;

const server = new Server({ name: "qa", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: input = {} } = request.params;
  // The claude CLI has no turn limit of its own, so we enforce one here
  if (++calls > Number(maxToolCalls)) {
    appendFileSync(traceFile, "LIMIT\n");
    return { content: [{ type: "text", text: "Tool call limit reached. Stop now and report what you have." }], isError: true };
  }
  appendFileSync(traceFile, toolTrace({ id: "", name, input }) + "\n");
  const result = await runTool({ id: "", name, input }, repo, appUrl);
  return { content: [{ type: "text", text: result.output }], isError: result.isError ?? false };
});

// stdout is the MCP channel: nothing else may print to it
await server.connect(new StdioServerTransport());
