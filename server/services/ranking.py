"""Rank candidate places across upcoming light windows.

Pure and network-free like scorer.py: callers pass candidates plus the light
phase and weather already resolved for each window, so rankings can be
reproduced from fixed fixtures.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional

from server.services.golden_hour import TimeWindow
from server.services.locations import LocationCandidate
from server.services.scorer import (
    DEFAULT_WEIGHTS,
    LocationConditions,
    ScoreResult,
    ScoreWeights,
    ShotType,
    WeatherSnapshot,
    WindowLightContext,
    score_window,
)


@dataclass(frozen=True)
class WindowContext:
    window: TimeWindow
    light: WindowLightContext
    weather: WeatherSnapshot


@dataclass(frozen=True)
class RankedPlace:
    candidate: LocationCandidate
    window: TimeWindow
    light: WindowLightContext
    weather: WeatherSnapshot
    result: ScoreResult


def rank_places(
    candidates: list[LocationCandidate],
    contexts: list[WindowContext],
    shot_type: ShotType,
    weights: ScoreWeights = DEFAULT_WEIGHTS,
) -> list[RankedPlace]:
    """Keep each candidate's best-scoring window, then sort by score, highest first.

    Ties keep input order: the earlier window for one place, and the earlier
    candidate between places.
    """
    if not contexts:
        raise ValueError("rank_places needs at least one window context")

    ranked: list[RankedPlace] = []
    for candidate in candidates:
        location = LocationConditions(
            name=candidate.name,
            crowd_level=candidate.crowd_level,
            permit_required=candidate.permit_required,
            accessibility_difficulty=candidate.accessibility_difficulty,
            distance_miles=candidate.distance_miles,
        )
        best: Optional[RankedPlace] = None
        for context in contexts:
            result = score_window(location, context.light, context.weather, shot_type, weights)
            if best is None or result.score > best.result.score:
                best = RankedPlace(
                    candidate=candidate,
                    window=context.window,
                    light=context.light,
                    weather=context.weather,
                    result=result,
                )
        assert best is not None  # contexts is non-empty, checked above
        ranked.append(best)

    ranked.sort(key=lambda place: place.result.score, reverse=True)
    return ranked


class Bucket(str, Enum):
    """Named picks from a ranking, ported from OptiRoute's recommendation buckets.

    There is no best-light bucket: the light score depends only on the time
    window, and every place shares the same windows and origin weather, so
    it cannot single out a place.
    """

    BEST_OVERALL = "best_overall"
    FREE = "free"
    RAINY_DAY = "rainy_day"


def rank_buckets(ranked: list[RankedPlace]) -> dict[Bucket, RankedPlace]:
    """The highest-ranked place for each bucket the data supports.

    `free` needs an OSM fee=no tag and `rainy_day` needs indoor=yes or
    covered=yes. A bucket with no qualifying place is left out.
    """
    picks = {
        Bucket.BEST_OVERALL: next(iter(ranked), None),
        Bucket.FREE: next((place for place in ranked if place.candidate.fee is False), None),
        Bucket.RAINY_DAY: next((place for place in ranked if place.candidate.indoor), None),
    }
    return {bucket: place for bucket, place in picks.items() if place is not None}
