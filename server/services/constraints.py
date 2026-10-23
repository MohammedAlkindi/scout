"""Hard constraints that remove places and say why.

Ported from OptiRoute's ConstraintEngine. Unlike score components, a hard
constraint is not traded off: a place that fails one is dropped from the
ranking and returned with its reasons. A constraint only rejects a place
when OpenStreetMap tags the fact it checks, so an untagged fee, unknown
opening hours, or untagged wheelchair access never removes a place.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from server.services.locations import LocationCandidate
from server.services.opening_hours import is_open


@dataclass(frozen=True)
class HardConstraints:
    free_only: bool = False
    open_now: bool = False
    wheelchair_required: bool = False
    # Scout measures straight-line distance from the start point.
    max_walk_miles: Optional[float] = None


def rejection_reasons(
    candidate: LocationCandidate,
    constraints: HardConstraints,
    local_time: Optional[datetime],
) -> list[str]:
    """Every constraint the place fails, empty when it passes.

    `local_time` is the wall-clock time at the place. When it is None the
    open-now check is skipped, because opening hours are local.
    """
    reasons: list[str] = []
    if constraints.free_only and candidate.fee is True:
        reasons.append("OpenStreetMap tags an entry fee here, and this travel style keeps only free places.")
    if (
        constraints.open_now
        and local_time is not None
        and candidate.opening_hours is not None
        and is_open(candidate.opening_hours, local_time) is False
    ):
        reasons.append(f'Closed at {local_time:%a %H:%M} local time (opening_hours "{candidate.opening_hours}").')
    if constraints.wheelchair_required and candidate.wheelchair == "no":
        reasons.append("OpenStreetMap tags this place as not wheelchair accessible.")
    if constraints.max_walk_miles is not None and candidate.distance_miles > constraints.max_walk_miles:
        reasons.append(
            f"{candidate.distance_miles:.1f} mi in a straight line from the start point, "
            f"beyond the {constraints.max_walk_miles:.1f} mi walking limit."
        )
    return reasons
