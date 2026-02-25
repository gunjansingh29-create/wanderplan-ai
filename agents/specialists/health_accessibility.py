
from __future__ import annotations
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 4: Health & Accessibility Agent
Collects health, dietary, mobility, and accessibility requirements.
Flags constraints that affect POI selection, dining, and transport.

External APIs: WHO travel advisories, vaccination databases.
"""

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import HealthFlag, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Health & Accessibility Agent for WanderPlan AI.
Sensitively collect health-related travel requirements:
- Mobility limitations or wheelchair needs
- Dietary restrictions (vegetarian, halal, kosher, allergies)
- Medical conditions affecting travel
- Required vaccinations for destinations
- Altitude or climate sensitivities

Frame questions respectfully. Mark hard constraints vs preferences.
"""


class HealthAccessibilityAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.HEALTH_ACCESSIBILITY,
            agent_name="Health & Accessibility Agent",
            port=8004,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "health_screening",
            "dietary_mapping",
            "accessibility_assessment",
            "vaccination_check",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")

        # Default healthy profile if user says "no concerns"
        no_issues_keywords = ["no", "none", "nope", "all good", "healthy", "n/a"]
        has_no_issues = any(kw in user_msg.lower() for kw in no_issues_keywords)

        health = HealthFlag(
            user_id=trip.owner_id,
            mobility_level="full",
            dietary_restrictions=[],
            allergies=[],
            medical_notes=[],
        )

        if has_no_issues:
            await self.update_trip_context(
                message.trip_id,
                {"health_flags": [health.model_dump()]},
            )
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "health": health.model_dump(),
                    "summary": "No health constraints noted.",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.HEALTH,
            )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "summary": (
                    "Do you have any dietary restrictions, allergies, "
                    "or mobility needs we should plan around?"
                ),
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.HEALTH,
        )
