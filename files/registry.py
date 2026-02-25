"""
Integration Registry — centralized service locator for all external adapters.
Manages lifecycle (start/stop), provides dependency injection, and exposes
a unified health-check endpoint.
"""

import asyncio
import logging
from typing import Any, Dict, Optional

from core.base_adapter import BaseAdapter

from flights.adapter import create_flight_adapter, AmadeusAdapter
from hotels.adapter import create_hotel_adapter, BookingAdapter
from places.adapter import create_places_adapter, create_tripadvisor_adapter, GooglePlacesAdapter, TripAdvisorAdapter
from restaurants.adapter import create_restaurant_adapter, YelpAdapter
from weather.adapter import create_weather_adapter, OpenWeatherMapAdapter
from health.adapter import create_who_adapter, create_cdc_adapter, WHOHealthAdapter, CDCTravelerAdapter
from maps.adapter import create_maps_adapter, GoogleMapsAdapter
from calendar.adapter import (
    create_google_calendar_adapter, create_microsoft_calendar_adapter,
    create_apple_calendar_adapter,
    GoogleCalendarAdapter, MicrosoftGraphCalendarAdapter, AppleCalDAVAdapter,
)
from payments.adapter import create_payments_adapter, StripeAdapter
from social.adapter import (
    create_instagram_adapter, create_twitter_adapter, create_tiktok_adapter,
    InstagramAdapter, TwitterAdapter, TikTokAdapter,
)
from notifications.adapter import create_sendgrid_adapter, create_twilio_adapter, SendGridAdapter, TwilioAdapter
from analytics.adapter import (
    create_mixpanel_adapter, create_ga4_adapter, create_amplitude_adapter,
    MixpanelAdapter, GA4Adapter, AmplitudeAdapter,
)

logger = logging.getLogger(__name__)


class IntegrationRegistry:
    """
    Singleton registry that lazily initializes adapters and manages their lifecycle.
    Usage:
        registry = IntegrationRegistry()
        await registry.start()
        flights = registry.flights  # AmadeusAdapter (with Skyscanner fallback)
        ...
        await registry.shutdown()
    """

    def __init__(self):
        self._adapters: Dict[str, BaseAdapter] = {}
        self._started = False

    # ── Adapter accessors (lazy init) ─────────────────────────────────

    @property
    def flights(self) -> AmadeusAdapter:
        return self._get_or_create("flights", create_flight_adapter)

    @property
    def hotels(self) -> BookingAdapter:
        return self._get_or_create("hotels", create_hotel_adapter)

    @property
    def places(self) -> GooglePlacesAdapter:
        return self._get_or_create("places", create_places_adapter)

    @property
    def tripadvisor(self) -> TripAdvisorAdapter:
        return self._get_or_create("tripadvisor", create_tripadvisor_adapter)

    @property
    def restaurants(self) -> YelpAdapter:
        return self._get_or_create("restaurants", create_restaurant_adapter)

    @property
    def weather(self) -> OpenWeatherMapAdapter:
        return self._get_or_create("weather", create_weather_adapter)

    @property
    def who_health(self) -> WHOHealthAdapter:
        return self._get_or_create("who_health", create_who_adapter)

    @property
    def cdc_health(self) -> CDCTravelerAdapter:
        return self._get_or_create("cdc_health", create_cdc_adapter)

    @property
    def maps(self) -> GoogleMapsAdapter:
        return self._get_or_create("maps", create_maps_adapter)

    @property
    def google_calendar(self) -> GoogleCalendarAdapter:
        return self._get_or_create("google_calendar", create_google_calendar_adapter)

    @property
    def microsoft_calendar(self) -> MicrosoftGraphCalendarAdapter:
        return self._get_or_create("microsoft_calendar", create_microsoft_calendar_adapter)

    @property
    def apple_calendar(self) -> AppleCalDAVAdapter:
        return self._get_or_create("apple_calendar", create_apple_calendar_adapter)

    @property
    def payments(self) -> StripeAdapter:
        return self._get_or_create("payments", create_payments_adapter)

    @property
    def instagram(self) -> InstagramAdapter:
        return self._get_or_create("instagram", create_instagram_adapter)

    @property
    def twitter(self) -> TwitterAdapter:
        return self._get_or_create("twitter", create_twitter_adapter)

    @property
    def tiktok(self) -> TikTokAdapter:
        return self._get_or_create("tiktok", create_tiktok_adapter)

    @property
    def email(self) -> SendGridAdapter:
        return self._get_or_create("email", create_sendgrid_adapter)

    @property
    def sms(self) -> TwilioAdapter:
        return self._get_or_create("sms", create_twilio_adapter)

    @property
    def mixpanel(self) -> MixpanelAdapter:
        return self._get_or_create("mixpanel", create_mixpanel_adapter)

    @property
    def ga4(self) -> GA4Adapter:
        return self._get_or_create("ga4", create_ga4_adapter)

    @property
    def amplitude(self) -> AmplitudeAdapter:
        return self._get_or_create("amplitude", create_amplitude_adapter)

    # ── Lifecycle ─────────────────────────────────────────────────────

    async def start(self) -> None:
        """Initialize all registered adapters."""
        logger.info("Starting integration registry with %d adapters …", len(self._adapters))
        start_tasks = [adapter.start() for adapter in self._adapters.values()]
        await asyncio.gather(*start_tasks, return_exceptions=True)
        self._started = True
        logger.info("Integration registry started.")

    async def shutdown(self) -> None:
        """Gracefully close all adapters."""
        logger.info("Shutting down integration registry …")
        close_tasks = [adapter.close() for adapter in self._adapters.values()]
        await asyncio.gather(*close_tasks, return_exceptions=True)
        self._adapters.clear()
        self._started = False
        logger.info("Integration registry shut down.")

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *exc):
        await self.shutdown()

    # ── Health ────────────────────────────────────────────────────────

    def health_check(self) -> Dict[str, Any]:
        return {
            "status": "healthy" if self._started else "not_started",
            "adapter_count": len(self._adapters),
            "adapters": {
                name: adapter.health_check()
                for name, adapter in self._adapters.items()
            },
        }

    # ── Internal ──────────────────────────────────────────────────────

    def _get_or_create(self, name: str, factory) -> BaseAdapter:
        if name not in self._adapters:
            self._adapters[name] = factory()
        return self._adapters[name]


# Global singleton (import and use in application)
registry = IntegrationRegistry()
