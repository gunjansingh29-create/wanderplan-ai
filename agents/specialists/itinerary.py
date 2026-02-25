from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 12: Itinerary Agent
Assembles the complete day-by-day trip itinerary from all upstream data.
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Optimises for travel time, opening hours, and activity flow.

This is the most complex agent — it synthesises outputs from POI, Dining,
Accommodation, Flight, and Duration agents into a coherent schedule.
"""

from __future__ import annotations

from datetime import date, timedelta

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import (
    ItineraryActivity,
    ItineraryDay,
    TripContext,
)
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Itinerary Agent for WanderPlan AI.
Create a day-by-day trip itinerary that:
- Schedules POIs with realistic time slots and travel time between them
Output a structured itinerary with time slots, activities, meals, and transport.
"""


class ItineraryAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.ITINERARY,
            agent_name="Itinerary Agent",
            port=8012,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "itinerary_generation",
            "schedule_optimization",
            "route_planning",
            "time_slot_allocation",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        duration = trip.duration_days or 7
        pois = trip.pois
        dining = trip.dining
        hotels = trip.hotels

        # Determine start date from availability windows
        start_date = date.today() + timedelta(days=30)  # fallback
        if trip.availability_windows:
            first_window = trip.availability_windows[0]
            try:
                start_date = date.fromisoformat(first_window.get("start", ""))
            except (ValueError, TypeError):
                pass

        # Build day-by-day itinerary
        itinerary_days = []
        poi_index = 0
        dining_index = 0

        for day_num in range(1, duration + 1):
            day_date = start_date + timedelta(days=day_num - 1)
            city = trip.bucket_list[0] if trip.bucket_list else "Unknown"

            activities = []
            # Morning activity
            if poi_index < len(pois):
                poi = pois[poi_index]
                activities.append(
                    ItineraryActivity(
                        time_slot="09:00-11:00",
                        poi_id=poi.poi_id,
                        title=poi.name,
                        description=f"Visit {poi.name}",
                        category=poi.category,
                        cost_estimate_usd=poi.cost_estimate_usd,
                        transport_to_next="walk",
                    )
                )
                poi_index += 1

            # Afternoon activity
            if poi_index < len(pois):
                poi = pois[poi_index]
                activities.append(
                    ItineraryActivity(
                        time_slot="14:00-16:30",
                        poi_id=poi.poi_id,
                        title=poi.name,
                        description=f"Explore {poi.name}",
                        category=poi.category,
                        cost_estimate_usd=poi.cost_estimate_usd,
                        transport_to_next="taxi",
                    )
                )
                poi_index += 1

            # Assign meals
            day_meals = []
            if dining_index < len(dining):
                day_meals.append(dining[dining_index])
                dining_index += 1

            day = ItineraryDay(
                day_number=day_num,
                date=day_date,
                city=city,
                theme=f"Day {day_num} - Exploring {city}",
                activities=activities,
                meals=day_meals,
                accommodation=hotels[0] if hotels else None,
                daily_budget_usd=trip.budget.daily_target if trip.budget else 0,
            )
            itinerary_days.append(day)

        await self.update_trip_context(
            message.trip_id,
            {"itinerary": [d.model_dump(mode="json") for d in itinerary_days]},
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "itinerary_days": len(itinerary_days),
                "total_activities": sum(len(d.activities) for d in itinerary_days),
                "summary": (
                    f"Built a {duration}-day itinerary with "
                    f"{sum(len(d.activities) for d in itinerary_days)} activities. "
                    "Would you like to export this to your calendar?"
                ),
                "status": "complete",
            },
            requires_user_input=False,
            correlation_id=message.correlation_id,
            stage=PlanningStage.ITINERARY,
        )
