"""
Hotel Adapters — Booking.com Connectivity API (primary) + Expedia Rapid (fallback).
Basic auth · 5 req/s · 10-min cache · circuit-breaker w/ auto-fallback
"""

import base64
import os
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import HOTELS_BOOKING, HOTELS_EXPEDIA


@dataclass
class HotelListing:
    id: str
    source: str
    name: str
    star_rating: float
    review_score: float
    price_per_night: float
    currency: str
    address: str
    latitude: float
    longitude: float
    amenities: List[str]
    thumbnail_url: Optional[str] = None


class BookingAdapter(BaseAdapter):
    """Booking.com Connectivity API."""

    def __init__(self, fallback: Optional[BaseAdapter] = None):
        super().__init__(HOTELS_BOOKING, fallback=fallback)
        self._username = os.getenv("BOOKING_USERNAME", "")
        self._password = os.getenv("BOOKING_PASSWORD", "")

    async def _build_headers(self, extra=None) -> Dict[str, str]:
        h = await super()._build_headers(extra)
        creds = base64.b64encode(f"{self._username}:{self._password}".encode()).decode()
        h["Authorization"] = f"Basic {creds}"
        return h

    async def search_hotels(
        self,
        city: str,
        checkin: date,
        checkout: date,
        guests: int = 2,
        rooms: int = 1,
        min_stars: int = 0,
        max_results: int = 20,
    ) -> List[HotelListing]:
        params = {
            "city": city,
            "checkin": checkin.isoformat(),
            "checkout": checkout.isoformat(),
            "guest_qty": guests,
            "room_qty": rooms,
            "min_class": min_stars,
            "rows": max_results,
        }
        cache_key = ("search", city, str(checkin), str(checkout), guests, rooms)
        data = await self._request(
            "GET", "/hotels",
            params=params,
            cache_key_parts=cache_key,
        )
        return [self._parse_hotel(h) for h in data.get("result", [])]

    async def get_availability(self, hotel_id: str, checkin: date, checkout: date) -> Dict[str, Any]:
        cache_key = ("availability", hotel_id, str(checkin), str(checkout))
        return await self._request(
            "GET", f"/hotels/{hotel_id}/availability",
            params={"checkin": checkin.isoformat(), "checkout": checkout.isoformat()},
            cache_key_parts=cache_key,
        )

    def _parse_hotel(self, raw: Dict) -> HotelListing:
        return HotelListing(
            id=str(raw.get("hotel_id", "")),
            source="booking",
            name=raw.get("hotel_name", ""),
            star_rating=float(raw.get("class", 0)),
            review_score=float(raw.get("review_score", 0)),
            price_per_night=float(raw.get("min_total_price", 0)),
            currency=raw.get("currency_code", "USD"),
            address=raw.get("address", ""),
            latitude=float(raw.get("latitude", 0)),
            longitude=float(raw.get("longitude", 0)),
            amenities=raw.get("hotel_facilities", []),
            thumbnail_url=raw.get("main_photo_url"),
        )


class ExpediaAdapter(BaseAdapter):
    """Expedia Rapid API — fallback hotel search."""

    def __init__(self):
        super().__init__(HOTELS_EXPEDIA)
        self._api_key = os.getenv("EXPEDIA_API_KEY", "")
        self._secret = os.getenv("EXPEDIA_API_SECRET", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"Authorization": f"EAN apikey={self._api_key}"}

    async def search_hotels(
        self,
        city: str,
        checkin: date,
        checkout: date,
        guests: int = 2,
        rooms: int = 1,
        min_stars: int = 0,
        max_results: int = 20,
    ) -> List[HotelListing]:
        params = {
            "region_id": city,
            "checkin": checkin.isoformat(),
            "checkout": checkout.isoformat(),
            "occupancy": f"{guests}",
            "filter": f"star_rating.gte={min_stars}" if min_stars else "",
        }
        cache_key = ("search", city, str(checkin), str(checkout), guests, rooms)
        data = await self._request(
            "GET", "/properties/availability",
            params=params,
            cache_key_parts=cache_key,
        )
        return [self._parse_hotel(h) for h in data.get("properties", [])[:max_results]]

    def _parse_hotel(self, raw: Dict) -> HotelListing:
        rates = raw.get("rates", [{}])
        price = float(rates[0].get("avg_nightly_rate", {}).get("value", 0)) if rates else 0
        geo = raw.get("geo", {})
        return HotelListing(
            id=str(raw.get("property_id", "")),
            source="expedia",
            name=raw.get("name", ""),
            star_rating=float(raw.get("star_rating", 0)),
            review_score=float(raw.get("guest_rating", 0)),
            price_per_night=price,
            currency="USD",
            address=raw.get("address", {}).get("line_1", ""),
            latitude=float(geo.get("latitude", 0)),
            longitude=float(geo.get("longitude", 0)),
            amenities=[a.get("name", "") for a in raw.get("amenities", [])],
            thumbnail_url=raw.get("images", [{}])[0].get("url") if raw.get("images") else None,
        )


def create_hotel_adapter() -> BookingAdapter:
    """Factory: Booking.com primary with Expedia fallback."""
    fallback = ExpediaAdapter()
    return BookingAdapter(fallback=fallback)
