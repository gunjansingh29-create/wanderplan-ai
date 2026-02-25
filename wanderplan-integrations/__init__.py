"""
WanderPlan AI — External Integration Adapter Layer
===================================================

Provides resilient, production-grade adapters for all third-party services
with unified retry, circuit-breaker, caching, and rate-limiting infrastructure.

Usage:
    from registry import registry

    async with registry:
        flights = await registry.flights.search_flights("JFK", "CDG", date(2025, 6, 1))
        hotels = await registry.hotels.search_hotels("Paris", date(2025, 6, 1), date(2025, 6, 5))
        weather = await registry.weather.get_forecast(48.8566, 2.3522)
"""

__version__ = "1.0.0"
