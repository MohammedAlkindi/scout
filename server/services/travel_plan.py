"""Travel plan: hard constraints, a style-weighted ranking, buckets and a grounded summary.

Pure and network-free. Orchestration fetches places, weather and the local
time, then calls plan_travel(), and tests replay it from fixed fixtures.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from server.services.constraints import rejection_reasons
from server.services.explanations import ExplanationContext
from server.services.locations import LocationCandidate
from server.services.ranking import Bucket, RankedPlace, WindowContext, rank_buckets, rank_places
from server.services.scorer import ShotType
from server.services.travel_styles import TRAVEL_STYLE_PROFILES, TravelStyle, TravelStyleProfile


@dataclass(frozen=True)
class RejectedPlace:
    candidate: LocationCandidate
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class TravelPlan:
    style: TravelStyle
    profile: TravelStyleProfile
    ranked: list[RankedPlace]
    rejected: list[RejectedPlace]
    buckets: dict[Bucket, RankedPlace]
    explanation: str


def plan_travel(
    candidates: list[LocationCandidate],
    contexts: list[WindowContext],
    shot_type: ShotType,
    style: TravelStyle,
    local_time: Optional[datetime],
) -> TravelPlan:
    """Drop places that fail the style's constraints, then rank the rest with its weights."""
    profile = TRAVEL_STYLE_PROFILES[style]
    kept: list[LocationCandidate] = []
    rejected: list[RejectedPlace] = []
    for candidate in candidates:
        reasons = rejection_reasons(candidate, profile.constraints, local_time)
        if reasons:
            rejected.append(RejectedPlace(candidate=candidate, reasons=tuple(reasons)))
        else:
            kept.append(candidate)

    ranked = rank_places(kept, contexts, shot_type, profile.weights)
    context = ExplanationContext.from_ranking(style.value, profile.weights, ranked, len(rejected))
    return TravelPlan(
        style=style,
        profile=profile,
        ranked=ranked,
        rejected=rejected,
        buckets=rank_buckets(ranked),
        explanation=context.render(),
    )
