"""
Flight Search Adapters — Amadeus Self-Service (primary) + Skyscanner (fallback).
OAuth2 client-credentials flow · 10 req/s · 15-min cache · circuit-breaker w/ auto-fallback
"""

import os
import time
from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import FLIGHTS_AMADEUS, FLIGHTS_SKYSCANNER


@dataclass
class FlightOffer:
    id: str
    source: str
    price_total: float
    currency: str
    departure: str
    arrival: str
    segments: List[Dict[str, Any]]
    booking_url: Optional[str] = None


class AmadeusAdapter(BaseAdapter):
    """Amadeus Self-Service API — flight offers, pricing, booking."""

    def __init__(self, fallback: Optional[BaseAdapter] = None):
        super().__init__(FLIGHTS_AMADEUS, fallback=fallback)
        self._client_id = os.getenv("AMADEUS_CLIENT_ID", "")
        self._client_secret = os.getenv("AMADEUS_CLIENT_SECRET", "")

    async def _refresh_oauth2_token(self) -> tuple[str, float]:
        url = "https://api.amadeus.com/v1/security/oauth2/token"
        async with self._session.post(
            url,
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
        ) as resp:
            data = await resp.json()
            token = data["access_token"]
            expires_in = data.get("expires_in", 1799)
            return token, time.time() + expires_in - 60

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: date,
        return_date: Optional[date] = None,
        adults: int = 1,
        cabin_class: str = "ECONOMY",
        max_results: int = 10,
    ) -> List[FlightOffer]:
        params = {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": departure_date.isoformat(),
            "adults": adults,
            "travelClass": cabin_class,
            "max": max_results,
            "currencyCode": "USD",
        }
        if return_date:
            params["returnDate"] = return_date.isoformat()

        cache_key = ("search", origin, destination, str(departure_date), str(return_date), adults)
        data = await self._request(
            "GET", "/shopping/flight-offers",
            params=params,
            cache_key_parts=cache_key,
        )
        return [self._parse_offer(o) for o in data.get("data", [])]

    async def get_price(self, offer_id: str, raw_offer: Dict) -> Dict[str, Any]:
        data = await self._request(
            "POST", "/shopping/flight-offers/pricing",
            json_body={"data": {"type": "flight-offers-pricing", "flightOffers": [raw_offer]}},
            skip_cache=True,
        )
        return data

    async def create_booking(self, offer: Dict, travelers: List[Dict]) -> Dict[str, Any]:
        return await self._request(
            "POST", "/booking/flight-orders",
            json_body={
                "data": {
                    "type": "flight-order",
                    "flightOffers": [offer],
                    "travelers": travelers,
                }
            },
            skip_cache=True,
        )

    def _parse_offer(self, raw: Dict) -> FlightOffer:
        price = raw.get("price", {})
        itineraries = raw.get("itineraries", [{}])
        segments = []
        for itin in itineraries:
            for seg in itin.get("segments", []):
                segments.append({
                    "departure": seg["departure"],
                    "arrival": seg["arrival"],
                    "carrier": seg.get("carrierCode"),
                    "flight_number": seg.get("number"),
                    "duration": seg.get("duration"),
                })
        first_seg = segments[0] if segments else {}
        return FlightOffer(
            id=raw.get("id", ""),
            source="amadeus",
            price_total=float(price.get("grandTotal", 0)),
            currency=price.get("currency", "USD"),
            departure=first_seg.get("departure", {}).get("at", ""),
            arrival=segments[-1].get("arrival", {}).get("at", "") if segments else "",
            segments=segments,
        )


class SkyscannerAdapter(BaseAdapter):
    """Skyscanner Partners API — fallback flight search."""

    def __init__(self):
        super().__init__(FLIGHTS_SKYSCANNER)
        self._api_key = os.getenv("SKYSCANNER_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"x-api-key": self._api_key}

    async def search_flights(
        self,
        origin: str,
        destination: str,
        departure_date: date,
        return_date: Optional[date] = None,
        adults: int = 1,
        cabin_class: str = "ECONOMY",
        max_results: int = 10,
    ) -> List[FlightOffer]:
        body = {
            "query": {
                "market": "US",
                "locale": "en-US",
                "currency": "USD",
                "queryLegs": [
                    {
                        "originPlaceId": {"iata": origin},
                        "destinationPlaceId": {"iata": destination},
                        "date": {"year": departure_date.year, "month": departure_date.month, "day": departure_date.day},
                    }
                ],
                "adults": adults,
                "cabinClass": cabin_class.replace("_", "").upper(),
            }
        }
        if return_date:
            body["query"]["queryLegs"].append({
                "originPlaceId": {"iata": destination},
                "destinationPlaceId": {"iata": origin},
                "date": {"year": return_date.year, "month": return_date.month, "day": return_date.day},
            })

        cache_key = ("search", origin, destination, str(departure_date), str(return_date), adults)
        data = await self._request(
            "POST", "/flights/live/search/create",
            json_body=body,
            cache_key_parts=cache_key,
        )
        return self._parse_results(data, max_results)

    def _parse_results(self, data: Dict, max_results: int) -> List[FlightOffer]:
        offers = []
        for itin_id, itin in list(data.get("content", {}).get("results", {}).get("itineraries", {}).items())[:max_results]:
            price_opts = itin.get("pricingOptions", [{}])
            price = price_opts[0].get("price", {}).get("amount", "0") if price_opts else "0"
            offers.append(FlightOffer(
                id=itin_id,
                source="skyscanner",
                price_total=float(price) / 1000,  # milliunits
                currency="USD",
                departure="",
                arrival="",
                segments=[],
            ))
        return offers


def create_flight_adapter() -> AmadeusAdapter:
    """Factory: Amadeus primary with Skyscanner fallback."""
    fallback = SkyscannerAdapter()
    return AmadeusAdapter(fallback=fallback)
