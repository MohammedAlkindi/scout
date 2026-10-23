"""Grounded travel-plan explanations.

Ported from OptiRoute's ExplanationContext. The context holds only values
the scorer and constraint engine computed, and render() states only those
values. tests/test_explanation_grounding.py fails if the text ever carries a
number that is not in the context.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from server.services.ranking import RankedPlace
from server.services.scorer import ScoreBreakdown, ScoreWeights


@dataclass(frozen=True)
class ExplanationContext:
    travel_style: str
    weights: ScoreWeights
    place_count: int
    rejected_count: int
    top_name: Optional[str] = None
    top_score: Optional[int] = None
    top_breakdown: Optional[ScoreBreakdown] = None
    runner_up_name: Optional[str] = None
    runner_up_score: Optional[int] = None

    @classmethod
    def from_ranking(
        cls, travel_style: str, weights: ScoreWeights, ranked: list[RankedPlace], rejected_count: int
    ) -> ExplanationContext:
        top = ranked[0] if ranked else None
        runner_up = ranked[1] if len(ranked) > 1 else None
        return cls(
            travel_style=travel_style,
            weights=weights,
            place_count=len(ranked) + rejected_count,
            rejected_count=rejected_count,
            top_name=top.candidate.name if top else None,
            top_score=top.result.score if top else None,
            top_breakdown=top.result.breakdown if top else None,
            runner_up_name=runner_up.candidate.name if runner_up else None,
            runner_up_score=runner_up.result.score if runner_up else None,
        )

    def render(self) -> str:
        w = self.weights
        sentences = [
            f"The {self.travel_style} style weighs light {w.light:.2f}, weather {w.weather:.2f}, "
            f"crowd {w.crowd:.2f} and access {w.access:.2f}."
        ]
        if self.top_name is not None and self.top_breakdown is not None:
            b = self.top_breakdown
            sentences.append(
                f"{self.top_name} ranks first with a score of {self.top_score} "
                f"(light {b.light:.1f}, weather {b.weather:.1f}, crowd {b.crowd:.1f}, access {b.access:.1f})."
            )
        else:
            sentences.append("No place passed the hard constraints.")
        if self.runner_up_name is not None:
            sentences.append(f"The runner-up is {self.runner_up_name} with a score of {self.runner_up_score}.")
        if self.rejected_count:
            verb = "was" if self.rejected_count == 1 else "were"
            sentences.append(f"{self.rejected_count} of {self.place_count} places {verb} removed by hard constraints.")
        else:
            sentences.append("No place was removed by hard constraints.")
        return " ".join(sentences)
