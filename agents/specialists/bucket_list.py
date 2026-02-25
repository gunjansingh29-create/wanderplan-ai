from __future__ import annotations
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 1: Bucket List Agent
Collects dream destinations and travel wish-list items from the user.
Normalises vague aspirations ("somewhere tropical") into concrete destinations.
"""

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """
You are the Bucket List Agent for WanderPlan AI.
Your job is to help users articulate their dream destinations and travel wishes.

When a user provides vague ideas like "somewhere warm" or "I love history",
suggest 3-5 concrete destinations that match. Ask clarifying questions to
narrow down preferences.

Output a structured list of destinations with brief justifications.
"""


class BucketListAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.BUCKET_LIST,
            agent_name="Bucket List Agent",
            port=8001,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return ["destination_suggestion", "wish_list_curation", "inspiration"]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")
        entities = message.payload.get("entities", {})

        destinations = entities.get("destinations", [])

        if destinations:
            # User provided concrete destinations — confirm and store
            await self.update_trip_context(
                message.trip_id, {"bucket_list": destinations}
            )
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "bucket_list": destinations,
                    "summary": f"Added {', '.join(destinations)} to your bucket list.",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.BUCKET_LIST,
            )

        # Vague input — ask the LLM to suggest destinations
        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "suggestions": [
                    "Based on your interests, consider: Kyoto, Barcelona, or Bali.",
                ],
                "summary": "Could you pick from these destinations or tell me more?",
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.BUCKET_LIST,
        )
