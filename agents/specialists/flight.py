from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 9: Flight Agent
Searches for flights matching dates, budget, and preferences.
Ranks by price, duration, stops, and departure time.

External APIs: Amadeus, Skyscanner, Google Flights, Kiwi.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import FlightOption, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Flight Agent for WanderPlan AI.
Search for the best flight options considering:
- Budget allocation for flights
- Preferred departure/arrival airports
- Direct vs connecting flights
- Time preferences (morning, evening, red-eye)
- Airline preferences or loyalty programs

Present top 3 options ranked by value (price × convenience).
"""


class FlightAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.FLIGHT,
            agent_name="Flight Agent",
            port=8009,
            system_prompt=SYSTEM_PROMPT,
            from fastapi import FastAPI
            app = FastAPI()
            @app.get("/health")
            def health():
                return {"status": "ok"}
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return ["flight_search", "price_comparison", "airline_lookup", "amadeus_integration"]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        budget_for_flights = trip.budget.breakdown.get("flights", 500) if trip.budget else 500
        destinations = trip.bucket_list

        # TODO: Call Amadeus / Skyscanner API with real search parameters
        sample_flights = []
        for dest in destinations[:2]:
            sample_flights.append(
                FlightOption(
                    flight_id=str(uuid.uuid4()),
                    airline="Sample Airlines",
                    stops=0,
                    duration_minutes=360,
                    booking_url="",
                    selected=False,
                )
            )

        await self.update_trip_context(
            message.trip_id,
            {"flights": [f.model_dump(mode="json") for f in sample_flights]},
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "flights": [f.model_dump(mode="json") for f in sample_flights],
                "count": len(sample_flights),
                "summary": (
                    f"Found {len(sample_flights)} flight options within your "
                    f"${budget_for_flights:,.0f} flight budget. Shall I book the best option?"
                ),
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.FLIGHTS,
        )
