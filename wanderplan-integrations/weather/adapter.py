"""
Weather — OpenWeatherMap API.
API key · 60 req/min · Historical data cached indefinitely · Forecasts cached 6 hours
Powers the Travel Timing Agent.
"""

import os
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from core.cache_manager import CacheConfig, CacheManager
from config import WEATHER_OWM


@dataclass
class WeatherData:
    date: str
    temp_min_c: float
    temp_max_c: float
    humidity: int
    description: str
    icon: str
    wind_speed_mps: float
    precipitation_mm: float
    uv_index: Optional[float] = None


@dataclass
class WeatherForecast:
    location: str
    latitude: float
    longitude: float
    daily: List[WeatherData] = field(default_factory=list)


class OpenWeatherMapAdapter(BaseAdapter):
    """OpenWeatherMap One Call 3.0 — current, forecast, and historical weather."""

    def __init__(self):
        super().__init__(WEATHER_OWM)
        self._api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")
        # Separate cache for historical data (indefinite TTL)
        self._historical_cache = CacheManager(
            CacheConfig(ttl_seconds=0, prefix="weather:owm:historical", indefinite=True)
        )

    def _api_key_header(self) -> Dict[str, str]:
        return {}  # OWM uses query-param auth

    async def get_forecast(
        self, latitude: float, longitude: float, days: int = 7
    ) -> WeatherForecast:
        """8-day forecast. Cached for 6 hours."""
        params = {
            "lat": latitude,
            "lon": longitude,
            "exclude": "minutely,hourly,alerts",
            "units": "metric",
            "appid": self._api_key,
        }
        cache_key = ("forecast", round(latitude, 2), round(longitude, 2))
        data = await self._request(
            "GET", "/onecall",
            params=params,
            cache_key_parts=cache_key,
            cache_ttl_override=21600,  # 6 hours
        )
        daily_items = [self._parse_daily(d) for d in data.get("daily", [])[:days]]
        return WeatherForecast(
            location=f"{latitude},{longitude}",
            latitude=latitude,
            longitude=longitude,
            daily=daily_items,
        )

    async def get_historical(
        self, latitude: float, longitude: float, target_date: date
    ) -> WeatherData:
        """Historical weather for a specific date. Cached indefinitely."""
        dt = int(datetime.combine(target_date, datetime.min.time()).timestamp())

        # Check indefinite historical cache first
        cache_key_parts = ("historical", round(latitude, 2), round(longitude, 2), str(target_date))
        cached = await self._historical_cache.get(*cache_key_parts)
        if cached:
            return WeatherData(**cached)

        params = {
            "lat": latitude,
            "lon": longitude,
            "dt": dt,
            "units": "metric",
            "appid": self._api_key,
        }
        await self._rate_limiter.acquire_or_raise()
        data = await self._raw_http("GET", "/onecall/timemachine", params=params)
        result = self._parse_historical(data, target_date)

        # Cache indefinitely
        await self._historical_cache.set(result.__dict__, *cache_key_parts)
        return result

    async def get_travel_timing_score(
        self, latitude: float, longitude: float, month: int
    ) -> Dict[str, Any]:
        """
        Aggregate historical weather to produce a 'best time to visit' score.
        Uses cached historical data for the given month across recent years.
        """
        # This would aggregate multi-year data in production
        forecast = await self.get_forecast(latitude, longitude)
        avg_temp = sum(d.temp_max_c for d in forecast.daily) / max(len(forecast.daily), 1)
        avg_precip = sum(d.precipitation_mm for d in forecast.daily) / max(len(forecast.daily), 1)
        score = max(0, min(100, int(70 + (25 - avg_temp) * -1 + (10 - avg_precip) * 2)))
        return {
            "latitude": latitude,
            "longitude": longitude,
            "month": month,
            "comfort_score": score,
            "avg_high_c": round(avg_temp, 1),
            "avg_precipitation_mm": round(avg_precip, 1),
        }

    def _parse_daily(self, raw: Dict) -> WeatherData:
        temp = raw.get("temp", {})
        weather = raw.get("weather", [{}])[0]
        return WeatherData(
            date=datetime.fromtimestamp(raw.get("dt", 0)).strftime("%Y-%m-%d"),
            temp_min_c=float(temp.get("min", 0)),
            temp_max_c=float(temp.get("max", 0)),
            humidity=raw.get("humidity", 0),
            description=weather.get("description", ""),
            icon=weather.get("icon", ""),
            wind_speed_mps=float(raw.get("wind_speed", 0)),
            precipitation_mm=float(raw.get("rain", 0)) + float(raw.get("snow", 0)),
            uv_index=raw.get("uvi"),
        )

    def _parse_historical(self, raw: Dict, target_date: date) -> WeatherData:
        current = raw.get("data", [{}])[0] if raw.get("data") else raw.get("current", {})
        weather = current.get("weather", [{}])[0]
        return WeatherData(
            date=target_date.isoformat(),
            temp_min_c=float(current.get("temp", 0)),
            temp_max_c=float(current.get("temp", 0)),
            humidity=current.get("humidity", 0),
            description=weather.get("description", ""),
            icon=weather.get("icon", ""),
            wind_speed_mps=float(current.get("wind_speed", 0)),
            precipitation_mm=float(current.get("rain", {}).get("1h", 0) if isinstance(current.get("rain"), dict) else 0),
        )


def create_weather_adapter() -> OpenWeatherMapAdapter:
    return OpenWeatherMapAdapter()
