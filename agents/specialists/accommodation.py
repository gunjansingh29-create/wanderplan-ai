
from __future__ import annotations

from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 10: Accommodation Agent
Searches for hotels, hostels, Airbnbs, and resorts matching budget and preferences.

External APIs: Booking.com, Airbnb, Hotels.com, Expedia.
"""

import uuid

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import AccommodationOption, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Accommodation Agent for WanderPlan AI.
Find the best places to stay considering:
- Budget allocation for accommodation
- Type preference (hotel, Airbnb, hostel, resort)
- Location proximity to POIs
- Amenity requirements (wifi, pool, kitchen, parking)
- Accessibility needs from health profile
- Group size

Present top 3 options per destination with price, rating, and key amenities.
"""


class AccommodationAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.ACCOMMODATION,
            agent_name="Accommodation Agent",
            port=8010,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "hotel_search",
            "airbnb_search",
            "accommodation_comparison",
            "booking_integration",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        budget_for_stays = trip.budget.breakdown.get("accommodation", 500) if trip.budget else 500
        duration = trip.duration_days or 7
        per_night = budget_for_stays / max(duration, 1)

        destinations = trip.bucket_list
        sample_stays = []
        for dest in destinations[:2]:
            sample_stays.append(
                AccommodationOption(
                    stay_id=str(uuid.uuid4()),
                    name=f"Central Hotel in {dest}",
                    type="hotel",
                    location={"lat": 0.0, "lng": 0.0},
                    price_per_night_usd=round(per_night, 2),
                    rating=4.3,
                    amenities=["wifi", "breakfast", "air conditioning"],
                    booking_url="",
                    selected=False,
                )
            )

        await self.update_trip_context(
            message.trip_id,
            {"hotels": [s.model_dump(mode="json") for s in sample_stays]},
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "stays": [s.model_dump(mode="json") for s in sample_stays],
                "count": len(sample_stays),
                "per_night_budget": round(per_night, 2),
                "summary": (
                    f"Found {len(sample_stays)} accommodation options at "
                    f"~${per_night:,.0f}/night. Would you like to see details?"
                ),
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.STAYS,
        )
