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
  // Model for agents (qa automate). An agent makes many calls, so a cheaper model can fit.
  agentModel?: string;
}

// Claude through the claude CLI (the user's subscription, no API key)
export interface ClaudeCodeLLMConfig {
  type: "claude-code";
  model?: string;
  agentModel?: string;
}

export interface QaConfig {
  tracker: JiraTrackerConfig | TicketSystem;
  llm: ClaudeLLMConfig | ClaudeCodeLLMConfig | LLMProvider;
  // The tester's project (tests, page objects, test-cases/). Default: the folder qa runs in.
  repo?: string;
  // The app under test. qa automate's agent may only open pages from here.
  appUrl?: string;
}
