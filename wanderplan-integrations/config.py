"""
WanderPlan AI — External Integration Configuration
Centralized configuration for all third-party service adapters.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AuthMethod(Enum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    BASIC = "basic"
    CALDAV = "caldav"
    STATIC = "static"


@dataclass(frozen=True)
class RetryPolicy:
    max_retries: int = 3
    base_delay_seconds: float = 1.0
    max_delay_seconds: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_status_codes: tuple = (429, 500, 502, 503, 504)


@dataclass(frozen=True)
class CircuitBreakerConfig:
    failure_threshold: int = 5
    recovery_timeout_seconds: int = 30
    half_open_max_calls: int = 3
    success_threshold: int = 2  # successes in half-open to close


@dataclass(frozen=True)
class RateLimitConfig:
    requests_per_second: Optional[float] = None
    requests_per_minute: Optional[float] = None
    requests_per_day: Optional[int] = None
    burst_size: Optional[int] = None


@dataclass(frozen=True)
class CacheConfig:
    ttl_seconds: int = 900  # 15 min default
    max_size: int = 10_000
    cache_backend: str = "redis"  # redis | memory
    prefix: str = ""
    indefinite: bool = False


@dataclass(frozen=True)
class IntegrationConfig:
    name: str
    base_url: str
    auth_method: AuthMethod
    rate_limit: RateLimitConfig
    cache: CacheConfig
    retry: RetryPolicy = field(default_factory=RetryPolicy)
    circuit_breaker: CircuitBreakerConfig = field(default_factory=CircuitBreakerConfig)
    timeout_seconds: float = 10.0
    fallback_name: Optional[str] = None


# ─── Integration Configurations ──────────────────────────────────────────────

FLIGHTS_AMADEUS = IntegrationConfig(
    name="amadeus",
    base_url="https://api.amadeus.com/v2",
    auth_method=AuthMethod.OAUTH2,
    rate_limit=RateLimitConfig(requests_per_second=10),
    cache=CacheConfig(ttl_seconds=900, prefix="flights:amadeus"),
    retry=RetryPolicy(max_retries=3, base_delay_seconds=1.0),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30),
    timeout_seconds=15.0,
    fallback_name="skyscanner",
)

FLIGHTS_SKYSCANNER = IntegrationConfig(
    name="skyscanner",
    base_url="https://partners.api.skyscanner.net/apiservices/v3",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=5),
    cache=CacheConfig(ttl_seconds=900, prefix="flights:skyscanner"),
    timeout_seconds=15.0,
)

HOTELS_BOOKING = IntegrationConfig(
    name="booking",
    base_url="https://distribution-xml.booking.com/2.12",
    auth_method=AuthMethod.BASIC,
    rate_limit=RateLimitConfig(requests_per_second=5),
    cache=CacheConfig(ttl_seconds=600, prefix="hotels:booking"),
    retry=RetryPolicy(max_retries=3),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=45),
    timeout_seconds=12.0,
    fallback_name="expedia",
)

HOTELS_EXPEDIA = IntegrationConfig(
    name="expedia",
    base_url="https://api.ean.com/v3",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=5),
    cache=CacheConfig(ttl_seconds=600, prefix="hotels:expedia"),
    timeout_seconds=12.0,
)

PLACES_GOOGLE = IntegrationConfig(
    name="google_places",
    base_url="https://maps.googleapis.com/maps/api/place",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_day=1000),
    cache=CacheConfig(ttl_seconds=3600, prefix="places:google"),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=60),
    timeout_seconds=8.0,
)

PLACES_TRIPADVISOR = IntegrationConfig(
    name="tripadvisor",
    base_url="https://api.content.tripadvisor.com/api/v1",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=2),
    cache=CacheConfig(ttl_seconds=3600, prefix="places:tripadvisor"),
    timeout_seconds=8.0,
)

RESTAURANTS_YELP = IntegrationConfig(
    name="yelp",
    base_url="https://api.yelp.com/v3",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_day=5000),
    cache=CacheConfig(ttl_seconds=1800, prefix="restaurants:yelp"),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30),
    timeout_seconds=8.0,
)

WEATHER_OWM = IntegrationConfig(
    name="openweathermap",
    base_url="https://api.openweathermap.org/data/3.0",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_minute=60),
    cache=CacheConfig(ttl_seconds=21600, prefix="weather:owm"),  # 6hr default; historical overridden
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30),
    timeout_seconds=8.0,
)

HEALTH_WHO = IntegrationConfig(
    name="who_health",
    base_url="",  # static dataset, no remote URL
    auth_method=AuthMethod.STATIC,
    rate_limit=RateLimitConfig(),
    cache=CacheConfig(ttl_seconds=604800, prefix="health:who", indefinite=False),  # 7 days
    timeout_seconds=5.0,
)

HEALTH_CDC = IntegrationConfig(
    name="cdc_traveler",
    base_url="https://wwwnc.cdc.gov/travel/api/v1",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_minute=30),
    cache=CacheConfig(ttl_seconds=3600, prefix="health:cdc"),
    timeout_seconds=8.0,
)

MAPS_GOOGLE = IntegrationConfig(
    name="google_maps",
    base_url="https://maps.googleapis.com/maps/api",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=50),
    cache=CacheConfig(ttl_seconds=86400, prefix="maps:google"),  # 24h for routes
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30),
    timeout_seconds=10.0,
)

CALENDAR_GOOGLE = IntegrationConfig(
    name="google_calendar",
    base_url="https://www.googleapis.com/calendar/v3",
    auth_method=AuthMethod.OAUTH2,
    rate_limit=RateLimitConfig(requests_per_second=10),
    cache=CacheConfig(ttl_seconds=300, prefix="calendar:google"),
    timeout_seconds=8.0,
)

CALENDAR_MICROSOFT = IntegrationConfig(
    name="microsoft_graph",
    base_url="https://graph.microsoft.com/v1.0",
    auth_method=AuthMethod.OAUTH2,
    rate_limit=RateLimitConfig(requests_per_second=10),
    cache=CacheConfig(ttl_seconds=300, prefix="calendar:microsoft"),
    timeout_seconds=8.0,
)

CALENDAR_APPLE = IntegrationConfig(
    name="apple_caldav",
    base_url="https://caldav.icloud.com",
    auth_method=AuthMethod.CALDAV,
    rate_limit=RateLimitConfig(requests_per_second=2),
    cache=CacheConfig(ttl_seconds=300, prefix="calendar:apple"),
    timeout_seconds=10.0,
)

PAYMENTS_STRIPE = IntegrationConfig(
    name="stripe",
    base_url="https://api.stripe.com/v1",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=100),
    cache=CacheConfig(ttl_seconds=0, prefix="payments:stripe"),  # no caching for payments
    retry=RetryPolicy(max_retries=2, retryable_status_codes=(429, 500, 502, 503)),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=3, recovery_timeout_seconds=60),
    timeout_seconds=30.0,
)

SOCIAL_INSTAGRAM = IntegrationConfig(
    name="instagram",
    base_url="https://graph.instagram.com/v18.0",
    auth_method=AuthMethod.OAUTH2,
    rate_limit=RateLimitConfig(requests_per_minute=200),
    cache=CacheConfig(ttl_seconds=0, prefix="social:instagram"),
    timeout_seconds=15.0,
)

SOCIAL_TWITTER = IntegrationConfig(
    name="twitter",
    base_url="https://api.twitter.com/2",
    auth_method=AuthMethod.OAUTH2,
    rate_limit=RateLimitConfig(requests_per_minute=300),
    cache=CacheConfig(ttl_seconds=0, prefix="social:twitter"),
    timeout_seconds=10.0,
)

SOCIAL_TIKTOK = IntegrationConfig(
    name="tiktok",
    base_url="https://open.tiktokapis.com/v2",
    auth_method=AuthMethod.OAUTH2,
    rate_limit=RateLimitConfig(requests_per_minute=100),
    cache=CacheConfig(ttl_seconds=0, prefix="social:tiktok"),
    timeout_seconds=15.0,
)

EMAIL_SENDGRID = IntegrationConfig(
    name="sendgrid",
    base_url="https://api.sendgrid.com/v3",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=100),
    cache=CacheConfig(ttl_seconds=0, prefix="email:sendgrid"),
    retry=RetryPolicy(max_retries=3),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30),
    timeout_seconds=10.0,
)

SMS_TWILIO = IntegrationConfig(
    name="twilio",
    base_url="https://api.twilio.com/2010-04-01",
    auth_method=AuthMethod.BASIC,
    rate_limit=RateLimitConfig(requests_per_second=50),
    cache=CacheConfig(ttl_seconds=0, prefix="sms:twilio"),
    retry=RetryPolicy(max_retries=3),
    circuit_breaker=CircuitBreakerConfig(failure_threshold=5, recovery_timeout_seconds=30),
    timeout_seconds=10.0,
)

ANALYTICS_MIXPANEL = IntegrationConfig(
    name="mixpanel",
    base_url="https://api.mixpanel.com",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=50),
    cache=CacheConfig(ttl_seconds=0, prefix="analytics:mixpanel"),
    timeout_seconds=5.0,
)

ANALYTICS_GA4 = IntegrationConfig(
    name="ga4",
    base_url="https://www.google-analytics.com/mp/collect",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=50),
    cache=CacheConfig(ttl_seconds=0, prefix="analytics:ga4"),
    timeout_seconds=5.0,
)

ANALYTICS_AMPLITUDE = IntegrationConfig(
    name="amplitude",
    base_url="https://api2.amplitude.com/2",
    auth_method=AuthMethod.API_KEY,
    rate_limit=RateLimitConfig(requests_per_second=50),
    cache=CacheConfig(ttl_seconds=0, prefix="analytics:amplitude"),
    timeout_seconds=5.0,
)
