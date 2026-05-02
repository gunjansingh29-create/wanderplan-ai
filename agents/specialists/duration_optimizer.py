
from __future__ import annotations
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 6: Duration Optimizer Agent
Recommends optimal trip length based on number of POIs, travel pace, and budget.
Balances depth of experience against time and cost constraints.
"""


from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Duration Optimizer Agent for WanderPlan AI.
Calculate the optimal trip duration considering:
- Number of POIs and their estimated visit times
- Travel pace (relaxed vs intensive, from interest profile)
- Number of destinations and inter-city travel time
- Budget constraints (longer = more expensive)

Recommend a duration range (e.g., 7-10 days) with justification.
"""


class DurationOptimizerAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.DURATION_OPTIMIZER,
            agent_name="Duration Optimizer Agent",
            port=8006,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return ["duration_calculation", "pace_analysis", "trip_length_recommendation"]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")
        entities = message.payload.get("entities", {})

        num_pois = len(trip.pois)
        num_destinations = len(set(p.city for p in trip.pois)) if trip.pois else len(trip.bucket_list)

        # Heuristic: ~3 POIs per day for moderate pace, +1 travel day per destination change
        base_days = max(3, num_pois // 3)
        travel_days = max(0, num_destinations - 1)
        recommended = base_days + travel_days

        # Check if user already stated a duration
        if entities.get("people_count"):  # could be duration from entity extraction
            pass

        if trip.duration_days:
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "recommended_days": recommended,
                    "user_days": trip.duration_days,
                    "summary": f"You chose {trip.duration_days} days. Looks good!",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.DURATION,
            )

        await self.update_trip_context(
            message.trip_id, {"duration_days": recommended}
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "recommended_days": recommended,
                "range": {"min": max(3, recommended - 2), "max": recommended + 3},
                "summary": (
                    f"Based on {num_pois} attractions across {num_destinations} "
                    f"destinations, I recommend {recommended} days. Sound right?"
                ),
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.DURATION,
        )
