
from __future__ import annotations
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}


"""
Agent 8: Budget Agent
Manages trip budget planning, allocation across categories, and real-time tracking.
Provides cost estimates and alerts when spending approaches limits.

External APIs: Currency exchange rates, cost-of-living indices.
"""

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import Budget, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Budget Agent for WanderPlan AI.
Help users plan and track their travel budget:
- Collect total budget or daily budget preference
- Estimate costs per category (flights, accommodation, dining, activities, transport)
- Adjust recommendations based on destination cost-of-living
- Track spending as bookings are made
- Alert when approaching budget limits

Use real cost-of-living data for destination-specific estimates.
"""


class BudgetAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.BUDGET,
            agent_name="Budget Agent",
            port=8008,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "budget_planning",
            "cost_estimation",
            "spending_tracking",
            "currency_conversion",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")
        entities = message.payload.get("entities", {})
        budget_amount = entities.get("budget_amount")
        duration = entities.get("duration") or (trip.duration_days if hasattr(trip, "duration_days") else 1)


        # Example logic for budget calculation (replace with your actual logic)
        if budget_amount:
            total = float(budget_amount)
            daily = total / duration
            budget = Budget(
                daily_target=round(daily, 2),
                total_budget=total,
                spent=0.0,
                remaining=total,
                breakdown={
                    "flights": round(total * 0.30, 2),
                    "accommodation": round(total * 0.30, 2),
                    "dining": round(total * 0.20, 2),
                    "activities": round(total * 0.10, 2),
                    "transport": round(total * 0.05, 2),
                    "misc": round(total * 0.05, 2),
                },
            )
            await self.update_trip_context(
                message.trip_id, {"budget": budget.model_dump()}
            )
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "budget": budget.model_dump(),
                    "summary": (
                        f"Budget set: ${total:,.0f} total (${daily:,.0f}/day for {duration} days). "
                        "Breakdown allocated across flights, stays, dining, and activities."
                    ),
                    "status": "complete",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.BUDGET,
            )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "summary": f"What's your total budget for this {duration}-day trip?",
                "status": "needs_input",
            },
            requires_user_input=True,
            correlation_id=message.correlation_id,
            stage=PlanningStage.BUDGET,
        )
