import type { QaConfig } from "../config/types.js";
import type { LLMProvider } from "./types.js";
import { ClaudeProvider } from "./claude.js";
import { ClaudeCodeProvider } from "./claude-code.js";
import { requireEnv } from "../config/env.js";

export function createLLMProvider(config: QaConfig): LLMProvider {
  const llm = config.llm;

  if ("complete" in llm) {
    return llm;
  }

  if (llm.type === "claude-code") {
    return new ClaudeCodeProvider(llm.model);
  }

  return new ClaudeProvider({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    model: llm.model,
    agentModel: llm.agentModel,
  });
}
