import type { Story } from "../trackers/types.js";
import type { LLMProvider } from "../llm/types.js";

const SYSTEM_PROMPT = `You are an experienced QA engineer reviewing a user story before development starts.
Find the problems that matter most in the story and its acceptance criteria:
- Gaps: behaviour the story does not cover (edge cases, errors, empty states, permissions).
- Ambiguity: wording that a developer and a tester could read differently.
- Testability: criteria that cannot be checked with a clear pass or fail.
Report at most 8 findings, ordered by risk: the ones most likely to cause a bug or rework come first.
Mention each problem once. Skip generic checks that apply to every story (performance, browser support,
accessibility standards) unless this story makes them relevant.
Do not invent problems.
Format your answer exactly like this, with nothing else:
- First line: "Verdict: Ready" or "Verdict: Not ready", then one short sentence explaining why.
- Then a numbered list. Each finding is one line: **short title** (type): one question for the product owner.
No headings, no explanations, no extra sections.
If the story is clear and complete, write "Verdict: Ready" and stop.`;

export async function reviewStory(story: Story, llm: LLMProvider): Promise<string> {
  const prompt = `Story ${story.key}: ${story.summary}\nStatus: ${story.status}\n\n${story.description}`;
  return llm.complete(SYSTEM_PROMPT, prompt);
}
