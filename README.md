# QA Agent — Jira → Test Cases → Playwright

AI agent بيقرا user story من Jira، يكتب test cases، ويكتب Playwright scripts ليها.

## التشغيل

```bash
npm install
npx playwright install chromium
cp .env.example .env        # حطي بيانات Jira و Anthropic
npm run agent -- QA-123     # رقم الـ story
npm run test:generated      # شغلي الـ tests اللي الـ agent كتبها
```

## النتيجة

- `test-cases/QA-123.md` — الـ test cases + الـ gaps في الـ acceptance criteria
- `tests/generated/qa-123-*.spec.ts` — الـ automation scripts

راجعي أي سطر فيه `TODO(verify-locator)` قبل ما تعملي merge.

## الهيكل

```
src/
├── config.ts            # env variables
├── index.ts             # CLI entry point
├── jira/client.ts       # Jira REST API
└── agent/
    ├── runAgent.ts      # agent loop (Claude + tool use)
    ├── tools.ts         # tools المتاحة للـ agent
    ├── workspace.ts     # file access guardrails
    └── prompts.ts       # system prompt
tests/
├── pages/               # page objects (مكتوبة بإيدينا)
├── examples/            # reference tests — الـ agent بيتعلم منها الـ style
└── generated/           # مكان كتابة الـ agent الوحيد للكود
test-cases/              # مكان كتابة الـ agent للـ test cases
```

الـ tests في `examples/` شغالة على https://www.saucedemo.com كموقع تجريبي. غيري `BASE_URL` للمنتج بتاعك.
