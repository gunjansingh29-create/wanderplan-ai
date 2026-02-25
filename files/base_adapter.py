"""
Base Integration Adapter — abstract base class that composes:
  • HTTP client (aiohttp)
  • Rate limiter
  • Circuit breaker
  • Retry policy
  • Cache manager
  • Structured logging & metrics hooks

All domain adapters inherit from this class.
"""

import abc
import logging
import time
from typing import Any, Callable, Dict, Optional

import aiohttp

from config import IntegrationConfig, AuthMethod
from core.cache_manager import CacheManager
from core.circuit_breaker import CircuitBreaker
from core.rate_limiter import CompositeRateLimiter
from core.retry_policy import execute_with_retry

logger = logging.getLogger(__name__)


class HTTPError(Exception):
    def __init__(self, status_code: int, message: str, adapter_name: str):
        self.status_code = status_code
        self.adapter_name = adapter_name
        super().__init__(f"[{adapter_name}] HTTP {status_code}: {message}")


class BaseAdapter(abc.ABC):
    """
    Every external-service adapter inherits from BaseAdapter.
    Subclasses implement domain methods; all resilience is handled here.
    """

    def __init__(
        self,
        config: IntegrationConfig,
        fallback: Optional["BaseAdapter"] = None,
    ):
        self._config = config
        self._fallback = fallback

        # Resilience components
        self._rate_limiter = CompositeRateLimiter(config.rate_limit, config.name)
        self._circuit_breaker = CircuitBreaker(config.circuit_breaker, config.name)
        self._cache = CacheManager(config.cache)
        self._session: Optional[aiohttp.ClientSession] = None

        # Auth state
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def start(self) -> None:
        timeout = aiohttp.ClientTimeout(total=self._config.timeout_seconds)
        self._session = aiohttp.ClientSession(timeout=timeout)
        if self._fallback:
            await self._fallback.start()

    async def close(self) -> None:
        if self._session:
            await self._session.close()
        if self._fallback:
            await self._fallback.close()

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *exc):
        await self.close()

    # ── Core request pipeline ─────────────────────────────────────────

    async def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        cache_key_parts: Optional[tuple] = None,
        cache_ttl_override: Optional[int] = None,
        skip_cache: bool = False,
    ) -> Any:
        """
        Full request pipeline:
          1. Check cache (GET only)
          2. Rate-limit
          3. Circuit-breaker → retry → HTTP call
          4. Cache response
        """
        # 1. Cache lookup (read-through)
        if method.upper() == "GET" and not skip_cache and cache_key_parts:
            cached = await self._cache.get(*cache_key_parts)
            if cached is not None:
                return cached

        # 2. Rate limiting (blocking acquire)
        await self._rate_limiter.acquire_or_raise()

        # 3. Circuit breaker wraps the retryable call
        async def _do_request(*a, **kw):
            return await execute_with_retry(
                self._raw_http,
                method,
                path,
                params=params,
                json_body=json_body,
                headers=headers,
                policy=self._config.retry,
                adapter_name=self._config.name,
            )

        fallback_fn = None
        if self._fallback:
            async def _fallback_request(*a, **kw):
                logger.info("[%s] Falling back to %s", self._config.name, self._fallback._config.name)
                return await self._fallback._request(
                    method, path, params=params, json_body=json_body,
                    headers=headers, cache_key_parts=cache_key_parts,
                    cache_ttl_override=cache_ttl_override,
                )
            fallback_fn = _fallback_request

        result = await self._circuit_breaker.call(_do_request, fallback=fallback_fn)

        # 4. Cache write-through
        if method.upper() == "GET" and cache_key_parts:
            await self._cache.set(result, *cache_key_parts, ttl_override=cache_ttl_override)

        return result

    async def _raw_http(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json_body: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Execute the actual HTTP call with auth headers."""
        url = f"{self._config.base_url}{path}" if not path.startswith("http") else path
        req_headers = await self._build_headers(headers)

        start = time.perf_counter()
        async with self._session.request(
            method, url, params=params, json=json_body, headers=req_headers
        ) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000
            body = await resp.json(content_type=None)
            logger.info(
                "[%s] %s %s → %d (%.0fms)",
                self._config.name, method.upper(), path, resp.status, elapsed_ms,
            )
            if resp.status >= 400:
                raise HTTPError(resp.status, str(body)[:200], self._config.name)
            return body

    # ── Authentication ────────────────────────────────────────────────

    async def _build_headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        h: Dict[str, str] = {"Accept": "application/json"}
        if extra:
            h.update(extra)

        if self._config.auth_method == AuthMethod.OAUTH2:
            token = await self._get_oauth2_token()
            h["Authorization"] = f"Bearer {token}"
        elif self._config.auth_method == AuthMethod.API_KEY:
            # Subclasses override _api_key_header() for provider-specific placement
            key_header = self._api_key_header()
            if key_header:
                h.update(key_header)

        return h

    async def _get_oauth2_token(self) -> str:
        """Override in subclasses for provider-specific OAuth2 flows."""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        self._access_token, self._token_expires_at = await self._refresh_oauth2_token()
        return self._access_token

    async def _refresh_oauth2_token(self) -> tuple[str, float]:
        """Subclasses must implement the actual OAuth2 token exchange."""
        raise NotImplementedError(
            f"[{self._config.name}] OAuth2 adapters must implement _refresh_oauth2_token()"
        )

    def _api_key_header(self) -> Optional[Dict[str, str]]:
        """Subclasses return the header dict for API key auth."""
        return None

    # ── Observability ─────────────────────────────────────────────────

    def health_check(self) -> Dict[str, Any]:
        return {
            "adapter": self._config.name,
            "circuit_breaker": self._circuit_breaker.health_snapshot(),
            "fallback": self._fallback._config.name if self._fallback else None,
        }
