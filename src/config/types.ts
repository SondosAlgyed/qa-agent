import type { TicketSystem } from "../trackers/types.js";

export interface JiraTrackerConfig {
  type: "jira";
  baseUrl: string;
  projectKey: string;
}

export interface QaConfig {
  tracker: JiraTrackerConfig | TicketSystem;
}
