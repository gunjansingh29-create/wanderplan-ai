"""
Restaurants — Yelp Fusion API.
API key · 5000 req/day · 30-min cache · cuisine & dietary tag filtering
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import RESTAURANTS_YELP


@dataclass
class Restaurant:
    id: str
    name: str
    rating: float
    review_count: int
    price: str  # $, $$, $$$, $$$$
    cuisine_types: List[str]
    latitude: float
    longitude: float
    address: str
    phone: str
    image_url: str
    is_open: bool
    distance_m: Optional[float] = None
    dietary_tags: List[str] = field(default_factory=list)


class YelpAdapter(BaseAdapter):
    """Yelp Fusion API — restaurant search, reviews, photos."""

    def __init__(self):
        super().__init__(RESTAURANTS_YELP)
        self._api_key = os.getenv("YELP_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    async def search_restaurants(
        self,
        latitude: float,
        longitude: float,
        radius_m: int = 5000,
        cuisine: Optional[str] = None,
        dietary_tags: Optional[List[str]] = None,
        price_levels: Optional[List[int]] = None,
        sort_by: str = "best_match",
        max_results: int = 20,
    ) -> List[Restaurant]:
        """
        Search restaurants near a coordinate.
        dietary_tags: e.g. ["vegan", "gluten_free", "halal", "kosher"]
        price_levels: 1-4 ($-$$$$)
        """
        categories = "restaurants"
        if cuisine:
            categories = f"{cuisine},{categories}"
        if dietary_tags:
            categories += "," + ",".join(dietary_tags)

        params = {
            "latitude": latitude,
            "longitude": longitude,
            "radius": min(radius_m, 40000),
            "categories": categories,
            "sort_by": sort_by,
            "limit": min(max_results, 50),
        }
        if price_levels:
            params["price"] = ",".join(str(p) for p in price_levels)

        cache_key = ("search", latitude, longitude, radius_m, cuisine, str(dietary_tags), str(price_levels))
        data = await self._request(
            "GET", "/businesses/search",
            params=params,
            cache_key_parts=cache_key,
        )
        return [self._parse_business(b) for b in data.get("businesses", [])]

    async def get_restaurant_details(self, business_id: str) -> Restaurant:
        cache_key = ("details", business_id)
        data = await self._request(
            "GET", f"/businesses/{business_id}",
            cache_key_parts=cache_key,
        )
        return self._parse_business(data)

    async def get_reviews(self, business_id: str, limit: int = 5) -> List[Dict[str, Any]]:
        cache_key = ("reviews", business_id)
        data = await self._request(
            "GET", f"/businesses/{business_id}/reviews",
            params={"limit": limit, "sort_by": "yelp_sort"},
            cache_key_parts=cache_key,
        )
        return [
            {
                "id": r.get("id"),
                "rating": r.get("rating"),
                "text": r.get("text"),
                "time_created": r.get("time_created"),
                "user": r.get("user", {}).get("name"),
            }
            for r in data.get("reviews", [])
        ]

    def _parse_business(self, raw: Dict) -> Restaurant:
        loc = raw.get("location", {})
        coords = raw.get("coordinates", {})
        categories = raw.get("categories", [])
        cuisine_types = [c.get("alias", "") for c in categories]
        dietary = [c for c in cuisine_types if c in ("vegan", "vegetarian", "gluten_free", "halal", "kosher")]
        address_parts = [loc.get("address1", ""), loc.get("city", ""), loc.get("state", "")]
        return Restaurant(
            id=raw.get("id", ""),
            name=raw.get("name", ""),
            rating=float(raw.get("rating", 0)),
            review_count=raw.get("review_count", 0),
            price=raw.get("price", ""),
            cuisine_types=cuisine_types,
            latitude=float(coords.get("latitude", 0)),
            longitude=float(coords.get("longitude", 0)),
            address=", ".join(p for p in address_parts if p),
            phone=raw.get("display_phone", ""),
            image_url=raw.get("image_url", ""),
            is_open=not raw.get("is_closed", True),
            distance_m=raw.get("distance"),
            dietary_tags=dietary,
        )


def create_restaurant_adapter() -> YelpAdapter:
    return YelpAdapter()
