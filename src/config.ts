import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export const config = {
  jira: {
    baseUrl: required("JIRA_BASE_URL").replace(/\/$/, ""),
    email: required("JIRA_EMAIL"),
    apiToken: required("JIRA_API_TOKEN"),
    acceptanceCriteriaField: process.env.JIRA_AC_FIELD || undefined,
  },
  anthropic: {
    apiKey: required("ANTHROPIC_API_KEY"),
    model: process.env.CLAUDE_MODEL || "claude-sonnet-5",
    maxTurns: Number(process.env.AGENT_MAX_TURNS ?? 20),
    maxTokens: 8000,
  },
  paths: {
    root: process.cwd(),
    readableDirs: ["tests", "test-cases"],
    testCasesDir: "test-cases",
    generatedTestsDir: "tests/generated",
  },
} as const;
