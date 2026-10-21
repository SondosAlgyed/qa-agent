import type { Story } from "../trackers/types.js";

// Stories list acceptance criteria as bullets without IDs, so the model numbers
// them (AC1, AC2...) and test cases point to those IDs.
export interface Criterion {
  id: string; // e.g. "AC1"
  text: string;
}

export interface TestCase {
  id: string; // e.g. "TC-1"
  title: string;
  // Which acceptance criteria this case checks, e.g. ["AC2"]. Lets the evals
  // check that every criterion is covered with a plain assertion.
  covers: string[];
  type: "positive" | "negative" | "edge";
  preconditions: string;
  steps: string[];
  expected: string;
}

// The criteria and the cases that cover them: what the model returns for one story
export interface TestSuite {
  criteria: Criterion[];
  cases: TestCase[];
}

export interface TestCaseStore {
  // Returns where the suite was saved (a file path, a URL...), for the CLI to print
  save(story: Story, suite: TestSuite): Promise<string>;
}
