
from __future__ import annotations
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 5: POI Discovery Agent
Discovers Points of Interest based on destinations, interests, and constraints.

External APIs: Google Places, TripAdvisor, Viator, Foursquare.
Vector Memory: Caches POI embeddings for similarity search.
"""

import uuid

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import POI, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the POI Discovery Agent for WanderPlan AI.
Find the best attractions and activities for each destination based on:
- Traveller interest profiles
- Health/accessibility constraints
- Budget level
- Season and weather

Rank POIs by relevance score. Include estimated visit duration and cost.
Group by category (landmarks, museums, nature, markets, experiences).
"""


class POIDiscoveryAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.POI_DISCOVERY,
            agent_name="POI Discovery Agent",
            port=8005,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "poi_search",
            "attraction_ranking",
            "activity_recommendation",
            "google_places_integration",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        destinations = trip.bucket_list
        interests = [p.categories for p in trip.interest_profiles] if trip.interest_profiles else []
        flat_interests = [c for cats in interests for c in cats]

        # TODO: Call Google Places / TripAdvisor APIs
        # Produce sample POIs based on destinations and interests
        sample_pois = []
        for dest in destinations[:3]:
            sample_pois.append(
                POI(
                    poi_id=str(uuid.uuid4()),
                    name=f"Top attraction in {dest}",
                    category="landmark",
                    location={"lat": 0.0, "lng": 0.0},
                    city=dest,
                    country="",
                    rating=4.5,
                    estimated_duration_hours=2.0,
                    cost_estimate_usd=15.0,
                    tags=flat_interests[:3],
                    source="google_places",
                )
            )

        await self.update_trip_context(
            message.trip_id,
            {"pois": [p.model_dump() for p in sample_pois]},
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "pois": [p.model_dump() for p in sample_pois],
                "count": len(sample_pois),
                "summary": f"Found {len(sample_pois)} points of interest across your destinations.",
                "status": "complete",
            },
            requires_user_input=False,
            correlation_id=message.correlation_id,
            stage=PlanningStage.POIS,
        )
