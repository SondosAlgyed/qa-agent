export interface CompleteOptions {
  // A JSON Schema the answer must follow. The provider enforces it if it can
  // (structured outputs); the answer is still returned as a JSON string.
  jsonSchema?: Record<string, unknown>;
}

// --- Agents: a shared language for tools, so the agent loop never depends on
// one provider's format. Each adapter translates to and from its own API.

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema of the tool's input
}

// The model asks us to run a tool. It never runs anything itself.
export interface ToolCall {
  id: string; // links the result back to this call
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  output: string;
  isError?: boolean; // e.g. the path was refused: the model should try something else
}

// One reply from the model. No tool calls means it's done.
export interface AgentTurn {
  text: string;
  toolCalls: ToolCall[];
  // Tokens this call used (what the provider bills), if the provider reports them
  usage?: { inputTokens: number; outputTokens: number };
}

// One agent conversation. The adapter keeps the history; the loop only sends
// results and reads the next turn. The first call sends no results.
export interface AgentConversation {
  next(results: ToolResult[]): Promise<AgentTurn>;
}

export interface LLMProvider {
  complete(system: string, prompt: string, options?: CompleteOptions): Promise<string>;
  // Optional: a provider without tool use can still do review and cases
  startAgent?(system: string, task: string, tools: ToolDefinition[]): AgentConversation;
}
