import { buildTask } from "./agent/prompts.js";
import { runAgent } from "./agent/runAgent.js";

async function main(): Promise<void> {
  const issueKey = process.argv[2]?.trim().toUpperCase();
  if (!issueKey) {
    console.error("Usage: npm run agent -- QA-123");
    process.exit(1);
  }

  console.log(`QA agent started for ${issueKey}\n`);
  const summary = await runAgent(buildTask(issueKey));
  console.log(`\n${summary}`);
}

main().catch((err) => {
  console.error(`\nAgent failed: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
