import type { Story } from "../trackers/types.js";

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

export interface TestCaseStore {
  // Returns where the cases were saved (a file path, a URL...), for the CLI to print
  save(story: Story, cases: TestCase[]): Promise<string>;
}
