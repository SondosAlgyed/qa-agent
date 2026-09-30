# Metrics

## qa review runs

Raw outputs: `docs/review-runs/<date>[-<version>]/<story>.txt`

| Date | Prompt | Story | Verdict | Blocking | Questions | Out of scope | Actual type | My judgment |
|------|--------|-------|---------|----------|-----------|--------------|-------------|-------------|
| 2026-09-30 | v1 | TOOL-1 | Ready with questions | 0 | 5 | 3 | | |
| 2026-09-30 | v1 | TOOL-2 | Not ready | 3 | 4 | 3 | | |
| 2026-09-30 | v1 | TOOL-3 | Not ready | 1 | 4 | 3 | | |
| 2026-09-30 | v1 | TOOL-4 | Not ready | 1 | 5 | 3 | | |
| 2026-09-30 | v1 | TOOL-6 | Run failed (API credit balance too low) | – | – | – | | |
| 2026-09-30 | v1 | TOOL-7 | Run failed (API credit balance too low) | – | – | – | | |
| 2026-09-30 | v1 | TOOL-8 | Run failed (API credit balance too low) | – | – | – | | |
| 2026-09-30 | v2 | TOOL-1 | Ready with questions | 0 | 4 | 3 | | |
| 2026-09-30 | v2 | TOOL-2 | Ready with questions | 0 | 6 | 3 | | |
| 2026-09-30 | v2 | TOOL-3 | Ready with questions | 0 | 5 | 3 | | |
| 2026-09-30 | v2 | TOOL-4 | Ready with questions | 0 | 5 | 2 | | |
| 2026-09-30 | v2 | TOOL-5 | Not ready | 4 | 3 | 2 | | |
| 2026-09-30 | v2 | TOOL-6 | Not ready | 4 | 3 | 2 | | |
| 2026-09-30 | v2 | TOOL-7 | Not ready | 2 | 4 | 2 | | |
| 2026-09-30 | v2 | TOOL-8 | Ready with questions | 0 | 5 | 3 | | |

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
