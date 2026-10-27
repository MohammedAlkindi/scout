"""Photon integration contracts: real GeoJSON shape, radius and failure semantics."""
import asyncio
from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient

from server import config, orchestration
from server.api import app
from server.cache import TTLCache
from server.errors import NoCandidatesFoundError, RateLimitedError, UpstreamServiceError
from server.services import locations
from server.services.scorer import WeatherSnapshot
from server.services.weather import ConditionsResult

FEATURE = {
    "type": "Feature", "properties": {"name": "Ghubrah Beach Park", "osm_type": "W", "osm_id": 566691932,
                                      "osm_key": "leisure", "osm_value": "park"},
    "geometry": {"type": "Point", "coordinates": [58.4048825, 23.603328]},
}


def transport(monkeypatch, respond):
    client_class = httpx.AsyncClient
    monkeypatch.setattr(locations.httpx, "AsyncClient", lambda **kwargs: client_class(transport=httpx.MockTransport(respond), **kwargs))
    monkeypatch.setattr(config, "LOCATIONS_PROVIDER", "photon")


def test_photon_uses_category_filter_and_preserves_unknown_access(monkeypatch):
    requests = []

    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"features": [FEATURE]})

    transport(monkeypatch, respond)
    result = asyncio.run(locations.find_locations(23.5793, 58.4025, 15, "park walk"))
    assert result[0].name == "Ghubrah Beach Park"
    assert result[0].data_source == "photon"
    assert result[0].fee is None and result[0].opening_hours is None and result[0].wheelchair is None
    assert "unknown" in result[0].accessibility_notes
    assert requests[0].method == "GET"
    assert requests[0].url.params.get_list("osm_tag") == ["leisure:park"]
    assert float(requests[0].url.params["radius"]) == pytest.approx(24.14016)


def test_photon_rejects_wrong_category_out_of_radius_and_invalid_coordinates():
    variants = [deepcopy(FEATURE) for _ in range(5)]
    variants[0]["properties"]["osm_value"] = "restaurant"
    variants[1]["geometry"]["coordinates"] = [55.27, 25.20]
    variants[2]["geometry"]["coordinates"] = [float("nan"), 23.60]
    variants[3]["properties"]["name"] = ""
    variants[4]["properties"]["osm_id"] = None
    result = locations._photon_candidates(23.5793, 58.4025, 15, [("leisure", "park")],
                                          {"features": variants + [FEATURE, FEATURE]})
    assert len(result) == 1
    assert result[0].osm_id == 566691932


@pytest.mark.parametrize("status,error", [(429, RateLimitedError), (503, UpstreamServiceError)])
def test_photon_http_errors_remain_structured(monkeypatch, status, error):
    transport(monkeypatch, lambda request: httpx.Response(status))
    with pytest.raises(error):
        asyncio.run(locations.find_locations(23.5793, 58.4025, 15, "park"))


@pytest.mark.parametrize("body,error", [({"features": []}, NoCandidatesFoundError), ({"features": None}, UpstreamServiceError), ([], UpstreamServiceError)])
def test_photon_empty_and_malformed_responses_are_distinct(monkeypatch, body, error):
    transport(monkeypatch, lambda request: httpx.Response(200, json=body))
    with pytest.raises(error):
        asyncio.run(locations.find_locations(23.5793, 58.4025, 15, "park"))


def test_photon_timeout_is_an_upstream_error(monkeypatch):
    def respond(request):
        raise httpx.ReadTimeout("upstream slow", request=request)
    transport(monkeypatch, respond)
    with pytest.raises(UpstreamServiceError):
        asyncio.run(locations.find_locations(23.5793, 58.4025, 15, "park"))


def test_photon_recommendation_reaches_api_with_live_source_not_demo(monkeypatch):
    transport(monkeypatch, lambda request: httpx.Response(200, json={"features": [FEATURE]}))
    monkeypatch.setattr(orchestration, "_locations_cache", TTLCache())

    async def conditions(*args):
        return ConditionsResult(current=WeatherSnapshot(cloud_cover_pct=25, wind_speed_mph=5,
                                visibility_miles=10, precipitation_probability_pct=0, temperature_f=80), forecast_24h=[])

    monkeypatch.setattr(orchestration, "_fetch_conditions_cached", conditions)
    response = TestClient(app).post("/api/recommendation", json={"latitude": 23.5793, "longitude": 58.4025,
                                    "intent": "park walk", "radius_miles": 15, "shot_type": "landscape"})
    assert response.status_code == 200
    data = response.json()
    assert data["demo_mode"] is False
    assert data["recommendations"][0]["location_name"] == "Ghubrah Beach Park"
    assert "Photon (Komoot)" in data["source_note"]
    assert "may be missing" in data["source_note"]
