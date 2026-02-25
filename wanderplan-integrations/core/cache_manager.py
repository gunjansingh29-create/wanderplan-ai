"""
Cache Manager — pluggable caching layer with Redis and in-memory backends.
Supports per-integration TTL, prefixed keys, and indefinite caching.
"""

import hashlib
import json
import logging
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from typing import Any, Optional

from config import CacheConfig

logger = logging.getLogger(__name__)


def build_cache_key(prefix: str, *parts: Any) -> str:
    """Deterministic cache key from prefix + arbitrary args."""
    raw = json.dumps(parts, sort_keys=True, default=str)
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    return f"{prefix}:{digest}"


class CacheBackend(ABC):
    @abstractmethod
    async def get(self, key: str) -> Optional[str]:
        ...

    @abstractmethod
    async def set(self, key: str, value: str, ttl_seconds: int = 0) -> None:
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        ...

    @abstractmethod
    async def clear_prefix(self, prefix: str) -> int:
        ...


class InMemoryCache(CacheBackend):
    """LRU in-memory cache with TTL (for dev / single-instance deploys)."""

    def __init__(self, max_size: int = 10_000):
        self._store: OrderedDict[str, tuple[str, float]] = OrderedDict()
        self._max_size = max_size

    async def get(self, key: str) -> Optional[str]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at and time.time() > expires_at:
            del self._store[key]
            return None
        self._store.move_to_end(key)
        return value

    async def set(self, key: str, value: str, ttl_seconds: int = 0) -> None:
        expires_at = (time.time() + ttl_seconds) if ttl_seconds > 0 else 0
        self._store[key] = (value, expires_at)
        self._store.move_to_end(key)
        while len(self._store) > self._max_size:
            self._store.popitem(last=False)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def clear_prefix(self, prefix: str) -> int:
        keys_to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_delete:
            del self._store[k]
        return len(keys_to_delete)


class RedisCache(CacheBackend):
    """Redis-backed cache. Requires `redis.asyncio`."""

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self._url = redis_url
        self._pool = None

    async def _get_pool(self):
        if self._pool is None:
            import redis.asyncio as aioredis
            self._pool = aioredis.from_url(self._url, decode_responses=True)
        return self._pool

    async def get(self, key: str) -> Optional[str]:
        r = await self._get_pool()
        return await r.get(key)

    async def set(self, key: str, value: str, ttl_seconds: int = 0) -> None:
        r = await self._get_pool()
        if ttl_seconds > 0:
            await r.setex(key, ttl_seconds, value)
        else:
            await r.set(key, value)

    async def delete(self, key: str) -> None:
        r = await self._get_pool()
        await r.delete(key)

    async def clear_prefix(self, prefix: str) -> int:
        r = await self._get_pool()
        cursor, keys = 0, []
        while True:
            cursor, batch = await r.scan(cursor, match=f"{prefix}*", count=100)
            keys.extend(batch)
            if cursor == 0:
                break
        if keys:
            await r.delete(*keys)
        return len(keys)


class CacheManager:
    """
    High-level cache manager that wraps a backend and applies per-config TTL.
    """

    def __init__(self, config: CacheConfig, backend: Optional[CacheBackend] = None):
        self._config = config
        if backend:
            self._backend = backend
        elif config.cache_backend == "redis":
            self._backend = RedisCache()
        else:
            self._backend = InMemoryCache(max_size=config.max_size)

    async def get(self, *key_parts: Any) -> Optional[Any]:
        key = build_cache_key(self._config.prefix, *key_parts)
        raw = await self._backend.get(key)
        if raw is None:
            logger.debug("Cache MISS: %s", key)
            return None
        logger.debug("Cache HIT: %s", key)
        return json.loads(raw)

    async def set(self, value: Any, *key_parts: Any, ttl_override: Optional[int] = None) -> None:
        key = build_cache_key(self._config.prefix, *key_parts)
        ttl = ttl_override if ttl_override is not None else self._config.ttl_seconds
        if self._config.indefinite:
            ttl = 0  # no expiry
        raw = json.dumps(value, default=str)
        await self._backend.set(key, raw, ttl)
        logger.debug("Cache SET: %s (ttl=%s)", key, ttl)

    async def invalidate(self, *key_parts: Any) -> None:
        key = build_cache_key(self._config.prefix, *key_parts)
        await self._backend.delete(key)

    async def clear_all(self) -> int:
        return await self._backend.clear_prefix(self._config.prefix)
