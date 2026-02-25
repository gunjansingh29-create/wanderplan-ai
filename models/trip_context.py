"""
WanderPlan AI - Trip Context / Shared State Models
Redis-backed trip session store schema — the single source of truth for an
evolving trip plan, readable and writable by all agents.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------

class TripMember(BaseModel):
    user_id: str
    name: str
    email: Optional[str] = None
    role: str = "member"                     # owner | member


class TimingResult(BaseModel):
    preferred_months: list[str] = Field(default_factory=list)
    avoid_months: list[str] = Field(default_factory=list)
    weather_preferences: list[str] = Field(default_factory=list)
    event_alignment: list[str] = Field(default_factory=list)   # festivals, holidays
    best_window: Optional[dict[str, str]] = None                # {start, end}


class InterestProfile(BaseModel):
    user_id: str
    categories: list[str] = Field(default_factory=list)        # adventure, culture, food…
    intensity: str = "moderate"                                  # low | moderate | high
    must_do: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)


class HealthFlag(BaseModel):
    user_id: str
    mobility_level: str = "full"             # full | limited | wheelchair
    dietary_restrictions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    medical_notes: list[str] = Field(default_factory=list)
    vaccination_status: dict[str, bool] = Field(default_factory=dict)


class POI(BaseModel):
    poi_id: str
    name: str
    category: str
    location: dict[str, float]               # {lat, lng}
    city: str
    country: str
    rating: Optional[float] = None
    estimated_duration_hours: float = 1.0
    cost_estimate_usd: float = 0.0
    accessibility_score: float = 1.0          # 0..1
    tags: list[str] = Field(default_factory=list)
    source: str = ""                          # api source


class Budget(BaseModel):
    currency: str = "USD"
    daily_target: float = 0.0
    total_budget: float = 0.0
    spent: float = 0.0
    remaining: float = 0.0
    breakdown: dict[str, float] = Field(default_factory=dict)   # flights, stays, dining…


class FlightOption(BaseModel):
    flight_id: str
    airline: str
    departure_airport: str
    arrival_airport: str
    departure_time: datetime
    arrival_time: datetime
    price_usd: float
    stops: int = 0
    duration_minutes: int = 0
    booking_url: Optional[str] = None
    selected: bool = False


class AccommodationOption(BaseModel):
    stay_id: str
    name: str
    type: str                                # hotel | hostel | airbnb | resort
    location: dict[str, float]
    price_per_night_usd: float
    rating: Optional[float] = None
    amenities: list[str] = Field(default_factory=list)
    check_in: Optional[date] = None
    check_out: Optional[date] = None
    booking_url: Optional[str] = None
    selected: bool = False


class DiningOption(BaseModel):
    restaurant_id: str
    name: str
    cuisine: list[str]
    price_level: str                         # $ | $$ | $$$ | $$$$
    location: dict[str, float]
    rating: Optional[float] = None
    dietary_options: list[str] = Field(default_factory=list)
    reservation_url: Optional[str] = None


class ItineraryActivity(BaseModel):
    time_slot: str                           # "09:00-11:00"
    poi_id: Optional[str] = None
    title: str
    description: str = ""
    category: str = "sightseeing"
    cost_estimate_usd: float = 0.0
    transport_to_next: Optional[str] = None  # walk | taxi | metro | bus


class ItineraryDay(BaseModel):
    day_number: int
    date: Optional[date] = None
    city: str
    theme: str = ""                          # "Beach Day", "Cultural Exploration"
    activities: list[ItineraryActivity] = Field(default_factory=list)
    meals: list[DiningOption] = Field(default_factory=list)
    accommodation: Optional[AccommodationOption] = None
    daily_budget_usd: float = 0.0


class CalendarExport(BaseModel):
    format: str = "ics"                      # ics | google | outlook
    exported_at: Optional[datetime] = None
    download_url: Optional[str] = None


# ---------------------------------------------------------------------------
# Root trip context — the full Redis-backed session object
# ---------------------------------------------------------------------------

class TripContext(BaseModel):
    """
    The master trip plan object stored in Redis (JSON serialised).
    Key: trip:{trip_id}
    Every agent reads/writes relevant sections via the shared state service.
    """
    trip_id: str
    owner_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    current_stage: str = "bucket_list"

    # Planning data — populated progressively by specialist agents
    members: list[TripMember] = Field(default_factory=list)
    bucket_list: list[str] = Field(default_factory=list)
    timing_results: Optional[TimingResult] = None
    interest_profiles: list[InterestProfile] = Field(default_factory=list)
    health_flags: list[HealthFlag] = Field(default_factory=list)
    pois: list[POI] = Field(default_factory=list)
    duration_days: Optional[int] = None
    availability_windows: list[dict[str, str]] = Field(default_factory=list)
    budget: Budget = Field(default_factory=Budget)
    flights: list[FlightOption] = Field(default_factory=list)
    hotels: list[AccommodationOption] = Field(default_factory=list)
    dining: list[DiningOption] = Field(default_factory=list)
    itinerary: list[ItineraryDay] = Field(default_factory=list)
    calendar_export: Optional[CalendarExport] = None

    # Metadata
    group_preferences: dict[str, Any] = Field(default_factory=dict)
    conversation_history: list[dict[str, str]] = Field(default_factory=list)
    agent_completions: dict[str, bool] = Field(default_factory=dict)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat(),
        }
