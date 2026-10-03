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
- CLI with one command: `qa review <key>` fetches a story from Jira and asks Claude to review it: a verdict (Ready / Ready with questions / Not ready) plus findings classified as Blocking, Question, or Out of scope, each with a question for the product owner. Add `--json` to get the story, verdict, and review as one JSON object (for scripts and evals). Evaluation results: [docs/metrics.md](docs/metrics.md)
- Evals (`evals/`, Python + DeepEval): run `qa review` as a black box on 8 golden stories, check the verdict, and use a GPT judge (G-Eval) to check that Blocking findings are grounded in the story. The judge was checked against human judgments first.

## Running the evals

Requires Python 3 and an `OPENAI_API_KEY` in `.env` (for the judge).

```bash
python -m venv evals/.venv
evals/.venv/Scripts/python.exe -m pip install -r evals/requirements.txt   # on macOS/Linux: evals/.venv/bin/python
evals/.venv/Scripts/python.exe -m pytest evals/test_review.py -v -s
```

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
│   └── review.ts     # review logic + prompt
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
├── run_cli.py        # runs qa review --json
├── judges.py         # G-Eval judge for Blocking findings
├── test_review.py    # the eval (pytest)
└── validate_judge.py # compares the judge with my own judgments
```
