import type { TicketSystem, Story } from "./types.js";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export class JiraTicketSystem implements TicketSystem {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  // 1) The constructor: runs once when we create a new JiraTracker
  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  }

  // 2) Public method: part of the IssueTracker contract
  async getStory(key: string): Promise<Story> {
    type JiraIssueResponse = {
      key: string;
      fields: Record<string, any>;
    };

    const path = `/rest/api/2/issue/${encodeURIComponent(key)}`;
    const issue = await this.request<JiraIssueResponse>(path);
    const f = issue.fields;

    return {
      key: issue.key,
      summary: f.summary ?? "",
      description: f.description ?? "",
      status: f.status?.name ?? "Unknown",
    };
  }

  // 3) Public method: part of the IssueTracker contract
  async addComment(key: string, text: string): Promise<void> {
    const path = `/rest/api/2/issue/${encodeURIComponent(key)}/comment`;
    await this.request(path, { method: "POST", body: { body: text } });
  }

  // 4) Private helper: only used inside this class
  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    const { method = "GET", body } = options;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Jira ${method} ${path} failed (${res.status}): ${errorText.slice(0, 300)}`,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}