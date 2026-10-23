"""Unit tests for Open-Meteo response parsing in server.services.weather."""

import pytest

from server.errors import UpstreamServiceError
from server.services.weather import _parse_utc_offset


def test_utc_offset_comes_from_open_meteo_metadata() -> None:
    assert _parse_utc_offset({"timezone": "Asia/Muscat", "utc_offset_seconds": 14400}) == 14400
    assert _parse_utc_offset({"timezone": "Asia/Kolkata", "utc_offset_seconds": 19800}) == 19800


@pytest.mark.parametrize("data", [{}, {"utc_offset_seconds": None}, {"utc_offset_seconds": "soon"}])
def test_missing_utc_offset_is_an_upstream_error(data: dict) -> None:
    with pytest.raises(UpstreamServiceError):
        _parse_utc_offset(data)
