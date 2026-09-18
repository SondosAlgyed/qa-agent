import { config } from "../config.js";

export interface JiraStory {
  key: string;
  summary: string;
  description: string;
  acceptanceCriteria: string;
  status: string;
  issueType: string;
  labels: string[];
}

const authHeader =
  "Basic " +
  Buffer.from(`${config.jira.email}:${config.jira.apiToken}`).toString("base64");

async function jiraGet<T>(path: string): Promise<T> {
  const res = await fetch(`${config.jira.baseUrl}${path}`, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

// API v2 returns description as plain text (v3 returns the more complex ADF JSON).
export async function getStory(issueKey: string): Promise<JiraStory> {
  const issue = await jiraGet<{ key: string; fields: Record<string, any> }>(
    `/rest/api/2/issue/${encodeURIComponent(issueKey)}`,
  );
  const f = issue.fields;
  const acField = config.jira.acceptanceCriteriaField;

  return {
    key: issue.key,
    summary: f.summary ?? "",
    description: f.description ?? "",
    acceptanceCriteria: acField ? String(f[acField] ?? "") : "",
    status: f.status?.name ?? "Unknown",
    issueType: f.issuetype?.name ?? "Unknown",
    labels: f.labels ?? [],
  };
}
