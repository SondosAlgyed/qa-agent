import hashlib
import json
import os
import subprocess
from datetime import date
from pathlib import Path

import pytest

from run_cli import LABEL, REPO_ROOT, TOOL_DIR, run_cli

GOLDENS_FILE = Path(__file__).parent / "goldens" / "triage.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))
PROMPT_FILE = "src/triage/triage.ts"
RUNS = range(1, int(os.environ.get("QA_EVAL_RUNS", "1")) + 1)
# The tester's project the failing tests live in (same as repo in qa.config.ts)
TARGET = Path(os.environ.get("QA_TARGET_REPO", REPO_ROOT.parent / "toolshop-tests")).resolve()


def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=TOOL_DIR, capture_output=True, encoding="utf-8", check=True)
    return result.stdout.strip()


def prompt_version() -> str:
    commit = git("log", "-1", "--format=%h", "--", PROMPT_FILE)
    changed = git("status", "--porcelain", "--", PROMPT_FILE)
    return f"{commit}-dirty" if changed else commit


RUN_DIR = REPO_ROOT / "docs" / "triage-runs" / f"{date.today()}-{prompt_version()}{LABEL}"

# One qa triage call per run covers every failure in the run file, so the cases share it
_triaged: dict[int, dict] = {}


def triaged(run: int) -> dict:
    if run not in _triaged:
        result = run_cli("triage", str(REPO_ROOT / GOLDENS["cases"][0]["input"]["run_file"]))
        RUN_DIR.mkdir(parents=True, exist_ok=True)
        (RUN_DIR / f"run{run}.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
        _triaged[run] = {f"{t['test']['file']}:{t['test']['line']}": t for t in result}
    return _triaged[run]


def code_sha256(file: str) -> str:
    # The same way the golden was made: the file's bytes, with Windows line endings as \n
    return hashlib.sha256((TARGET / file).read_bytes().replace(b"\r\n", b"\n")).hexdigest()


@pytest.mark.parametrize("run", RUNS, ids=lambda run: f"run{run}")
@pytest.mark.parametrize("case", GOLDENS["cases"], ids=lambda case: case["id"])
def test_triage(case, run):
    file = case["id"].rsplit(":", 1)[0]
    assert code_sha256(file) == case["input"]["code_sha256"], f"{file} changed since it was labelled. Check the label first."

    result = triaged(run).get(case["id"])
    assert result, f"qa triage didn't return {case['id']}"
    triage = result["triage"]

    # 1. The category matches my label (or a borderline alternative I accepted)
    accepted = [case["expected"]["category"], *case["expected"]["also_accepted"]]
    assert triage["category"] in accepted, f"got {triage['category']} ({triage['confidence']}), expected {accepted}: {triage['reason']}"
    # 2. It names the evidence its decision rests on
    assert triage["evidence"].strip(), "no evidence quoted"
