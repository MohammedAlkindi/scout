"""Unit tests for server.services.opening_hours."""

from datetime import datetime
from typing import Optional

import pytest

from server.services.opening_hours import is_open, parse_opening_hours

# 2026-10-23 is a Friday.
FRIDAY_10_30 = datetime(2026, 10, 23, 10, 30)
FRIDAY_18_00 = datetime(2026, 10, 23, 18, 0)
SATURDAY_01_00 = datetime(2026, 10, 24, 1, 0)
SATURDAY_12_00 = datetime(2026, 10, 24, 12, 0)


@pytest.mark.parametrize(
    ("hours", "local_time", "expected"),
    [
        ("24/7", FRIDAY_18_00, True),
        ("Mo-Fr 09:00-17:00", FRIDAY_10_30, True),
        ("Mo-Fr 09:00-17:00", FRIDAY_18_00, False),
        ("Mo-Fr 09:00-17:00", SATURDAY_12_00, False),
        ("09:00-17:00", SATURDAY_12_00, True),
        ("Mo-Su 09:00-17:00; Sa off", SATURDAY_12_00, False),
        ("Mo-Fr 08:00-10:00, 16:00-19:00", FRIDAY_18_00, True),
        ("Mo-Fr 08:00-10:00, 16:00-19:00", FRIDAY_10_30, False),
        ("Fr 20:00-02:00", SATURDAY_01_00, True),
        ("Fr 20:00-02:00", SATURDAY_12_00, False),
        ("Fr-Mo 10:00-14:00", SATURDAY_12_00, True),
        ("Sa,Su 10:00-14:00", FRIDAY_10_30, False),
        ("Mo-Fr 09:00-17:00; PH off", FRIDAY_10_30, None),
        ("sunrise-sunset", FRIDAY_10_30, None),
        ("Jan-Mar 09:00-17:00", FRIDAY_10_30, None),
        ("Mo-Fr", FRIDAY_10_30, None),
        ("Mo-Fr 25:00-26:00", FRIDAY_10_30, None),
    ],
)
def test_is_open(hours: str, local_time: datetime, expected: Optional[bool]) -> None:
    assert is_open(hours, local_time) is expected


def test_later_rule_replaces_earlier_rule_for_named_days() -> None:
    schedule = parse_opening_hours("Mo-Su 09:00-17:00; Su 12:00-15:00")

    assert schedule is not None
    assert schedule[0] == [(540, 1020)]
    assert schedule[6] == [(720, 900)]
