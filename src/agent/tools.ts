import type Anthropic from "@anthropic-ai/sdk";
import path from "node:path";
import { config } from "../config.js";
import { getStory } from "../jira/client.js";
import { listFiles, readFile, writeFile } from "./workspace.js";

const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/;
const SPEC_FILE = /^[\w-]+\.spec\.ts$/;

export const toolDefinitions: Anthropic.Tool[] = [
  {
    name: "get_jira_story",
    description: "Fetch a Jira user story: summary, description, acceptance criteria, status.",
    input_schema: {
      type: "object",
      properties: { issue_key: { type: "string", description: "e.g. QA-123" } },
      required: ["issue_key"],
    },
  },
  {
    name: "list_files",
    description: "List files in the test framework. Allowed dirs: tests, test-cases.",
    input_schema: {
      type: "object",
      properties: { dir: { type: "string", description: "e.g. tests" } },
      required: ["dir"],
    },
  },
  {
    name: "read_file",
    description: "Read a file from the test framework to learn its conventions and page objects.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "e.g. tests/pages/LoginPage.ts" } },
      required: ["path"],
    },
  },
  {
    name: "save_test_cases",
    description: "Save the test cases for a story as Markdown to test-cases/<ISSUE_KEY>.md.",
    input_schema: {
      type: "object",
      properties: {
        issue_key: { type: "string" },
        markdown: { type: "string" },
      },
      required: ["issue_key", "markdown"],
    },
  },
  {
    name: "save_test_script",
    description:
      "Save a Playwright TypeScript spec to tests/generated/<filename>. Filename must end with .spec.ts.",
    input_schema: {
      type: "object",
      properties: {
        filename: { type: "string", description: "e.g. qa-123-login.spec.ts" },
        code: { type: "string" },
      },
      required: ["filename", "code"],
    },
  },
];

type Handler = (input: Record<string, any>) => Promise<string>;

const handlers: Record<string, Handler> = {
  get_jira_story: async ({ issue_key }) => {
    if (!ISSUE_KEY.test(issue_key)) throw new Error(`Invalid issue key: ${issue_key}`);
    return JSON.stringify(await getStory(issue_key), null, 2);
  },

  list_files: async ({ dir }) => (await listFiles(dir)).join("\n") || "(empty)",

  read_file: async ({ path: filePath }) => readFile(filePath),

  save_test_cases: async ({ issue_key, markdown }) => {
    if (!ISSUE_KEY.test(issue_key)) throw new Error(`Invalid issue key: ${issue_key}`);
    const target = path.join(config.paths.testCasesDir, `${issue_key}.md`);
    return `Saved ${await writeFile(target, markdown, config.paths.testCasesDir)}`;
  },

  save_test_script: async ({ filename, code }) => {
    if (!SPEC_FILE.test(filename)) throw new Error(`Filename must match *.spec.ts: ${filename}`);
    const target = path.join(config.paths.generatedTestsDir, filename);
    return `Saved ${await writeFile(target, code, config.paths.generatedTestsDir)}`;
  },
};

export async function executeTool(
  name: string,
  input: unknown,
): Promise<{ content: string; isError: boolean }> {
  const handler = handlers[name];
  if (!handler) return { content: `Unknown tool: ${name}`, isError: true };
  try {
    return { content: await handler(input as Record<string, any>), isError: false };
  } catch (err) {
    // Errors go back to the model so it can correct itself instead of crashing the run.
    return { content: err instanceof Error ? err.message : String(err), isError: true };
  }
}
