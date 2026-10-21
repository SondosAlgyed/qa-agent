import Anthropic from "@anthropic-ai/sdk";
import type { CompleteOptions, LLMProvider } from "./types.js";
import { QaError } from "../core/errors.js";

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

export class ClaudeProvider implements LLMProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? "claude-opus-5";
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
