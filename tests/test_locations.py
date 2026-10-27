"""Unit tests for OpenStreetMap location-query shaping."""

from server.services.locations import (
    _build_overpass_query,
    _candidates_from_elements,
    _search_radii,
    _tag_groups,
    _tags_for_intent,
)


def test_romantic_photo_intent_uses_narrow_named_place_tags() -> None:
    tags = _tags_for_intent("romantic photos")

    assert ("leisure", "park") in tags
    assert ("tourism", "viewpoint") in tags
    assert ("natural", "water") not in tags
    assert len(tags) <= 3


def test_default_intent_avoids_broad_water_query() -> None:
    tags = _tags_for_intent("somewhere nice")

    assert tags == [("tourism", "viewpoint"), ("leisure", "park")]


def test_overpass_query_filters_to_named_features() -> None:
    query = _build_overpass_query(40.7128, -74.006, 1000.0, [("leisure", "park")])

    assert "[timeout:" in query
    assert 'node["leisure"="park"]["name"]' in query
    assert 'way["leisure"="park"]["name"]' in query
    assert "out center 30;" in query


def test_tag_groups_keep_overpass_queries_focused() -> None:
    tags = [("leisure", "park"), ("tourism", "viewpoint")]

    assert _tag_groups(tags) == [[("leisure", "park")], [("tourism", "viewpoint")]]


def test_search_radii_expand_from_nearby_to_requested_radius() -> None:
    assert _search_radii(0.5) == [0.5]
    assert _search_radii(2.0) == [1.0, 2.0]
    assert _search_radii(5.0) == [1.0, 3.0, 5.0]
    assert _search_radii(15.0) == [1.0, 3.0, 8.0, 15.0]


def test_candidates_ignore_unnamed_features() -> None:
    candidates = _candidates_from_elements(
        23.5791,
        58.4026,
        [
            {
                "type": "node",
                "id": 1,
                "lat": 23.58,
                "lon": 58.41,
                "tags": {"leisure": "park"},
            },
            {
                "type": "node",
                "id": 2,
                "lat": 23.58,
                "lon": 58.41,
                "tags": {"name": "Azaiba Beach Park", "leisure": "park"},
            },
        ],
    )

    assert len(candidates) == 1
    assert candidates[0].name == "Azaiba Beach Park"
    assert candidates[0].terrain_type == "urban park"


def test_candidates_keep_constraint_tags() -> None:
    candidates = _candidates_from_elements(
        23.5791,
        58.4026,
        [
            {
                "type": "node",
                "id": 3,
                "lat": 23.58,
                "lon": 58.41,
                "tags": {
                    "name": "Old Fort Museum",
                    "tourism": "attraction",
                    "fee": "2 OMR",
                    "opening_hours": "Sa-Th 09:00-17:00",
                    "wheelchair": "limited",
                    "indoor": "yes",
                },
            },
            {
                "type": "node",
                "id": 4,
                "lat": 23.59,
                "lon": 58.42,
                "tags": {"name": "Harbor Viewpoint", "tourism": "viewpoint", "fee": "no", "wheelchair": "unknown"},
            },
        ],
    )

    museum, viewpoint = candidates
    assert (museum.fee, museum.opening_hours, museum.wheelchair) == (True, "Sa-Th 09:00-17:00", "limited")
    assert (viewpoint.fee, viewpoint.opening_hours, viewpoint.wheelchair) == (False, None, None)
    assert museum.indoor is True
    assert viewpoint.indoor is False


def test_live_search_expands_empty_results_and_combines_intent_tags(monkeypatch) -> None:
    import asyncio
    from server.services import locations

    queries = []

    async def fetch(client, endpoint, query):
        queries.append(query)
        if len(queries) < 3:
            return {"elements": []}
        return {"elements": [{"id": 42, "lat": 23.60, "lon": 58.40,
                              "tags": {"name": "Live mapped park", "leisure": "park"}}]}

    monkeypatch.setattr(locations, "_fetch_overpass_json", fetch)
    monkeypatch.setattr(locations.config, "OVERPASS_BASE_URLS", ("https://example.test/api",))
    result = asyncio.run(locations.find_locations(23.5791, 58.4026, 15, "somewhere nice"))
    assert result[0].osm_id == 42
    assert len(queries) == 3
    assert all('"tourism"="viewpoint"' in q and '"leisure"="park"' in q for q in queries)
    assert 'around:12874.752' in queries[-1]


def test_live_search_fails_over_after_provider_timeout(monkeypatch) -> None:
    import asyncio
    import httpx
    from server.services import locations

    calls = []

    def respond(request):
        calls.append(request)
        if request.url.host == "slow.test":
            raise httpx.ReadTimeout("slow upstream", request=request)
        return httpx.Response(200, json={"elements": [{"id": 99, "lat": 23.58, "lon": 58.40,
                                     "tags": {"name": "Mapped viewpoint", "tourism": "viewpoint"}}]})

    client_class = httpx.AsyncClient
    monkeypatch.setattr(locations.httpx, "AsyncClient",
                        lambda **kwargs: client_class(transport=httpx.MockTransport(respond), **kwargs))
    monkeypatch.setattr(locations.config, "OVERPASS_BASE_URLS", ("https://slow.test/api", "https://healthy.test/api"))
    result = asyncio.run(locations.find_locations(23.5791, 58.4026, 15, "somewhere nice"))
    assert result[0].osm_id == 99
    assert [r.url.host for r in calls] == ["slow.test", "healthy.test"]
    assert calls[1].method == "POST"
    assert "github.com/MohammedAlkindi/scout" in calls[1].headers["User-Agent"]


def test_live_search_deadline_bounds_hanging_provider(monkeypatch) -> None:
    import asyncio
    import pytest
    from server.services import locations
    from server.errors import UpstreamServiceError

    async def hanging_fetch(*args):
        await asyncio.sleep(60)

    monkeypatch.setattr(locations, "_fetch_overpass_json", hanging_fetch)
    monkeypatch.setattr(locations.config, "OVERPASS_SEARCH_TIMEOUT_SECONDS", 0.01)
    with pytest.raises(UpstreamServiceError):
        asyncio.run(locations.find_locations(23.5791, 58.4026, 15, "somewhere nice"))
