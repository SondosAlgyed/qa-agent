import type { QaConfig } from "../config/types.js";
import type { TicketSystem } from "./types.js";
import { JiraTicketSystem } from "./jira.js";
import { requireEnv } from "../config/env.js";

export function createTicketSystem(config: QaConfig): TicketSystem {
  const tracker = config.tracker;

  if ("getStory" in tracker) {
    return tracker;
  }

  return new JiraTicketSystem({
    baseUrl: tracker.baseUrl,
    email: requireEnv("JIRA_EMAIL"),
    apiToken: requireEnv("JIRA_API_TOKEN"),
  });
}
