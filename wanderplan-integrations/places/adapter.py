"""
Places of Interest — Google Places API (primary) + TripAdvisor Content API (supplement).
API key · 1000 req/day (free tier) · 1-hr cache · TripAdvisor for deeper reviews
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import PLACES_GOOGLE, PLACES_TRIPADVISOR


@dataclass
class PointOfInterest:
    id: str
    source: str
    name: str
    category: str
    rating: float
    total_reviews: int
    latitude: float
    longitude: float
    address: str
    photo_urls: List[str] = field(default_factory=list)
    reviews: List[Dict[str, Any]] = field(default_factory=list)
    opening_hours: Optional[Dict] = None
    price_level: Optional[int] = None


class GooglePlacesAdapter(BaseAdapter):
    """Google Places API — POI discovery, photos, reviews."""

    def __init__(self):
        super().__init__(PLACES_GOOGLE)
        self._api_key = os.getenv("GOOGLE_PLACES_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {}  # Google Places uses query-param auth

    async def search_nearby(
        self,
        latitude: float,
        longitude: float,
        radius_m: int = 5000,
        place_type: str = "tourist_attraction",
        max_results: int = 20,
    ) -> List[PointOfInterest]:
        params = {
            "location": f"{latitude},{longitude}",
            "radius": radius_m,
            "type": place_type,
            "key": self._api_key,
        }
        cache_key = ("nearby", latitude, longitude, radius_m, place_type)
        data = await self._request(
            "GET", "/nearbysearch/json",
            params=params,
            cache_key_parts=cache_key,
        )
        return [self._parse_place(p) for p in data.get("results", [])[:max_results]]

    async def text_search(self, query: str, region: Optional[str] = None) -> List[PointOfInterest]:
        params = {"query": query, "key": self._api_key}
        if region:
            params["region"] = region
        cache_key = ("text", query, region)
        data = await self._request(
            "GET", "/textsearch/json",
            params=params,
            cache_key_parts=cache_key,
        )
        return [self._parse_place(p) for p in data.get("results", [])]

    async def get_details(self, place_id: str) -> PointOfInterest:
        params = {
            "place_id": place_id,
            "fields": "name,rating,formatted_address,geometry,photos,reviews,opening_hours,price_level,types",
            "key": self._api_key,
        }
        cache_key = ("details", place_id)
        data = await self._request(
            "GET", "/details/json",
            params=params,
            cache_key_parts=cache_key,
        )
        return self._parse_detail(data.get("result", {}), place_id)

    def _parse_place(self, raw: Dict) -> PointOfInterest:
        geo = raw.get("geometry", {}).get("location", {})
        types = raw.get("types", [])
        return PointOfInterest(
            id=raw.get("place_id", ""),
            source="google_places",
            name=raw.get("name", ""),
            category=types[0] if types else "unknown",
            rating=float(raw.get("rating", 0)),
            total_reviews=raw.get("user_ratings_total", 0),
            latitude=float(geo.get("lat", 0)),
            longitude=float(geo.get("lng", 0)),
            address=raw.get("vicinity", ""),
            price_level=raw.get("price_level"),
        )

    def _parse_detail(self, raw: Dict, place_id: str) -> PointOfInterest:
        geo = raw.get("geometry", {}).get("location", {})
        photo_urls = [
            f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference={p['photo_reference']}&key={self._api_key}"
            for p in raw.get("photos", [])[:5]
        ]
        reviews = [
            {"author": r.get("author_name"), "rating": r.get("rating"), "text": r.get("text"), "time": r.get("relative_time_description")}
            for r in raw.get("reviews", [])
        ]
        types = raw.get("types", [])
        return PointOfInterest(
            id=place_id,
            source="google_places",
            name=raw.get("name", ""),
            category=types[0] if types else "unknown",
            rating=float(raw.get("rating", 0)),
            total_reviews=len(raw.get("reviews", [])),
            latitude=float(geo.get("lat", 0)),
            longitude=float(geo.get("lng", 0)),
            address=raw.get("formatted_address", ""),
            photo_urls=photo_urls,
            reviews=reviews,
            opening_hours=raw.get("opening_hours"),
            price_level=raw.get("price_level"),
        )


class TripAdvisorAdapter(BaseAdapter):
    """TripAdvisor Content API — supplementary deep reviews."""

    def __init__(self):
        super().__init__(PLACES_TRIPADVISOR)
        self._api_key = os.getenv("TRIPADVISOR_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"accept": "application/json"}

    async def search_location(self, query: str, category: str = "attractions") -> List[Dict]:
        params = {"searchQuery": query, "category": category, "key": self._api_key}
        cache_key = ("search", query, category)
        data = await self._request("GET", "/location/search", params=params, cache_key_parts=cache_key)
        return data.get("data", [])

    async def get_reviews(self, location_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        params = {"key": self._api_key}
        cache_key = ("reviews", location_id)
        data = await self._request(
            "GET", f"/location/{location_id}/reviews",
            params=params,
            cache_key_parts=cache_key,
        )
        return [
            {
                "id": r.get("id"),
                "title": r.get("title"),
                "text": r.get("text"),
                "rating": r.get("rating"),
                "published_date": r.get("published_date"),
                "trip_type": r.get("trip_type"),
            }
            for r in data.get("data", [])[:limit]
        ]

    async def get_photos(self, location_id: str, limit: int = 5) -> List[str]:
        params = {"key": self._api_key}
        cache_key = ("photos", location_id)
        data = await self._request(
            "GET", f"/location/{location_id}/photos",
            params=params,
            cache_key_parts=cache_key,
        )
        return [
            p.get("images", {}).get("large", {}).get("url", "")
            for p in data.get("data", [])[:limit]
        ]


def create_places_adapter() -> GooglePlacesAdapter:
    return GooglePlacesAdapter()

def create_tripadvisor_adapter() -> TripAdvisorAdapter:
    return TripAdvisorAdapter()
