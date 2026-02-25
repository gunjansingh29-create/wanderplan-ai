"""
Circuit Breaker — prevents cascading failures by short-circuiting calls
to unhealthy downstream services.

States:
  CLOSED   → requests pass through; failures counted
  OPEN     → requests fail-fast; fallback invoked
  HALF_OPEN→ limited probe requests; if they succeed → CLOSED, else → OPEN
"""

import asyncio
import logging
import time
from enum import Enum
from typing import Any, Callable, Optional

from config import CircuitBreakerConfig

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(Exception):
    """Raised when the circuit breaker is open and the call is rejected."""

    def __init__(self, adapter_name: str, remaining_seconds: float):
        self.adapter_name = adapter_name
        self.remaining_seconds = remaining_seconds
        super().__init__(
            f"[{adapter_name}] Circuit OPEN. Recovery in {remaining_seconds:.1f}s"
        )


class CircuitBreaker:
    """
    Thread-safe (asyncio) circuit breaker per integration adapter.
    """

    def __init__(self, config: CircuitBreakerConfig, adapter_name: str = "unknown"):
        self._config = config
        self._adapter_name = adapter_name
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._half_open_calls = 0
        self._last_failure_time: Optional[float] = None
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    async def call(
        self,
        func: Callable,
        *args: Any,
        fallback: Optional[Callable] = None,
        **kwargs: Any,
    ) -> Any:
        """
        Execute *func* through the circuit breaker.
        If circuit is OPEN and a *fallback* is provided, invoke fallback instead.
        """
        async with self._lock:
            self._maybe_transition_to_half_open()

            if self._state == CircuitState.OPEN:
                remaining = self._recovery_remaining()
                logger.warning(
                    "[%s] Circuit OPEN — failing fast (%.1fs to recovery)",
                    self._adapter_name,
                    remaining,
                )
                if fallback:
                    logger.info("[%s] Invoking fallback …", self._adapter_name)
                    return await fallback(*args, **kwargs)
                raise CircuitOpenError(self._adapter_name, remaining)

            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self._config.half_open_max_calls:
                    if fallback:
                        return await fallback(*args, **kwargs)
                    raise CircuitOpenError(self._adapter_name, 0)
                self._half_open_calls += 1

        # Execute outside the lock to avoid holding it during I/O
        try:
            result = await func(*args, **kwargs)
        except Exception as exc:
            await self._on_failure()
            raise
        else:
            await self._on_success()
            return result

    # ── State transitions ─────────────────────────────────────────────

    async def _on_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._state == CircuitState.HALF_OPEN:
                self._transition(CircuitState.OPEN)
            elif self._failure_count >= self._config.failure_threshold:
                self._transition(CircuitState.OPEN)

    async def _on_success(self) -> None:
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self._config.success_threshold:
                    self._transition(CircuitState.CLOSED)
            else:
                # Reset consecutive failure count on success in CLOSED state
                self._failure_count = 0

    def _maybe_transition_to_half_open(self) -> None:
        if self._state == CircuitState.OPEN and self._recovery_remaining() <= 0:
            self._transition(CircuitState.HALF_OPEN)

    def _transition(self, new_state: CircuitState) -> None:
        old = self._state
        self._state = new_state
        if new_state == CircuitState.CLOSED:
            self._failure_count = 0
            self._success_count = 0
            self._half_open_calls = 0
        elif new_state == CircuitState.HALF_OPEN:
            self._success_count = 0
            self._half_open_calls = 0
        logger.info("[%s] Circuit %s → %s", self._adapter_name, old.value, new_state.value)

    def _recovery_remaining(self) -> float:
        if self._last_failure_time is None:
            return 0
        elapsed = time.monotonic() - self._last_failure_time
        return max(0, self._config.recovery_timeout_seconds - elapsed)

    # ── Observability ─────────────────────────────────────────────────

    def health_snapshot(self) -> dict:
        return {
            "adapter": self._adapter_name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "half_open_calls": self._half_open_calls,
        }

    async def force_open(self) -> None:
        """Manual kill-switch for ops."""
        async with self._lock:
            self._last_failure_time = time.monotonic()
            self._transition(CircuitState.OPEN)

    async def force_close(self) -> None:
        async with self._lock:
            self._transition(CircuitState.CLOSED)
