
from __future__ import annotations
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 11: Dining Agent
Recommends restaurants and food experiences matching cuisine preferences,
dietary needs, budget, and location.

External APIs: Yelp, Google Places, TripAdvisor, TheFork.
"""

import uuid

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import DiningOption, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Dining Agent for WanderPlan AI.
Recommend restaurants and food experiences considering:
- Cuisine preferences from interest profiles
- Dietary restrictions and allergies from health profiles
- Budget level for dining
- Location proximity to accommodations and POIs
- Local food specialities for each destination
- Mix of casual and special dining experiences

Suggest 2-3 restaurants per day, categorised by meal (breakfast, lunch, dinner).
"""


class DiningAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.DINING,
            agent_name="Dining Agent",
            port=8011,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "restaurant_search",
            "cuisine_matching",
            "dietary_filtering",
            "yelp_integration",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        destinations = trip.bucket_list
        dietary = []
        if trip.health_flags:
            for hf in trip.health_flags:
                dietary.extend(hf.dietary_restrictions)

        sample_dining = []
        for dest in destinations[:2]:
            sample_dining.append(
                DiningOption(
                    restaurant_id=str(uuid.uuid4()),
                    name=f"Local Favourite in {dest}",
                    cuisine=["local", "international"],
                    price_level="$$",
                    location={"lat": 0.0, "lng": 0.0},
                    rating=4.5,
                    dietary_options=dietary if dietary else ["vegetarian available"],
                )
            )

        await self.update_trip_context(
            message.trip_id,
            {"dining": [d.model_dump() for d in sample_dining]},
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "dining": [d.model_dump() for d in sample_dining],
                "count": len(sample_dining),
                "summary": (
                    f"Curated {len(sample_dining)} dining spots matching your preferences. "
                    "Ready to build the day-by-day itinerary?"
                ),
                "status": "complete",
            },
            requires_user_input=False,
            correlation_id=message.correlation_id,
            stage=PlanningStage.DINING,
        )
