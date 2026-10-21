import type { Story } from "../trackers/types.js";
import type { LLMProvider } from "../llm/types.js";
import type { TestSuite } from "../stores/types.js";
import { QaError } from "./errors.js";

const SYSTEM_PROMPT = `You are an experienced QA engineer writing manual test cases for a user story.
The test cases are for a human tester: clear steps and an expected result. They are not automated.

Rules:
1. List the acceptance criteria in the order they appear and number them AC1, AC2, ...
   A criterion is a statement of a new behaviour. Include one written outside the bullet list.
   Not criteria: the user story sentence ("As a ..., I want ..."), which is context; and detail
   lines that explain a criterion above them (for example, the allowed file types for an upload,
   or a report's column order), which belong to that criterion. Keep one bullet as one criterion.
   Copy each criterion's wording; do not add to it or explain it.
2. Every acceptance criterion must be covered by at least one test case.
3. Do not invent requirements. Every expected result must come from the story.
4. If the story does not say exactly what should happen (for example, the exact text of a message),
   do not guess. Describe what the story does say, and add "(not specified in the story)".
5. Add negative and edge cases where a criterion calls for them: errors, empty or invalid input,
   limits. Do not add cases for features the story does not describe.
6. Each test case checks one behaviour, with concrete steps a tester can follow.
7. Each test case stands alone: give it its own preconditions, and never depend on another
   test case having run first.

There is no target number of test cases. Write what the criteria need, and no more.
Number the test cases TC-1, TC-2, ... In "covers", list the IDs of the criteria each case checks.`;

// Structured outputs make the answer valid JSON with exactly these fields
const SUITE_SCHEMA = {
  type: "object",
  properties: {
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, text: { type: "string" } },
        required: ["id", "text"],
        additionalProperties: false,
      },
    },
    cases: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          covers: { type: "array", items: { type: "string" } },
          type: { type: "string", enum: ["positive", "negative", "edge"] },
          preconditions: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
          expected: { type: "string" },
        },
        required: ["id", "title", "covers", "type", "preconditions", "steps", "expected"],
        additionalProperties: false,
      },
    },
  },
  required: ["criteria", "cases"],
  additionalProperties: false,
};

export async function writeTestCases(story: Story, llm: LLMProvider): Promise<TestSuite> {
  const prompt = `Story ${story.key}: ${story.summary}\n\n${story.description}`;
  const answer = await llm.complete(SYSTEM_PROMPT, prompt, { jsonSchema: SUITE_SCHEMA });
  const suite = JSON.parse(answer) as TestSuite;
  checkReferences(suite);
  return suite;
}

// The schema guarantees the shape, not the logic: a case could still point to
// a criterion that doesn't exist. Uncovered criteria are not checked here;
// that's a quality question for the evals.
function checkReferences(suite: TestSuite): void {
  const ids = new Set(suite.criteria.map((c) => c.id));
  for (const tc of suite.cases) {
    const unknown = tc.covers.filter((id) => !ids.has(id));
    if (tc.covers.length === 0 || unknown.length > 0) {
      throw new QaError(
        `The model returned ${tc.id} pointing to unknown criteria (${unknown.join(", ") || "none"}). Try running again.`,
      );
    }
  }
}
