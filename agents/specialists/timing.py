
from __future__ import annotations
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 2: Timing Agent
Determines optimal travel timing based on weather, events, pricing seasons,
and user preferences.

External APIs: Weather APIs, event calendars, seasonal pricing data.
"""

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import TimingResult, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Timing Agent for WanderPlan AI.
Analyse destinations and recommend optimal travel windows considering:
- Weather patterns and climate
- Local festivals and events
- Peak vs off-peak pricing seasons
- User's stated timing preferences

Provide a ranked list of travel windows with pros/cons for each.
"""


class TimingAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.TIMING,
            agent_name="Timing Agent",
            port=8002,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return ["weather_analysis", "event_lookup", "seasonal_pricing", "timing_optimization"]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")
        entities = message.payload.get("entities", {})
        dates = entities.get("dates", [])

        destinations = trip.bucket_list

        # TODO: Call weather API, event calendar API for real data
        # For now, produce structured timing recommendation

        timing = TimingResult(
            preferred_months=["March", "April", "October"],
            avoid_months=["July", "August"],
            weather_preferences=["mild", "dry"],
            event_alignment=[],
            best_window={"start": "2025-03-15", "end": "2025-04-15"},
        )

        await self.update_trip_context(
            message.trip_id,
            {"timing_results": timing.model_dump()},
        )

        if dates:
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "timing": timing.model_dump(),
                    "summary": f"Noted your preferred dates. Best window identified.",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.TIMING,
            )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "timing": timing.model_dump(),
                "summary": (
                    f"For {', '.join(destinations)}, the best travel window is "
                    "March-April (mild weather, fewer crowds). Does that work?"
                ),
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.TIMING,
        )
