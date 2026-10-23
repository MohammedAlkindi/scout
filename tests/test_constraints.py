"""Unit tests for server.services.constraints."""

from dataclasses import replace
from datetime import datetime

from server.services.constraints import HardConstraints, rejection_reasons
from server.services.locations import LocationCandidate
from server.services.scorer import CrowdLevel

FRIDAY_18_00 = datetime(2026, 10, 23, 18, 0)

_PLACE = LocationCandidate(
    name="Old Fort Museum",
    latitude=23.6,
    longitude=58.4,
    distance_miles=2.4,
    terrain_type="landmark",
    accessibility_notes="not wheelchair accessible",
    accessibility_difficulty=0.7,
    permit_required=True,
    permit_notes="a fee is charged at this location per OSM data",
    crowd_level=CrowdLevel.MEDIUM,
    osm_id=7,
    image_url=None,
    image_attribution=None,
    fee=True,
    opening_hours="Mo-Fr 09:00-17:00",
    wheelchair="no",
)

_ALL = HardConstraints(free_only=True, open_now=True, wheelchair_required=True, max_walk_miles=1.5)


def test_no_constraints_reject_nothing() -> None:
    assert rejection_reasons(_PLACE, HardConstraints(), FRIDAY_18_00) == []


def test_every_failed_constraint_has_a_reason() -> None:
    reasons = rejection_reasons(_PLACE, _ALL, FRIDAY_18_00)

    assert reasons == [
        "OpenStreetMap tags an entry fee here, and this travel style keeps only free places.",
        'Closed at Fri 18:00 local time (opening_hours "Mo-Fr 09:00-17:00").',
        "OpenStreetMap tags this place as not wheelchair accessible.",
        "2.4 mi in a straight line from the start point, beyond the 1.5 mi walking limit.",
    ]


def test_missing_tags_never_reject() -> None:
    untagged = replace(_PLACE, fee=None, opening_hours=None, wheelchair=None, distance_miles=1.5)

    assert rejection_reasons(untagged, _ALL, FRIDAY_18_00) == []


def test_open_now_needs_a_local_time_and_supported_hours() -> None:
    open_now = HardConstraints(open_now=True)

    assert rejection_reasons(_PLACE, open_now, None) == []
    assert rejection_reasons(replace(_PLACE, opening_hours="sunrise-sunset"), open_now, FRIDAY_18_00) == []
    assert rejection_reasons(_PLACE, open_now, datetime(2026, 10, 23, 10, 0)) == []


def test_free_and_limited_access_places_pass() -> None:
    place = replace(_PLACE, fee=False, wheelchair="limited")

    assert rejection_reasons(place, HardConstraints(free_only=True, wheelchair_required=True), FRIDAY_18_00) == []
