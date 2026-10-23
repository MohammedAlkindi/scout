"""Check a common subset of the OpenStreetMap opening_hours syntax.

Supported: "24/7", and rules separated by ";" that start with an optional
weekday selector (Mo-Fr, Sa,Su, Fr-Mo) followed by time spans
(09:00-17:00, 10:00-12:00,14:00-18:00) or "off"/"closed". As in the OSM
specification, a later rule replaces earlier ones for the days it names,
days no rule names are closed, and a span may run past midnight
(22:00-02:00).

Anything else (months, public holidays, sunrise, comments) returns None,
so callers treat the hours as unknown instead of guessing.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

_DAYS = ("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
_MINUTES_PER_DAY = 24 * 60
_TIME = re.compile(r"^(\d{1,2}):(\d{2})$")

# Weekday (0 = Monday) to open spans in minutes after local midnight. An
# overnight span ends past _MINUTES_PER_DAY.
Schedule = dict[int, list[tuple[int, int]]]


def _parse_days(selector: str) -> Optional[set[int]]:
    days: set[int] = set()
    for part in selector.split(","):
        first, _, last = part.partition("-")
        if first not in _DAYS or (last and last not in _DAYS):
            return None
        day = _DAYS.index(first)
        end = _DAYS.index(last) if last else day
        days.add(day)
        while day != end:
            day = (day + 1) % 7
            days.add(day)
    return days


def _parse_minutes(text: str) -> Optional[int]:
    match = _TIME.match(text)
    if match is None:
        return None
    hours, minutes = int(match.group(1)), int(match.group(2))
    if minutes > 59 or hours > 24 or (hours == 24 and minutes > 0):
        return None
    return hours * 60 + minutes


def _parse_spans(text: str) -> Optional[list[tuple[int, int]]]:
    if text in ("off", "closed"):
        return []
    spans: list[tuple[int, int]] = []
    for part in text.split(","):
        start_text, separator, end_text = part.partition("-")
        start = _parse_minutes(start_text)
        end = _parse_minutes(end_text)
        if not separator or start is None or end is None:
            return None
        if end <= start:
            end += _MINUTES_PER_DAY
        spans.append((start, end))
    return spans


def parse_opening_hours(value: str) -> Optional[Schedule]:
    """Weekly schedule for a supported opening_hours value, otherwise None."""
    text = value.strip()
    if text == "24/7":
        return {day: [(0, _MINUTES_PER_DAY)] for day in range(7)}

    schedule: Schedule = {}
    for rule in (part.strip() for part in text.split(";")):
        if not rule:
            continue
        selector, _, rest = rule.partition(" ")
        days: Optional[set[int]] = set(range(7))
        times = rule
        if selector[:2] in _DAYS:
            days = _parse_days(selector)
            times = rest
        spans = _parse_spans(times.replace(" ", ""))
        if days is None or spans is None:
            return None
        for day in days:
            schedule[day] = spans
    return schedule


def is_open(value: str, local_time: datetime) -> Optional[bool]:
    """Whether a place is open at a local wall-clock time, or None if the hours are unsupported."""
    schedule = parse_opening_hours(value)
    if schedule is None:
        return None
    day = local_time.weekday()
    minute = local_time.hour * 60 + local_time.minute
    if any(start <= minute < end for start, end in schedule.get(day, [])):
        return True
    previous_day = (day - 1) % 7
    return any(minute + _MINUTES_PER_DAY < end for _, end in schedule.get(previous_day, []))
