"""
Retry policy with exponential backoff, jitter, and retryable status filtering.
"""

import asyncio
import logging
import random
from functools import wraps
from typing import Any, Callable, Optional, Type

from config import RetryPolicy

logger = logging.getLogger(__name__)


class RetryExhaustedError(Exception):
    """Raised when all retry attempts have been exhausted."""

    def __init__(self, adapter_name: str, attempts: int, last_exception: Exception):
        self.adapter_name = adapter_name
        self.attempts = attempts
        self.last_exception = last_exception
        super().__init__(
            f"[{adapter_name}] All {attempts} retry attempts exhausted. "
            f"Last error: {last_exception}"
        )


def compute_backoff_delay(
    attempt: int,
    policy: RetryPolicy,
) -> float:
    """Calculate delay with exponential backoff and optional jitter."""
    delay = min(
        policy.base_delay_seconds * (policy.exponential_base ** attempt),
        policy.max_delay_seconds,
    )
    if policy.jitter:
        delay = delay * (0.5 + random.random())  # jitter between 50%-150%
    return delay


def is_retryable_status(status_code: int, policy: RetryPolicy) -> bool:
    return status_code in policy.retryable_status_codes


def is_retryable_exception(exc: Exception) -> bool:
    """Determine if the exception type warrants a retry."""
    retryable_types = (
        asyncio.TimeoutError,
        ConnectionError,
        ConnectionResetError,
        OSError,
    )
    return isinstance(exc, retryable_types)


async def execute_with_retry(
    func: Callable,
    *args: Any,
    policy: RetryPolicy,
    adapter_name: str = "unknown",
    **kwargs: Any,
) -> Any:
    """
    Execute an async callable with retry logic.

    Retries on:
      - Retryable HTTP status codes (via RetryableHTTPError)
      - Network / timeout exceptions
    """
    last_exception: Optional[Exception] = None

    for attempt in range(policy.max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except Exception as exc:
            last_exception = exc
            status_code = getattr(exc, "status_code", None)

            retryable = False
            if status_code and is_retryable_status(status_code, policy):
                retryable = True
            elif is_retryable_exception(exc):
                retryable = True

            if not retryable or attempt >= policy.max_retries:
                raise

            delay = compute_backoff_delay(attempt, policy)
            logger.warning(
                "[%s] Attempt %d/%d failed (%s). Retrying in %.2fs …",
                adapter_name,
                attempt + 1,
                policy.max_retries + 1,
                exc,
                delay,
            )
            await asyncio.sleep(delay)

    # Should not reach here, but safety net
    raise RetryExhaustedError(adapter_name, policy.max_retries + 1, last_exception)


def with_retry(policy: RetryPolicy, adapter_name: str = "unknown"):
    """Decorator version of execute_with_retry."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            return await execute_with_retry(
                func, *args, policy=policy, adapter_name=adapter_name, **kwargs
            )
        return wrapper
    return decorator
