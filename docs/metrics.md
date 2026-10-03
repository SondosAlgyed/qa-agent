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