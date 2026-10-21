import type { TicketSystem, Story } from "./types.js";
import { QaError } from "../core/errors.js";

export interface JiraConfig {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export class JiraTicketSystem implements TicketSystem {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  // 1) The constructor: runs once when we create a new JiraTicketSystem
  constructor(config: JiraConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.authHeader =
      "Basic " +
      Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
  }

  // 2) Public method: part of the TicketSystem contract
  async getStory(key: string): Promise<Story> {
    type JiraIssueResponse = {
      id: string;
      key: string;
      fields: Record<string, any>;
    };

    const path = `/rest/api/2/issue/${encodeURIComponent(key)}`;
    const issue = await this.request<JiraIssueResponse>(path, {
      what: `Story ${key}`,
    });
    const f = issue.fields;

    return {
      id: issue.id,
      key: issue.key,
      summary: f.summary ?? "",
      description: f.description ?? "",
      status: f.status?.name ?? "Unknown",
    };
  }

  // 3) Public method: part of the TicketSystem contract. `text` is Markdown.
  async addComment(key: string, text: string): Promise<void> {
    const path = `/rest/api/2/issue/${encodeURIComponent(key)}/comment`;
    await this.request(path, {
      method: "POST",
      body: { body: markdownToJira(text) },
      what: `Story ${key}`,
    });
  }

  // 4) Private helper: only used inside this class
  private async request<T>(
    path: string,
    // `what` names the thing we asked for, for error messages (e.g. "Story TOOL-1")
    options: { method?: string; body?: unknown; what?: string } = {},
  ): Promise<T> {
    const { method = "GET", body, what = path } = options;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 || res.status === 403) {
      throw new QaError(
        "Jira login failed. Check JIRA_EMAIL and JIRA_API_TOKEN in .env.",
      );
    }

    // Jira answers a bad token as an anonymous user, so a wrong token also
    // gives 404. Ask Jira who we are to tell the two causes apart.
    if (res.status === 404) {
      if (!(await this.isLoggedIn())) {
        throw new QaError(
          "Jira login failed. Check JIRA_EMAIL and JIRA_API_TOKEN in .env.",
        );
      }
      throw new QaError(`${what} not found in Jira. Check the key.`);
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Jira ${method} ${path} failed (${res.status}): ${errorText.slice(0, 300)}`,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  // 5) Private helper: does Jira accept our credentials?
  private async isLoggedIn(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/rest/api/2/myself`, {
      headers: { Authorization: this.authHeader, Accept: "application/json" },
    });
    return res.ok;
  }
}

// Jira's v2 API reads wiki markup, not Markdown: "# x" would become a numbered list.
// Converts only the Markdown our tool writes (headings, bullets, numbered steps).
function markdownToJira(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/^## (.*)$/, "h3. $1")
        .replace(/^# (.*)$/, "h2. $1")
        .replace(/^- /, "* ")
        .replace(/^\d+\. /, "# "),
    )
    .join("\n");
}
