"""Golden-file regression tests for rankings, ported from OptiRoute's evaluation harness.

Each case replays the fixed places in tests/golden/places.json through the
functions the recommendation flow uses, and compares the whole result with
tests/golden/ranking_cases.json: order, scores, chosen windows, rejections
with reasons, buckets and the explanation. Any ranking change fails here.

After an intended change, regenerate the expected file and review its diff:

    SCOUT_UPDATE_GOLDEN=1 python -m pytest tests/test_golden_rankings.py
"""

from __future__ import annotations

import json
import os
from typing import Any, Optional

import pytest

from server.services.ranking import RankedPlace, rank_places
from server.services.travel_plan import plan_travel
from server.services.travel_styles import TravelStyle
from tests.place_fixtures import GOLDEN_DIR, LOCAL_TIME, SHOT_TYPE, places, window_contexts, window_label

CASES_PATH = GOLDEN_DIR / "ranking_cases.json"
# "default" is a request without travel_style.
CASES: dict[str, Optional[TravelStyle]] = {"default": None, **{style.value: style for style in TravelStyle}}


def _ranked_entry(place: RankedPlace) -> dict[str, Any]:
    breakdown = place.result.breakdown
    return {
        "name": place.candidate.name,
        "score": place.result.score,
        "window": window_label(place.window),
        "breakdown": {
            "light": breakdown.light,
            "weather": breakdown.weather,
            "crowd": breakdown.crowd,
            "access": breakdown.access,
        },
    }


def run_case(case_id: str) -> dict[str, Any]:
    style = CASES[case_id]
    if style is None:
        return {"ranked": [_ranked_entry(place) for place in rank_places(places(), window_contexts(), SHOT_TYPE)]}
    plan = plan_travel(places(), window_contexts(), SHOT_TYPE, style, LOCAL_TIME)
    return {
        "ranked": [_ranked_entry(place) for place in plan.ranked],
        "rejected": [{"name": item.candidate.name, "reasons": list(item.reasons)} for item in plan.rejected],
        "buckets": {bucket.value: place.candidate.name for bucket, place in plan.buckets.items()},
        "explanation": plan.explanation,
    }


@pytest.fixture(scope="module")
def expected() -> dict[str, Any]:
    if os.environ.get("SCOUT_UPDATE_GOLDEN") == "1":
        cases = {case_id: run_case(case_id) for case_id in CASES}
        CASES_PATH.write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")
    return json.loads(CASES_PATH.read_text(encoding="utf-8"))


def test_golden_file_has_every_case(expected: dict[str, Any]) -> None:
    assert list(expected) == list(CASES)


@pytest.mark.parametrize("case_id", list(CASES))
def test_ranking_matches_golden_file(case_id: str, expected: dict[str, Any]) -> None:
    assert run_case(case_id) == expected[case_id]


def test_photographer_case_matches_the_default_ranking(expected: dict[str, Any]) -> None:
    assert expected["photographer"]["ranked"] == expected["default"]["ranked"]
