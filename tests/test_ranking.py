"""Unit tests for server.services.ranking."""

from datetime import datetime, timedelta, timezone

import pytest

from server.services.golden_hour import TimeWindow
from server.services.locations import LocationCandidate
from server.services.ranking import WindowContext, rank_places
from server.services.scorer import CrowdLevel, LightPhase, ShotType, WeatherSnapshot, WindowLightContext

_START = datetime(2026, 10, 23, 13, 0, tzinfo=timezone.utc)
_CALM = WeatherSnapshot(
    cloud_cover_pct=30.0, wind_speed_mph=5.0, visibility_miles=10.0, precipitation_probability_pct=5.0, temperature_f=70.0
)


def _candidate(name: str, crowd_level: CrowdLevel = CrowdLevel.LOW, distance_miles: float = 0.5) -> LocationCandidate:
    return LocationCandidate(
        name=name,
        latitude=23.6,
        longitude=58.4,
        distance_miles=distance_miles,
        terrain_type="scenic viewpoint",
        accessibility_notes="accessibility unknown -- verify locally",
        accessibility_difficulty=0.25,
        permit_required=False,
        permit_notes=None,
        crowd_level=crowd_level,
        osm_id=1,
        image_url=None,
        image_attribution=None,
    )


def _context(phase: LightPhase, offset_minutes: int) -> WindowContext:
    start = _START + timedelta(minutes=offset_minutes)
    return WindowContext(
        window=TimeWindow(start=start, end=start + timedelta(minutes=30)),
        light=WindowLightContext(phase=phase),
        weather=_CALM,
    )


def test_each_place_keeps_its_best_window() -> None:
    blue = _context(LightPhase.BLUE_HOUR, 0)
    golden = _context(LightPhase.GOLDEN_HOUR, 60)

    ranked = rank_places([_candidate("Harbor Viewpoint")], [blue, golden], ShotType.LANDSCAPE)

    assert len(ranked) == 1
    assert ranked[0].light.phase == LightPhase.GOLDEN_HOUR
    assert ranked[0].window == golden.window


def test_places_sort_by_score_and_ties_keep_input_order() -> None:
    contexts = [_context(LightPhase.GOLDEN_HOUR, 0)]
    candidates = [
        _candidate("Busy Square", crowd_level=CrowdLevel.HIGH),
        _candidate("Quiet Cove"),
        _candidate("Quiet Ridge"),
    ]

    ranked = rank_places(candidates, contexts, ShotType.LANDSCAPE)

    assert [place.candidate.name for place in ranked] == ["Quiet Cove", "Quiet Ridge", "Busy Square"]


def test_rank_places_requires_a_window() -> None:
    with pytest.raises(ValueError):
        rank_places([_candidate("Harbor Viewpoint")], [], ShotType.LANDSCAPE)
