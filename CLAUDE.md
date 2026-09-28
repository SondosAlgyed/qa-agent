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
- The agent learns conventions by reading the target repo's existing tests.
- Demo project: Toolshop (https://practicesoftwaretesting.com), Jira key TOOL.

## How I want to work — IMPORTANT
- ONE POINT PER REPLY. Never cover more than one item, step, or topic in a
  single reply. Don't recap finished items and don't preview the next one.
- End every reply with one question or one action for me, then stop and wait.
- Only move to the next point after I explicitly say "next" or "تمام".
I'm learning TypeScript, Playwright, and AI agents through this project.
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
- [x] Environment: Node, Playwright + Chromium, Jira Cloud (TOOL-1..10), .env
- [x] tsconfig.json — written and understood
- [x] src/trackers/types.ts — Story + TicketSystem contract
- [x] src/trackers/jira.ts — JiraTicketSystem implements TicketSystem.
      Credentials come through the constructor (dependency injection).
      Tested against real Jira. Old src/jira/client.ts deleted.
- [x] Cleanup: .env.example (Jira vars only), removed dead "agent" script,
      README rewritten to match what works today
- [ ] NEXT: config + CLI skeleton

## Cleanup still needed
- tsconfig.json: trailing comma after "types": ["node"]

## Roadmap
- Month 1: interfaces, config, CLI skeleton, Jira + Markdown adapters, `review` and `cases`
- Month 2: `automate` (learns repo conventions, verifies locators with Playwright MCP), `run`
- Month 3: `triage`, `report`, MCP server, npm publish, docs, demo video

## Portfolio & job search — help me with this too
I'm job hunting as a QA Automation engineer. Help me turn this project into
visible proof of my skills.

For docs, posts, and CV text, you may draft — but in my voice, simple and
honest, and I edit before anything is published.

Keep these files up to date with me:
- docs/journal.md — short entry after each session: what I built, what I
  learned, what was hard. Raw material for posts and interview stories.
- docs/metrics.md — measurable results (gaps found, scripts that ran without
  edits, time saved). Numbers only from real runs, never estimated.
- README.md — reflects what actually works today, not what's planned.

When I ask for the weekly wrap-up:
1. Read docs/journal.md and the week's git log.
2. Draft a short LinkedIn post (English, under 150 words): one concrete result
   or lesson, no hype, no exaggeration.
3. Suggest README updates.
4. Suggest 1–2 CV bullets if something is CV-worthy, with numbers when we have them.

When I ask for interview prep: turn journal entries into STAR stories
(situation, task, action, result) and ask me likely interview questions
about my design decisions.
