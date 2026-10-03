import json
import subprocess
from datetime import date
from pathlib import Path

import pytest

from judges import grounded_blocking, judge_blocking
from run_cli import REPO_ROOT, run_review

GOLDENS_FILE = Path(__file__).parent / "goldens" / "review.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))
PROMPT_FILE = "src/core/review.ts"


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, encoding="utf-8", check=True)
    return result.stdout.strip()


def prompt_version() -> str:
    commit = git("log", "-1", "--format=%h", "--", PROMPT_FILE)
    changed = git("status", "--porcelain", "--", PROMPT_FILE)
    return f"{commit}-dirty" if changed else commit


RUN_DIR = REPO_ROOT / "docs" / "review-runs" / f"{date.today()}-{prompt_version()}"


@pytest.mark.parametrize("case", GOLDENS, ids=lambda case: case["key"])
def test_review(case):
    result = run_review(case["key"])

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    saved = json.dumps(result, indent=2, ensure_ascii=False)
    (RUN_DIR / f"{case['key']}.json").write_text(saved, encoding="utf-8")

    snapshot = {field: result[field] for field in ("summary", "description", "status")}
    assert snapshot == case["input"], f"{case['key']} changed in Jira. Update the golden first."

    assert result["verdict"] == case["expected"]["verdict"]

    if result["verdict"] == "Not ready":
        score, reason = judge_blocking(result["summary"], result["description"], result["review"])
        print(f"\n{case['key']} score: {score}")
        print(f"reason: {reason}")
        assert score >= grounded_blocking.threshold, reason
