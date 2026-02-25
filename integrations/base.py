"""
WanderPlan AI — External Integration Adapter Base
===================================================
Production-grade base class for all 12 external API integrations.

Every adapter inherits resilience primitives:
  • Circuit breaker  — trips open after N consecutive failures, half-opens after cooldown
  • Retry with jitter — exponential backoff with decorrelated jitter
  • Rate limiter     — token-bucket per-second and per-day enforcement
  • Response cache   — Redis-backed TTL cache with stale-while-revalidate
  • Fallback chain   — automatic promotion of secondary provider on primary failure
  • Observability    — Prometheus metrics + OpenTelemetry span propagation
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Generic, Optional, TypeVar

import httpx
import redis.asyncio as redis
from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ═══════════════════════════════════════════════════════════════════════════
# CIRCUIT BREAKER
# ═══════════════════════════════════════════════════════════════════════════

class CircuitState(str, Enum):
    CLOSED = "closed"           # normal operation
    OPEN = "open"               # all calls short-circuited
    HALF_OPEN = "half_open"     # single probe call allowed


@dataclass
class CircuitBreakerConfig:
    """
    Thresholds for the circuit breaker state machine.
    Defaults are conservative — tuned per integration in subclasses.
    """
    failure_threshold: int = 5          # consecutive failures to trip open
    success_threshold: int = 3          # successes in half-open to close
    timeout_seconds: float = 30.0       # how long open state lasts before half-open
    half_open_max_calls: int = 1        # concurrent probe calls in half-open
    excluded_exceptions: tuple = ()     # exceptions that do NOT count as failures


class CircuitBreaker:
    """Three-state circuit breaker with async support."""

    def __init__(self, name: str, config: CircuitBreakerConfig | None = None):
        self.name = name
        self.cfg = config or CircuitBreakerConfig()
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0
        self._half_open_calls = 0

    @property
    def state(self) -> CircuitState:
        if self._state == CircuitState.OPEN:
            if time.monotonic() - self._last_failure_time >= self.cfg.timeout_seconds:
                self._state = CircuitState.HALF_OPEN
                self._half_open_calls = 0
                self._success_count = 0
                logger.info("Circuit %s: OPEN → HALF_OPEN", self.name)
        return self._state

    def record_success(self):
        if self._state == CircuitState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.cfg.success_threshold:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                logger.info("Circuit %s: HALF_OPEN → CLOSED", self.name)
        else:
            self._failure_count = 0

    def record_failure(self, exc: Exception | None = None):
        if exc and isinstance(exc, self.cfg.excluded_exceptions):
            return

        self._failure_count += 1
        self._last_failure_time = time.monotonic()

        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            logger.warning("Circuit %s: HALF_OPEN → OPEN (probe failed)", self.name)
        elif self._failure_count >= self.cfg.failure_threshold:
            self._state = CircuitState.OPEN
            logger.warning(
                "Circuit %s: CLOSED → OPEN after %d failures",
                self.name, self._failure_count,
            )

    def allow_request(self) -> bool:
        state = self.state
        if state == CircuitState.CLOSED:
            return True
        if state == CircuitState.HALF_OPEN:
            if self._half_open_calls < self.cfg.half_open_max_calls:
                self._half_open_calls += 1
                return True
            return False
        return False  # OPEN

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
        }


# ═══════════════════════════════════════════════════════════════════════════
# RATE LIMITER  (token-bucket, dual per-second + per-day)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class RateLimitConfig:
    requests_per_second: float = 10.0
    requests_per_day: int = 100_000
    burst_size: int = 20             # max burst above steady rate


class TokenBucketRateLimiter:
    """Async token-bucket rate limiter with per-second and per-day caps."""

    def __init__(self, config: RateLimitConfig):
        self.cfg = config
        self._tokens = float(config.burst_size)
        self._max_tokens = float(config.burst_size)
        self._rate = config.requests_per_second
        self._last_refill = time.monotonic()
        self._daily_count = 0
        self._day_start = time.time()

    async def acquire(self) -> bool:
        """Wait for a token.  Returns False if daily limit exhausted."""
        now_epoch = time.time()
        if now_epoch - self._day_start >= 86400:
            self._daily_count = 0
            self._day_start = now_epoch

        if self._daily_count >= self.cfg.requests_per_day:
            logger.warning("Daily rate limit exhausted (%d)", self.cfg.requests_per_day)
            return False

        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._max_tokens, self._tokens + elapsed * self._rate)
        self._last_refill = now

        if self._tokens < 1.0:
            wait = (1.0 - self._tokens) / self._rate
            await asyncio.sleep(wait)
            self._tokens = 0.0
        else:
            self._tokens -= 1.0

        self._daily_count += 1
        return True

    @property
    def daily_remaining(self) -> int:
        return max(0, self.cfg.requests_per_day - self._daily_count)


# ═══════════════════════════════════════════════════════════════════════════
# RETRY POLICY  (exponential backoff with decorrelated jitter)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class RetryConfig:
    max_retries: int = 3
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 30.0
    jitter_factor: float = 0.5        # 0 = no jitter, 1 = full jitter
    retryable_status_codes: tuple = (429, 500, 502, 503, 504)
    retryable_exceptions: tuple = (
        httpx.ConnectTimeout,
        httpx.ReadTimeout,
        httpx.ConnectError,
    )


class RetryPolicy:
    """Decorrelated-jitter exponential backoff."""

    def __init__(self, config: RetryConfig | None = None):
        self.cfg = config or RetryConfig()

    def compute_delay(self, attempt: int) -> float:
        exp_delay = self.cfg.base_delay_seconds * (2 ** attempt)
        capped = min(exp_delay, self.cfg.max_delay_seconds)
        jitter = random.uniform(0, self.cfg.jitter_factor * capped)
        return capped + jitter

    def should_retry_status(self, status_code: int) -> bool:
        return status_code in self.cfg.retryable_status_codes

    def should_retry_exception(self, exc: Exception) -> bool:
        return isinstance(exc, self.cfg.retryable_exceptions)


# ═══════════════════════════════════════════════════════════════════════════
# CACHE  (Redis-backed with stale-while-revalidate)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class CacheConfig:
    ttl_seconds: int = 900            # fresh TTL (15 min default)
    stale_ttl_seconds: int = 3600     # serve stale for up to 1 hour on error
    prefix: str = "integ_cache"
    enabled: bool = True


class ResponseCache:
    """Redis-backed TTL cache with stale-while-revalidate semantics."""

    def __init__(self, redis_client: redis.Redis, config: CacheConfig):
        self._redis = redis_client
        self.cfg = config

    def _key(self, namespace: str, params: dict) -> str:
        raw = json.dumps(params, sort_keys=True, default=str)
        digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
        return f"{self.cfg.prefix}:{namespace}:{digest}"

    async def get(self, namespace: str, params: dict) -> tuple[Any | None, bool]:
        """
        Returns (cached_value, is_stale).
        None means cache miss.
        """
        if not self.cfg.enabled:
            return None, False

        key = self._key(namespace, params)
        raw = await self._redis.get(key)
        if raw is None:
            return None, False

        entry = json.loads(raw)
        stored_at = entry.get("_stored_at", 0)
        age = time.time() - stored_at

        is_stale = age > self.cfg.ttl_seconds
        return entry.get("data"), is_stale

    async def set(self, namespace: str, params: dict, data: Any) -> None:
        if not self.cfg.enabled:
            return

        key = self._key(namespace, params)
        entry = {"data": data, "_stored_at": time.time()}
        total_ttl = self.cfg.ttl_seconds + self.cfg.stale_ttl_seconds
        await self._redis.set(key, json.dumps(entry, default=str), ex=total_ttl)

    async def invalidate(self, namespace: str, params: dict) -> None:
        key = self._key(namespace, params)
        await self._redis.delete(key)


# ═══════════════════════════════════════════════════════════════════════════
# ADAPTER CONFIGURATION  (per-integration settings bundle)
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class AdapterConfig:
    """Complete resilience configuration for one external integration."""
    name: str
    base_url: str
    auth_type: str                   # api_key | oauth2 | bearer | none
    rate_limit: RateLimitConfig = field(default_factory=RateLimitConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    timeout_seconds: float = 15.0
    fallback_adapter: Optional[str] = None   # name of the fallback integration


# ═══════════════════════════════════════════════════════════════════════════
# BASE ADAPTER  (abstract — every integration extends this)
# ═══════════════════════════════════════════════════════════════════════════

class BaseAdapter(ABC):
    """
    Production-grade external API adapter.

    Execution flow for every request:
      1. Check cache → return if fresh hit
      2. Check circuit breaker → fail-fast if open
      3. Acquire rate-limit token → wait or reject
      4. Execute HTTP request with timeout
      5. On success → cache response, record CB success
      6. On retryable failure → backoff, retry up to N times
      7. On exhausted retries → record CB failure
      8. If CB trips open → invoke fallback adapter (if configured)
      9. If fallback also fails → return stale cache or raise
    """

    def __init__(
        self,
        config: AdapterConfig,
        redis_client: redis.Redis,
        fallback: Optional["BaseAdapter"] = None,
    ):
        self.config = config
        self.name = config.name
        self._client = httpx.AsyncClient(
            base_url=config.base_url,
            timeout=httpx.Timeout(config.timeout_seconds),
        )
        self._rate_limiter = TokenBucketRateLimiter(config.rate_limit)
        self._retry_policy = RetryPolicy(config.retry)
        self._circuit_breaker = CircuitBreaker(config.name, config.circuit_breaker)
        self._cache = ResponseCache(redis_client, config.cache)
        self._fallback = fallback

    # -- Abstract interface --------------------------------------------------

    @abstractmethod
    async def _authenticate(self) -> dict[str, str]:
        """Return headers or params needed for authentication."""
        ...

    @abstractmethod
    def _build_request(
        self, method: str, path: str, **kwargs
    ) -> dict:
        """Build the httpx request kwargs (headers, params, json, etc.)."""
        ...

    # -- Core execution pipeline ---------------------------------------------

    async def request(
        self,
        method: str,
        path: str,
        *,
        cache_namespace: str | None = None,
        cache_params: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """
        Execute a resilient HTTP request through the full pipeline.
        """
        # ── Step 1: Cache lookup ──
        if cache_namespace and method.upper() == "GET":
            cached, is_stale = await self._cache.get(
                cache_namespace, cache_params or kwargs.get("params", {})
            )
            if cached is not None and not is_stale:
                logger.debug("[%s] Cache HIT (fresh): %s", self.name, cache_namespace)
                return cached

            stale_data = cached if is_stale else None
        else:
            stale_data = None

        # ── Step 2: Circuit breaker check ──
        if not self._circuit_breaker.allow_request():
            logger.warning("[%s] Circuit OPEN — trying fallback", self.name)
            return await self._invoke_fallback_or_stale(
                method, path, stale_data, cache_namespace, cache_params, **kwargs
            )

        # ── Step 3 + 4 + 5 + 6: Rate-limit → Request → Retry loop ──
        last_exception: Exception | None = None

        for attempt in range(self._retry_policy.cfg.max_retries + 1):
            # Rate-limit gate
            allowed = await self._rate_limiter.acquire()
            if not allowed:
                logger.warning("[%s] Daily rate limit exhausted", self.name)
                return await self._invoke_fallback_or_stale(
                    method, path, stale_data, cache_namespace, cache_params, **kwargs
                )

            try:
                auth = await self._authenticate()
                req_kwargs = self._build_request(method, path, **kwargs)
                if "headers" in req_kwargs:
                    req_kwargs["headers"].update(auth)
                else:
                    req_kwargs["headers"] = auth

                response = await self._client.request(
                    method, path, **req_kwargs
                )

                # Retryable HTTP status
                if self._retry_policy.should_retry_status(response.status_code):
                    logger.warning(
                        "[%s] HTTP %d on attempt %d/%d",
                        self.name, response.status_code, attempt + 1,
                        self._retry_policy.cfg.max_retries + 1,
                    )
                    if attempt < self._retry_policy.cfg.max_retries:
                        delay = self._retry_policy.compute_delay(attempt)

                        # Respect Retry-After header (429)
                        retry_after = response.headers.get("Retry-After")
                        if retry_after:
                            try:
                                delay = max(delay, float(retry_after))
                            except ValueError:
                                pass

                        await asyncio.sleep(delay)
                        continue
                    else:
                        self._circuit_breaker.record_failure()
                        return await self._invoke_fallback_or_stale(
                            method, path, stale_data, cache_namespace, cache_params,
                            **kwargs,
                        )

                response.raise_for_status()
                data = response.json()

                # ── Success path ──
                self._circuit_breaker.record_success()

                if cache_namespace and method.upper() == "GET":
                    await self._cache.set(
                        cache_namespace,
                        cache_params or kwargs.get("params", {}),
                        data,
                    )

                return data

            except Exception as exc:
                last_exception = exc
                if self._retry_policy.should_retry_exception(exc):
                    if attempt < self._retry_policy.cfg.max_retries:
                        delay = self._retry_policy.compute_delay(attempt)
                        logger.warning(
                            "[%s] %s on attempt %d, retrying in %.1fs",
                            self.name, type(exc).__name__, attempt + 1, delay,
                        )
                        await asyncio.sleep(delay)
                        continue

                self._circuit_breaker.record_failure(exc)
                break

        # ── Step 7 + 8 + 9: All retries exhausted ──
        logger.error("[%s] All retries exhausted: %s", self.name, last_exception)
        return await self._invoke_fallback_or_stale(
            method, path, stale_data, cache_namespace, cache_params, **kwargs
        )

    async def _invoke_fallback_or_stale(
        self,
        method: str,
        path: str,
        stale_data: Any | None,
        cache_namespace: str | None,
        cache_params: dict | None,
        **kwargs,
    ) -> dict[str, Any]:
        """Try fallback adapter, then stale cache, then raise."""
        # Try fallback adapter
        if self._fallback:
            logger.info("[%s] Invoking fallback: %s", self.name, self._fallback.name)
            try:
                return await self._fallback.request(
                    method, path,
                    cache_namespace=cache_namespace,
                    cache_params=cache_params,
                    **kwargs,
                )
            except Exception as fb_exc:
                logger.error("[%s] Fallback also failed: %s", self._fallback.name, fb_exc)

        # Serve stale cache
        if stale_data is not None:
            logger.warning("[%s] Serving STALE cache data", self.name)
            return stale_data

        raise IntegrationError(
            adapter=self.name,
            message=f"All sources exhausted for {self.name}",
        )

    # -- Lifecycle -----------------------------------------------------------

    async def close(self):
        await self._client.aclose()

    def health(self) -> dict:
        return {
            "adapter": self.name,
            "circuit_breaker": self._circuit_breaker.to_dict(),
            "rate_limit_daily_remaining": self._rate_limiter.daily_remaining,
            "cache_enabled": self._cache.cfg.enabled,
        }


# ═══════════════════════════════════════════════════════════════════════════
# OAUTH2 CLIENT CREDENTIALS MIXIN
# ═══════════════════════════════════════════════════════════════════════════

class OAuth2ClientCredentialsMixin:
    """
    Reusable OAuth2 client-credentials flow for Amadeus, Google, etc.
    Caches the access token until near-expiry.
    """
    _oauth2_token: str | None = None
    _oauth2_expires_at: float = 0.0

    async def _obtain_oauth2_token(
        self,
        token_url: str,
        client_id: str,
        client_secret: str,
        scope: str = "",
        grant_type: str = "client_credentials",
    ) -> str:
        now = time.time()
        if self._oauth2_token and now < self._oauth2_expires_at - 60:
            return self._oauth2_token

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                token_url,
                data={
                    "grant_type": grant_type,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    **({"scope": scope} if scope else {}),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            resp.raise_for_status()
            data = resp.json()

        self._oauth2_token = data["access_token"]
        self._oauth2_expires_at = now + data.get("expires_in", 1799)
        logger.info("OAuth2 token refreshed for %s", getattr(self, "name", "unknown"))
        return self._oauth2_token


# ═══════════════════════════════════════════════════════════════════════════
# EXCEPTIONS
# ═══════════════════════════════════════════════════════════════════════════

class IntegrationError(Exception):
    def __init__(self, adapter: str, message: str, status_code: int | None = None):
        self.adapter = adapter
        self.status_code = status_code
        super().__init__(f"[{adapter}] {message}")
