# Commands cheat sheet

Run everything from the qa-agent folder:

```
cd C:\Users\sondo\Documents\Qa_Agent\qa-agent
```

Before a demo: internet on, `.env` has `JIRA_EMAIL` and `JIRA_API_TOKEN`, and Claude Code is
logged in (`claude` works in a terminal). qa.config.ts uses `llm.type: "claude-code"`, so Claude
runs on the subscription: no API key, no credit. Heavy use can hit the subscription's usage
limit; then wait for it to reset. Try one command first.

## qa review: is the story ready?

```
npx tsx src/cli.ts review TOOL-1
npx tsx src/cli.ts review TOOL-1 --json
```

Calls Jira + Claude. Changes nothing.

## qa cases: write test cases

```
npx tsx src/cli.ts cases TOOL-1 --json
npx tsx src/cli.ts cases TOOL-1
npx tsx src/cli.ts cases TOOL-1 --push
```

- `--json`: prints the test cases only. Saves nothing. Safest for a demo.
- No flag: saves `../toolshop-tests/test-cases/TOOL-1.md`. It OVERWRITES the reviewed file.
  Undo with `git checkout test-cases/TOOL-1.md` inside toolshop-tests.
- `--push`: posts the reviewed file to the Jira story as a comment. No AI call.
  It writes to Jira, so only run it on purpose.

## qa automate: write a Playwright test

```
npx tsx src/cli.ts automate TOOL-4 TC-2
npx tsx src/cli.ts automate TOOL-4 TC-2 --json
```

Reads `../toolshop-tests/test-cases/TOOL-4.md`, writes `tests/TOOL-4-TC-2.spec.ts` in
toolshop-tests, runs it until it passes 3 times. About 1-2 minutes, on the subscription.
Nothing is committed. Check with `git status` in toolshop-tests.

Already automated (committed): TOOL-4 TC-1, TOOL-4 TC-3, TOOL-8 TC-2.
For a live demo pick one that isn't, e.g. TOOL-4 TC-2 or TC-4.
After the demo, to throw the new test away: delete the new file(s) in toolshop-tests
(`git status` shows them).

## Run the Playwright tests (inside toolshop-tests)

```
cd C:\Users\sondo\Documents\Qa_Agent\toolshop-tests
npx playwright test --project=chromium
npx playwright test tests/TOOL-4-TC-1.spec.ts --project=chromium
npx playwright show-report
```

## Unit tests and typecheck (qa-agent)

```
npm run test:unit
npm run typecheck
```

## Evals (qa-agent, Python + DeepEval)

```
evals/.venv/Scripts/python.exe -m pytest evals/test_review.py -v -s
evals/.venv/Scripts/python.exe -m pytest evals/test_cases.py -v
evals/.venv/Scripts/python.exe -m pytest evals/test_automate.py -s
```

They call Claude many times (on the subscription) and GPT for the judge (this costs a little,
needs `OPENAI_API_KEY`): slow. Add `QA_EVAL_RUNS=3` to repeat each case.
Not for a live demo. `test_automate.py` needs toolshop-tests committed and clean.
