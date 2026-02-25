
from __future__ import annotations
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 14: Group Coordinator Agent
Manages multi-traveller coordination: merging preferences, resolving conflicts,
and ensuring the plan works for all group members.

This is the 15th agent in the system (14 specialists + 1 orchestrator).
It can be invoked at any stage when group dynamics need resolution.
"""

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Group Coordinator Agent for WanderPlan AI.
Manage multi-traveller trip planning:
- Merge interest profiles across group members
- Identify preference conflicts and suggest compromises
- Coordinate availability across all members
- Aggregate budget constraints (per-person vs shared expenses)
- Ensure health/accessibility needs are met for everyone
- Facilitate group voting on disputed choices

Always aim for consensus. When conflicts arise, present balanced options.
"""


class GroupCoordinatorAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.GROUP_COORDINATOR,
            agent_name="Group Coordinator Agent",
            port=8014,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "preference_merging",
            "conflict_resolution",
            "group_voting",
            "multi_traveller_coordination",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        members = trip.members
        interests = trip.interest_profiles

        if len(members) <= 1:
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "summary": "Solo trip — no group coordination needed.",
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
            )

        # Merge interests across members
        all_categories = set()
        all_must_do = set()
        all_avoid = set()
        for profile in interests:
            all_categories.update(profile.categories)
            all_must_do.update(profile.must_do)
            all_avoid.update(profile.avoid)

        conflicts = all_must_do & all_avoid
        merged = {
            "shared_interests": list(all_categories),
            "must_do": list(all_must_do - conflicts),
            "avoid": list(all_avoid - conflicts),
            "conflicts": list(conflicts),
        }

        await self.update_trip_context(
            message.trip_id,
            {"group_preferences": merged},
        )

        if conflicts:
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "merged": merged,
                    "conflicts": list(conflicts),
                    "summary": (
                        f"Found {len(conflicts)} preference conflicts in the group: "
                        f"{', '.join(conflicts)}. How should we resolve these?"
                    ),
                    "status": "needs_input",
                },
                requires_user_input=True,
                correlation_id=message.correlation_id,
            )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "merged": merged,
                "summary": (
                    f"Group preferences merged successfully for {len(members)} travellers. "
                    "No conflicts found."
                ),
                "status": "complete",
            },
            requires_user_input=False,
            correlation_id=message.correlation_id,
        )
