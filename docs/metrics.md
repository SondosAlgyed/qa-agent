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

## Automated evals (evals/)

Run with: `evals/.venv/Scripts/python.exe -m pytest evals/test_review.py -v`

| Date | Prompt | Eval code | Check | Result | Notes |
|------|--------|-----------|-------|--------|-------|
| 2026-10-03 | v2 (`5492c1e`) | `fd95f65` | Snapshot matches Jira + verdict assertion | 8 of 8 passed | One run only. Claude is non-deterministic, so a borderline story could change on a re-run. |