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

## 2026-10-03 — Prompt v3
- Changed the prompt one rule at a time (v3-a, v3-b, v3-c), with a commit and
  an eval run for each, so every change in results has one known cause.
- The eval now saves every review. Without that, I could see that a test
  passed but not whether the new rule actually worked.
- Rules that ask the model to judge ("only if relevant") are weak. Making the
  rule part of the format ("each item needs a reason") worked better.
- Skipped one idea on purpose: removing "no-risk" findings could also remove
  real edge cases, and finding gaps is the tool's main job.
- Hard part: one run said Out of scope dropped to 4 of 8 stories. With 3 runs
  per version it was really about half, same as before. Single runs lie.
- Compared v2 and v3-c with 3 runs each, using a git worktree for v2. v3 is
  modestly better, with no verdict regressions. Stopped there: more rules
  tuned on the same 8 stories would be overfitting.
- My judgment has to stay mine: the evals are only trustworthy if the human
  labels really come from a human.

## 2026-10-14 — DeepEval course and next steps

- Finished the Udemy course "Testing AI Systems with DeepEval" (Rahul Shetty Academy).
- Most of what it teaches was already in our evaluation roadmap. Now I know the
  tools behind each item: G-Eval for cases, Synthesizer for synthetic goldens,
  tracing and tool correctness for automate.
- One new idea: Prompt Alignment, to check the output follows the prompt's rules.
  Added to the roadmap for later, with synthetic goldens.
- The course confirmed one of our decisions: a judge from another vendor (GPT)
  than the tool (Claude) avoids self-evaluation bias.
- Planned the next steps in order. Cleanup comes before `cases`, because `cases`
  writes files and should be built on clear error handling from the start.

## 2026-10-19 — Playwright practice repo, back to qa-agent

- Paused qa-agent for a few days to prepare for a job interview, and learned
  Playwright hands-on in a separate repo: `toolshop-tests` (UI + API tests on
  Toolshop, a LoginPage page object, tags `@smoke` / `@regression`, GitHub Actions CI).
- Kept it separate on purpose: qa-agent is the tool, `toolshop-tests` is a
  project the tool works on. It will be the target repo for `qa automate`,
  which learns conventions from the existing tests and page objects.
- Watch out for Part 2: hand-written tests for the same stories as our goldens
  could let `qa automate` copy them during evals.
- Health check before restarting: the Jira API token no longer works (401 on
  `/myself`). Jira then answers the issue request as an anonymous user, with a
  404 "issue doesn't exist or no permission". So the tool reports "not found"
  when the real problem is auth. That's exactly the kind of misleading error
  the cleanup step should fix. Anthropic and OpenAI keys are fine.

## 2026-10-21 — Cleanup: clear errors

- Two kinds of errors: expected ones we can explain (`QaError`, one line, exit
  code 1) and bugs (full stack trace). The adapters know what a 401 means; the CLI
  only asks "is it a QaError?", so it stays thin and a GUI or MCP server can reuse it.
- Jira: a bad token gives 404, not 401. So on a 404 the adapter asks Jira "who am
  I?" first. Now a bad token says "login failed" and a wrong key says "not found".
  Root cause, not symptom.
- Claude: matched the SDK's error classes, not message text (except the credit
  case, which can come as a plain 400).
- Testing the messages found a wrong one: I pointed users to CLAUDE_MODEL in .env,
  but the code reads the model from qa.config.ts. Tests on error paths matter too.
- Not tested: no-credit and busy messages (would need to really run out of credit
  or wait for an outage).
## 2026-10-21 — `qa cases`: from contract to 24 of 24

- `TestCaseStore` contract + Markdown adapter. The file is written to a temp file and renamed at
  the end, so a failed run never leaves a half-written file.
- Stories list criteria as bullets without IDs, so the model numbers them and each test case
  says which criteria it covers. That makes coverage a plain assertion, no judge needed.
- Structured outputs (a JSON schema) instead of asking for JSON in the prompt: the evals measure
  test case quality, not broken JSON. The schema guarantees the shape, not the logic, so the code
  still checks that every "covers" ID exists.
- Prompt v1: 4 of 8. The eval found three different causes. v2 changed one rule (what counts as
  a criterion) and got 24 of 24 over 3 runs.
- Mistake caught: v2-a's examples came from a golden story, which our rules forbid. Replaced them
  (v2-b) and recorded v2-a as not trusted.
- The goldens' labels were decided by Claude at my request, using my counting rule; that's written
  in the goldens. Judging the judge must be my own call, so I judged TOOL-7 myself first.
- Test cases reach Jira, but only through a human: `qa cases <key>` writes a draft, I review
  it, and `qa cases <key> --push` posts that file as a comment, without calling the model.
  That's why this is allowed before the safety evals (recorded in CLAUDE.md). Jira's API
  reads wiki markup, so the Jira adapter converts the Markdown; the CLI doesn't know.
- Started a Zephyr adapter, because a comment can't hold test runs, and Zephyr is what I used
  at _VOIS. The reviewed Markdown file is the source, so `parseMarkdown` reads it back (a
  round-trip test: parse + write gives the same file for all 8). Zephyr links by the issue's
  numeric ID, so `Story` now has `id`.
- Blocked on Zephyr's API token: a fresh token gets "Unknown token". I stopped instead of
  writing the adapter blind: field names guessed from examples, with no way to test them,
  would likely mean rewriting it. Tomorrow: retry, then build it against the real API.

## 2026-10-23 — `qa automate`: tools, loop, first run

- Built the agent's five tools on one `TargetRepo` class: every path goes through `resolve`,
  the boundary check. The agent may rewrite only files it created, and run only those.
- Unit tests (`node:test`) for the boundaries, because security limits must not break silently.
- A provider-neutral agent interface in `LLMProvider` (tool calls, results, turns). The Claude
  adapter translates and keeps the history; the loop knows nothing about Claude.
- First real loop: asked to read the goldens, the agent was refused and said so.
- First real `qa automate` run (TOOL-4 TC-1) stopped when the API credit ran out. Before that,
  the agent wrote an "explore" script into the test file and ran it to study the site. Lesson:
  a "run test" tool is a "run any code" tool, so the file limits could be bypassed with
  `import fs` or an import from `../..`. `runTest` now checks every file the agent wrote
  first. It's a guard, not a sandbox; full isolation needs a container.
- Second session (2026-10-24): the whole flow ran once, end to end. `qa cases` drafted TOOL-4's
  test cases with invented data ("Laptops", "BrandX"); I reviewed them with real Toolshop
  categories and brands (checked with the API, so the "no results" case really has none).
- `qa automate` with Sonnet 5.5: TOOL-4 TC-3 in about a minute, 8 model calls, about $0.16,
  3 of 3. It reused the page object from the previous run and listed what its test doesn't check.
- I reviewed the agent's code like a PR: renamed a misleading method, removed a stale comment,
  replaced a duplicated locator. Then the tests failed when 6 ran in parallel, and passed one by
  one: the demo server can't take the load. A flakiness risk, not a code bug.
- First automate eval: 3 of 3 on reviewed cases with no hand-written test, each checked by the
  eval itself (3 runs, page object reused, only new files, tag, ran its test). One run only.
- The agent also read my private CLAUDE.md in the target repo, so files git ignores are now
  hidden from it.
