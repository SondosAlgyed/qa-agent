# QA Agent — Project Context

## Vision
An open-source, project-agnostic QA toolkit: a framework + AI agent that any
tester can install on any project to automate repetitive QA work.
It assists testers; it does not replace exploratory testing or human judgment.

Planned CLI commands:
- `qa review <key>`   — review acceptance criteria, find gaps and ambiguity
- `qa cases <key>`    — write test cases (Markdown / CSV / Xray / TestRail)
- `qa automate <key>` — write Playwright scripts following the repo's own conventions
- `qa run --smoke | --regression` — run tests by tag and summarise results
- `qa triage`         — classify failures: real bug / flaky / broken script
- `qa report <key>`   — post results to the tracker

## Architecture principles
- Interfaces only where things differ between teams:
  TicketSystem, LLMProvider, TestRunner, TestCaseStore.
- Design for many adapters, implement one of each first:
  Jira, Claude, Playwright, Markdown.
- Per-project config file (`qa.config.ts`) created by `qa init`.
- Testers can plug in their own adapter through qa.config.ts, without
  changing our code (the tracker is built-in settings OR a TicketSystem).
- CLI first (it must run in CI). Keep the CLI thin: commands call plain
  functions, so a GUI or MCP server can reuse them later.
- The agent learns conventions by reading the target repo's existing tests.
- Demo project: Toolshop (https://practicesoftwaretesting.com), Jira key TOOL.
- Any file-reading tools given to the agent must never have access to evals/,
  docs/metrics.md, or docs/review-runs/. They contain the expected answers.

## Evaluation (evals/)
- Evals live in evals/, written in Python with DeepEval. They test the CLI as a
  black box through --json output. They never import code from src/.
- Use plain code assertions for anything exact (e.g. the verdict matches the
  expected verdict). Use G-Eval only for qualities that need judgment
  (e.g. are Blocking findings grounded in the story).
- Goldens (evals/goldens/<command>.json) hold, for each case: the input as a
  snapshot, the expected result, and what a human judged as correct.
- Before trusting any G-Eval metric, validate it against my manual judgments
  in docs/metrics.md.
- The qa agent (the tool's prompts and code in src/) must never read evals/ or
  the goldens, and golden cases must never be used as examples in prompts.
  They are test data.
- Every prompt version is a commit, and its eval results are recorded in
  docs/metrics.md.

## Documentation
- Keep docs/journal.md, docs/metrics.md, and README.md up to date:
  a short journal entry after each session, and README reflects what works today, not what's planned.
- Numbers in docs/metrics.md come only from real runs, never estimated.

## How I want to work — IMPORTANT
- ONE POINT PER REPLY. Never cover more than one item, step, or topic in a
  single reply. Don't recap finished items and don't preview the next one.
- End every reply with one question or one action for me, then stop and wait.
- Only move to the next point after I explicitly say "next" or "تمام".
I'm learning TypeScript, Playwright, and AI agents through this project.
I'm also learning Python and DeepEval through this project — explain them
the same way as TypeScript (new concepts explained the first time they appear).
- Reply in simple, clear English. Short sentences, no jargon without explaining it.
- You may write code, but in small steps only: one small piece at a time
  (a function, a few lines), never a whole file or several files at once.
- Before writing: tell me what we're adding and why.
- After writing: explain every line in detail — what it does, why it's there,
  and what the alternative would be. Explain any new TypeScript, Playwright,
  or agent concept the first time it appears.
- Explain the architectural reasoning behind each decision, not just what to do.
- Keep code and technical terms as they are (don't translate them).
- After each step, stop. Tell me how to run or check it, and wait for me to
  confirm I understood before moving on.
- Now and then, suggest a small piece I can write myself for practice,
  then review it and explain what I could improve and why.


## Progress so far
- [x] Environment: Node, Playwright + Chromium, Jira Cloud (TOOL-1..8), .env
- [x] tsconfig.json — written and understood
- [x] src/trackers/types.ts — Story + TicketSystem contract
- [x] src/trackers/jira.ts — JiraTicketSystem implements TicketSystem.
      Credentials come through the constructor (dependency injection).
      Tested against real Jira. Old src/jira/client.ts deleted.
- [x] Cleanup: .env.example (Jira vars only), removed dead "agent" script,
      README rewritten to match what works today
- [x] Config + CLI skeleton: QaConfig (built-in Jira settings or a custom
      TicketSystem adapter), requireEnv, loadConfig, createTicketSystem.
      `qa review <key>` fetches and prints a story (no AI yet). Tested against real Jira.
- [x] LLMProvider interface + Claude adapter (ClaudeProvider, API key via constructor),
      createLLMProvider factory, `llm` in QaConfig. `qa review <key>` now asks Claude
      for a verdict + up to 8 risk-ordered findings. Prompt tuned in 3 runs on TOOL-1.
      (replaced by prompt v2, see below)
- [x] `qa review <key>` works end to end (Jira → Claude → verdict + findings).
- [x] Review prompt v2 committed (5492c1e). Evaluated on 8 stories: 8/8 correct
      verdicts, 6 of 10 Blocking findings real. Details in docs/metrics.md.
- [x] `qa review <key> --json` prints story + verdict + full review as JSON (98acefe).
      parseVerdict reads the verdict from the first line; prompt v2 unchanged.

## Next steps (in order)
1. Create evals/goldens/review.json with the 8 stories.
2. First eval: verdict assertion + one G-Eval metric for grounded Blocking findings.
3. Validate the G-Eval metric against docs/metrics.md.

## Cleanup still needed
- tsconfig.json: trailing comma after "types": ["node"]
- LLM adapter: show a clear message when the Anthropic API credit is exhausted,
  instead of the raw 400 error.
- All CLI errors (Jira 404, API credit, auth) should print one clear line instead
  of a raw stack trace.
- A failed run must not leave a normal-looking output file.

## Roadmap
- Part 1: interfaces, config, CLI skeleton, Jira + Markdown adapters, `review`, then an
  evaluation step (review --json → golden dataset → DeepEval evals → validate the judge
  → prompt v3), then `cases`
- Part 2: `automate` (learns repo conventions, verifies locators with Playwright MCP), `run`
- Part 3: `triage`, `report`, MCP server, npm publish, docs, demo video

## Evaluation roadmap (later — don't implement now)
- Synthetic goldens: use DeepEval's Synthesizer to generate more stories and balance
  clear vs vague. A human sets the expected verdict for every generated story;
  the model never labels its own data.
- Safety evals: PII / secret leakage (the tool must never write tokens, keys, or
  personal data into Jira comments or test scripts), and prompt injection (a story
  containing instructions like "ignore previous instructions" must not change the
  tool's behaviour).
- cases evals: every acceptance criterion is covered by at least one test case;
  no invented requirements; negative and edge cases present.
- automate evals: treat reading the repo as retrieval — use contextual precision and
  recall to check it found and reused existing page objects. Use tracing and
  component-level tests to check tool usage and order.
- triage evals: use Toolshop's intentionally buggy version as a golden set with known
  bugs; compare classifications with plain assertions.
- CI: run evals automatically in GitHub Actions when prompts change (Part 3).
- Maybe later: multi-turn evals, only if we add an interactive mode.

## Review prompt — ideas for v3 (not now)
- One finding per root cause: merge findings that describe the same missing information.
- Unspecified message text, wording, or placement is always a Question, never Blocking.
- Don't include findings with no realistic risk (e.g. sorting an empty list).
- Out of scope still appears in every run with 2–3 items.