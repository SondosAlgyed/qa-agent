import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { executeTool, toolDefinitions } from "./tools.js";

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// The agent loop: call Claude, run any tools it asks for, send results back, repeat.
export async function runAgent(task: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

  for (let turn = 1; turn <= config.anthropic.maxTurns; turn++) {
    const response = await client.messages.create({
      model: config.anthropic.model,
      max_tokens: config.anthropic.maxTokens,
      system: SYSTEM_PROMPT,
      tools: toolDefinitions,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "max_tokens") {
      throw new Error("Response hit max_tokens. Increase config.anthropic.maxTokens.");
    }

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n");
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      console.log(`  → [turn ${turn}] ${block.name}`);
      const result = await executeTool(block.name, block.input);
      if (result.isError) console.log(`    ✗ ${result.content}`);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result.content,
        is_error: result.isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  throw new Error(`Agent did not finish within ${config.anthropic.maxTurns} turns.`);
}
