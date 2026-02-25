"""
Analytics — Mixpanel (events), Google Analytics 4 (web), Amplitude (product).
Fire-and-forget with async batching. No caching. Lightweight circuit breaker.
"""

import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import ANALYTICS_MIXPANEL, ANALYTICS_GA4, ANALYTICS_AMPLITUDE


@dataclass
class AnalyticsEvent:
    event_name: str
    user_id: str
    properties: Dict[str, Any] = field(default_factory=dict)
    timestamp: Optional[float] = None


class AnalyticsBatchBuffer:
    """
    Lightweight in-memory buffer that flushes events in batches.
    Production: replace with Kafka / SQS for durability.
    """

    def __init__(self, max_size: int = 50, flush_interval_seconds: float = 10.0):
        self._buffer: List[Dict[str, Any]] = []
        self._max_size = max_size
        self._flush_interval = flush_interval_seconds
        self._last_flush = time.time()

    def add(self, event: Dict[str, Any]) -> bool:
        self._buffer.append(event)
        should_flush = (
            len(self._buffer) >= self._max_size
            or (time.time() - self._last_flush) >= self._flush_interval
        )
        return should_flush

    def drain(self) -> List[Dict[str, Any]]:
        events = self._buffer[:]
        self._buffer.clear()
        self._last_flush = time.time()
        return events


# ─── Mixpanel ─────────────────────────────────────────────────────────

class MixpanelAdapter(BaseAdapter):
    """Mixpanel — granular event tracking for user behavior analytics."""

    def __init__(self):
        super().__init__(ANALYTICS_MIXPANEL)
        self._token = os.getenv("MIXPANEL_TOKEN", "")
        self._buffer = AnalyticsBatchBuffer()

    def _api_key_header(self) -> Dict[str, str]:
        return {"Accept": "text/plain"}

    async def track(self, event: AnalyticsEvent) -> None:
        payload = {
            "event": event.event_name,
            "properties": {
                "token": self._token,
                "distinct_id": event.user_id,
                "time": int(event.timestamp or time.time()),
                "$insert_id": str(uuid.uuid4()),
                **event.properties,
            },
        }
        should_flush = self._buffer.add(payload)
        if should_flush:
            await self._flush()

    async def _flush(self) -> None:
        events = self._buffer.drain()
        if not events:
            return
        try:
            await self._request(
                "POST", "/track",
                json_body=events,
                skip_cache=True,
            )
        except Exception:
            pass  # analytics is best-effort; don't break user flows

    async def track_search(self, user_id: str, query: str, result_count: int) -> None:
        await self.track(AnalyticsEvent("search_performed", user_id, {
            "query": query, "result_count": result_count,
        }))

    async def track_booking(self, user_id: str, booking_type: str, amount: float, currency: str) -> None:
        await self.track(AnalyticsEvent("booking_completed", user_id, {
            "type": booking_type, "amount": amount, "currency": currency,
        }))


# ─── Google Analytics 4 ──────────────────────────────────────────────

class GA4Adapter(BaseAdapter):
    """Google Analytics 4 — Measurement Protocol for server-side web analytics."""

    def __init__(self):
        super().__init__(ANALYTICS_GA4)
        self._measurement_id = os.getenv("GA4_MEASUREMENT_ID", "")
        self._api_secret = os.getenv("GA4_API_SECRET", "")
        self._buffer = AnalyticsBatchBuffer()

    async def track(self, event: AnalyticsEvent) -> None:
        payload = {
            "client_id": event.user_id,
            "events": [
                {
                    "name": event.event_name,
                    "params": {
                        **event.properties,
                        "engagement_time_msec": "100",
                    },
                }
            ],
        }
        should_flush = self._buffer.add(payload)
        if should_flush:
            await self._flush()

    async def _flush(self) -> None:
        events = self._buffer.drain()
        for payload in events:
            try:
                await self._request(
                    "POST", f"?measurement_id={self._measurement_id}&api_secret={self._api_secret}",
                    json_body=payload,
                    skip_cache=True,
                )
            except Exception:
                pass

    async def track_page_view(self, user_id: str, page_path: str, page_title: str) -> None:
        await self.track(AnalyticsEvent("page_view", user_id, {
            "page_location": page_path, "page_title": page_title,
        }))


# ─── Amplitude ────────────────────────────────────────────────────────

class AmplitudeAdapter(BaseAdapter):
    """Amplitude — product analytics with user properties and event tracking."""

    def __init__(self):
        super().__init__(ANALYTICS_AMPLITUDE)
        self._api_key = os.getenv("AMPLITUDE_API_KEY", "")
        self._buffer = AnalyticsBatchBuffer()

    def _api_key_header(self) -> Dict[str, str]:
        return {"Content-Type": "application/json"}

    async def track(self, event: AnalyticsEvent) -> None:
        payload = {
            "api_key": self._api_key,
            "events": [
                {
                    "user_id": event.user_id,
                    "event_type": event.event_name,
                    "time": int((event.timestamp or time.time()) * 1000),
                    "event_properties": event.properties,
                }
            ],
        }
        should_flush = self._buffer.add(payload)
        if should_flush:
            await self._flush()

    async def _flush(self) -> None:
        events = self._buffer.drain()
        for payload in events:
            try:
                await self._request(
                    "POST", "/httpapi",
                    json_body=payload,
                    skip_cache=True,
                )
            except Exception:
                pass

    async def set_user_properties(self, user_id: str, properties: Dict[str, Any]) -> None:
        payload = {
            "api_key": self._api_key,
            "events": [{
                "user_id": user_id,
                "event_type": "$identify",
                "user_properties": {"$set": properties},
            }],
        }
        try:
            await self._request("POST", "/httpapi", json_body=payload, skip_cache=True)
        except Exception:
            pass

    async def track_feature_usage(self, user_id: str, feature: str, details: Dict = None) -> None:
        await self.track(AnalyticsEvent("feature_used", user_id, {
            "feature_name": feature, **(details or {}),
        }))


def create_mixpanel_adapter() -> MixpanelAdapter:
    return MixpanelAdapter()

def create_ga4_adapter() -> GA4Adapter:
    return GA4Adapter()

def create_amplitude_adapter() -> AmplitudeAdapter:
    return AmplitudeAdapter()
