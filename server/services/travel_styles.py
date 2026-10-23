"""Travel-style profiles: score weights plus hard constraints, kept as data.

Ported from OptiRoute's named weight profiles. Each style is one entry in
TRAVEL_STYLE_PROFILES and no other code branches on the style. Photographer
keeps Scout's default weights and no constraints, so it ranks places the
same way as a request without a travel style.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from server.services.constraints import HardConstraints
from server.services.scorer import DEFAULT_WEIGHTS, ScoreWeights


class TravelStyle(str, Enum):
    PHOTOGRAPHER = "photographer"
    SIGHTSEEING = "sightseeing"
    FAMILY = "family"
    BUDGET = "budget"
    ACCESSIBLE = "accessible"


@dataclass(frozen=True)
class TravelStyleProfile:
    weights: ScoreWeights
    constraints: HardConstraints


TRAVEL_STYLE_PROFILES: dict[TravelStyle, TravelStyleProfile] = {
    TravelStyle.PHOTOGRAPHER: TravelStyleProfile(weights=DEFAULT_WEIGHTS, constraints=HardConstraints()),
    # Light matters less than getting in: skip places tagged as closed now.
    TravelStyle.SIGHTSEEING: TravelStyleProfile(
        weights=ScoreWeights(light=0.15, weather=0.30, crowd=0.20, access=0.35),
        constraints=HardConstraints(open_now=True),
    ),
    # Comfortable weather and easy access, open now, and a short walk.
    TravelStyle.FAMILY: TravelStyleProfile(
        weights=ScoreWeights(light=0.10, weather=0.35, crowd=0.20, access=0.35),
        constraints=HardConstraints(open_now=True, max_walk_miles=1.5),
    ),
    # Only places without a tagged entry fee.
    TravelStyle.BUDGET: TravelStyleProfile(
        weights=ScoreWeights(light=0.25, weather=0.30, crowd=0.15, access=0.30),
        constraints=HardConstraints(free_only=True),
    ),
    # Access dominates, and places tagged wheelchair=no are dropped.
    TravelStyle.ACCESSIBLE: TravelStyleProfile(
        weights=ScoreWeights(light=0.15, weather=0.25, crowd=0.15, access=0.45),
        constraints=HardConstraints(wheelchair_required=True),
    ),
}
