import json
import os
import subprocess
from datetime import date
from pathlib import Path

import pytest

from run_cli import LABEL, REPO_ROOT, TOOL_DIR, run_cases

GOLDENS_FILE = Path(__file__).parent / "goldens" / "cases.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))
PROMPT_FILE = "src/core/cases.ts"
RUNS = range(1, int(os.environ.get("QA_EVAL_RUNS", "1")) + 1)


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=TOOL_DIR, capture_output=True, encoding="utf-8", check=True)
    return result.stdout.strip()


def prompt_version() -> str:
    commit = git("log", "-1", "--format=%h", "--", PROMPT_FILE)
    changed = git("status", "--porcelain", "--", PROMPT_FILE)
    return f"{commit}-dirty" if changed else commit


RUN_DIR = REPO_ROOT / "docs" / "cases-runs" / f"{date.today()}-{prompt_version()}{LABEL}"


@pytest.mark.parametrize("run", RUNS, ids=lambda run: f"run{run}")
@pytest.mark.parametrize("case", GOLDENS, ids=lambda case: case["key"])
def test_cases(case, run):
    result = run_cases(case["key"])

    RUN_DIR.mkdir(parents=True, exist_ok=True)
    saved = json.dumps(result, indent=2, ensure_ascii=False)
    (RUN_DIR / f"{case['key']}-run{run}.json").write_text(saved, encoding="utf-8")

    snapshot = {field: result[field] for field in ("summary", "description", "status")}
    assert snapshot == case["input"], f"{case['key']} changed in Jira. Update the golden first."

    # 1. The model found the same criteria a human counted: none missed, none invented
    found = [c["text"] for c in result["criteria"]]
    expected = case["expected"]["criteria"]
    assert len(found) == len(expected), f"found {len(found)} criteria, expected {len(expected)}: {found}"

    # 2. Every criterion is covered by at least one test case
    covered = {ac for tc in result["cases"] for ac in tc["covers"]}
    uncovered = [c["id"] for c in result["criteria"] if c["id"] not in covered]
    assert not uncovered, f"criteria with no test case: {uncovered}"
