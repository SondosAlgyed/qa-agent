import "dotenv/config";
import { Command } from "commander";
import { loadConfig } from "./config/load.js";
import { createTicketSystem } from "./trackers/factory.js";

const program = new Command();

program
  .name("qa")
  .description("AI-assisted QA toolkit")
  .version("0.1.0");

program
  .command("review")
  .description("Review a story's acceptance criteria")
  .argument("<key>", "story key, e.g. TOOL-1")
  .action(async (key: string) => {
    const config = await loadConfig();
    const tickets = createTicketSystem(config);
    const story = await tickets.getStory(key);

    console.log(`${story.key}: ${story.summary}`);
    console.log(`Status: ${story.status}`);
    console.log("");
    console.log(story.description);
  });

await program.parseAsync();
