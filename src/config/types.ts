import type { TicketSystem } from "../trackers/types.js";
import type { LLMProvider } from "../llm/types.js";

export interface JiraTrackerConfig {
  type: "jira";
  baseUrl: string;
  projectKey: string;
}

export interface ClaudeLLMConfig {
  type: "claude";
  model?: string;
}

export interface QaConfig {
  tracker: JiraTrackerConfig | TicketSystem;
  llm: ClaudeLLMConfig | LLMProvider;
}
