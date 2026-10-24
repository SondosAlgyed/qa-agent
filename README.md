# QA Agent

An open-source, project-agnostic QA toolkit: a framework + AI agent that any
tester can add to their project to automate repetitive QA work.
It assists testers. It does not replace exploratory testing or human judgment.

## Status

Early development. What works today:

- `TicketSystem` contract: a small interface for reading stories and posting comments
- Jira adapter (`JiraTicketSystem`): implements the contract with the Jira Cloud REST API, tested against a real Jira project
- `LLMProvider` contract + Claude adapter (`ClaudeProvider`), plug in your own through qa.config.ts
- Config file (`qa.config.ts`): use the built-in Jira and Claude adapters, or plug in your own
- `qa review <key>` fetches a story from Jira and asks Claude to review it: a verdict (Ready / Ready with questions / Not ready) plus findings classified as Blocking, Question, or Out of scope, each with a question for the product owner. Add `--json` to get the story, verdict, and review as one JSON object (for scripts and evals). Evaluation results: [docs/metrics.md](docs/metrics.md)
- `qa cases <key>` writes manual test cases for a story to `test-cases/<KEY>.md`, as a draft for a tester to review: the acceptance criteria numbered AC1, AC2, ..., then test cases (positive, negative, edge) with preconditions, steps, expected result, and which criteria each one covers. Where the story doesn't say what should happen, the case says "not specified in the story" instead of guessing. Add `--json` to print instead of saving. After reviewing the file, `qa cases <key> --push` posts it to the story as a Jira comment (no AI call: only the reviewed file goes to Jira). The model returns structured JSON (a schema enforced by the API). Saving goes through a `TestCaseStore` contract, so other tools (Zephyr, Xray, TestRail) can be added as adapters.
- `qa automate <key> <TC-id>` turns one reviewed test case into a Playwright test in your project. An AI agent reads your config, tests and page objects, looks at the real page (its accessibility tree), writes the test, runs it and fixes it. Then qa runs the test 3 more times itself before calling it done. It reuses your page objects, may create new files but never changes yours, and prints what it did, what it reused, and what it's unsure about. Nothing is committed: you review the test. Settings in `qa.config.ts`: `repo` (your project, default the current folder), `appUrl` (the app under test), `llm.agentModel` (e.g. a cheaper model for the agent). Add `--json` for scripts and evals.
- The agent's limits: it can't read or write outside your project, can't see `.env`, `node_modules`, `.git` or any file git ignores (your private files), and can only run tests it wrote, with a fixed command. Before running, its code is checked: only `@playwright/test` and imports from inside the project, no `require`, `eval`, `process` or `file://`. This is a guard, not a sandbox.
- Clear errors: problems you can fix (missing `.env` value, bad Jira token, story not found, bad Anthropic key, no API credit, unknown model, Claude busy) print one line that says what to do, and exit with code 1. Unexpected errors keep their full stack trace.
- Evals (`evals/`, Python + DeepEval): run `qa review` as a black box on 8 golden stories, check the verdict, and use a GPT judge (G-Eval) to check that Blocking findings are grounded in the story. The judge was checked against human judgments first.
- Cases evals: run `qa cases` on the same 8 stories and check that it finds the same number of acceptance criteria as a human counted, and that every criterion has a test case (24 of 24 over 3 runs). A GPT judge for "no invented requirements" exists but isn't trusted yet: it agreed with my judgment on 1 of 3 stories so far, and is stricter than me on the other two.
- Automate eval: run `qa automate` on 3 reviewed test cases that have no hand-written test, and check that each test passes 3 runs (the eval runs it), reuses the existing page object, changes no existing file, is tagged, and that the agent ran its test before finishing. First run: 3 of 3, under a minute and about $0.11 each.

## Running the evals

Requires Python 3 and an `OPENAI_API_KEY` in `.env` (for the judge).

```bash
python -m venv evals/.venv
evals/.venv/Scripts/python.exe -m pip install -r evals/requirements.txt   # on macOS/Linux: evals/.venv/bin/python
evals/.venv/Scripts/python.exe -m pytest evals/test_review.py -v -s
evals/.venv/Scripts/python.exe -m pytest evals/test_cases.py -v
evals/.venv/Scripts/python.exe -m pytest evals/test_automate.py -s   # needs the target repo committed and clean
npm run test:unit                                                     # unit tests for the agent's limits
```

Every review is saved to `docs/review-runs/<date>-<prompt commit>/`. Optional settings:
- `QA_EVAL_RUNS=3` runs each story 3 times (LLM output varies between runs).
- `QA_TOOL_DIR=<folder>` runs the CLI from another folder, e.g. a `git worktree` of an older prompt, to compare versions.

## Setup

Requires Node.js 18+.

```bash
npm install
cp .env.example .env      # add your Jira email, Jira API token, and Anthropic API key
# edit qa.config.ts: set your Jira baseUrl and projectKey
npx tsx src/cli.ts review TOOL-1
```

## Project structure

```
qa.config.ts          # per-project settings
src/
├── cli.ts            # qa command
├── config/
│   ├── types.ts      # QaConfig
│   ├── load.ts       # loads qa.config.ts
│   └── env.ts        # reads secrets from .env
├── core/
│   ├── review.ts     # review logic + prompt
│   ├── cases.ts      # test case logic + prompt + JSON schema
│   └── errors.ts     # QaError: an expected error with a clear message
├── stores/
│   ├── types.ts      # TestCase, TestSuite + TestCaseStore contract
│   └── markdown.ts   # Markdown adapter (test-cases/<KEY>.md) + parser
├── automate/
│   ├── repo.ts       # TargetRepo: the agent's file tools and their limits
│   ├── snapshot.ts   # page_snapshot: a page's accessibility tree
│   ├── agent.ts      # the agent loop and its tools
│   ├── prompt.ts     # automate prompt
│   └── automate.ts   # one test case → one checked Playwright test
├── llm/
│   ├── types.ts      # LLMProvider contract
│   ├── claude.ts     # Claude adapter
│   └── factory.ts    # picks the LLM provider
└── trackers/
    ├── types.ts      # Story + TicketSystem contract
    ├── jira.ts       # Jira Cloud adapter
    └── factory.ts    # picks the ticket system
evals/                # Python evals (never imported by src/)
├── goldens/review.json   # 8 stories: Jira snapshot + expected verdict
├── goldens/cases.json    # same 8 stories + expected acceptance criteria
├── run_cli.py        # runs qa review / qa cases --json
├── judges.py         # G-Eval judges (Blocking findings, invented requirements)
├── test_review.py    # the review eval (pytest)
├── test_cases.py     # the cases eval (pytest)
├── validate_judge.py        # compares the review judge with my own judgments
└── validate_cases_judge.py  # compares the cases judge with my own judgments
```
