import asyncio
from server.cache import TTLCache


def test_ttl_cache_stores_and_expires_values():
    async def _test():
        cache: TTLCache[str] = TTLCache()
        fetches = 0

        async def fetcher():
            nonlocal fetches
            fetches += 1
            return "result_value"

        # First fetch populates cache
        val1 = await cache.get_or_fetch("test_key", 0.05, fetcher)
        assert val1 == "result_value"
        assert fetches == 1

        # Immediate second call returns cached value without fetching
        val2 = await cache.get_or_fetch("test_key", 0.05, fetcher)
        assert val2 == "result_value"
        assert fetches == 1

        # Wait for TTL to expire
        await asyncio.sleep(0.06)
        val3 = await cache.get_or_fetch("test_key", 0.05, fetcher)
        assert val3 == "result_value"
        assert fetches == 2

    asyncio.run(_test())


def test_ttl_cache_invalidate_and_clear():
    async def _test():
        cache: TTLCache[int] = TTLCache()

        async def get_100():
            return 100

        async def get_200():
            return 200

        await cache.get_or_fetch("k1", 10.0, get_100)
        await cache.get_or_fetch("k2", 10.0, get_200)

        cache.invalidate("k1")
        # k1 invalidated, k2 still present
        calls = 0

        async def fetch_k1():
            nonlocal calls
            calls += 1
            return 101

        res = await cache.get_or_fetch("k1", 10.0, fetch_k1)
        assert res == 101
        assert calls == 1

        cache.clear()
        calls_k2 = 0

        async def fetch_k2():
            nonlocal calls_k2
            calls_k2 += 1
            return 202

        res2 = await cache.get_or_fetch("k2", 10.0, fetch_k2)
        assert res2 == 202
        assert calls_k2 == 1

    asyncio.run(_test())
