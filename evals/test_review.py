import json
from pathlib import Path

import pytest
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, SingleTurnParams
from dotenv import load_dotenv

from run_cli import REPO_ROOT, run_review

load_dotenv(REPO_ROOT / ".env")

GOLDENS_FILE = Path(__file__).parent / "goldens" / "review.json"
GOLDENS = json.loads(GOLDENS_FILE.read_text(encoding="utf-8"))

grounded_blocking = GEval(
    name="Grounded Blocking findings",
    evaluation_steps=[
        "List every finding in the actual output marked as Blocking.",
        "For each one, check that it points to something the story in the input says, "
        "or to core behaviour the story is about but clearly does not define.",
        "A Blocking finding is not real if it is invented, generic (it would apply to any story), "
        "repeats the root cause of another Blocking finding, or is only a missing extra case "
        "or unspecified wording (that is a Question, not Blocking).",
        "The score is the share of Blocking findings that are real.",
    ],
    evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
    model="gpt-5.5-2026-04-23",
)


@pytest.mark.parametrize("case", GOLDENS, ids=lambda case: case["key"])
def test_review(case):
    result = run_review(case["key"])

    snapshot = {field: result[field] for field in ("summary", "description", "status")}
    assert snapshot == case["input"], f"{case['key']} changed in Jira. Update the golden first."

    assert result["verdict"] == case["expected"]["verdict"]

    if result["verdict"] == "Not ready":
        test_case = LLMTestCase(
            input=f"{result['summary']}\n\n{result['description']}",
            actual_output=result["review"],
        )
        grounded_blocking.measure(test_case)
        print(f"\n{case['key']} score: {grounded_blocking.score}")
        print(f"reason: {grounded_blocking.reason}")
        assert grounded_blocking.is_successful(), grounded_blocking.reason
