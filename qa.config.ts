import type { QaConfig } from "./src/config/types.js";

const config: QaConfig = {
  tracker: {
    type: "jira",
    baseUrl: "https://sondosalgyed-qa.atlassian.net",
    projectKey: "TOOL",
  },
};

export default config;
