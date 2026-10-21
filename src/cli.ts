import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { Command } from "commander";
import { loadConfig } from "./config/load.js";
import { createTicketSystem } from "./trackers/factory.js";
import { createLLMProvider } from "./llm/factory.js";
import { parseVerdict, reviewStory } from "./core/review.js";
import { QaError } from "./core/errors.js";
import { writeTestCases } from "./core/cases.js";
import { MarkdownTestCaseStore } from "./stores/markdown.js";

dotenv.config({ quiet: true });

const program = new Command();

program
  .name("qa")
  .description("AI-assisted QA toolkit")
  .version("0.1.0");

program
  .command("review")
  .description("Review a story's acceptance criteria")
  .argument("<key>", "story key, e.g. TOOL-1")
  .option("--json", "print the result as JSON")
  .action(async (key: string, options: { json?: boolean }) => {
    const config = await loadConfig();
    const tickets = createTicketSystem(config);
    const llm = createLLMProvider(config);

    const story = await tickets.getStory(key);

    if (options.json) {
      const review = await reviewStory(story, llm);
      const result = { ...story, verdict: parseVerdict(review), review };
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`${story.key}: ${story.summary}`);
    console.log(`Status: ${story.status}`);
    console.log("");
    console.log("Reviewing with AI...");
    console.log("");

    const review = await reviewStory(story, llm);
    console.log(review);
  });

program
  .command("cases")
  .description("Write test cases for a story's acceptance criteria")
  .argument("<key>", "story key, e.g. TOOL-1")
  .option("--json", "print the story and test cases as JSON instead of saving a file")
  .option("--push", "post the reviewed test case file to the story as a comment (no AI call)")
  .action(async (key: string, options: { json?: boolean; push?: boolean }) => {
    const config = await loadConfig();
    const tickets = createTicketSystem(config);

    // Only a file a human has reviewed goes to the tracker, never the model's answer directly
    if (options.push) {
      const file = path.join("test-cases", `${key}.md`);
      if (!existsSync(file)) {
        throw new QaError(`No ${file} to push. Run "qa cases ${key}" first, then review the file.`);
      }
      await tickets.addComment(key, readFileSync(file, "utf8"));
      console.log(`Posted ${file} to ${key} as a comment.`);
      return;
    }

    const llm = createLLMProvider(config);

    const story = await tickets.getStory(key);
    if (!options.json) console.log(`Writing test cases for ${story.key}: ${story.summary}...`);

    const suite = await writeTestCases(story, llm);

    if (options.json) {
      console.log(JSON.stringify({ ...story, ...suite }, null, 2));
      return;
    }

    const store = new MarkdownTestCaseStore();
    const location = await store.save(story, suite);
    console.log(
      `Saved ${suite.cases.length} test cases (covering ${suite.criteria.length} criteria) to ${location}`,
    );
  });

// Expected errors (QaError) print one clear line on stderr and exit with code 1.
// Anything else is a bug, so it keeps its full stack trace.
try {
  await program.parseAsync();
} catch (error) {
  if (!(error instanceof QaError)) throw error;
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
