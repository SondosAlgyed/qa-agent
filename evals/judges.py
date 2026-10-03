from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCase, SingleTurnParams
from dotenv import load_dotenv

from run_cli import REPO_ROOT

load_dotenv(REPO_ROOT / ".env")

grounded_blocking = GEval(
    name="Grounded Blocking findings",
    evaluation_steps=[
        "List every finding in the actual output marked as Blocking.",
        "For each one, check that it points to something the story in the input says, "
        "or to core behaviour the story is about but clearly does not define.",
        "A Blocking finding is not real if it is invented, generic (it would apply to any story), "
        "or is only a missing extra case or unspecified wording (that is a Question, not Blocking).",
        "The score is the share of Blocking findings that are real.",
    ],
    evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
    model="gpt-5.5-2026-04-23",
)


def judge_blocking(summary: str, description: str, review: str) -> tuple[float, str]:
    test_case = LLMTestCase(input=f"{summary}\n\n{description}", actual_output=review)
    grounded_blocking.measure(test_case)
    return grounded_blocking.score, grounded_blocking.reason
