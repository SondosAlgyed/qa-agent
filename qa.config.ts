import type { QaConfig } from "./src/config/types.js";

const config: QaConfig = {
  tracker: {
    type: "jira",
    baseUrl: "https://sondosalgyed-qa.atlassian.net",
    projectKey: "TOOL",
  },
  llm: {
    type: "claude-code",
    // review and cases stay on the default model (their eval results were measured with it)
    // agentModel: "claude-sonnet-5-5",
  },
  // While developing, qa runs from qa-agent and works on the demo test project
  repo: "../toolshop-tests",
  appUrl: "https://practicesoftwaretesting.com",
};

export default config;
