"""Unit tests for server.services.travel_styles."""

import pytest

from server.services.constraints import HardConstraints
from server.services.scorer import DEFAULT_WEIGHTS
from server.services.travel_styles import TRAVEL_STYLE_PROFILES, TravelStyle


def test_every_style_has_a_profile() -> None:
    assert set(TRAVEL_STYLE_PROFILES) == set(TravelStyle)


@pytest.mark.parametrize("style", list(TravelStyle))
def test_profile_weights_sum_to_one(style: TravelStyle) -> None:
    weights = TRAVEL_STYLE_PROFILES[style].weights

    assert weights.light + weights.weather + weights.crowd + weights.access == pytest.approx(1.0)


def test_photographer_profile_is_the_default_ranking() -> None:
    profile = TRAVEL_STYLE_PROFILES[TravelStyle.PHOTOGRAPHER]

    assert profile.weights == DEFAULT_WEIGHTS
    assert profile.constraints == HardConstraints()
