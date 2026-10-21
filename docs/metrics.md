# Metrics

## qa review runs

Raw outputs: `docs/review-runs/<date>[-<version>]/<story>.txt`

| Date | Prompt | Story | Verdict | Blocking | Questions | Out of scope | Actual type | My judgment |
|------|--------|-------|---------|----------|-----------|--------------|-------------|-------------|
| 2026-09-30 | v1 | TOOL-1 | Ready with questions | 0 | 5 | 3 | Clear | ✅ Correct |
| 2026-09-30 | v1 | TOOL-2 | Not ready | 3 | 4 | 3 | Clear | ✅ Agent right — story had real gaps (min length, required fields, age check); fixed before v2 |
| 2026-09-30 | v1 | TOOL-3 | Not ready | 1 | 4 | 3 | Clear | ⚠️ Too strict — "what counts as a match" should be a Question |
| 2026-09-30 | v1 | TOOL-4 | Not ready | 1 | 5 | 3 | Clear | ❌ False positive — invented ambiguity |
| 2026-09-30 | v1 | TOOL-6 | Run failed (API credit balance too low) | – | – | – | Vague | – |
| 2026-09-30 | v1 | TOOL-7 | Run failed (API credit balance too low) | – | – | – | Vague | – |
| 2026-09-30 | v1 | TOOL-8 | Run failed (API credit balance too low) | – | – | – | Clear | – |
| 2026-09-30 | v2 | TOOL-1 | Ready with questions | 0 | 4 | 3 | Clear | ✅ Correct |
| 2026-09-30 | v2 | TOOL-2 | Ready with questions | 0 | 6 | 3 | Clear | ✅ Correct (after story fix) |
| 2026-09-30 | v2 | TOOL-3 | Ready with questions | 0 | 5 | 3 | Clear | ✅ Correct |
| 2026-09-30 | v2 | TOOL-4 | Ready with questions | 0 | 5 | 2 | Clear | ✅ Correct |
| 2026-09-30 | v2 | TOOL-5 | Not ready | 4 | 3 | 2 | Vague | ✅ Verdict correct — 2 of 4 Blocking real (1 duplicate, 2 should be Questions) |
| 2026-09-30 | v2 | TOOL-6 | Not ready | 4 | 3 | 2 | Vague | ✅ Verdict correct — 2 of 4 Blocking real (1 duplicate, 2 should be Questions) |
| 2026-09-30 | v2 | TOOL-7 | Not ready | 2 | 4 | 2 | Vague | ✅ Verdict correct — 2 of 2 Blocking real (overlapping) |
| 2026-09-30 | v2 | TOOL-8 | Ready with questions | 0 | 5 | 3 | Clear | ✅ Correct — no Question should be Blocking |

**Summary (v2):**
- Verdict accuracy: 8 of 8 (5 clear → Ready with questions, 3 vague → Not ready).
- Blocking precision on vague stories: 6 of 10 findings real; 3 of those 6 repeat a root cause.
- Known weaknesses: duplicate findings, and inconsistent severity for unspecified message text
  (Question in TOOL-1, Blocking in TOOL-6).

Note: TOOL-2's improvement is partly from fixing the story, not only the prompt.

Test set: 8 stories, TOOL-1 to TOOL-8. TOOL-9 and TOOL-10 were deleted from Jira on purpose
(2026-09-30), so they are not part of the set.

### Prompt versions

- **v1** (not committed): Blocking = "the criteria that ARE written cannot be implemented or
  verified as stated"; "Out of scope:" limited to "at most 3 short bullet items"; no Ambiguity rule.
  Raw outputs: `docs/review-runs/2026-09-30/`
- **v2** (commit `5492c1e`): v1 + "Out of scope" only when a reader might wrongly assume it is
  part of the story ("omitting this section is normal") + rule "Before marking an Ambiguity as
  Blocking, ask: would a typical developer and tester read this the same way?"
  Raw outputs: `docs/review-runs/2026-09-30-v2/`
- **v3-a** (commit `297e4bd`): v2 + "Unspecified message content (the exact text of a message,
  its wording, or where it appears on screen) is always a Question, never Blocking."
  Raw outputs: `docs/review-runs/2026-10-03-297e4bd/`
- **v3-b** (commit `ddde6ae`): v3-a + "One finding per root cause. If one answer from the product
  owner would resolve several findings, merge them into one. 'X is not defined' and 'X cannot be
  verified' are the same root cause." (replaces "Mention each problem once")
  Raw outputs: `docs/review-runs/2026-10-03-ddde6ae/`
- **v3-c** (commit `fb47af7`): v3-b + each Out of scope bullet must be "- <item> — <the part of the
  story that could make someone think it is included>"; "If you cannot point to such a part, leave
  the item out."
  Raw outputs: `docs/review-runs/2026-10-03-fb47af7/`
- **v3** = v3-c, adopted 2026-10-03 after the 3-run comparison with v2 (below).

## Automated evals (evals/)

Run with: `evals/.venv/Scripts/python.exe -m pytest evals/test_review.py -v`

| Date | Prompt | Eval code | Check | Result | Notes |
|------|--------|-----------|-------|--------|-------|
| 2026-10-03 | v2 (`5492c1e`) | `fd95f65` | Snapshot matches Jira + verdict assertion | 8 of 8 passed | One run only. Claude is non-deterministic, so a borderline story could change on a re-run. |
| 2026-10-03 | v2 (`5492c1e`) | `84c622c` | + G-Eval "Grounded Blocking findings" (judge: gpt-5.5-2026-04-23) on TOOL-5/6/7 | 3 of 3 passed, score 1.0 each | Fresh reviews, not the ones I judged, so not comparable with my scores. |
| 2026-10-03 | v3-a (`297e4bd`) | `3855937` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 0.6, TOOL-6 0.8, TOOL-7 1.0 | Reviews not saved (eval didn't save them yet). Rejected findings were extra cases, unrelated to the v3-a rule. |
| 2026-10-03 | v3-a (`297e4bd`) | `b763337` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 1.0, TOOL-6 1.0, TOOL-7 1.0 | Raw outputs: `docs/review-runs/2026-10-03-297e4bd/`. TOOL-6: confirmation content and failure paths moved from Blocking (v2) to Question. Out of scope had 4 items. |
| 2026-10-03 | v3-b (`ddde6ae`) | `b763337` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 1.0, TOOL-6 1.0, TOOL-7 1.0 | Raw outputs: `docs/review-runs/2026-10-03-ddde6ae/`. Blocking count: TOOL-5 1, TOOL-6 3, TOOL-7 3. My judgment on duplicates: none in TOOL-5 and TOOL-6; TOOL-7 #1 (attributes undefined) and #2 ("narrow down correctly" unmeasurable) partly repeat the same root cause. Clearly better than v2 (duplicates in all 3 vague stories). |
| 2026-10-03 | v3-c (`fb47af7`) | `b763337` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 0.5, TOOL-6 0.7, TOOL-7 1.0 | Raw outputs: `docs/review-runs/2026-10-03-fb47af7/`. Out of scope: in 4 of 8 stories, 9 items (v3-b: 7 of 8, 20 items). My judgment: 7 of 9 items justified; weak: TOOL-7 "Keyword search" (reason points to no part of the story) and TOOL-1 "Password reset" ("natural follow-on"). Lower judge scores come from Blocking findings, not this rule: TOOL-5 again had a Blocking about scope/pagination (the borderline finding). |

### v2 vs v3-c, 3 runs each (2026-10-03)

Single runs were too noisy to compare versions (v3-a gave TOOL-5 0.6 and 1.0 on two runs of the
same prompt), so each version ran 3 times. Eval code `b0d902c`, judge gpt-5.5-2026-04-23.
v2 ran from a git worktree at `8d371f2`; its prompt file's last commit is `98acefe`
(prompt v2 text + `parseVerdict`). Counts below come from the saved reviews, by code.
Raw outputs: `docs/review-runs/2026-10-03-98acefe/` (v2), `docs/review-runs/2026-10-03-fb47af7/*-run*.json` (v3-c).

| Measure | v2 | v3-c |
|---------|----|------|
| Verdicts correct | 24 of 24 | 24 of 24 |
| Judge, mean of 9 scores (TOOL-5/6/7 × 3) | 0.88 | 0.94 |
| Judge, lowest score | 0.5 | 0.5 |
| Blocking per run, TOOL-5 | 3, 4, 3 | 2, 2, 1 |
| Blocking per run, TOOL-6 | 3, 4, 3 | 3, 3, 3 |
| Blocking per run, TOOL-7 | 3, 3, 3 | 3, 3, 3 |
| Reviews with Out of scope | 14 of 24 | 13 of 24 |
| Out of scope items, total | 43 | 26 |

**Conclusion:** v3-c is modestly but really better than v2, with no verdict regressions.
The duplicate rule worked where the duplication was obvious (TOOL-5: gap + testability of the
same thing) but not in TOOL-6/7. Out of scope items fell 40%, but the section still appears in
about half the reviews; the single v3-c run's "4 of 8" was luck. The judge-score gain is close
to the noise level and is not evidence on its own.

## Judge validation: "Grounded Blocking findings"

The judge scores the saved v2 reviews (`docs/review-runs/2026-09-30-v2/`) that I judged by hand.
Score = share of Blocking findings that are real. G-Eval scores are approximate (0–10 scale
normalised), so small differences mean nothing.
Run with: `evals/.venv/Scripts/python.exe evals/validate_judge.py`

| Date | Judge code | Story | My score | Judge score | Where we disagree |
|------|------------|-------|----------|-------------|-------------------|
| 2026-10-03 | `84c622c` (duplicates = not real) | TOOL-5 | 0.50 | 0.80 | Judge accepted "Where sorting applies" |
| 2026-10-03 | `84c622c` (duplicates = not real) | TOOL-6 | 0.50 | 0.80 | Judge accepted "See a confirmation is untestable" (unspecified message content) |
| 2026-10-03 | `84c622c` (duplicates = not real) | TOOL-7 | 1.00 | 1.00 | – |
| 2026-10-03 | `3855937` (duplicates = real) | TOOL-5 | 0.50 | 0.80 | Judge accepted "Where sorting applies" |
| 2026-10-03 | `3855937` (duplicates = real) | TOOL-6 | 0.50 | 0.50 | – |
| 2026-10-03 | `3855937` (duplicates = real) | TOOL-7 | 1.00 | 1.00 | – |

**Conclusion:** the judge agrees with me on 2 of 3 stories; the third differs by one borderline
finding. TOOL-6 changed between runs although the rule change did not touch that finding, so the
judge itself is non-deterministic. Usable, but the sample is tiny (3 stories): don't trust small
score differences, and don't tune the judge further on these same 3 stories (overfitting).
Rule decision: duplicates count as real in this metric; duplication needs its own metric (v3).
## Cases prompt

Eval: `evals/test_cases.py` (run with `evals/.venv/Scripts/python.exe -m pytest evals/test_cases.py -v`).
Goldens: `evals/goldens/cases.json`, 8 stories. Counting rule (mine): a criterion is any sentence that
describes a new behaviour; details that explain a criterion are part of it. The labels were decided by
Claude with that rule at my request, not yet reviewed by me. TOOL-6's single bullet counts as one
criterion (one result of one action), also decided by Claude at my request.
Checks: 1. criteria count = golden count. 2. every criterion has at least one test case.

### v1 (`d62ff27`), 2026-10-21, 1 run

Raw outputs: `docs/cases-runs/2026-10-21-d62ff27/`.

| Story | Criteria found | Expected | Result |
|-------|----------------|----------|--------|
| TOOL-1 | 4 | 4 | pass |
| TOOL-2 | 7 | 4 | fail: the 3 detail lines (`**`) counted as criteria |
| TOOL-3 | 5 | 5 | pass |
| TOOL-4 | 4 | 4 | pass |
| TOOL-5 | 2 | 1 | fail: "As a customer, I want…" counted as a criterion, with invented text in brackets |
| TOOL-6 | 2 | 1 | fail: one bullet split into two |
| TOOL-7 | 2 | 1 | fail: "As a customer, I want…" counted as a criterion, with invented text in brackets |
| TOOL-8 | 4 | 4 | pass |

**4 of 8.** Coverage passed on the 4 stories that reached it. Three different causes: details counted
as criteria, the user story sentence counted as a criterion, and splitting one bullet. On the vague
stories the model also added text to the criteria in brackets, against rule 1.

### v2-a (`3883f28`) and v2-b (`d67b2ef`), 2026-10-21

One change to rule 1: say what counts as a criterion (a new behaviour; the user story sentence and
detail lines are not criteria; one bullet = one criterion; copy the wording, don't add to it).
v2-a's examples ("which fields are required, a minimum length") came from TOOL-2, a golden story,
which our rules forbid. v2-b replaced them with unrelated examples (file types, column order).
v2-a's result is not trusted for that reason.

| Version | Runs | Count check | Coverage check |
|---------|------|-------------|----------------|
| v1 | 1 | 4 of 8 | passed on the 4 that reached it |
| v2-a (golden example in prompt) | 1 | 8 of 8 | 8 of 8 |
| v2-b | 3 per story | 24 of 24 | 24 of 24 |

Raw outputs: `docs/cases-runs/2026-10-21-3883f28/` (v2-a), `docs/cases-runs/2026-10-21-d67b2ef/` (v2-b).

**What the checks don't show (read by hand, v2-b):**
- Vague stories (TOOL-5/6/7): the criterion text is now copied exactly, no invented text in brackets.
- TOOL-5's test cases say the sort options are "not specified in the story" instead of inventing them,
  but add edge cases like "sorting an empty list" and "a single product": low-risk padding, the same
  open issue as in the review prompt.
- TOOL-2: two of three runs put the detail lines in brackets after their criterion (copied from the
  story, not invented); one run left them out.
- "No invented requirements" is not measured yet: that needs the G-Eval metric, next.

### Judge validation for "No invented requirements" (in progress)

Human judgments of the saved v2-b runs (`docs/cases-runs/2026-10-21-d67b2ef/`, run 1), made before
seeing any judge or assistant opinion. Score = share of test cases with nothing invented.

| Story | My score | Notes |
|-------|----------|-------|
| TOOL-7 | 1.00 (4 of 4 fine) | Claude (the assistant) disagreed afterwards on TC-2: "two filters show products matching both" picks AND over OR without saying "not specified" (TOOL-4 uses OR for two categories). I kept my judgment: it is the natural reading of "narrow down correctly". |

| TOOL-6 | 1.00 (1 of 1 fine) | Not invented, but missing: no case for a failed checkout. The assistant had pointed me to look at the preconditions before I answered. Afterwards it noted "logged in" is an assumption (guest checkout isn't ruled out); I kept my judgment. |

Judge: G-Eval "No invented requirements" (`evals/judges.py`, GPT `gpt-5.5-2026-04-23`).
Run with: `evals/.venv/Scripts/python.exe evals/validate_cases_judge.py`

| Date | Story | My score | Judge score | Where we disagree |
|------|-------|----------|-------------|-------------------|
| 2026-10-21 | TOOL-5 | 1.00 | 0.80 | Judge flagged TC-3 (sorting an empty list). I see TC-3/TC-4 (empty list, one product) as low-value padding, not invention. I gave this judgment after reading the assistant's, and agreed with it. |
| 2026-10-21 | TOOL-6 | 1.00 | 1.00 | – (judge also noted "logged in" as an assumption, but not an invented requirement) |
| 2026-10-21 | TOOL-7 | 1.00 | 0.80 | Judge flagged TC-3 (removing a filter restores the list). It accepted TC-2 (AND), the one the assistant had questioned. |

**Conclusion so far:** the judge agrees with me on 1 of 3 stories; on TOOL-5 and TOOL-7 it is
stricter by one borderline case each. Pattern: the judge counts ordinary expectations ("no error",
"the list comes back") as invented, where I don't. If more stories confirm it, the judge's steps need
a clearer line between a new requirement and an ordinary expectation. Three readers (me, the assistant, the judge) each drew the line in a different
place on TOOL-7, so "invented" is itself a fuzzy label here. Sample far too small to trust the
judge yet: don't add it to test_cases.py as a pass/fail check until more stories are judged by me.
Idea from my review, not measured yet: a failure/negative case can be needed even when the story
doesn't describe the failure (expected result "not specified").
