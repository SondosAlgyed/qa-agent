export interface LLMProvider {
  complete(system: string, prompt: string): Promise<string>;
}
