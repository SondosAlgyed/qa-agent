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

## Automated evals (evals/)

Run with: `evals/.venv/Scripts/python.exe -m pytest evals/test_review.py -v`

| Date | Prompt | Eval code | Check | Result | Notes |
|------|--------|-----------|-------|--------|-------|
| 2026-10-03 | v2 (`5492c1e`) | `fd95f65` | Snapshot matches Jira + verdict assertion | 8 of 8 passed | One run only. Claude is non-deterministic, so a borderline story could change on a re-run. |
| 2026-10-03 | v2 (`5492c1e`) | `84c622c` | + G-Eval "Grounded Blocking findings" (judge: gpt-5.5-2026-04-23) on TOOL-5/6/7 | 3 of 3 passed, score 1.0 each | Fresh reviews, not the ones I judged, so not comparable with my scores. |
| 2026-10-03 | v3-a (`297e4bd`) | `3855937` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 0.6, TOOL-6 0.8, TOOL-7 1.0 | Reviews not saved (eval didn't save them yet). Rejected findings were extra cases, unrelated to the v3-a rule. |
| 2026-10-03 | v3-a (`297e4bd`) | `b763337` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 1.0, TOOL-6 1.0, TOOL-7 1.0 | Raw outputs: `docs/review-runs/2026-10-03-297e4bd/`. TOOL-6: confirmation content and failure paths moved from Blocking (v2) to Question. Out of scope had 4 items. |
| 2026-10-03 | v3-b (`ddde6ae`) | `b763337` | Verdicts + G-Eval | 8 of 8 passed. Judge: TOOL-5 1.0, TOOL-6 1.0, TOOL-7 1.0 | Raw outputs: `docs/review-runs/2026-10-03-ddde6ae/`. Blocking count: TOOL-5 1, TOOL-6 3, TOOL-7 3. My judgment on duplicates: none in TOOL-5 and TOOL-6; TOOL-7 #1 (attributes undefined) and #2 ("narrow down correctly" unmeasurable) partly repeat the same root cause. Clearly better than v2 (duplicates in all 3 vague stories). |

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