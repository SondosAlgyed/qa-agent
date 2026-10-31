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
- Reply in the language of my message: Arabic message → Arabic reply, English message →
  English reply. Simple, clear language. Short sentences, no jargon without explaining it.
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
- [x] evals/goldens/review.json: 8 cases (Jira snapshot + expected verdict + my notes).
      Expected verdicts confirmed by me. The eval must first check the snapshot still
      matches Jira (stories can change).
- [x] First eval (evals/test_review.py, pytest): snapshot check + verdict assertion
      on all 8, then G-Eval "Grounded Blocking findings" when the verdict is Not ready.
      Judge is GPT (gpt-5.5-2026-04-23), a different family from the tool, defined once
      in evals/judges.py. v2: 8/8 verdicts.
- [x] Judge validated (evals/validate_judge.py) on the saved v2 reviews: agrees with
      me on 2 of 3. Duplicates count as real in this metric. Judge is non-deterministic;
      don't tune it further on these 3 stories. Details in docs/metrics.md.
- [x] Review prompt v3 = v3-c (fb47af7), built one rule at a time (v3-a message content →
      Question, v3-b one finding per root cause, v3-c Out of scope items need a reason).
      v2 vs v3-c, 3 runs each: 24/24 verdicts both; fewer duplicate Blocking (TOOL-5 only);
      Out of scope items 43 → 26. Evals save every review; QA_EVAL_RUNS repeats runs;
      QA_TOOL_DIR runs an older version from a git worktree. Details in docs/metrics.md.

- [x] Cleanup: clear CLI errors. `QaError` (src/core/errors.ts) = an expected error with
      a clear message; the CLI prints it as one line on stderr, exit code 1. Other
      errors keep their stack trace. Jira: 401/403 → login failed; on 404 it checks
      /myself first, because Jira answers a bad token as anonymous (404), so "not found"
      is only shown when the login works. Claude: bad key, no credit, unknown model,
      busy/unreachable. Missing .env values. The credit and busy messages are untested.

- [x] `qa cases <key>` (--json): TestCaseStore + Markdown adapter (temp file + rename), structured
      outputs via an optional jsonSchema in LLMProvider, cases prompt v2-b (d67b2ef). The model
      numbers the criteria (AC1...) and each case lists what it covers. Output: test-cases/<KEY>.md
      (gitignored). Plan: the file is a draft for a human to review; a Jira/Zephyr adapter comes
      after the safety evals.
- [x] cases evals part 1: evals/goldens/cases.json (labels by Claude at my request, with my
      counting rule; written in the goldens), evals/test_cases.py (criteria count + coverage).
      v1 4/8, v2-b 24/24 over 3 runs. Details in docs/metrics.md.

- [x] G-Eval "No invented requirements" (evals/judges.py), validated on TOOL-5/6/7: agrees with
      me on 1 of 3, stricter on the other two (it counts ordinary expectations as invented).
      Not a pass/fail check yet; needs more human-judged stories. Part 1 is done.

- [x] `qa cases <key> --push`: posts the reviewed file to the story as a Jira comment.
- [ ] Zephyr adapter (in progress). Zephyr (SmartBear, trial, Standard plan, $10/month after
      the trial: cancel it if not needed) is installed on the TOOL project. Done: parseMarkdown
      (reviewed file → TestSuite, round-trip test 8/8 identical), Story.id (TOOL-1 = 10006).
      Blocked: ZEPHYR_API_TOKEN (.env, from Personal settings → Apps → Zephyr API Access Tokens)
      gets 401 "Unknown token" on https://api.zephyrscale.smartbear.com/v2/projects, US and EU,
      although it's fresh, issued for our site, and valid to 2027. Maybe a new-install delay.
      Retried 2026-10-30: still 401 "Unknown token", US and EU. My advice: cancel the trial
      (Jira → Settings → Apps → Manage apps → Zephyr) unless SmartBear support answers first.
- [x] No API cost (2026-10-29): `llm.type: "claude-code"` (src/llm/claude-code.ts) runs the claude
      CLI on my subscription; ANTHROPIC_API_KEY removed from .env on purpose (don't bring it back).
      review/cases: one call, --json-schema. automate: Claude Code runs the loop, but its only tools
      are ours through an MCP server (src/automate/mcp-server.ts: trace + tool-call limit);
      --restricted, not --safe-mode (that turns MCP off). Evals on it, 3 runs: cases 24/24, review
      24/24 verdicts, automate 9/9. Only paid part left: the GPT judge (OPENAI_API_KEY).
      Evals take QA_EVAL_LABEL (e.g. claude-code) for the run folder name.
      Guard (5ce6575): runClaude removes ANTHROPIC_API_KEY from claude's environment, because
      with a key claude bills the API instead of the subscription (tested with a fake key).
      Also: temp folders deleted after each call, 10-minute timeout, 17 unit tests.
      Check `claude auth status` → authMethod "claude.ai" = subscription.
- [x] LinkedIn post 2 (qa cases + qa automate) written 2026-10-29. Final text and the
      "Laptops" screenshot (a real re-run, not a mockup) are saved outside the repo in
      Documents/Qa_Agent/linkedin/. Rule I follow: every number in a post must already be
      in docs/metrics.md and pushed. Next post: `qa run`.

## Next steps (in order)
0. Waiting on me: cancel the Zephyr trial (or write to SmartBear support).
1. Zephyr: retry the token. If it works, write ZephyrTestCaseStore against the real API, one
   call at a time (POST /testcases, /testcases/{key}/teststeps, /testcases/{key}/links/issues
   with the numeric issueId); the field names so far come from third-party examples, not the
   official docs. If it still fails, contact SmartBear support with the exact error.
   Then: should --push go to Zephyr instead of a comment, and delete the TOOL-1 comment?
2. `qa automate`: works end to end (see the design below). Done: `TargetRepo` (src/automate/repo.ts:
   resolve = the boundary check; read/list hide files git ignores, except test-results; write new
   files + rewrite its own; delete its own; runTest only its own files, fixed command, no shell,
   and it first checks the agent's code: only @playwright/test and in-project imports, no require,
   eval, process, file://; a guard, not a sandbox), page_snapshot (accessibility tree, app origin
   only), provider-neutral agent types in LLMProvider + Claude adapter, the loop (agent.ts, trace,
   turn limit, tokens), prompt v1 (343cfab, 8 rules, never weaken a failing check), the command
   (+ --json), config `repo`, `appUrl`, `llm.agentModel` (Sonnet 5.5 for the agent). 15 unit tests.
   Real runs: TOOL-4 TC-1 and TC-3 written, reviewed by me, committed in toolshop-tests.
   Eval (evals/test_automate.py, 3 reviewed TOOL-4 cases): 3/3, under a minute and ~$0.11 each.
   Second page: TOOL-8 TC-2 (cart) 3/3, ~2 min, ~$0.29: created CartPage, built its own cart (no
   shared data), cleaned up its debug file, and found an accessibility issue in the app (the
   remove button has no accessible name). All agent tests reviewed by me and pushed.
   Cases prompt v3 (56581d1): placeholders instead of invented test data; 24/24 over 3 runs.
   Eval repeated 2026-10-29: 9/9 on the API and 9/9 on claude-code.
   Open: a G-Eval "the test really checks the expected result" (validate
   against my judgments first); tests fail when 6 run in parallel against the demo server (one
   worker is fine); the agent repeats helpers (addToCart, the products QUERY wait) instead of
   suggesting a page-object refactor.

## `qa automate` design (agreed 2026-10-22)
- Command: `qa automate <key> <TC-id>`, e.g. `qa automate TOOL-1 TC-2`. One test case, chosen by
  me. Later: the agent suggests what to automate and why, and I decide.
- Input: the reviewed test case file + the target repo. The target repo is the folder qa runs in;
  while developing, `repo: "../toolshop-tests"` in qa.config.ts. Test case files live in the
  target repo too.
- An agent (tool-use loop), not a single call: it must run the test it writes and fix it.
  Turn limit (AGENT_MAX_TURNS, e.g. 15); if it can't finish, it stops and says why.
- Five tools, written by us, each with its own limits: list_files, read_file, write_file,
  run_test (only the test it wrote), page_snapshot (opens a page with Playwright, returns the
  element tree). Playwright MCP later, only if page_snapshot isn't enough.
- Limits: nothing outside the target repo (so qa-agent's evals/ and goldens are unreachable);
  no .env or node_modules; new files only (it may add a page object, never edit existing ones);
  no shell, no git.
- Done = the test passes 3 runs in a row. Output: the new file (tests/<KEY>-<TC>.spec.ts) +
  a short report (passed 3/3, page objects reused, tag). No commit: I review and commit.
- Evals: plain checks first: the eval runs the test itself 3 times; reuses existing page
  objects (e.g. imports LoginPage for a login step); git status shows only new files; has a
  tag; the trace shows run_test before "done". One G-Eval: the test really checks the expected
  result (validate against my judgments). Use test cases with no existing hand-written test
  (TOOL-4 filters, TOOL-2 registration, TOOL-8 removing an item), so it can't copy one.

## `qa run` design (agreed 2026-10-31)
- Command: `qa run --smoke | --regression | --tag <tag>`, optional `--project`, `--workers`,
  `--json`. Exit code 1 if any test failed (for CI).
- `TestRunner` contract (src/runners/types.ts) + Playwright adapter (src/runners/playwright.ts),
  like trackers/. The command's logic in src/run/ (one folder per command).
- Playwright adapter: fixed command, no shell: `playwright test --grep <tag> --reporter=json`,
  then parse the JSON. It never changes the repo's config; only what the user passes
  (--project, --workers).
- RunResult: total, passed, failed, flaky, skipped, seconds; per test: title, file:line, tags,
  project, status, retries, first error lines. Flaky (failed, then passed on retry) is its own
  group: the starting point for `qa triage`.
- No AI in v1: the summary is plain code. The AI part is `qa triage`, a separate command.
- Tests: unit tests on the parser with real Playwright JSON, plus real runs on toolshop-tests
  (4 @smoke, 7 @regression, 3 browsers). No DeepEval: nothing to judge.

## Eval Monitor / `qa ui` design (agreed 2026-10-29)
- Architecture: CLI + local web UI (same pattern as `playwright test --ui`).
  `qa ui` starts a server; the browser page calls it; the server calls the same plain
  functions as the CLI. No duplicated logic. The CLI stays (CI needs it).
- Server safety: listens on 127.0.0.1 only; rejects requests whose Origin is not its own page.
  Keys and .env stay on the server side; the browser never sees them.
- The server is not an agent tool: the dashboard may read eval results, the agent never.
- Numbers on the dashboard come only from saved runs, never typed in or estimated
  (the mockup's numbers are hard-coded; the real page must read them).
- Process: design each page as an artifact first, agree on it, then build it in the repo,
  one component at a time.
- Page 1 (Providers): choose Local / Subscription / API for two roles, tool and judge.
  Data-route diagram, rule-based advisor, config preview.
  Mockup v3: https://claude.ai/artifact/UxaYNtaMLGsWPkyZxNShRT
  Subscription option: terms checked 2026-10-30 on code.claude.com/docs/en/legal-and-compliance.
  Fine for me: the unmodified claude binary, signed in with my own subscription, for ordinary,
  individual use; qa never sees or stores the login. Not for others: "developers building
  products or services ... should use API key authentication", and nobody may route their
  users' requests through a Pro/Max login. So in the UI and README: Subscription = personal use
  with your own Claude Code login; teams, CI and anything shared = API key. Heavy unattended
  eval runs stretch "ordinary, individual usage": keep them occasional.
- Open: how the judge setting reaches evals/judges.py (Python); where this work sits
  in "Next steps" (before or after Zephyr and automate).
- Rejected: desktop app (heavy install), cloud app (accounts, keys, security),
  VS Code extension only (ties users to one editor).

## Later steps (continuing the list above)
3. `qa run --smoke | --regression`: design agreed 2026-10-31 (see below), building now.
   Done: TestRunner contract (src/runners/types.ts); parseReport (src/runners/playwright.ts) +
   4 unit tests on a real report (fixture: failed, flaky, skipped, passed, describe block).
   Learned from the real JSON: tags come without @, files are relative to testDir, statuses are
   expected/unexpected/flaky/skipped, error messages keep colour codes even with NO_COLOR.
   Next: the adapter that runs playwright (fixed command, no shell), then the command.
4. Better evaluation: synthetic goldens → Prompt Alignment → review prompt v4.
   After Part 2, so the Synthesizer serves all three prompts (review, cases, automate).
5. Safety evals (PII + prompt injection). Before any command that writes AI output to Jira
   directly (`qa report`, a Zephyr adapter that skips review).
   Decided 2026-10-21: `qa cases <key> --push` may post to Jira before the safety evals,
   because it only posts the Markdown file a human has reviewed, never the model's answer
   directly, and it doesn't call the model at all.
6. Part 3: `triage`, `report`, MCP server, evals in CI, npm publish.

## Cleanup still needed
- Zephyr trial: $10/month after the trial. Cancel it before it ends if Zephyr stays blocked.
- No unit tests yet for ClaudeCodeProvider and mcp-server.ts (only real runs).
- claude CLI gets the system prompt as an argument; Windows limits argument length. Use
  --system-prompt-file if a prompt grows large.
- Folder consistency (after the interview): review and cases live in src/core/, automate has
  its own folder. Give every command its own folder: src/review/, src/cases/, src/automate/.

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
- Prompt Alignment: check the review (and later cases) output follows the prompt's
  rules. Do it together with synthetic goldens, when we improve the review prompt again.
  Validate the judge against my judgments first.
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

## Review prompt — open issues after v3 (not now)
Fix these only with new stories to test on (synthetic goldens), not by tuning on the same 8.
- Findings with no realistic risk (e.g. sorting an empty list). Deferred on purpose: the
  rule could make the tool drop real edge cases, and Questions don't change the verdict.
- Harder duplicates still happen (TOOL-6/7: "X undefined" + "X unmeasurable" in other words).
- The prompt's Out of scope example "lockout on a basic login story" is very close to TOOL-1,
  and TOOL-1 lists lockout. Replace it with an example unrelated to any golden story.
- Out of scope still appears in about half the reviews; some reasons are weak.
- TOOL-3 is borderline: a manual run on 2026-10-29 said "Not ready" (golden: "Ready with
  questions"); the 3 eval runs that day matched the golden.