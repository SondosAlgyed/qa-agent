import json
import os
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOOL_DIR = Path(os.environ.get("QA_TOOL_DIR", REPO_ROOT)).resolve()


def run_review(key: str) -> dict:
    result = subprocess.run(
        [shutil.which("npx"), "tsx", "src/cli.ts", "review", key, "--json"],
        cwd=TOOL_DIR,
        capture_output=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise RuntimeError(f"qa review {key} failed:\n{result.stderr}")
    return json.loads(result.stdout)
