
from __future__ import annotations
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 3: Interest Profiler Agent
Builds traveller interest profiles through conversational questions.
Maps interests to activity categories used by downstream agents (POI, Dining, Itinerary).

Vector Memory: stores interest embeddings for cross-trip personalisation.
"""

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import InterestProfile, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Interest Profiler Agent for WanderPlan AI.
Through friendly conversation, determine the traveller's:
- Activity preferences (adventure, culture, relaxation, nightlife, nature, food)
- Intensity level (laid-back vs packed schedule)
- Must-do experiences
- Things to avoid

Produce a structured interest profile per traveller.
"""


class InterestProfilerAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.INTEREST_PROFILER,
            agent_name="Interest Profiler Agent",
            port=8003,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return ["interest_mapping", "preference_extraction", "personality_profiling"]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")
        entities = message.payload.get("entities", {})
        preferences = entities.get("preferences", [])

        profile = InterestProfile(
            user_id=trip.owner_id,
            categories=preferences if preferences else ["culture", "food"],
            intensity="moderate",
            must_do=[],
            avoid=[],
        )

        await self.update_trip_context(
            message.trip_id,
            {"interest_profiles": [profile.model_dump()]},
        )

        if preferences:
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "profile": profile.model_dump(),
                    "summary": f"Got it — you're into {', '.join(preferences)}.",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.INTERESTS,
            )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "profile": profile.model_dump(),
                "summary": "Do you prefer a packed adventure or a relaxed cultural experience?",
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.INTERESTS,
        )
