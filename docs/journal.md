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