"""travel_style through orchestration, the HTTP API and the MCP tool, with fixed inputs."""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest
from fastapi.testclient import TestClient

from server import orchestration
from server.api import app
from server.cache import TTLCache
from server.errors import UpstreamServiceError
from server.mcp_server import mcp
from server.schemas import RecommendationResponse
from server.services.scorer import WeatherSnapshot
from server.services.travel_styles import TravelStyle
from server.services.weather import ConditionsResult, ForecastHour
from tests.place_fixtures import places

# A Friday afternoon in UTC. With a +4 hour offset it is 18:00 at the places.
_NOW = datetime(2026, 10, 23, 14, 0, tzinfo=timezone.utc)
_OFFSET_SECONDS = 4 * 3600
_CONDITIONS = ConditionsResult(
    current=WeatherSnapshot(
        cloud_cover_pct=25.0, wind_speed_mph=6.0, visibility_miles=10.0, precipitation_probability_pct=5.0, temperature_f=80.0
    ),
    forecast_24h=[
        ForecastHour(
            time=_NOW + timedelta(hours=hour),
            cloud_cover_pct=25.0,
            wind_speed_mph=6.0,
            visibility_miles=10.0,
            precipitation_probability_pct=5.0,
            temperature_f=80.0,
        )
        for hour in range(24)
    ],
)


class _FixedDatetime(datetime):
    @classmethod
    def now(cls, tz: Optional[object] = None) -> "_FixedDatetime":
        return cls.fromtimestamp(_NOW.timestamp(), tz=timezone.utc)


@pytest.fixture(autouse=True)
def fixed_inputs(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fixture_places(*args: object, **kwargs: object) -> object:
        return places()

    async def fixture_conditions(*args: object, **kwargs: object) -> object:
        return _CONDITIONS

    async def fixture_offset(*args: object, **kwargs: object) -> int:
        return _OFFSET_SECONDS

    monkeypatch.setattr(orchestration, "datetime", _FixedDatetime)
    monkeypatch.setattr(orchestration, "_find_locations_cached", fixture_places)
    monkeypatch.setattr(orchestration, "_fetch_conditions_cached", fixture_conditions)
    monkeypatch.setattr(orchestration, "_utc_offset_cache", TTLCache())
    monkeypatch.setattr(orchestration.weather_service, "fetch_utc_offset_seconds", fixture_offset)


def _recommend(travel_style: Optional[TravelStyle]) -> RecommendationResponse:
    return asyncio.run(orchestration.build_recommendation(23.6, 58.4, "city walk", 15.0, None, travel_style))


def test_no_travel_style_keeps_the_photographer_response() -> None:
    default = _recommend(None)
    photographer = _recommend(TravelStyle.PHOTOGRAPHER)

    assert default.travel_plan is None
    assert photographer.travel_plan is not None
    assert default.recommendations == photographer.recommendations


def test_travel_style_rejects_with_reasons_and_buckets() -> None:
    response = _recommend(TravelStyle.SIGHTSEEING)
    plan = response.travel_plan

    assert plan is not None
    assert plan.local_time == datetime(2026, 10, 23, 18, 0)
    assert [rejected.location_name for rejected in plan.rejected] == ["Old Fort Museum", "Beach Club"]
    assert plan.rejected[0].reasons == ['Closed at Fri 18:00 local time (opening_hours "Sa-Th 09:00-17:00").']
    rejected_names = {rejected.location_name for rejected in plan.rejected}
    assert not rejected_names & {item.location_name for item in response.recommendations}

    buckets = {bucket.bucket.value: bucket.recommendation for bucket in plan.buckets}
    assert set(buckets) == {"best_overall", "free", "rainy_day"}
    assert buckets["best_overall"] == response.recommendations[0]
    assert buckets["rainy_day"].location_name == "Covered Souq"
    assert plan.explanation.startswith("The sightseeing style weighs light 0.15")


def test_open_now_is_skipped_when_the_time_zone_lookup_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    async def failing_offset(*args: object, **kwargs: object) -> int:
        raise UpstreamServiceError("Weather data is temporarily unavailable.")

    monkeypatch.setattr(orchestration.weather_service, "fetch_utc_offset_seconds", failing_offset)

    plan = _recommend(TravelStyle.SIGHTSEEING).travel_plan

    assert plan is not None
    assert plan.local_time is None
    assert plan.rejected == []


def test_styles_without_open_now_skip_the_time_zone_lookup(monkeypatch: pytest.MonkeyPatch) -> None:
    async def unexpected_offset(*args: object, **kwargs: object) -> int:
        raise AssertionError("budget has no open-now constraint")

    monkeypatch.setattr(orchestration.weather_service, "fetch_utc_offset_seconds", unexpected_offset)

    plan = _recommend(TravelStyle.BUDGET).travel_plan

    assert plan is not None
    assert plan.local_time is None
    assert [rejected.location_name for rejected in plan.rejected] == ["Old Fort Museum", "Beach Club"]


def test_api_accepts_travel_style_and_rejects_unknown_styles() -> None:
    client = TestClient(app)
    body = {"latitude": 23.6, "longitude": 58.4, "intent": "city walk"}

    default = client.post("/api/recommendation", json=body)
    family = client.post("/api/recommendation", json={**body, "travel_style": "family"})
    unknown = client.post("/api/recommendation", json={**body, "travel_style": "luxury"})

    assert default.status_code == 200
    assert default.json()["travel_plan"] is None
    assert family.status_code == 200
    assert family.json()["travel_plan"]["constraints"]["max_walk_miles"] == 1.5
    assert unknown.status_code == 422


def test_mcp_tool_exposes_travel_style() -> None:
    tools = asyncio.run(mcp.list_tools())
    schema = next(tool.inputSchema for tool in tools if tool.name == "build_recommendation")

    assert "travel_style" not in schema["required"]
    assert schema["$defs"]["TravelStyle"]["enum"] == [style.value for style in TravelStyle]
