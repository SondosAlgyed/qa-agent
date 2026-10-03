import json
from pathlib import Path

import pytest

from judges import grounded_blocking, judge_blocking
from run_cli import run_review

GOLDENS_FILE = Path(__file__).parent / "goldens" / "review.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", GOLDENS, ids=lambda case: case["key"])
def test_review(case):
    result = run_review(case["key"])

    snapshot = {field: result[field] for field in ("summary", "description", "status")}
    assert snapshot == case["input"], f"{case['key']} changed in Jira. Update the golden first."

    assert result["verdict"] == case["expected"]["verdict"]

    if result["verdict"] == "Not ready":
        score, reason = judge_blocking(result["summary"], result["description"], result["review"])
        print(f"\n{case['key']} score: {score}")
        print(f"reason: {reason}")
        assert score >= grounded_blocking.threshold, reason
