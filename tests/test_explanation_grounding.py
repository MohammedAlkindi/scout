"""Explanation grounding, ported from OptiRoute's test_explanation_grounding.py.

The contract: a travel-plan explanation may only repeat values in its
ExplanationContext, and every context value comes from the scorer or the
constraint engine. A number in the text that is not in the context fails.
"""

import re
from dataclasses import fields

import pytest

from server.services.explanations import ExplanationContext
from server.services.ranking import rank_places
from server.services.scorer import DEFAULT_WEIGHTS, ScoreBreakdown, ScoreWeights
from server.services.travel_plan import plan_travel
from server.services.travel_styles import TRAVEL_STYLE_PROFILES, TravelStyle
from tests.place_fixtures import LOCAL_TIME, SHOT_TYPE, places, window_contexts

_NUMBER = re.compile(r"\d+(?:\.\d+)?")


def _context_numbers(context: ExplanationContext) -> set[float]:
    numbers: set[float] = set()
    for field in fields(context):
        value = getattr(context, field.name)
        if isinstance(value, (ScoreWeights, ScoreBreakdown)):
            numbers.update(getattr(value, part.name) for part in fields(value))
        elif isinstance(value, (int, float)) and not isinstance(value, bool):
            numbers.add(float(value))
    return numbers


def _ungrounded_numbers(context: ExplanationContext) -> list[str]:
    text = context.render()
    for name in (context.top_name, context.runner_up_name):
        if name:
            text = text.replace(name, "")
    allowed = _context_numbers(context)
    return [token for token in _NUMBER.findall(text) if float(token) not in allowed]


@pytest.mark.parametrize("style", list(TravelStyle))
def test_fixture_plan_explanations_only_repeat_context_values(style: TravelStyle) -> None:
    plan = plan_travel(places(), window_contexts(), SHOT_TYPE, style, LOCAL_TIME)
    context = ExplanationContext.from_ranking(
        style.value, TRAVEL_STYLE_PROFILES[style].weights, plan.ranked, len(plan.rejected)
    )

    assert plan.explanation == context.render()
    assert _ungrounded_numbers(context) == []


def test_context_copies_the_top_two_places() -> None:
    ranked = rank_places(places(), window_contexts(), SHOT_TYPE)
    context = ExplanationContext.from_ranking("photographer", DEFAULT_WEIGHTS, ranked, rejected_count=2)

    assert (context.top_name, context.top_score, context.top_breakdown) == (
        ranked[0].candidate.name,
        ranked[0].result.score,
        ranked[0].result.breakdown,
    )
    assert (context.runner_up_name, context.runner_up_score) == (ranked[1].candidate.name, ranked[1].result.score)
    assert context.place_count == len(ranked) + 2


def test_single_place_has_no_runner_up() -> None:
    ranked = rank_places(places()[:1], window_contexts(), SHOT_TYPE)
    context = ExplanationContext.from_ranking("budget", DEFAULT_WEIGHTS, ranked, rejected_count=0)

    assert context.runner_up_name is None
    assert "runner-up" not in context.render()
    assert _ungrounded_numbers(context) == []


def test_all_places_rejected_states_no_scores() -> None:
    context = ExplanationContext.from_ranking("family", DEFAULT_WEIGHTS, [], rejected_count=7)
    text = context.render()

    assert "No place passed the hard constraints." in text
    assert "7 of 7 places were removed" in text
    assert _ungrounded_numbers(context) == []


def test_an_invented_number_is_caught() -> None:
    ranked = rank_places(places(), window_contexts(), SHOT_TYPE)
    context = ExplanationContext.from_ranking("photographer", DEFAULT_WEIGHTS, ranked, rejected_count=0)
    text = context.render() + " It is 12 minutes away."

    allowed = _context_numbers(context)
    assert [token for token in _NUMBER.findall(text) if float(token) not in allowed] == ["12"]
