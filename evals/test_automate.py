import json
import os
import shutil
import subprocess
from datetime import date
from pathlib import Path

import pytest

from run_cli import LABEL, REPO_ROOT, TOOL_DIR

GOLDENS_FILE = Path(__file__).parent / "goldens" / "automate.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))
PROMPT_FILE = "src/automate/prompt.ts"
RUNS = range(1, int(os.environ.get("QA_EVAL_RUNS", "1")) + 1)
# The tester's project the agent works in (same as repo in qa.config.ts)
TARGET = Path(os.environ.get("QA_TARGET_REPO", REPO_ROOT.parent / "toolshop-tests")).resolve()


def git(cwd: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=cwd, capture_output=True, encoding="utf-8", check=True)
    return result.stdout.strip()


def prompt_version() -> str:
    commit = git(TOOL_DIR, "log", "-1", "--format=%h", "--", PROMPT_FILE)
    changed = git(TOOL_DIR, "status", "--porcelain", "--", PROMPT_FILE)
    return f"{commit}-dirty" if changed else commit


RUN_DIR = REPO_ROOT / "docs" / "automate-runs" / f"{date.today()}-{prompt_version()}{LABEL}"


def status() -> list[str]:
    # "--untracked-files=all" lists new files one by one, not just their folder
    out = git(TARGET, "status", "--porcelain", "--untracked-files=all")
    return out.splitlines() if out else []


def read_test_case(key: str, case_id: str) -> str:
    md = (TARGET / "test-cases" / f"{key}.md").read_text(encoding="utf-8").replace("\r\n", "\n")
    start = md.index(f"## {case_id}:")
    end = md.find("\n## ", start + 1)
    return md[start:] .strip() if end == -1 else md[start:end].strip()


def run_automate(key: str, case_id: str) -> dict:
    # Not run_cli: automate exits with 1 when its own 3-run check fails, and we
    # still want to read that result
    result = subprocess.run(
        [shutil.which("npx"), "tsx", "src/cli.ts", "automate", key, case_id, "--json"],
        cwd=TOOL_DIR, capture_output=True, encoding="utf-8",
    )
    if not result.stdout.strip().startswith("{"):
        raise RuntimeError(f"qa automate {key} {case_id} failed:\n{result.stderr}")
    return json.loads(result.stdout)


def passes_three_times(test_file: str) -> bool:
    # Our own runs, one at a time (parallel runs overload the demo server)
    result = subprocess.run(
        [shutil.which("npx"), "playwright", "test", test_file, "--project=chromium",
         "--repeat-each=3", "--workers=1", "--reporter=line"],
        cwd=TARGET, capture_output=True, encoding="utf-8",
    )
    return result.returncode == 0


@pytest.mark.parametrize("run", RUNS, ids=lambda run: f"run{run}")
@pytest.mark.parametrize("case", GOLDENS, ids=lambda case: f"{case['key']}-{case['case']}")
def test_automate(case, run):
    key, case_id = case["key"], case["case"]
    assert read_test_case(key, case_id) == case["input"]["test_case"], "The test case changed. Update the golden first."
    assert status() == [], "The target repo has uncommitted changes. Commit or stash them first."

    try:
        result = run_automate(key, case_id)
        changes = status()

        RUN_DIR.mkdir(parents=True, exist_ok=True)
        saved = {**result, "repo_changes": changes}
        (RUN_DIR / f"{key}-{case_id}-run{run}.json").write_text(json.dumps(saved, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\n{key} {case_id}: {result['seconds']}s, {result['turns']} calls, "
              f"{result['inputTokens']} in / {result['outputTokens']} out")

        # 3. Only new files: nothing someone else wrote was changed
        assert all(line.startswith("??") for line in changes), f"existing files were changed: {changes}"

        test_file = result["file"]
        code = (TARGET / test_file).read_text(encoding="utf-8")
        # 5. It ran its test before saying it was done
        assert any(step.startswith("run_test") for step in result["trace"]), "never ran its test"
        # 4. Tagged like the project's tests
        assert case["expected"]["tag"] in code, "missing tag"
        # 2. Reused the existing page object
        assert f"import {{ {case['expected']['page_object']} }}" in code, "didn't reuse the page object"
        # 1. The test passes in our own 3 runs
        assert passes_three_times(test_file), "the test doesn't pass 3 runs in a row"
    finally:
        # Remove only the files this run created, so every case starts clean
        for line in status():
            if line.startswith("??"):
                (TARGET / line[3:].strip()).unlink(missing_ok=True)
