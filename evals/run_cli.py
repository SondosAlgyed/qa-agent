import json
import os
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOOL_DIR = Path(os.environ.get("QA_TOOL_DIR", REPO_ROOT)).resolve()


def run_cli(command: str, key: str) -> dict:
    result = subprocess.run(
        [shutil.which("npx"), "tsx", "src/cli.ts", command, key, "--json"],
        cwd=TOOL_DIR,
        capture_output=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"qa {command} {key} failed:\n{result.stderr}")
    return json.loads(result.stdout)


def run_review(key: str) -> dict:
    return run_cli("review", key)


def run_cases(key: str) -> dict:
    return run_cli("cases", key)
