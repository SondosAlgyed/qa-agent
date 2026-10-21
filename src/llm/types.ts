export interface CompleteOptions {
  // A JSON Schema the answer must follow. The provider enforces it if it can
  // (structured outputs); the answer is still returned as a JSON string.
  jsonSchema?: Record<string, unknown>;
}

export interface LLMProvider {
  complete(system: string, prompt: string, options?: CompleteOptions): Promise<string>;
}
