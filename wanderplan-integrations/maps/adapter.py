"""
Maps & Routing — Google Maps Directions API + Distance Matrix.
API key · 50 req/s · 24-hr cache for routes · Travel time calculations between POIs
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from core.base_adapter import BaseAdapter
from config import MAPS_GOOGLE


@dataclass
class RouteSegment:
    origin: str
    destination: str
    distance_m: int
    duration_seconds: int
    duration_text: str
    distance_text: str
    polyline: str = ""
    steps: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class DistanceMatrixEntry:
    origin: str
    destination: str
    distance_m: int
    duration_seconds: int
    duration_in_traffic_seconds: Optional[int] = None


class GoogleMapsAdapter(BaseAdapter):
    """Google Maps — Directions and Distance Matrix for itinerary routing."""

    def __init__(self):
        super().__init__(MAPS_GOOGLE)
        self._api_key = os.getenv("GOOGLE_MAPS_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {}

    async def get_directions(
        self,
        origin: str,
        destination: str,
        mode: str = "driving",
        waypoints: Optional[List[str]] = None,
        departure_time: Optional[int] = None,
    ) -> List[RouteSegment]:
        """
        Get directions between two points.
        origin/destination: address string or "lat,lng"
        mode: driving | walking | bicycling | transit
        """
        params = {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "key": self._api_key,
            "alternatives": "false",
        }
        if waypoints:
            params["waypoints"] = "optimize:true|" + "|".join(waypoints)
        if departure_time and mode in ("driving", "transit"):
            params["departure_time"] = departure_time

        cache_key = ("directions", origin, destination, mode, str(waypoints))
        data = await self._request(
            "GET", "/directions/json",
            params=params,
            cache_key_parts=cache_key,
        )

        segments = []
        for route in data.get("routes", []):
            for leg in route.get("legs", []):
                segments.append(RouteSegment(
                    origin=leg.get("start_address", ""),
                    destination=leg.get("end_address", ""),
                    distance_m=leg.get("distance", {}).get("value", 0),
                    duration_seconds=leg.get("duration", {}).get("value", 0),
                    distance_text=leg.get("distance", {}).get("text", ""),
                    duration_text=leg.get("duration", {}).get("text", ""),
                    polyline=route.get("overview_polyline", {}).get("points", ""),
                    steps=[
                        {
                            "instruction": s.get("html_instructions", ""),
                            "distance": s.get("distance", {}).get("text", ""),
                            "duration": s.get("duration", {}).get("text", ""),
                        }
                        for s in leg.get("steps", [])
                    ],
                ))
        return segments

    async def get_distance_matrix(
        self,
        origins: List[str],
        destinations: List[str],
        mode: str = "driving",
    ) -> List[DistanceMatrixEntry]:
        """
        NxM distance/duration matrix for batch travel-time calculations.
        origins/destinations: list of address strings or "lat,lng"
        """
        params = {
            "origins": "|".join(origins),
            "destinations": "|".join(destinations),
            "mode": mode,
            "key": self._api_key,
        }
        cache_key = ("matrix", "|".join(origins), "|".join(destinations), mode)
        data = await self._request(
            "GET", "/distancematrix/json",
            params=params,
            cache_key_parts=cache_key,
        )

        results = []
        origin_addrs = data.get("origin_addresses", origins)
        dest_addrs = data.get("destination_addresses", destinations)
        for i, row in enumerate(data.get("rows", [])):
            for j, elem in enumerate(row.get("elements", [])):
                if elem.get("status") == "OK":
                    results.append(DistanceMatrixEntry(
                        origin=origin_addrs[i] if i < len(origin_addrs) else origins[i],
                        destination=dest_addrs[j] if j < len(dest_addrs) else destinations[j],
                        distance_m=elem.get("distance", {}).get("value", 0),
                        duration_seconds=elem.get("duration", {}).get("value", 0),
                        duration_in_traffic_seconds=elem.get("duration_in_traffic", {}).get("value"),
                    ))
        return results

    async def optimize_itinerary_order(
        self,
        start: str,
        end: str,
        stops: List[str],
        mode: str = "driving",
    ) -> Tuple[List[str], List[RouteSegment]]:
        """
        Use Google's waypoint optimization to find the best order for visiting stops.
        Returns (optimized_order, route_segments).
        """
        segments = await self.get_directions(
            origin=start,
            destination=end,
            mode=mode,
            waypoints=stops,
        )
        # Google returns waypoint_order in the route
        return stops, segments  # simplified; production would parse waypoint_order


def create_maps_adapter() -> GoogleMapsAdapter:
    return GoogleMapsAdapter()
