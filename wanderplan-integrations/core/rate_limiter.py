"""
Rate Limiter — token-bucket implementation supporting per-second,
per-minute, and per-day rate limits.
"""

import asyncio
import logging
import time
from typing import Optional

from config import RateLimitConfig

logger = logging.getLogger(__name__)


class RateLimitExceededError(Exception):
    def __init__(self, adapter_name: str, wait_seconds: float):
        self.adapter_name = adapter_name
        self.wait_seconds = wait_seconds
        super().__init__(
            f"[{adapter_name}] Rate limit exceeded. Retry in {wait_seconds:.2f}s"
        )


class TokenBucket:
    """Async token-bucket rate limiter."""

    def __init__(self, rate: float, capacity: Optional[int] = None):
        """
        Args:
            rate: tokens replenished per second
            capacity: max burst size (defaults to ceil(rate))
        """
        self._rate = rate
        self._capacity = capacity or max(1, int(rate) + 1)
        self._tokens = float(self._capacity)
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self, wait: bool = True) -> bool:
        async with self._lock:
            self._refill()
            if self._tokens >= 1:
                self._tokens -= 1
                return True
            if not wait:
                return False

        # Wait for a token to become available
        wait_time = (1 - self._tokens) / self._rate
        logger.debug("Rate limiter: waiting %.3fs for token", wait_time)
        await asyncio.sleep(wait_time)
        return await self.acquire(wait=False)

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._capacity, self._tokens + elapsed * self._rate)
        self._last_refill = now


class CompositeRateLimiter:
    """
    Enforces multiple rate-limit tiers simultaneously (e.g. 10/s AND 5000/day).
    All tiers must allow the request.
    """

    def __init__(self, config: RateLimitConfig, adapter_name: str = "unknown"):
        self._adapter_name = adapter_name
        self._buckets: list[TokenBucket] = []

        if config.requests_per_second:
            burst = config.burst_size or max(1, int(config.requests_per_second) + 1)
            self._buckets.append(TokenBucket(config.requests_per_second, burst))

        if config.requests_per_minute:
            rate = config.requests_per_minute / 60.0
            burst = config.burst_size or max(1, int(rate * 10) + 1)
            self._buckets.append(TokenBucket(rate, burst))

        if config.requests_per_day:
            rate = config.requests_per_day / 86400.0
            burst = config.burst_size or max(1, int(rate * 60) + 1)
            self._buckets.append(TokenBucket(rate, burst))

    async def acquire(self, wait: bool = True) -> bool:
        """Acquire a token from ALL buckets."""
        for bucket in self._buckets:
            ok = await bucket.acquire(wait=wait)
            if not ok:
                return False
        return True

    async def acquire_or_raise(self) -> None:
        ok = await self.acquire(wait=True)
        if not ok:
            raise RateLimitExceededError(self._adapter_name, 1.0)
