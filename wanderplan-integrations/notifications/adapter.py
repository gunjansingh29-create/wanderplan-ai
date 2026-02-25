"""
Email & SMS — SendGrid (transactional email) + Twilio (SMS & 2FA).
No caching (transactional). Retry on failure. Circuit breaker protection.
"""

import base64
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from core.base_adapter import BaseAdapter
from config import EMAIL_SENDGRID, SMS_TWILIO


@dataclass
class EmailMessage:
    to: List[str]
    subject: str
    html_body: str
    from_email: str = "noreply@wanderplan.ai"
    from_name: str = "WanderPlan AI"
    template_id: Optional[str] = None
    template_data: Dict[str, Any] = field(default_factory=dict)
    attachments: List[Dict] = field(default_factory=list)


@dataclass
class SMSMessage:
    to: str  # E.164 format
    body: str
    from_number: Optional[str] = None


@dataclass
class MessageResult:
    provider: str
    message_id: str
    status: str


# ─── SendGrid ─────────────────────────────────────────────────────────

class SendGridAdapter(BaseAdapter):
    """SendGrid — booking confirmations, itinerary updates, sharing invites."""

    def __init__(self):
        super().__init__(EMAIL_SENDGRID)
        self._api_key = os.getenv("SENDGRID_API_KEY", "")

    def _api_key_header(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    async def send_email(self, message: EmailMessage) -> MessageResult:
        body: Dict[str, Any] = {
            "personalizations": [{"to": [{"email": e} for e in message.to]}],
            "from": {"email": message.from_email, "name": message.from_name},
            "subject": message.subject,
        }
        if message.template_id:
            body["template_id"] = message.template_id
            body["personalizations"][0]["dynamic_template_data"] = message.template_data
        else:
            body["content"] = [{"type": "text/html", "value": message.html_body}]

        if message.attachments:
            body["attachments"] = message.attachments

        data = await self._request("POST", "/mail/send", json_body=body, skip_cache=True)
        return MessageResult(
            provider="sendgrid",
            message_id=data.get("x-message-id", "") if isinstance(data, dict) else "",
            status="sent",
        )

    async def send_booking_confirmation(
        self, to_email: str, booking_data: Dict[str, Any]
    ) -> MessageResult:
        return await self.send_email(EmailMessage(
            to=[to_email],
            subject=f"Booking Confirmed — {booking_data.get('destination', 'Your Trip')}",
            html_body="",
            template_id=os.getenv("SENDGRID_TEMPLATE_BOOKING", ""),
            template_data=booking_data,
        ))

    async def send_itinerary_update(
        self, to_emails: List[str], itinerary_data: Dict[str, Any]
    ) -> MessageResult:
        return await self.send_email(EmailMessage(
            to=to_emails,
            subject=f"Itinerary Updated — {itinerary_data.get('trip_name', 'Your Trip')}",
            html_body="",
            template_id=os.getenv("SENDGRID_TEMPLATE_ITINERARY", ""),
            template_data=itinerary_data,
        ))

    async def send_share_invite(
        self, to_email: str, inviter_name: str, trip_name: str, invite_link: str
    ) -> MessageResult:
        return await self.send_email(EmailMessage(
            to=[to_email],
            subject=f"{inviter_name} invited you to {trip_name} on WanderPlan",
            html_body="",
            template_id=os.getenv("SENDGRID_TEMPLATE_INVITE", ""),
            template_data={"inviter": inviter_name, "trip": trip_name, "link": invite_link},
        ))


# ─── Twilio ───────────────────────────────────────────────────────────

class TwilioAdapter(BaseAdapter):
    """Twilio — SMS notifications and 2FA verification."""

    def __init__(self):
        super().__init__(SMS_TWILIO)
        self._account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self._auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self._from_number = os.getenv("TWILIO_FROM_NUMBER", "")

    async def _build_headers(self, extra=None) -> Dict[str, str]:
        h = await super()._build_headers(extra)
        creds = base64.b64encode(f"{self._account_sid}:{self._auth_token}".encode()).decode()
        h["Authorization"] = f"Basic {creds}"
        return h

    async def send_sms(self, message: SMSMessage) -> MessageResult:
        body = {
            "To": message.to,
            "From": message.from_number or self._from_number,
            "Body": message.body,
        }
        data = await self._request(
            "POST", f"/Accounts/{self._account_sid}/Messages.json",
            json_body=body,
            skip_cache=True,
        )
        return MessageResult(
            provider="twilio",
            message_id=data.get("sid", ""),
            status=data.get("status", "queued"),
        )

    async def send_verification_code(self, phone: str) -> str:
        """Send 2FA verification via Twilio Verify."""
        verify_sid = os.getenv("TWILIO_VERIFY_SID", "")
        data = await self._request(
            "POST", f"/Services/{verify_sid}/Verifications",
            json_body={"To": phone, "Channel": "sms"},
            skip_cache=True,
        )
        return data.get("sid", "")

    async def check_verification(self, phone: str, code: str) -> bool:
        verify_sid = os.getenv("TWILIO_VERIFY_SID", "")
        data = await self._request(
            "POST", f"/Services/{verify_sid}/VerificationCheck",
            json_body={"To": phone, "Code": code},
            skip_cache=True,
        )
        return data.get("status") == "approved"

    async def send_trip_reminder(self, phone: str, trip_name: str, departure: str) -> MessageResult:
        return await self.send_sms(SMSMessage(
            to=phone,
            body=f"WanderPlan reminder: Your trip '{trip_name}' departs on {departure}. Have a great journey!",
        ))


def create_sendgrid_adapter() -> SendGridAdapter:
    return SendGridAdapter()

def create_twilio_adapter() -> TwilioAdapter:
    return TwilioAdapter()
