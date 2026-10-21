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


no_invented_requirements = GEval(
    name="No invented requirements",
    evaluation_steps=[
        "The input is a user story. The actual output is test cases written for it.",
        "For each test case, check its preconditions and expected result against the story.",
        "A test case invents a requirement if it states as expected behaviour something the story "
        "does not say and does not clearly imply: a specific option, rule, message text, or a choice "
        "between two reasonable readings, without marking it as not specified in the story.",
        "Saying that something is 'not specified in the story' is not inventing. "
        "Ordinary setup needed to run the test is not inventing.",
        "The score is the share of test cases that invent nothing.",
    ],
    evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
    model="gpt-5.5-2026-04-23",
)


def judge_invented(summary: str, description: str, cases_text: str) -> tuple[float, str]:
    test_case = LLMTestCase(input=f"{summary}\n\n{description}", actual_output=cases_text)
    no_invented_requirements.measure(test_case)
    return no_invented_requirements.score, no_invented_requirements.reason


def judge_blocking(summary: str, description: str, review: str) -> tuple[float, str]:
    test_case = LLMTestCase(input=f"{summary}\n\n{description}", actual_output=review)
    grounded_blocking.measure(test_case)
    return grounded_blocking.score, grounded_blocking.reason
