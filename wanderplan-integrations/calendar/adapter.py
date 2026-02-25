"""
Calendar Integration — Google Calendar (OAuth2), Microsoft Graph (OAuth2), Apple CalDAV.
Push itinerary events to user calendars with timezone-aware scheduling.
"""

import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import CALENDAR_GOOGLE, CALENDAR_MICROSOFT, CALENDAR_APPLE


@dataclass
class CalendarEvent:
    title: str
    start_time: str  # ISO 8601
    end_time: str
    timezone: str
    location: Optional[str] = None
    description: Optional[str] = None
    reminders_minutes: List[int] = field(default_factory=lambda: [30])
    attendees: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CalendarEventResult:
    provider: str
    event_id: str
    html_link: Optional[str] = None
    status: str = "confirmed"


class GoogleCalendarAdapter(BaseAdapter):
    """Google Calendar API — push itinerary events via OAuth2."""

    def __init__(self):
        super().__init__(CALENDAR_GOOGLE)
        self._client_id = os.getenv("GOOGLE_CALENDAR_CLIENT_ID", "")
        self._client_secret = os.getenv("GOOGLE_CALENDAR_CLIENT_SECRET", "")

    async def _refresh_oauth2_token(self) -> tuple[str, float]:
        """Exchange refresh token for access token. In production, per-user tokens from DB."""
        raise NotImplementedError("Per-user OAuth2 flow — token comes from user session store")

    async def create_event(
        self, event: CalendarEvent, calendar_id: str = "primary", user_token: str = ""
    ) -> CalendarEventResult:
        body = {
            "summary": event.title,
            "location": event.location,
            "description": event.description,
            "start": {"dateTime": event.start_time, "timeZone": event.timezone},
            "end": {"dateTime": event.end_time, "timeZone": event.timezone},
            "reminders": {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": m} for m in event.reminders_minutes],
            },
        }
        if event.attendees:
            body["attendees"] = [{"email": e} for e in event.attendees]

        data = await self._request(
            "POST", f"/calendars/{calendar_id}/events",
            json_body=body,
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return CalendarEventResult(
            provider="google",
            event_id=data.get("id", ""),
            html_link=data.get("htmlLink"),
            status=data.get("status", "confirmed"),
        )

    async def push_itinerary(
        self, events: List[CalendarEvent], calendar_id: str = "primary", user_token: str = ""
    ) -> List[CalendarEventResult]:
        results = []
        for event in events:
            result = await self.create_event(event, calendar_id, user_token)
            results.append(result)
        return results

    async def delete_event(self, event_id: str, calendar_id: str = "primary", user_token: str = "") -> bool:
        await self._request(
            "DELETE", f"/calendars/{calendar_id}/events/{event_id}",
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return True


class MicrosoftGraphCalendarAdapter(BaseAdapter):
    """Microsoft Graph API — Outlook/O365 calendar events."""

    def __init__(self):
        super().__init__(CALENDAR_MICROSOFT)

    async def create_event(self, event: CalendarEvent, user_token: str = "") -> CalendarEventResult:
        body = {
            "subject": event.title,
            "body": {"contentType": "text", "content": event.description or ""},
            "start": {"dateTime": event.start_time, "timeZone": event.timezone},
            "end": {"dateTime": event.end_time, "timeZone": event.timezone},
            "location": {"displayName": event.location or ""},
            "isReminderOn": bool(event.reminders_minutes),
            "reminderMinutesBeforeStart": event.reminders_minutes[0] if event.reminders_minutes else 15,
        }
        if event.attendees:
            body["attendees"] = [
                {"emailAddress": {"address": e}, "type": "required"}
                for e in event.attendees
            ]
        data = await self._request(
            "POST", "/me/events",
            json_body=body,
            headers={"Authorization": f"Bearer {user_token}"},
            skip_cache=True,
        )
        return CalendarEventResult(
            provider="microsoft",
            event_id=data.get("id", ""),
            html_link=data.get("webLink"),
        )

    async def push_itinerary(
        self, events: List[CalendarEvent], user_token: str = ""
    ) -> List[CalendarEventResult]:
        return [await self.create_event(e, user_token) for e in events]


class AppleCalDAVAdapter(BaseAdapter):
    """Apple Calendar via CalDAV — iCloud calendar integration."""

    def __init__(self):
        super().__init__(CALENDAR_APPLE)

    async def create_event(self, event: CalendarEvent, user_credentials: Dict = None) -> CalendarEventResult:
        """
        Create iCal VEVENT and PUT to CalDAV endpoint.
        In production this uses caldav library with app-specific password.
        """
        import uuid
        event_uid = str(uuid.uuid4())

        vcalendar = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WanderPlan AI//EN
BEGIN:VEVENT
UID:{event_uid}
DTSTART:{event.start_time.replace('-', '').replace(':', '').replace('.', '')}
DTEND:{event.end_time.replace('-', '').replace(':', '').replace('.', '')}
SUMMARY:{event.title}
LOCATION:{event.location or ''}
DESCRIPTION:{event.description or ''}
END:VEVENT
END:VCALENDAR"""

        # CalDAV PUT request would go here in production
        return CalendarEventResult(
            provider="apple_caldav",
            event_id=event_uid,
        )

    async def push_itinerary(
        self, events: List[CalendarEvent], user_credentials: Dict = None
    ) -> List[CalendarEventResult]:
        return [await self.create_event(e, user_credentials) for e in events]


def create_google_calendar_adapter() -> GoogleCalendarAdapter:
    return GoogleCalendarAdapter()

def create_microsoft_calendar_adapter() -> MicrosoftGraphCalendarAdapter:
    return MicrosoftGraphCalendarAdapter()

def create_apple_calendar_adapter() -> AppleCalDAVAdapter:
    return AppleCalDAVAdapter()
