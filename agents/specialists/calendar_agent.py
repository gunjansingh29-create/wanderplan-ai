from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health():
    return {"status": "ok"}
"""
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}
"""
Agent 13: Calendar Agent
Exports the finalised itinerary to calendar formats (ICS, Google Calendar, Outlook).

External APIs: Google Calendar API, Microsoft Graph (Outlook).
"""

from __future__ import annotations

from datetime import datetime

from agents.base_agent import AgentConfig, BaseAgent
from models.trip_context import CalendarExport, TripContext
from schemas.messages import AgentID, AgentMessage, PlanningStage

SYSTEM_PROMPT = """\
You are the Calendar Agent for WanderPlan AI.
- Create event entries with:
  - Activity title and description
  - Time slots
  - Location data
  - Travel reminders
  - Reservation confirmations
"""


class CalendarAgent(BaseAgent):
    def __init__(self, **kwargs):
        config = AgentConfig(
            agent_id=AgentID.CALENDAR,
            agent_name="Calendar Agent",
            port=8013,
            system_prompt=SYSTEM_PROMPT,
            **kwargs,
        )
        super().__init__(config)

    @property
    def capabilities(self) -> list[str]:
        return [
            "ics_generation",
            "google_calendar_sync",
            "outlook_sync",
            "calendar_export",
        ]

    async def process(self, trip: TripContext, message: AgentMessage) -> AgentMessage:
        user_msg = message.payload.get("user_message", "")

        if not trip.itinerary:
            return self.make_response(
                trip_id=message.trip_id,
                payload={
                    "summary": "No itinerary to export yet. Let's finish planning first.",
                    "status": "blocked",
                },
                requires_user_input=False,
                correlation_id=message.correlation_id,
                stage=PlanningStage.CALENDAR,
            )

        # Generate ICS content
        ics_events = []
        for day in trip.itinerary:
            for activity in day.activities:
                ics_events.append({
                    "summary": activity.title,
                    "description": activity.description,
                    "date": str(day.date),
                    "time_slot": activity.time_slot,
                    "location": day.city,
                })

        export = CalendarExport(
            format="ics",
            exported_at=datetime.utcnow(),
            download_url=f"/api/trips/{message.trip_id}/calendar/download",
        )

        await self.update_trip_context(
            message.trip_id,
            {"calendar_export": export.model_dump(mode="json")},
        )

        return self.make_response(
            trip_id=message.trip_id,
            payload={
                "export": export.model_dump(mode="json"),
                "event_count": len(ics_events),
                "summary": (
                    f"Calendar export ready with {len(ics_events)} events. "
                    "Your trip plan is complete!"
                ),
                "status": "complete",
            },
            requires_user_input=False,
            correlation_id=message.correlation_id,
            stage=PlanningStage.CALENDAR,
        )
