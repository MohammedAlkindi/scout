"""Unit tests for server.services.travel_plan, using tests/golden/places.json."""

from server.services.ranking import Bucket, rank_places
from server.services.travel_plan import plan_travel
from server.services.travel_styles import TravelStyle
from tests.place_fixtures import LOCAL_TIME, SHOT_TYPE, places, window_contexts


def _names(plan_places: list) -> list[str]:
    return [place.candidate.name for place in plan_places]


def test_photographer_plan_matches_the_default_ranking() -> None:
    plan = plan_travel(places(), window_contexts(), SHOT_TYPE, TravelStyle.PHOTOGRAPHER, LOCAL_TIME)
    default = rank_places(places(), window_contexts(), SHOT_TYPE)

    assert plan.ranked == default
    assert plan.rejected == []


def test_rejected_places_leave_the_ranking_with_reasons() -> None:
    plan = plan_travel(places(), window_contexts(), SHOT_TYPE, TravelStyle.BUDGET, LOCAL_TIME)

    assert _names(plan.rejected) == ["Old Fort Museum", "Beach Club"]
    assert all(rejected.reasons for rejected in plan.rejected)
    assert not set(_names(plan.rejected)) & set(_names(plan.ranked))
    assert len(plan.ranked) + len(plan.rejected) == len(places())


def test_open_now_is_skipped_without_a_local_time() -> None:
    plan = plan_travel(places(), window_contexts(), SHOT_TYPE, TravelStyle.SIGHTSEEING, None)

    assert plan.rejected == []


def test_style_weights_change_the_ranking() -> None:
    photographer = plan_travel(places(), window_contexts(), SHOT_TYPE, TravelStyle.PHOTOGRAPHER, LOCAL_TIME)
    accessible = plan_travel(places(), window_contexts(), SHOT_TYPE, TravelStyle.ACCESSIBLE, LOCAL_TIME)

    assert _names(photographer.ranked)[1] == "Ridge Summit"
    assert _names(accessible.ranked).index("Ridge Summit") > 1


def test_plan_buckets_come_from_the_kept_places() -> None:
    plan = plan_travel(places(), window_contexts(), SHOT_TYPE, TravelStyle.SIGHTSEEING, LOCAL_TIME)

    assert plan.buckets[Bucket.BEST_OVERALL] == plan.ranked[0]
    assert plan.buckets[Bucket.RAINY_DAY].candidate.name == "Covered Souq"
