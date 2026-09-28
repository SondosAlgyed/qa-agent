# QA Agent

An open-source, project-agnostic QA toolkit: a framework + AI agent that any
tester can add to their project to automate repetitive QA work.
It assists testers. It does not replace exploratory testing or human judgment.

## Status

Early development. What works today:

- `TicketSystem` contract: a small interface for reading stories and posting comments
- Jira adapter (`JiraTicketSystem`): implements the contract with the Jira Cloud REST API, tested against a real Jira project

There is no CLI yet.

## Setup

Requires Node.js 18+.

```bash
npm install
cp .env.example .env      # add your Jira URL, email, and API token
npm run typecheck
```

## Project structure

```
src/
└── trackers/
    ├── types.ts    # Story + TicketSystem contract
    └── jira.ts     # Jira Cloud adapter
```
