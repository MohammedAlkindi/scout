import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from server.api import app
from server.cache import TTLCache
from server.services import locations
from server.errors import UpstreamServiceError


@pytest.fixture(autouse=True)
def cache(monkeypatch):
    monkeypatch.setattr(locations, "_destination_cache", TTLCache())


def install(monkeypatch, respond):
    original = httpx.AsyncClient
    monkeypatch.setattr(locations.httpx, "AsyncClient", lambda **kwargs: original(transport=httpx.MockTransport(respond), **kwargs))


def test_destination_search_validates_results_and_caches_queries(monkeypatch):
    calls = []
    def respond(request):
        calls.append(request)
        return httpx.Response(200, json={"features": [
            {"properties": {"name": "Tampa", "osm_value": "city", "city": "Tampa", "state": "Florida", "country": "United States"}, "geometry": {"type": "Point", "coordinates": [-82.46, 27.95]}},
            {"properties": {"name": "Invalid"}, "geometry": {"type": "Point", "coordinates": [300, 100]}}
        ]})
    install(monkeypatch, respond)
    response = TestClient(app).get("/api/destinations", params={"q": "Tampa"})
    assert response.status_code == 200
    assert response.json()[0]["region"] == "Florida, United States"
    assert response.json()[0]["latitude"] == 27.95
    assert len(response.json()) == 1
    assert asyncio.run(locations.search_destinations("tampa")) == response.json()
    assert len(calls) == 1


def test_destination_search_upstream_failure_is_structured(monkeypatch):
    install(monkeypatch, lambda request: httpx.Response(503))
    response = TestClient(app).get("/api/destinations", params={"q": "Unavailable city"})
    assert response.status_code == 502
    assert response.json()["code"] == "upstream_unavailable"
    assert "coordinates" in response.json()["error"]


def test_destination_search_rejects_short_input_before_upstream(monkeypatch):
    def unexpected(request):
        pytest.fail("invalid input must not call upstream")
    install(monkeypatch, unexpected)
    assert TestClient(app).get("/api/destinations", params={"q": "x"}).status_code == 422
