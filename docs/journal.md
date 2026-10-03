# Learning Journal

## Week 1
- Set up Node, Playwright, Jira Cloud with 10 user stories (5 clear, 5 deliberately vague)
- Wrote tsconfig.json and understood each option
- Built a Jira client: generic request function, getStory, addComment
- Hard part: a 404 that was really an auth problem — Jira hides issues from
  unauthenticated users instead of returning 401
- Decision: pivoted to an open-source, project-agnostic tool with adapters

## 2026-09-30 — AI review
- Added an `LLMProvider` contract and a Claude adapter, same pattern as the
  Jira adapter: contract, adapter, factory. `qa review <key>` now asks Claude
  to review a story. The first real run worked end to end.
- Learned the difference between the API and MCP: the API is when my code
  drives the AI, MCP is when an AI app uses my tools.
- Prompt iteration: the first output had ~24 findings plus extra sections —
  good quality, but too long to use. Three runs later: a verdict line and
  one line per finding.
- Hard part: the model treated "at most 8" as a target. Every story got
  exactly 8 findings, even the good ones. It padded or merged unrelated points.
- Designed my own severity model: Blocking / Question / Out of scope, and
  three verdicts (Ready / Ready with questions / Not ready).
- Evaluated v1 vs v2 on 8 Jira stories and judged every result myself.
  v2: verdict right on 8 of 8. But only 6 of 10 Blocking findings were real,
  and 3 of those repeated the same root cause.
- Lesson: TOOL-2 improved partly because I fixed the story, not only the
  prompt. When comparing prompt versions, the input has to stay the same.
- Ran out of API credit in the middle of a batch. Now each prompt version is
  a git commit, and every run is saved, so results can be traced.

## 2026-10-03 — First evals
- Added `qa review --json` so the evals can treat the CLI as a black box.
  Found a hidden bug: dotenv 17 prints a line to stdout, which broke the JSON.
- Built a golden set: 8 stories, each with a Jira snapshot and my expected
  verdict. Learned that goldens are an answer key for testing the tool, not
  something I fill in for every new story — like a regression suite for prompts.
- First Python + pytest + DeepEval code. The verdict check is a plain assert;
  G-Eval (an LLM judge) is only for what needs judgment.
- Chose GPT as the judge, so Claude doesn't grade its own work.
- Hard part: `assert_test` hid the score. A test that passes says nothing
  about how good the judge is — I needed the actual score and reason.
- Validated the judge on the reviews I had judged by hand: it agrees on 2 of 3.
  Found that my own rule (duplicates count as real) and the judge's rule
  disagreed. Lesson: one metric should measure one thing.
- The judge is non-deterministic too, and 3 stories is a tiny sample, so I
  stopped tuning it to avoid overfitting.