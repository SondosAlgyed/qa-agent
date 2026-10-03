import json

from judges import judge_blocking
from run_cli import REPO_ROOT

RUN_DIR = REPO_ROOT / "docs" / "review-runs" / "2026-09-30-v2"
GOLDENS_FILE = REPO_ROOT / "evals" / "goldens" / "review.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))

# My judgments of the saved v2 runs (docs/metrics.md): share of Blocking findings that are real.
HUMAN_SCORES = {"TOOL-5": 0.5, "TOOL-6": 0.5, "TOOL-7": 1.0}

for case in GOLDENS:
    key = case["key"]
    if key not in HUMAN_SCORES:
        continue

    saved = (RUN_DIR / f"{key}.txt").read_text(encoding="utf-8")
    review = saved[saved.index("Verdict:"):]
    score, reason = judge_blocking(case["input"]["summary"], case["input"]["description"], review)

    human = HUMAN_SCORES[key]
    print(f"{key}  human: {human:.2f}  judge: {score:.2f}  diff: {score - human:+.2f}")
    print(f"  reason: {reason}\n")
