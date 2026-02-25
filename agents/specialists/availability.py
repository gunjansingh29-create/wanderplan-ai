
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 7: Availability Agent
Coordinates schedule availability across trip members.
Integrates with calendar APIs to find overlapping free windows.

External APIs: Google Calendar, Outlook Calendar.
"""
from __future__ import annotations

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Availability Agent for WanderPlan AI.
Determine when all trip members are available to travel by:
- Checking shared calendar availability (with permission)
- Asking about work/school constraints
- Identifying blackout dates
- Cross-referencing with the Timing Agent's recommended windows

Find the best overlapping window that fits the recommended duration.
"""


class AvailabilityAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.AVAILABILITY,
            agent_name="Availability Agent",
            port=8007,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return ["calendar_check", "schedule_coordination", "date_negotiation"]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")
        entities = message.payload.get("entities", {})
        dates = entities.get("dates", [])

        if dates:
            windows = [{"start": dates[0], "end": dates[-1] if len(dates) > 1 else dates[0]}]
            await self.update_trip_context(
                message.trip_id, {"availability_windows": windows}
            )
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "windows": windows,
                    "summary": f"Locked in dates: {dates[0]} to {dates[-1] if len(dates) > 1 else 'TBD'}.",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.AVAILABILITY,
            )

        # Use timing agent's recommendation as a hint
        timing = trip.timing_results
        if timing and timing.best_window:
            suggestion = f"{timing.best_window.get('start', '')} to {timing.best_window.get('end', '')}"
        else:
            suggestion = "the next few months"

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "suggested_window": suggestion,
                "summary": f"When are you free to travel? Best window is around {suggestion}.",
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.AVAILABILITY,
        )
