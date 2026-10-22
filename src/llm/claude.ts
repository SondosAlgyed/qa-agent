import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentConversation,
  AgentTurn,
  CompleteOptions,
  LLMProvider,
  ToolCall,
  ToolDefinition,
  ToolResult,
} from "./types.js";
import { QaError } from "../core/errors.js";

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
  agentModel?: string; // defaults to `model`
}

export class ClaudeProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly agentModel: string;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? "claude-opus-5";
    this.agentModel = config.agentModel ?? this.model;
  }

  async complete(
    system: string,
    prompt: string,
    options: CompleteOptions = {},
  ): Promise<string> {
    let response;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system,
        messages: [{ role: "user", content: prompt }],
        // Structured outputs: the API makes the answer valid JSON for this schema
        ...(options.jsonSchema
          ? { output_config: { format: { type: "json_schema", schema: options.jsonSchema } } }
          : {}),
      });
    } catch (error) {
      throw toQaError(error, this.model);
    }

    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined to answer this request.");
    }

    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  startAgent(system: string, task: string, tools: ToolDefinition[]): AgentConversation {
    return new ClaudeConversation(this.client, this.agentModel, system, task, tools);
  }
}

// Translates the shared agent language to Claude's API and keeps the history.
// The API remembers nothing between calls, so every call sends all of it.
class ClaudeConversation implements AgentConversation {
  private readonly messages: Anthropic.Beta.BetaMessageParam[] = [];
  private readonly tools: Anthropic.Beta.BetaTool[];

  constructor(
    private readonly client: Anthropic,
    private readonly model: string,
    private readonly system: string,
    private readonly task: string,
    tools: ToolDefinition[],
  ) {
    this.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
    }));
  }

  async next(results: ToolResult[]): Promise<AgentTurn> {
    if (this.messages.length === 0) {
      this.messages.push({ role: "user", content: this.task });
    } else {
      // All results of one turn go back together, each linked to its call
      this.messages.push({
        role: "user",
        content: results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.callId,
          content: r.output,
          is_error: r.isError ?? false,
        })),
      });
    }

    let response;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: this.system,
        tools: this.tools,
        messages: this.messages,
      });
    } catch (error) {
      throw toQaError(error, this.model);
    }
    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined to continue this task.");
    }

    // Keep the whole reply (not just the text): it holds the tool calls and the
    // model's thinking, which the next call needs to continue the same task
    this.messages.push({ role: "assistant", content: response.content });

    const toolCalls: ToolCall[] = [];
    const text: string[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      } else if (block.type === "text") {
        text.push(block.text);
      }
    }
    return { text: text.join("\n"), toolCalls };
  }
}

// Turns the API errors we know into one clear line. Anything else stays as it
// is (a bug or something new), so we keep its details.
function toQaError(error: unknown, model: string): unknown {
  if (error instanceof Anthropic.AuthenticationError) {
    return new QaError("Anthropic API key is invalid. Check ANTHROPIC_API_KEY in .env.");
  }
  // Credit used up: a 402 billing error, or a 400 that says so
  if (
    error instanceof Anthropic.APIError &&
    (error.status === 402 || /credit balance/i.test(error.message))
  ) {
    return new QaError(
      "Anthropic API credit is used up. Add credit at console.anthropic.com.",
    );
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new QaError(`Claude model "${model}" was not found. Check llm.model in qa.config.ts.`);
  }
  // The SDK already retried these twice before giving up
  if (
    error instanceof Anthropic.RateLimitError ||
    error instanceof Anthropic.APIConnectionError ||
    (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500)
  ) {
    return new QaError("Claude is busy or unreachable right now. Try again in a minute.");
  }
  return error;
}
