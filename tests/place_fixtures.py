"""Loads the fixed places and light windows in tests/golden/places.json."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from server.services.golden_hour import TimeWindow
from server.services.locations import LocationCandidate
from server.services.ranking import WindowContext
from server.services.scorer import CrowdLevel, LightPhase, ShotType, WeatherSnapshot, WindowLightContext

GOLDEN_DIR = Path(__file__).parent / "golden"
_DATA = json.loads((GOLDEN_DIR / "places.json").read_text(encoding="utf-8"))

SHOT_TYPE = ShotType(_DATA["shot_type"])
LOCAL_TIME = datetime.fromisoformat(_DATA["local_time"])


def places() -> list[LocationCandidate]:
    return [
        LocationCandidate(
            name=place["name"],
            latitude=23.6,
            longitude=58.4,
            distance_miles=place["distance_miles"],
            terrain_type=place["terrain_type"],
            accessibility_notes=place["accessibility_notes"],
            accessibility_difficulty=place["accessibility_difficulty"],
            permit_required=place["permit_required"],
            permit_notes=place["permit_notes"],
            crowd_level=CrowdLevel(place["crowd_level"]),
            osm_id=index,
            image_url=None,
            image_attribution=None,
            fee=place["fee"],
            opening_hours=place["opening_hours"],
            wheelchair=place["wheelchair"],
            indoor=place["indoor"],
        )
        for index, place in enumerate(_DATA["places"], start=1)
    ]


def window_contexts() -> list[WindowContext]:
    return [
        WindowContext(
            window=TimeWindow(
                start=datetime.fromisoformat(window["start_utc"]),
                end=datetime.fromisoformat(window["end_utc"]),
            ),
            light=WindowLightContext(phase=LightPhase(window["phase"]), centrality=window["centrality"]),
            weather=WeatherSnapshot(**window["weather"]),
        )
        for window in _DATA["windows"]
    ]



def window_label(window: TimeWindow) -> str:
    """The fixture label of a window, so golden files stay readable."""
    for entry in _DATA["windows"]:
        if datetime.fromisoformat(entry["start_utc"]) == window.start:
            return str(entry["label"])
    raise KeyError(window.start)
