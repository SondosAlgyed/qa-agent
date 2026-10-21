import json

from judges import judge_invented
from run_cli import REPO_ROOT

RUN_DIR = REPO_ROOT / "docs" / "cases-runs" / "2026-10-21-d67b2ef"
GOLDENS_FILE = REPO_ROOT / "evals" / "goldens" / "cases.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))

# My judgments of run 1 (docs/metrics.md): share of test cases that invent nothing.
HUMAN_SCORES = {"TOOL-5": 1.0, "TOOL-6": 1.0, "TOOL-7": 1.0}
STORIES = ["TOOL-5", "TOOL-6", "TOOL-7"]


def as_text(cases: list[dict]) -> str:
    parts = []
    for tc in cases:
        parts.append(
            f"{tc['id']}: {tc['title']}\n"
            f"Preconditions: {tc['preconditions']}\n"
            f"Steps: {' / '.join(tc['steps'])}\n"
            f"Expected: {tc['expected']}"
        )
    return "\n\n".join(parts)


for case in GOLDENS:
    key = case["key"]
    if key not in STORIES:
        continue

    saved = json.loads((RUN_DIR / f"{key}-run1.json").read_text(encoding="utf-8"))
    score, reason = judge_invented(case["input"]["summary"], case["input"]["description"], as_text(saved["cases"]))

    human = HUMAN_SCORES.get(key)
    human_text = f"{human:.2f}" if human is not None else "not judged"
    print(f"{key}  human: {human_text}  judge: {score:.2f}")
    print(f"  reason: {reason}\n")
