
from __future__ import annotations
import asyncio
import base64
import json
import os
import re
import smtplib
import time as pytime
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlencode
from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from email.message import EmailMessage
from typing import Any, Optional
from uuid import uuid4
from uuid import UUID

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Integration-test seed users (kept in sync with tests/integration/setup/seed.sql)
USERS = {
    "alice@test.com": {
        "password": "Password1!",
        "user_id": "00000000-0000-0000-0000-000000000001",
        "name": "Alice Chen",
    },
    "bob@test.com": {
        "password": "Password1!",
        "user_id": "00000000-0000-0000-0000-000000000002",
        "name": "Bob Smith",
    },
    "carol@test.com": {
        "password": "Password1!",
        "user_id": "00000000-0000-0000-0000-000000000003",
        "name": "Carol Park",
    },
    "dave@test.com": {
        "password": "Password1!",
        "user_id": "00000000-0000-0000-0000-000000000004",
        "name": "Dave Jones",
    },
    "eve@test.com": {
        "password": "Password1!",
        "user_id": "00000000-0000-0000-0000-000000000005",
        "name": "Eve Martinez",
    },
    "frank@test.com": {
        "password": "Password1!",
        "user_id": "00000000-0000-0000-0000-000000000006",
        "name": "Frank Lee",
    },
}

_AMADEUS_TOKEN = ""
_AMADEUS_TOKEN_EXPIRES_AT = 0.0

class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class PasswordResetRequest(BaseModel):
    email: str
    new_password: str


class AuthResponse(BaseModel):
    accessToken: str
    user_id: str
    name: str


class PasswordResetResponse(BaseModel):
    ok: bool
    message: str

"""
WanderPlan AI - Orchestrator Agent
Central coordinator that:
    1. Receives all user input
    2. Classifies intent via LLM
    3. Routes to the appropriate specialist agent
    4. Collects the agent's response
    5. Formats it as a yes/no decision or minimal-input question
    6. Tracks workflow via a planning state machine
"""
app = FastAPI()

_default_allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://wanderplan-orchestrator.onrender.com",
    "https://wanderplan-ai.onrender.com",
]
_env_allowed_origins = [
    o.strip()
    for o in os.getenv("FRONTEND_ORIGINS", "").split(",")
    if o.strip()
]
_allowed_origins = list(dict.fromkeys(_default_allowed_origins + _env_allowed_origins))
_allowed_origin_regex = os.getenv(
    "FRONTEND_ORIGIN_REGEX",
    r"^https://[a-z0-9-]+\.(onrender\.com|vercel\.app)$",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
db_pool: asyncpg.Pool | None = None


class CreateTripRequest(BaseModel):
    name: str
    destination_hint: Optional[str] = None
    duration_days: int = 7


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"


class CrewInviteEmailRequest(BaseModel):
    inviter_email: str
    inviter_name: Optional[str] = None
    invitee_email: str


class UpdateMemberRequest(BaseModel):
    status: str


class TripInviteRespondRequest(BaseModel):
    action: str = "accept"


class SaveDestinationsRequest(BaseModel):
    destinations: list[str]
    votes: dict[str, int] = {}


class BucketListItemRequest(BaseModel):
    destination: str
    country: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None


class InterestProfileRequest(BaseModel):
    categories: list[str]
    intensity: str = "moderate"
    must_do: list[str] = []
    avoid: list[str] = []


class BudgetRequest(BaseModel):
    daily_budget: float
    currency: str = "USD"


class BudgetIncreaseRequest(BaseModel):
    new_daily_budget: float
    reason: Optional[str] = None


class FlightSegmentRequest(BaseModel):
    from_airport: str
    to_airport: str
    depart_date: str


class FlightSearchRequest(BaseModel):
    origin: str
    destination: str
    depart_date: str
    return_date: Optional[str] = None
    round_trip: bool = False
    cabin_class: str = "economy"
    multi_city_segments: list[FlightSegmentRequest] = []


class FlightLegSelectionRequest(BaseModel):
    leg_id: Optional[str] = None
    flight_id: str


class FlightSelectRequest(BaseModel):
    flight_id: Optional[str] = None
    leg_selections: list[FlightLegSelectionRequest] = []
    price_usd: Optional[float] = None
    force: bool = False


class StaySearchRequest(BaseModel):
    city: str
    check_in: str
    check_out: str
    max_price: Optional[float] = None


class StaySelectRequest(BaseModel):
    stay_id: str
    price_per_night: float
    nights: int
    force_over_budget: bool = False


class AvailabilityRequest(BaseModel):
    date_ranges: list[dict[str, str]]


class AvailabilityLockRequest(BaseModel):
    start: str
    end: str


class PoiApprovalRequest(BaseModel):
    approved: bool


class PoiShortlistRequest(BaseModel):
    shortlisted: bool


class PoiVoteRequest(BaseModel):
    vote: str  # "approve" or "reject"


class PoiSyncItemRequest(BaseModel):
    poi_id: Optional[str] = None
    name: str
    category: Optional[str] = None
    destination: Optional[str] = None
    country: Optional[str] = None
    tags: list[str] = []
    rating: Optional[float] = None
    cost_estimate_usd: float = 0
    shortlisted: bool = False
    approved: bool = False


class PoiSyncRequest(BaseModel):
    pois: list[PoiSyncItemRequest] = []


class TripPlanningStateUpdateRequest(BaseModel):
    current_step: Optional[int] = None
    state: dict[str, Any] = {}
    merge: bool = True


class StageVoteRequest(BaseModel):
    vote: str = "yes"


class StageFinalizeRequest(BaseModel):
    action: str = "approve"


class HealthAcknowledgmentItem(BaseModel):
    activity_id: str
    certification_required: Optional[str] = None
    user_has_cert: bool


class HealthAcknowledgmentRequest(BaseModel):
    acknowledgments: list[HealthAcknowledgmentItem]
    dietary_restrictions: list[str] = []
    mobility_level: Optional[str] = None


class PlatformPreferenceRequest(BaseModel):
    platform: str


class StoryboardGenerateRequest(BaseModel):
    day_id: Optional[str] = None


class ItineraryApproveRequest(BaseModel):
    approved: bool


class CalendarSyncRequest(BaseModel):
    provider: str
    calendar_id: Optional[str] = None
    access_token: Optional[str] = None


class AnalyticsEventRequest(BaseModel):
    session_id: Optional[str] = None
    trip_id: Optional[str] = None
    user_id: Optional[str] = None
    event_type: str
    screen_name: Optional[str] = None
    properties: dict[str, Any] = {}
    client_ts: Optional[str] = None


class DestinationExtractionRequest(BaseModel):
    text: str


class MeProfileRequest(BaseModel):
    display_name: str = ""
    travel_styles: list[str] = []
    interests: dict[str, Any] = {}
    budget_tier: str = "moderate"
    dietary: list[str] = []


class MeBucketItemRequest(BaseModel):
    destination: str
    country: Optional[str] = None
    tags: list[str] = []
    best_months: list[int] = []
    cost_per_day: float = 0
    best_time_desc: str = ""
    cost_note: str = ""


class CrewInviteAcceptRequest(BaseModel):
    invite_token: str


class CrewInviteRespondRequest(BaseModel):
    invite_token: str
    action: str = "accept"


class LLMMessageRequest(BaseModel):
    model: Optional[str] = None
    max_tokens: int = 800
    temperature: Optional[float] = None
    system: Optional[str] = None
    messages: list[dict[str, Any]]


def _smtp_settings() -> tuple[str, int, str, str, str]:
    host_port = os.getenv("SMTP_HOST", "").strip()
    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_pass = os.getenv("SMTP_PASS", "").strip()
    smtp_from = os.getenv("ALERT_EMAIL_FROM", smtp_user).strip()

    host = host_port
    port = 587
    if ":" in host_port:
        host, port_str = host_port.rsplit(":", 1)
        try:
            port = int(port_str)
        except ValueError:
            port = 587

    return host.strip(), port, smtp_user, smtp_pass, smtp_from


def _crew_invite_delivery_mode() -> str:
    mode = os.getenv("CREW_INVITE_DELIVERY_MODE", "email").strip().lower()
    if mode in {"link", "manual"}:
        return "link_only"
    if mode not in {"email", "link_only"}:
        return "email"
    return mode


def _send_trip_invite_email_sync(
    *,
    to_email: str,
    inviter_name: str,
    inviter_email: str,
    trip_name: str,
    trip_id: str,
    duration_days: int = 0,
    destinations: Optional[list[str]] = None,
) -> None:
    host, port, smtp_user, smtp_pass, smtp_from = _smtp_settings()
    if not host or not smtp_user or not smtp_pass or not smtp_from:
        raise RuntimeError("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS/ALERT_EMAIL_FROM)")

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    accept_link = f"{frontend_base}/?entry=home&join_trip_id={quote_plus(str(trip_id))}&trip_invite_action=accept"
    reject_link = f"{frontend_base}/?entry=home&join_trip_id={quote_plus(str(trip_id))}&trip_invite_action=reject"
    destination_line = ", ".join((destinations or [])[:8]).strip()
    duration_line = f"{int(duration_days)} day trip" if int(duration_days or 0) > 0 else "Duration to be finalized"
    subject = f"{inviter_name} invited you to trip: {trip_name}"
    text_body = (
        "You have a WanderPlan trip invitation.\n\n"
        f"From: {inviter_name} ({inviter_email})\n"
        f"Trip Name: {trip_name}\n"
        f"Duration: {duration_line}\n"
        f"Destinations: {destination_line or 'TBD'}\n\n"
        f"Accept Trip: {accept_link}\n"
        f"Reject Trip: {reject_link}\n\n"
        "If you already have a WanderPlan account, sign in and choose Accept Trip or Reject Trip.\n"
        "If you are new, sign up first and then choose Accept Trip or Reject Trip.\n\n"
        "If you were not expecting this invite, you can ignore this email."
    )
    html_body = (
        "<div style=\"font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;\">"
        "<p style=\"margin:0 0 10px 0;\">You have a WanderPlan trip invitation.</p>"
        f"<p style=\"margin:0 0 6px 0;\"><strong>From:</strong> {inviter_name} ({inviter_email})</p>"
        f"<p style=\"margin:0 0 14px 0;\"><strong>Trip Name:</strong> {trip_name}</p>"
        f"<p style=\"margin:0 0 6px 0;\"><strong>Duration:</strong> {duration_line}</p>"
        f"<p style=\"margin:0 0 14px 0;\"><strong>Destinations:</strong> {destination_line or 'TBD'}</p>"
        "<p style=\"margin:0 0 14px 0;\">"
        f"<a href=\"{accept_link}\" style=\"display:inline-block;padding:10px 14px;border-radius:8px;background:#0D7377;color:#fff;text-decoration:none;font-weight:600;\">Accept Trip</a>"
        "&nbsp;&nbsp;"
        f"<a href=\"{reject_link}\" style=\"display:inline-block;padding:10px 14px;border-radius:8px;background:#ef4444;color:#fff;text-decoration:none;font-weight:600;\">Reject Trip</a>"
        "</p>"
        "<p style=\"margin:0 0 8px 0;\">If you already have a WanderPlan account, sign in and choose Accept Trip or Reject Trip.</p>"
        "<p style=\"margin:0 0 8px 0;\">If you are new, sign up first and then choose Accept Trip or Reject Trip.</p>"
        "<p>If you were not expecting this invite, you can ignore this email.</p>"
        "</div>"
    )

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)


async def _send_trip_invite_email(
    *,
    to_email: str,
    inviter_name: str,
    inviter_email: str,
    trip_name: str,
    trip_id: str,
    duration_days: int = 0,
    destinations: Optional[list[str]] = None,
) -> tuple[bool, str]:
    try:
        await asyncio.to_thread(
            _send_trip_invite_email_sync,
            to_email=to_email,
            inviter_name=inviter_name,
            inviter_email=inviter_email,
            trip_name=trip_name,
            trip_id=trip_id,
            duration_days=duration_days,
            destinations=destinations,
        )
        return True, ""
    except Exception as exc:
        return False, str(exc)


def _send_crew_invite_email_sync(
    *,
    inviter_email: str,
    inviter_name: str,
    invitee_email: str,
    invite_token: str,
    invitee_has_account: bool,
) -> None:
    host, port, smtp_user, smtp_pass, smtp_from = _smtp_settings()
    if not host or not smtp_user or not smtp_pass or not smtp_from:
        raise RuntimeError("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS/ALERT_EMAIL_FROM)")

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    signin_or_signup_link = f"{frontend_base}/?entry=home"
    accept_link = f"{frontend_base}/?entry=home&invite_token={quote_plus(invite_token)}&invite_action=accept"
    reject_link = f"{frontend_base}/?entry=home&invite_token={quote_plus(invite_token)}&invite_action=reject"
    subject = f"{inviter_name} invited you to join WanderPlan crew"
    text_body = (
        f"{inviter_name} ({inviter_email}) invited you to join their WanderPlan crew.\n\n"
        f"Sign in / Sign up: {signin_or_signup_link}\n"
        f"Accept invite (new or existing account): {accept_link}\n"
        f"Reject invite: {reject_link}\n\n"
        "If you already have a WanderPlan account, sign in and choose Accept or Reject.\n"
        "If you are new, sign up first and then choose Accept or Reject.\n\n"
        "After signup and profile setup, you will be able to see each other's preferences."
    )
    html_body = (
        f"<p><strong>{inviter_name}</strong> ({inviter_email}) invited you to join their WanderPlan crew.</p>"
        f"<p><a href=\"{signin_or_signup_link}\">Sign in / Sign up</a></p>"
        f"<p><a href=\"{accept_link}\">Accept invite</a></p>"
        f"<p><a href=\"{reject_link}\">Reject invite</a></p>"
        "<p>If you already have a WanderPlan account, sign in and choose Accept or Reject.</p>"
        "<p>If you are new, sign up first and then choose Accept or Reject.</p>"
        "<p>After signup and profile setup, you will be able to see each other's preferences.</p>"
    )

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = invitee_email
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    with smtplib.SMTP(host, port, timeout=15) as server:
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.send_message(msg)


async def _send_crew_invite_email(
    *,
    inviter_email: str,
    inviter_name: str,
    invitee_email: str,
    invite_token: str,
    invitee_has_account: bool,
) -> tuple[bool, str]:
    try:
        await asyncio.to_thread(
            _send_crew_invite_email_sync,
            inviter_email=inviter_email,
            inviter_name=inviter_name,
            invitee_email=invitee_email,
            invite_token=invite_token,
            invitee_has_account=invitee_has_account,
        )
        return True, ""
    except Exception as exc:
        return False, str(exc)


def _parse_user_id_from_token(authorization: str) -> str:
    prefix = "Bearer "
    if not authorization or not authorization.startswith(prefix):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization[len(prefix) :].strip()
    if token.startswith("test-token:"):
        return token.split(":", 1)[1]
    parts = token.split(".")
    if len(parts) == 3:
        try:
            payload = parts[1].replace("-", "+").replace("_", "/")
            while len(payload) % 4 != 0:
                payload += "="
            payload_json = base64.b64decode(payload.encode("utf-8")).decode("utf-8")
            parsed = json.loads(payload_json)
            uid = str(parsed.get("sub") or parsed.get("user_id") or parsed.get("userId") or parsed.get("id") or "").strip()
            if uid:
                return uid
        except Exception:
            pass
    raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    return _parse_user_id_from_token(authorization)


async def _require_trip_member(conn: asyncpg.Connection, trip_id: str, user_id: str) -> None:
    member = await conn.fetchrow(
        "SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2",
        trip_id,
        user_id,
    )
    if not member:
        raise HTTPException(status_code=403, detail="Forbidden")


async def _require_accepted_trip_member(conn: asyncpg.Connection, trip_id: str, user_id: str) -> None:
    member = await conn.fetchrow(
        """
        SELECT role, status
        FROM trip_members
        WHERE trip_id = $1 AND user_id = $2
        """,
        trip_id,
        user_id,
    )
    if not member:
        raise HTTPException(status_code=403, detail="Forbidden")
    role = str(member["role"] or "").lower()
    status = str(member["status"] or "pending").lower()
    if role != "owner" and status != "accepted":
        raise HTTPException(status_code=403, detail="Only accepted trip members can access this trip")


async def _require_trip_owner(conn: asyncpg.Connection, trip_id: str, user_id: str) -> None:
    trip = await conn.fetchrow("SELECT owner_id FROM trips WHERE id = $1", trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if str(trip["owner_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Only owner can perform this action")


def _budget_breakdown(total_budget: float) -> dict[str, float]:
    # Flights removed — each traveler selects flights individually (personal cost)
    accommodation = round(total_budget * 0.40, 2)
    dining = round(total_budget * 0.25, 2)
    activities = round(total_budget * 0.20, 2)
    transport = round(total_budget * 0.10, 2)
    misc = round(total_budget - (accommodation + dining + activities + transport), 2)
    return {
        "accommodation": accommodation,
        "dining": dining,
        "activities": activities,
        "transport": transport,
        "misc": misc,
    }


def _json_obj(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}
    return {}


_CONSENSUS_STAGE_ALIASES = {
    "bucket": "destinations",
    "destination": "destinations",
    "destinations": "destinations",
    "invite": "invite_crew",
    "invite_crew": "invite_crew",
    "invite-crew": "invite_crew",
    "vote": "vote_destinations",
    "vote_destinations": "vote_destinations",
    "vote-destinations": "vote_destinations",
    "interests": "interests",
    "health": "health",
    "activities": "activities",
    "pois": "poi_voting",
    "poi_voting": "poi_voting",
    "poi-voting": "poi_voting",
    "budget": "budget",
    "dates": "dates",
    "duration": "dates",
    "availability": "dates",
    "stays": "stays",
    "dining": "dining",
    "itinerary": "itinerary",
}


def _normalize_consensus_stage_key(stage_key: str) -> str:
    raw = str(stage_key or "").strip().lower().replace(" ", "_")
    if not raw:
        raise HTTPException(status_code=422, detail="Missing stage key")
    mapped = _CONSENSUS_STAGE_ALIASES.get(raw, raw)
    if mapped not in set(_CONSENSUS_STAGE_ALIASES.values()):
        raise HTTPException(status_code=422, detail=f"Unsupported stage: {stage_key}")
    return mapped


def _normalize_stage_vote(vote: str) -> str:
    raw = str(vote or "").strip().lower()
    if raw in {"approve", "approved", "yes", "y", "up", "thumbs_up"}:
        return "yes"
    if raw in {"revise", "revised", "no", "n", "down", "thumbs_down"}:
        return "no"
    raise HTTPException(status_code=422, detail="vote must be yes/no (or approve/revise)")


def _normalize_stage_finalize_action(action: str) -> str:
    raw = str(action or "").strip().lower()
    if raw in {"approve", "approved", "yes"}:
        return "approved"
    if raw in {"revise", "revised", "reject", "no"}:
        return "revised"
    raise HTTPException(status_code=422, detail="action must be approve or revise")


def _deep_merge_state(base: Any, incoming: Any) -> Any:
    if isinstance(base, dict) and isinstance(incoming, dict):
        merged: dict[str, Any] = dict(base)
        for k, v in incoming.items():
            merged[k] = _deep_merge_state(merged.get(k), v)
        return merged
    return incoming


def _build_stage_consensus_summary(
    stage_key: str,
    stage_state: dict[str, Any],
    accepted_members: list[dict[str, Any]],
    owner_id: str,
    user_id: str,
) -> dict[str, Any]:
    votes_raw = stage_state.get("votes")
    votes = votes_raw if isinstance(votes_raw, dict) else {}
    accepted_ids = [str(m["user_id"]) for m in accepted_members]
    yes_count = 0
    no_count = 0
    pending_count = 0
    for uid in accepted_ids:
        val = str(votes.get(uid, "")).strip().lower()
        if val == "yes":
            yes_count += 1
        elif val == "no":
            no_count += 1
        else:
            pending_count += 1
    member_count = len(accepted_ids)
    majority_needed = max(1, (member_count // 2) + 1)
    is_solo = member_count <= 1
    decision = str(stage_state.get("final_decision") or "").strip().lower() or None
    return {
        "stage_key": stage_key,
        "consensus_mode": "majority_with_organizer_final_say",
        "organizer_user_id": owner_id,
        "is_organizer": str(owner_id) == str(user_id),
        "is_solo": is_solo,
        "member_count": member_count,
        "majority_needed": majority_needed,
        "votes": votes,
        "yes_count": yes_count,
        "no_count": no_count,
        "pending_count": pending_count,
        "has_majority_yes": yes_count >= majority_needed,
        "has_majority_no": no_count >= majority_needed,
        "final_decision": decision,
        "finalized_by": stage_state.get("finalized_by"),
        "finalized_at": stage_state.get("finalized_at"),
        "members": accepted_members,
    }


def _amadeus_settings() -> tuple[str, str, str]:
    base_url = os.getenv("AMADEUS_BASE_URL", "https://api.amadeus.com").strip().rstrip("/")
    client_id = os.getenv("AMADEUS_CLIENT_ID", os.getenv("AMADEUS_API_KEY", "")).strip()
    client_secret = os.getenv("AMADEUS_CLIENT_SECRET", os.getenv("AMADEUS_API_SECRET", "")).strip()
    return base_url, client_id, client_secret


def _amadeus_credentials_configured() -> bool:
    _, client_id, client_secret = _amadeus_settings()
    return bool(client_id and client_secret)


def _parse_iso_duration_minutes(value: str) -> int:
    text = str(value or "").strip().upper()
    match = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?", text)
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    return (hours * 60) + minutes


def _safe_parse_datetime(value: str) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.now(timezone.utc)
    try:
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def _airline_booking_url(
    carrier_code: str,
    *,
    origin: str,
    destination: str,
    depart_date: str,
    return_date: str | None = None,
) -> str:
    carrier = str(carrier_code or "").upper()
    origin_code = re.sub(r"[^A-Z]", "", str(origin or "").upper())[:3]
    destination_code = re.sub(r"[^A-Z]", "", str(destination or "").upper())[:3]
    depart = str(depart_date or "")[:10]
    ret = str(return_date or "")[:10]

    airline_sites = {
        "AA": "https://www.aa.com",
        "AF": "https://wwws.airfrance.us",
        "AS": "https://www.alaskaair.com",
        "BA": "https://www.britishairways.com",
        "B6": "https://www.jetblue.com",
        "DL": "https://www.delta.com",
        "EK": "https://www.emirates.com",
        "LH": "https://www.lufthansa.com",
        "NH": "https://www.ana.co.jp",
        "QF": "https://www.qantas.com",
        "QR": "https://www.qatarairways.com",
        "SQ": "https://www.singaporeair.com",
        "UA": "https://www.united.com",
        "WN": "https://www.southwest.com",
        "JL": "https://www.jal.com",
    }
    base = airline_sites.get(carrier)
    if base:
        query = urlencode(
            {
                "origin": origin_code,
                "destination": destination_code,
                "departureDate": depart,
                "returnDate": ret or "",
            }
        )
        return f"{base}/?{query}"

    phrase = f"Flights from {origin_code} to {destination_code} on {depart}"
    if ret:
        phrase += f" returning {ret}"
    return f"https://www.google.com/travel/flights?q={quote_plus(phrase)}"


def _amadeus_get_access_token(force_refresh: bool = False) -> str:
    global _AMADEUS_TOKEN, _AMADEUS_TOKEN_EXPIRES_AT
    now = pytime.time()
    if not force_refresh and _AMADEUS_TOKEN and now < (_AMADEUS_TOKEN_EXPIRES_AT - 30):
        return _AMADEUS_TOKEN

    base_url, client_id, client_secret = _amadeus_settings()
    if not client_id or not client_secret:
        raise RuntimeError("Amadeus credentials are not configured")

    payload = urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": client_id,
            "client_secret": client_secret,
        }
    ).encode("utf-8")
    req = urllib_request.Request(
        f"{base_url}/v1/security/oauth2/token",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib_request.urlopen(req, timeout=15) as resp:  # nosec B310
        body = json.loads(resp.read().decode("utf-8"))
    token = str(body.get("access_token") or "").strip()
    expires_in = int(body.get("expires_in") or 1799)
    if not token:
        raise RuntimeError("Amadeus token response missing access_token")
    _AMADEUS_TOKEN = token
    _AMADEUS_TOKEN_EXPIRES_AT = now + max(expires_in, 60)
    return token


def _amadeus_request_json(path: str, params: dict[str, Any], retry: bool = True) -> dict[str, Any]:
    base_url, _, _ = _amadeus_settings()
    token = _amadeus_get_access_token(force_refresh=False)
    query = urlencode(params)
    url = f"{base_url}{path}?{query}"
    req = urllib_request.Request(
        url,
        method="GET",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib_request.urlopen(req, timeout=20) as resp:  # nosec B310
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 401 and retry:
            _amadeus_get_access_token(force_refresh=True)
            return _amadeus_request_json(path, params, retry=False)
        body = exc.read().decode("utf-8", "ignore")
        raise RuntimeError(f"Amadeus API error HTTP {exc.code}: {body}") from exc
    except URLError as exc:
        raise RuntimeError(f"Amadeus network error: {exc.reason}") from exc


def _segment_departure_date(segment: dict[str, Any], fallback_days: int) -> str:
    dep_time = segment.get("depart_time")
    if isinstance(dep_time, datetime):
        return dep_time.date().isoformat()
    try:
        return date.fromisoformat(str(dep_time)[:10]).isoformat()
    except Exception:
        return (datetime.now(timezone.utc) + timedelta(days=max(1, fallback_days))).date().isoformat()


def _search_amadeus_segment(
    *,
    from_airport: str,
    to_airport: str,
    depart_date: str,
    cabin_class: str,
    max_price: float,
    max_results: int = 12,
) -> list[dict[str, Any]]:
    cabin = str(cabin_class or "economy").strip().upper().replace("-", "_")
    if cabin not in {"ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"}:
        cabin = "ECONOMY"

    params: dict[str, Any] = {
        "originLocationCode": from_airport,
        "destinationLocationCode": to_airport,
        "departureDate": depart_date,
        "adults": 1,
        "travelClass": cabin,
        "currencyCode": "USD",
        "max": max_results,
    }
    if max_price > 0:
        params["maxPrice"] = int(max(50, round(max_price)))

    data = _amadeus_request_json("/v2/shopping/flight-offers", params=params)
    offers = data.get("data", [])
    carriers = _json_obj(data.get("dictionaries", {}).get("carriers"))

    parsed: list[dict[str, Any]] = []
    for offer in offers:
        itineraries = offer.get("itineraries") or []
        if not itineraries:
            continue
        first_itinerary = itineraries[0]
        segments = first_itinerary.get("segments") or []
        if not segments:
            continue

        first_segment = segments[0]
        last_segment = segments[-1]
        dep_at = str(first_segment.get("departure", {}).get("at", ""))
        arr_at = str(last_segment.get("arrival", {}).get("at", ""))
        dep_airport = str(first_segment.get("departure", {}).get("iataCode", from_airport))
        arr_airport = str(last_segment.get("arrival", {}).get("iataCode", to_airport))
        carrier_code = str(
            first_segment.get("carrierCode")
            or first_segment.get("operating", {}).get("carrierCode")
            or ""
        ).upper()
        airline_name = str(carriers.get(carrier_code) or carrier_code or "Airline")
        raw_price = offer.get("price", {}).get("grandTotal")
        try:
            price_total = float(raw_price)
        except Exception:
            continue
        duration_min = _parse_iso_duration_minutes(first_itinerary.get("duration", ""))
        stops = max(0, len(segments) - 1)

        booking_url = (
            str(offer.get("links", {}).get("flightOffers") or "").strip()
            or _airline_booking_url(
                carrier_code,
                origin=dep_airport,
                destination=arr_airport,
                depart_date=depart_date,
            )
        )
        parsed.append(
            {
                "offer_id": str(offer.get("id") or ""),
                "carrier_code": carrier_code,
                "airline_name": airline_name,
                "price_usd": price_total,
                "currency": str(offer.get("price", {}).get("currency") or "USD"),
                "departure_airport": dep_airport,
                "arrival_airport": arr_airport,
                "departure_time": _safe_parse_datetime(dep_at),
                "arrival_time": _safe_parse_datetime(arr_at),
                "duration_minutes": duration_min,
                "stops": stops,
                "booking_url": booking_url,
            }
        )
    parsed.sort(key=lambda item: (item["price_usd"], item["duration_minutes"], item["stops"]))
    return parsed


def _build_mock_flight_options(
    *,
    route_segments: list[dict[str, Any]],
    max_price: float,
    cabin_class: str,
) -> list[dict[str, Any]]:
    route_points = [route_segments[0]["from_airport"]] + [seg["to_airport"] for seg in route_segments]
    route_summary = " -> ".join(route_points)
    segment_count = len(route_segments)
    per_segment_budget = max_price / max(segment_count, 1)
    cabin_label = str(cabin_class or "economy").replace("_", " ").title()

    airline_profiles = [
        {"code": "JL", "airline": "Japan Airlines", "stops": 0, "price_mult": 0.86, "duration_mult": 0.94},
        {"code": "NH", "airline": "ANA", "stops": 0, "price_mult": 0.92, "duration_mult": 0.90},
        {"code": "EK", "airline": "Emirates", "stops": 1, "price_mult": 0.78, "duration_mult": 1.12},
    ]

    options: list[dict[str, Any]] = []
    for profile_idx, profile in enumerate(airline_profiles):
        legs = []
        total_price = 0.0
        total_stops = 0
        total_duration_min = 0
        first_dep_time = None
        last_arr_time = None

        for seg_idx, seg in enumerate(route_segments):
            route_seed = sum(ord(ch) for ch in f"{seg['from_airport']}{seg['to_airport']}")
            base_duration = 210 + (route_seed % 190)
            seg_stops = profile["stops"] + (1 if profile["stops"] == 0 and route_seed % 11 == 0 else 0)
            dep_time = seg["depart_time"] + timedelta(hours=profile_idx)
            duration_min = int(base_duration * profile["duration_mult"]) + (seg_stops * 55)
            arr_time = dep_time + timedelta(minutes=duration_min)
            seg_price = max(
                65.0,
                round(per_segment_budget * profile["price_mult"] * (0.94 + (seg_idx * 0.05)), 2),
            )

            total_price += seg_price
            total_stops += seg_stops
            total_duration_min += duration_min
            first_dep_time = first_dep_time or dep_time
            last_arr_time = arr_time
            legs.append(
                {
                    "from_airport": seg["from_airport"],
                    "to_airport": seg["to_airport"],
                    "departure_time": dep_time.isoformat(),
                    "arrival_time": arr_time.isoformat(),
                    "duration_minutes": duration_min,
                    "stops": seg_stops,
                }
            )

        options.append(
            {
                "source": "mock",
                "airline": profile["airline"],
                "departure_airport": route_segments[0]["from_airport"],
                "arrival_airport": route_segments[-1]["to_airport"],
                "departure_time": first_dep_time,
                "arrival_time": last_arr_time,
                "price_usd": round(total_price, 2),
                "stops": total_stops,
                "duration_minutes": total_duration_min,
                "cabin_class": cabin_label,
                "route_summary": route_summary,
                "legs_count": segment_count,
                "legs": legs,
                "booking_url": _airline_booking_url(
                    profile["code"],
                    origin=route_segments[0]["from_airport"],
                    destination=route_segments[-1]["to_airport"],
                    depart_date=_segment_departure_date(route_segments[0], 1),
                    return_date=_segment_departure_date(route_segments[-1], segment_count + 1),
                ),
            }
        )
    return options


def _build_live_flight_options(
    *,
    route_segments: list[dict[str, Any]],
    max_price: float,
    cabin_class: str,
) -> tuple[list[dict[str, Any]], str]:
    if not _amadeus_credentials_configured():
        return [], "amadeus_credentials_missing"

    if not route_segments:
        return [], "missing_route_segments"

    segment_budget_cap = max(80.0, (max_price / max(len(route_segments), 1)) * 1.2)
    segment_results: list[list[dict[str, Any]]] = []
    for idx, seg in enumerate(route_segments):
        dep_date = _segment_departure_date(seg, idx + 1)
        offers = _search_amadeus_segment(
            from_airport=seg["from_airport"],
            to_airport=seg["to_airport"],
            depart_date=dep_date,
            cabin_class=cabin_class,
            max_price=segment_budget_cap,
            max_results=12,
        )
        if not offers:
            return [], f"amadeus_no_results_segment_{idx + 1}"
        segment_results.append(offers)

    lead_segment = segment_results[0]
    carrier_candidates: list[str] = []
    for offer in lead_segment:
        carrier_code = str(offer.get("carrier_code") or "")
        if carrier_code and carrier_code not in carrier_candidates:
            carrier_candidates.append(carrier_code)
        if len(carrier_candidates) >= 4:
            break

    if not carrier_candidates:
        for offers in segment_results:
            for offer in offers:
                carrier_code = str(offer.get("carrier_code") or "")
                if carrier_code and carrier_code not in carrier_candidates:
                    carrier_candidates.append(carrier_code)
                if len(carrier_candidates) >= 4:
                    break
            if len(carrier_candidates) >= 4:
                break

    route_points = [route_segments[0]["from_airport"]] + [seg["to_airport"] for seg in route_segments]
    route_summary = " -> ".join(route_points)
    cabin_label = str(cabin_class or "economy").replace("_", " ").title()
    options: list[dict[str, Any]] = []

    for carrier_code in carrier_candidates[:3]:
        option_legs = []
        total_price = 0.0
        total_stops = 0
        total_duration = 0
        first_dep = None
        last_arr = None
        airline_name = ""
        booking_url = ""

        for seg_idx, offers in enumerate(segment_results):
            preferred = [item for item in offers if item.get("carrier_code") == carrier_code]
            chosen = preferred[0] if preferred else offers[0]
            total_price += float(chosen.get("price_usd") or 0.0)
            total_stops += int(chosen.get("stops") or 0)
            total_duration += int(chosen.get("duration_minutes") or 0)
            if first_dep is None:
                first_dep = chosen["departure_time"]
            last_arr = chosen["arrival_time"]
            if not airline_name:
                airline_name = str(chosen.get("airline_name") or carrier_code)
            if not booking_url:
                booking_url = str(chosen.get("booking_url") or "")

            option_legs.append(
                {
                    "from_airport": route_segments[seg_idx]["from_airport"],
                    "to_airport": route_segments[seg_idx]["to_airport"],
                    "departure_time": chosen["departure_time"].isoformat(),
                    "arrival_time": chosen["arrival_time"].isoformat(),
                    "duration_minutes": int(chosen.get("duration_minutes") or 0),
                    "stops": int(chosen.get("stops") or 0),
                }
            )

        if not booking_url:
            booking_url = _airline_booking_url(
                carrier_code,
                origin=route_segments[0]["from_airport"],
                destination=route_segments[-1]["to_airport"],
                depart_date=_segment_departure_date(route_segments[0], 1),
                return_date=_segment_departure_date(route_segments[-1], len(route_segments) + 1),
            )

        options.append(
            {
                "source": "amadeus",
                "airline": airline_name or carrier_code or "Airline",
                "departure_airport": route_segments[0]["from_airport"],
                "arrival_airport": route_segments[-1]["to_airport"],
                "departure_time": first_dep or route_segments[0]["depart_time"],
                "arrival_time": last_arr or route_segments[-1]["depart_time"],
                "price_usd": round(total_price, 2),
                "stops": total_stops,
                "duration_minutes": total_duration,
                "cabin_class": cabin_label,
                "route_summary": route_summary,
                "legs_count": len(route_segments),
                "legs": option_legs,
                "booking_url": booking_url,
            }
        )

    options.sort(key=lambda item: (item["price_usd"], item["duration_minutes"], item["stops"]))
    return options[:3], ""


def _make_leg_id(segment: dict[str, Any], idx: int) -> str:
    depart_date = _segment_departure_date(segment, idx + 1)
    return f"leg-{idx + 1}-{segment['from_airport']}-{segment['to_airport']}-{depart_date}"


def _build_mock_leg_option_groups(
    *,
    route_segments: list[dict[str, Any]],
    max_price: float,
    cabin_class: str,
) -> list[dict[str, Any]]:
    carriers = [
        ("DL", "Delta"),
        ("UA", "United"),
        ("AA", "American Airlines"),
        ("AS", "Alaska Airlines"),
        ("B6", "JetBlue"),
        ("NH", "ANA"),
        ("JL", "Japan Airlines"),
        ("BA", "British Airways"),
        ("AF", "Air France"),
        ("EK", "Emirates"),
    ]
    cabin_label = str(cabin_class or "economy").replace("_", " ").title()
    per_segment_budget = max_price / max(len(route_segments), 1)
    leg_groups: list[dict[str, Any]] = []

    for idx, segment in enumerate(route_segments):
        base_dep = segment["depart_time"]
        route_seed = sum(ord(ch) for ch in f"{segment['from_airport']}{segment['to_airport']}")
        leg_id = _make_leg_id(segment, idx)
        options: list[dict[str, Any]] = []
        for opt_idx, (carrier_code, airline_name) in enumerate(carriers):
            dep_time = base_dep + timedelta(minutes=opt_idx * 55)
            base_duration = 120 + (route_seed % 260) + (opt_idx * 9)
            stops = 0 if opt_idx < 3 else (1 if opt_idx < 8 else 2)
            duration_min = base_duration + (stops * 60)
            arr_time = dep_time + timedelta(minutes=duration_min)
            price_factor = 0.58 + (opt_idx * 0.047)
            price = min(
                max_price,
                max(45.0, round(per_segment_budget * price_factor + (idx * 6.5), 2)),
            )
            options.append(
                {
                    "leg_id": leg_id,
                    "airline": airline_name,
                    "carrier_code": carrier_code,
                    "departure_airport": segment["from_airport"],
                    "arrival_airport": segment["to_airport"],
                    "departure_time": dep_time,
                    "arrival_time": arr_time,
                    "price_usd": price,
                    "stops": stops,
                    "duration_minutes": duration_min,
                    "cabin_class": cabin_label,
                    "booking_url": _airline_booking_url(
                        carrier_code,
                        origin=segment["from_airport"],
                        destination=segment["to_airport"],
                        depart_date=_segment_departure_date(segment, idx + 1),
                    ),
                    "source": "mock",
                }
            )
        leg_groups.append(
            {
                "leg_id": leg_id,
                "from_airport": segment["from_airport"],
                "to_airport": segment["to_airport"],
                "depart_date": _segment_departure_date(segment, idx + 1),
                "options": options,
            }
        )
    return leg_groups


def _build_live_leg_option_groups(
    *,
    route_segments: list[dict[str, Any]],
    max_price: float,
    cabin_class: str,
) -> tuple[list[dict[str, Any]], str]:
    if not _amadeus_credentials_configured():
        return [], "amadeus_credentials_missing"
    if not route_segments:
        return [], "missing_route_segments"

    per_segment_budget = max(80.0, (max_price / max(len(route_segments), 1)) * 1.35)
    leg_groups: list[dict[str, Any]] = []
    for idx, segment in enumerate(route_segments):
        depart_date = _segment_departure_date(segment, idx + 1)
        offers: list[dict[str, Any]] = []
        # Try strict budget first, then relax pricing and date constraints if inventory is sparse.
        date_candidates: list[str] = [depart_date]
        try:
            dep = date.fromisoformat(depart_date)
            date_candidates.extend(
                [
                    (dep + timedelta(days=1)).isoformat(),
                    (dep - timedelta(days=1)).isoformat(),
                    (dep + timedelta(days=2)).isoformat(),
                    (dep - timedelta(days=2)).isoformat(),
                ]
            )
        except Exception:
            pass
        dedup_dates: list[str] = []
        for cand in date_candidates:
            if cand not in dedup_dates:
                dedup_dates.append(cand)

        last_error = ""
        merged_offers: dict[str, dict[str, Any]] = {}
        for dep_candidate in dedup_dates:
            for price_cap in (per_segment_budget, 0.0):
                try:
                    attempt_offers = _search_amadeus_segment(
                        from_airport=segment["from_airport"],
                        to_airport=segment["to_airport"],
                        depart_date=dep_candidate,
                        cabin_class=cabin_class,
                        max_price=price_cap,
                        max_results=30,
                    )
                except Exception as exc:
                    last_error = str(exc)
                    continue
                for offer in attempt_offers:
                    dep_val = offer.get("departure_time")
                    arr_val = offer.get("arrival_time")
                    dep_iso = dep_val.isoformat() if isinstance(dep_val, datetime) else str(dep_val or "")
                    arr_iso = arr_val.isoformat() if isinstance(arr_val, datetime) else str(arr_val or "")
                    key = "|".join(
                        [
                            str(offer.get("carrier_code") or ""),
                            str(offer.get("departure_airport") or ""),
                            str(offer.get("arrival_airport") or ""),
                            dep_iso,
                            arr_iso,
                            f"{float(offer.get('price_usd') or 0.0):.2f}",
                        ]
                    )
                    merged_offers[key] = offer
                # Keep expanding if inventory is sparse on the requested date.
                if dep_candidate == depart_date and len(merged_offers) >= 8:
                    break
                if len(merged_offers) >= 20:
                    break
            if dep_candidate == depart_date and len(merged_offers) >= 8:
                break
            if len(merged_offers) >= 20:
                break
        offers = sorted(
            merged_offers.values(),
            key=lambda item: (float(item.get("price_usd") or 0.0), int(item.get("duration_minutes") or 0), int(item.get("stops") or 0)),
        )

        if not offers:
            if last_error:
                return [], last_error
            return [], f"amadeus_no_results_segment_{idx + 1}"

        leg_id = _make_leg_id(segment, idx)
        options: list[dict[str, Any]] = []
        for offer in offers[:20]:
            options.append(
                {
                    "leg_id": leg_id,
                    "airline": offer.get("airline_name") or offer.get("carrier_code") or "Airline",
                    "carrier_code": offer.get("carrier_code") or "",
                    "departure_airport": offer.get("departure_airport") or segment["from_airport"],
                    "arrival_airport": offer.get("arrival_airport") or segment["to_airport"],
                    "departure_time": offer.get("departure_time") or segment["depart_time"],
                    "arrival_time": offer.get("arrival_time") or (segment["depart_time"] + timedelta(hours=4)),
                    "price_usd": float(offer.get("price_usd") or 0),
                    "stops": int(offer.get("stops") or 0),
                    "duration_minutes": int(offer.get("duration_minutes") or 0),
                    "cabin_class": str(cabin_class or "economy").replace("_", " ").title(),
                    "booking_url": offer.get("booking_url") or _airline_booking_url(
                        offer.get("carrier_code") or "",
                        origin=segment["from_airport"],
                        destination=segment["to_airport"],
                        depart_date=depart_date,
                    ),
                    "source": "amadeus",
                }
            )
        leg_groups.append(
            {
                "leg_id": leg_id,
                "from_airport": segment["from_airport"],
                "to_airport": segment["to_airport"],
                "depart_date": depart_date,
                "options": options,
            }
        )
    return leg_groups, ""


def _extract_json_block(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]) if len(lines) >= 3 else text
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        snippet = text[start : end + 1]
        try:
            parsed = json.loads(snippet)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _simple_destination_heuristic(text: str) -> list[dict[str, str]]:
    normalized = (text or "").replace("\n", " ").strip()
    if not normalized:
        return []
    lowered = normalized.lower()

    # Region shortcuts for common travel intents.
    region_aliases: dict[str, list[str]] = {
        "south east asia": ["Thailand", "Vietnam", "Indonesia", "Malaysia", "Singapore", "Philippines", "Cambodia", "Laos"],
        "southeast asia": ["Thailand", "Vietnam", "Indonesia", "Malaysia", "Singapore", "Philippines", "Cambodia", "Laos"],
        "south-east asia": ["Thailand", "Vietnam", "Indonesia", "Malaysia", "Singapore", "Philippines", "Cambodia", "Laos"],
        "sea countries": ["Thailand", "Vietnam", "Indonesia", "Malaysia", "Singapore", "Philippines", "Cambodia", "Laos"],
    }
    for alias, countries in region_aliases.items():
        if alias in lowered:
            return [{"name": country} for country in countries]

    stopwords = {
        "a", "an", "and", "at", "for", "i", "in", "me", "my", "of", "or", "our",
        "please", "somewhere", "the", "to", "us", "we",
    }
    travel_words = {
        "explore", "go", "going", "like", "love", "plan", "planning",
        "see", "travel", "traveling", "travelling", "visit", "visiting", "want", "wanna",
    }

    def _clean(value: str) -> str:
        return re.sub(r"\s+", " ", value.strip(" .!?;:,"))

    def _strip_intent_prefix(value: str) -> str:
        out = _clean(value)
        patterns = [
            r"^(?:i|we)\s+(?:want|wanna|would like|would love)\s+to\s+",
            r"^(?:i|we)\s+(?:plan|planning)\s+to\s+",
            r"^(?:go|going|travel|traveling|travelling|visit|visiting|explore|see)\s+(?:to\s+)?",
            r"^(?:to|in|at)\s+",
        ]
        for pattern in patterns:
            out = re.sub(pattern, "", out, flags=re.IGNORECASE)
        return _clean(out)

    def _is_plausible(value: str) -> bool:
        words = re.findall(r"[A-Za-z][A-Za-z'/-]*", value)
        if not words:
            return False
        lowered_words = [w.lower() for w in words]
        if len(lowered_words) > 4:
            return False
        if len(lowered_words) == 1 and (len(lowered_words[0]) < 3 or lowered_words[0] in stopwords):
            return False
        if all(w in stopwords for w in lowered_words):
            return False
        if any(w in travel_words for w in lowered_words):
            return False
        return True

    candidates: list[str] = []

    def _add_candidate_phrase(phrase: str) -> None:
        stripped = _strip_intent_prefix(phrase)
        if not stripped:
            return
        parts = re.split(r"\b(?:and|or|&)\b|[,;/|]+", stripped, flags=re.IGNORECASE)
        for part in parts:
            value = _clean(part)
            if value and _is_plausible(value):
                candidates.append(value)

    # Prefer list-like separators first.
    split_chunks = re.split(r"[,;/|]+", normalized)
    if len(split_chunks) > 1:
        for chunk in split_chunks:
            _add_candidate_phrase(chunk)

    # Handle conjunction lists (e.g., "Bali and Tokyo").
    conjunction_chunks = re.split(r"\b(?:and|or|&)\b", normalized, flags=re.IGNORECASE)
    if len(conjunction_chunks) > 1:
        for chunk in conjunction_chunks:
            _add_candidate_phrase(chunk)

    # Proper-noun runs as a fallback when users type full sentences.
    tokens = normalized.split()
    runs: list[str] = []
    current: list[str] = []
    for token in tokens:
        clean = token.strip(" .!?;:")
        if clean and clean[:1].isupper():
            current.append(clean)
        else:
            if current:
                runs.append(" ".join(current))
            current = []
    if current:
        runs.append(" ".join(current))
    for run in runs:
        _add_candidate_phrase(run)

    # Single-value fallback for short direct inputs (e.g., "paris").
    if not candidates:
        _add_candidate_phrase(normalized)

    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for item in candidates:
        name = item.strip()
        key = name.lower()
        if not name or key in seen:
            continue
        seen.add(key)
        out.append({"name": name})
    return out[:10]


def _anthropic_extract_destinations(text: str) -> tuple[list[dict[str, str]], bool, str, str, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return _simple_destination_heuristic(text), False, "", "fallback:no_api_key", "ANTHROPIC_API_KEY missing"

    model = (
        os.getenv("ANTHROPIC_MODEL", "").strip()
        or os.getenv("LLM_MODEL", "claude-sonnet-4-20250514").strip()
    )
    prompt = (
        "Extract travel destinations from this user text. "
        "Return ONLY JSON with shape {\"destinations\":[{\"name\":\"...\",\"country\":\"...\"}]}. "
        "Use city/region/country names only. Do not include commentary.\n\n"
        f"User text: {text}"
    )
    payload = {
        "model": model,
        "max_tokens": 400,
        "temperature": 0,
        "messages": [{"role": "user", "content": prompt}],
    }

    req = urllib_request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=20) as resp:  # nosec B310
            raw = resp.read().decode("utf-8")
    except HTTPError as err:
        body = ""
        try:
            body = err.read().decode("utf-8", errors="ignore")
        except Exception:
            body = ""
        detail = f"HTTPError {err.code}: {body[:400] or str(err.reason)}"
        return _simple_destination_heuristic(text), False, "", "fallback:network_error", detail
    except URLError as err:
        detail = f"URLError: {getattr(err, 'reason', str(err))}"
        return _simple_destination_heuristic(text), False, "", "fallback:network_error", detail
    except TimeoutError:
        return _simple_destination_heuristic(text), False, "", "fallback:network_error", "TimeoutError contacting Anthropic"

    data = _extract_json_block(raw)
    content = data.get("content")
    if isinstance(content, list):
        joined = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                joined.append(str(block.get("text", "")))
        maybe_json = _extract_json_block("\n".join(joined))
    else:
        maybe_json = data

    rows = maybe_json.get("destinations", [])
    if not isinstance(rows, list):
        return _simple_destination_heuristic(text), False, "", "fallback:llm_unparsable", "Anthropic response did not contain destinations[] JSON"

    out: list[dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name", "")).strip()
        country = str(row.get("country", "")).strip()
        if not name:
            continue
        k = name.lower()
        if k in seen:
            continue
        seen.add(k)
        item = {"name": name}
        if country:
            item["country"] = country
        out.append(item)
    if out:
        raw_text = ""
        if isinstance(content, list):
            raw_text = "\n".join(
                str(block.get("text", ""))
                for block in content
                if isinstance(block, dict) and block.get("type") == "text"
            ).strip()
        return out[:10], True, raw_text, "llm", ""
    return _simple_destination_heuristic(text), False, "", "fallback:empty_llm", "Anthropic returned empty destination list"


def _anthropic_messages_proxy(body: LLMMessageRequest) -> dict[str, Any]:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(status_code=503, detail="LLM is not configured: ANTHROPIC_API_KEY missing")

    model = (
        (body.model or "").strip()
        or os.getenv("ANTHROPIC_MODEL", "").strip()
        or os.getenv("LLM_MODEL", "claude-sonnet-4-20250514").strip()
    )
    max_tokens = int(body.max_tokens or 800)
    max_tokens = max(1, min(max_tokens, 8192))

    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": body.messages or [],
    }
    if body.system:
        payload["system"] = body.system
    if body.temperature is not None:
        payload["temperature"] = body.temperature

    if not payload["messages"]:
        raise HTTPException(status_code=400, detail="messages must not be empty")

    req = urllib_request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=30) as resp:  # nosec B310
            raw = resp.read().decode("utf-8")
    except HTTPError as err:
        body_text = ""
        try:
            body_text = err.read().decode("utf-8", errors="ignore")
        except Exception:
            body_text = ""
        status = int(getattr(err, "code", 502) or 502)
        if status < 400 or status > 599:
            status = 502
        raise HTTPException(
            status_code=status,
            detail=f"LLM error: HTTPError {status}: {body_text[:400] or str(err.reason)}",
        ) from err
    except URLError as err:
        raise HTTPException(
            status_code=502,
            detail=f"LLM error: URLError: {getattr(err, 'reason', str(err))}",
        ) from err
    except TimeoutError as err:
        raise HTTPException(status_code=504, detail="LLM error: TimeoutError contacting Anthropic") from err

    try:
        return json.loads(raw)
    except Exception as err:
        raise HTTPException(status_code=502, detail="LLM error: invalid JSON response from Anthropic") from err


POI_CATALOG: dict[str, list[dict[str, Any]]] = {
    "food": [
        {"name": "Tsukiji Outer Market", "category": "food", "city": "Tokyo", "country": "Japan", "tags": ["food", "market", "seafood"], "rating": 4.5, "cost": 15},
        {"name": "Ramen Street", "category": "food", "city": "Tokyo", "country": "Japan", "tags": ["food", "ramen", "dining"], "rating": 4.6, "cost": 10},
    ],
    "culture": [
        {"name": "Senso-ji Temple", "category": "culture", "city": "Tokyo", "country": "Japan", "tags": ["temple", "history", "culture"], "rating": 4.7, "cost": 0},
        {"name": "Tokyo National Museum", "category": "culture", "city": "Tokyo", "country": "Japan", "tags": ["museum", "history", "art"], "rating": 4.5, "cost": 12},
    ],
    "art": [
        {"name": "teamLab Borderless", "category": "art", "city": "Tokyo", "country": "Japan", "tags": ["art", "tech", "adventure"], "rating": 4.8, "cost": 32},
    ],
    "nature": [
        {"name": "Shinjuku Gyoen", "category": "nature", "city": "Tokyo", "country": "Japan", "tags": ["park", "nature", "garden"], "rating": 4.6, "cost": 5},
    ],
    "adventure": [
        {"name": "Mt Takao Hike", "category": "adventure", "city": "Tokyo", "country": "Japan", "tags": ["hiking", "nature", "adventure"], "rating": 4.4, "cost": 5},
    ],
}


_PROFILE_INTEREST_CATEGORY_ALIASES: dict[str, list[str]] = {
    "food": ["food"],
    "cooking": ["food"],
    "dining": ["food"],
    "street_food": ["food"],
    "local": ["food", "culture"],
    "culture": ["culture"],
    "history": ["culture"],
    "historical": ["culture"],
    "temples": ["culture"],
    "museum": ["art", "culture"],
    "museums": ["art", "culture"],
    "art": ["art"],
    "photography": ["art", "nature"],
    "photo": ["art", "nature"],
    "hiking": ["nature", "adventure"],
    "nature": ["nature"],
    "adventure": ["adventure"],
    "scuba": ["adventure"],
    "snorkeling": ["adventure"],
    "nightlife": ["food", "culture"],
    "shopping": ["culture", "food"],
    "wellness": ["nature"],
    # Legacy values produced by older frontend mapping.
    "do": ["nature"],
    "how": ["adventure"],
}
_POI_CATEGORY_KEYS: set[str] = set(POI_CATALOG.keys())


def _normalize_interest_categories(values: Any) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in values or []:
        key = str(raw or "").strip().lower().replace(" ", "_")
        if not key:
            continue
        mapped = _PROFILE_INTEREST_CATEGORY_ALIASES.get(key, [key])
        for cat in mapped:
            norm = str(cat or "").strip().lower()
            if not norm or norm not in _POI_CATEGORY_KEYS or norm in seen:
                continue
            seen.add(norm)
            out.append(norm)
    return out


def _categories_from_user_profile_interests(interests: Any) -> list[str]:
    parsed = interests
    if isinstance(parsed, str):
        try:
            parsed = json.loads(parsed)
        except Exception:
            parsed = {}
    if not isinstance(parsed, dict):
        return []

    selected: list[str] = []
    for key, val in parsed.items():
        keep = False
        if isinstance(val, bool):
            keep = val
        elif isinstance(val, (int, float)):
            keep = val > 0
        elif isinstance(val, str):
            keep = val.strip().lower() in {"1", "true", "yes", "y", "on"}
        if keep:
            selected.append(str(key or ""))
    return _normalize_interest_categories(selected)


async def _trip_interest_category_counter(conn: asyncpg.Connection, trip_id: str) -> Counter[str]:
    rows = await conn.fetch(
        """
        SELECT tm.user_id, ip.categories, up.interests
        FROM trip_members tm
        LEFT JOIN interest_profiles ip ON ip.trip_id = tm.trip_id AND ip.user_id = tm.user_id
        LEFT JOIN user_profiles up ON up.user_id = tm.user_id
        WHERE tm.trip_id = $1 AND tm.status = 'accepted'
        """,
        trip_id,
    )

    counter: Counter[str] = Counter()
    for row in rows:
        trip_categories = _normalize_interest_categories(row["categories"] or [])
        if trip_categories:
            for cat in trip_categories:
                counter[cat] += 1
            continue

        profile_categories = _categories_from_user_profile_interests(row["interests"])
        for cat in profile_categories:
            counter[cat] += 1
    return counter


def _post_calendar_event(base_url: str, calendar_id: str, payload: dict[str, Any]) -> None:
    if not base_url:
        return
    endpoint = f"{base_url.rstrip('/')}/v3/calendars/{calendar_id}/events"
    data = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(endpoint, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib_request.urlopen(req, timeout=5) as resp:  # nosec B310
        if resp.status < 200 or resp.status >= 300:
            raise HTTPException(status_code=502, detail="Calendar provider rejected event")


MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _timing_profile_for_destination(destination: str) -> tuple[dict[str, int], list[str], list[str], dict[str, str]]:
    # Deterministic seasonality curve by destination hash so tests stay stable.
    seed = sum(ord(c) for c in destination.lower()) % 12
    month_scores: dict[str, int] = {}
    for idx, month in enumerate(MONTH_NAMES):
        distance = min((idx - seed) % 12, (seed - idx) % 12)
        score = max(0, 10 - distance * 2)
        month_scores[month] = int(score)

    sorted_months = sorted(month_scores.items(), key=lambda item: item[1], reverse=True)
    preferred = [m for m, _ in sorted_months[:3]]
    avoid = [m for m, _ in sorted(month_scores.items(), key=lambda item: item[1])[:2]]

    start = datetime(2025, 6, 15, tzinfo=timezone.utc)
    end = start + timedelta(days=13)
    best_window = {"start": start.isoformat(), "end": end.isoformat()}
    return month_scores, preferred, avoid, best_window


def _storyboard_text(platform: str, title_tokens: list[str], destination: str) -> str:
    joined = ", ".join(title_tokens[:3]) if title_tokens else destination
    if platform == "twitter":
        text = f"{destination} day highlights: {joined}. Perfect balance of culture + food + views. #travel"
        return text[:280]
    if platform == "tiktok":
        text = f"POV: one day in {destination} - {joined}. Save this route for your next trip! #tiktoktravel #wanderplan"
        return text[:300]
    if platform == "blog":
        para = (
            f"We started in {destination} and moved through {joined}. "
            "Every transition was timed to avoid crowds and preserve recovery windows. "
            "Food stops were selected to match dietary constraints while still keeping local character.\n\n"
        )
        long_text = para * 18
        return long_text
    hashtags = "#travel #wanderplan #itinerary #explore"
    base = (
        f"{destination} in one unforgettable sequence: {joined}. "
        "Sunrise starts, market lunches, and evening city views all fit without rush. "
        "This is exactly why collaborative trip planning matters. "
    )
    return f"{base}{hashtags}"


async def _bootstrap_schema(conn: asyncpg.Connection) -> None:
    # Fresh cloud databases need a complete baseline schema before app endpoints run.
    statements = [
        """
        CREATE EXTENSION IF NOT EXISTS pgcrypto
        """,
        """
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS trips (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          owner_id UUID REFERENCES users(id),
          name TEXT NOT NULL,
          status TEXT DEFAULT 'planning',
          duration_days INT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS trip_members (
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          role TEXT DEFAULT 'member',
          status TEXT DEFAULT 'pending',
          joined_at TIMESTAMPTZ,
          PRIMARY KEY (trip_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS bucket_list_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          destination TEXT NOT NULL,
          country TEXT,
          category TEXT,
          added_by UUID REFERENCES users(id),
          vote_score INT DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS trip_destinations (
          trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
          destination TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (trip_id, destination)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS timing_results (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          destination TEXT NOT NULL,
          month_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
          preferred_months TEXT[] DEFAULT '{}',
          avoid_months TEXT[] DEFAULT '{}',
          best_window JSONB,
          computed_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS interest_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          categories TEXT[] DEFAULT '{}',
          intensity TEXT DEFAULT 'moderate',
          must_do TEXT[] DEFAULT '{}',
          avoid TEXT[] DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (trip_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS pois (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          category TEXT,
          city TEXT,
          country TEXT,
          tags TEXT[] DEFAULT '{}',
          rating NUMERIC(3,1),
          cost_estimate_usd NUMERIC(10,2) DEFAULT 0,
          shortlisted BOOLEAN DEFAULT FALSE,
          approved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS budgets (
          trip_id UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
          currency TEXT DEFAULT 'USD',
          daily_target NUMERIC(12,2),
          total_budget NUMERIC(12,2),
          spent NUMERIC(12,2) DEFAULT 0,
          remaining NUMERIC(12,2),
          breakdown JSONB DEFAULT '{}'::jsonb,
          warning_active BOOLEAN DEFAULT FALSE,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS flight_options (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          airline TEXT,
          departure_airport TEXT,
          arrival_airport TEXT,
          departure_time TIMESTAMPTZ,
          arrival_time TIMESTAMPTZ,
          price_usd NUMERIC(10,2),
          stops INT DEFAULT 0,
          duration_min INT,
          selected BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS itinerary_days (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          day_number INT NOT NULL,
          date DATE,
          title TEXT,
          approved BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS itinerary_activities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          day_id UUID REFERENCES itinerary_days(id) ON DELETE CASCADE,
          time_slot TEXT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          location_name TEXT,
          lat DOUBLE PRECISION,
          lng DOUBLE PRECISION,
          cost_estimate NUMERIC(10,2) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS calendar_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          activity_id UUID REFERENCES itinerary_activities(id),
          calendar_id TEXT,
          event_title TEXT,
          start_time TIMESTAMPTZ,
          end_time TIMESTAMPTZ,
          location TEXT,
          synced_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS storyboards (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          platform TEXT NOT NULL,
          content TEXT,
          word_count INT,
          generated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id TEXT,
          trip_id UUID,
          user_id UUID,
          event_type TEXT NOT NULL,
          screen_name TEXT,
          properties JSONB DEFAULT '{}'::jsonb,
          client_ts TIMESTAMPTZ,
          server_ts TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS health_acknowledgments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          activity_id UUID,
          certification_required TEXT,
          user_has_cert BOOLEAN,
          alternative_suggested TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS availability_windows (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS member_platform_preferences (
          trip_id UUID NOT NULL,
          user_id UUID NOT NULL,
          platform TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (trip_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS trip_planning_states (
          trip_id UUID PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
          current_step INT DEFAULT 0,
          state JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_by UUID REFERENCES users(id),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS user_profiles (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL DEFAULT '',
          travel_styles TEXT[] NOT NULL DEFAULT '{}',
          interests JSONB NOT NULL DEFAULT '{}'::jsonb,
          budget_tier TEXT NOT NULL DEFAULT 'moderate',
          dietary TEXT[] NOT NULL DEFAULT '{}',
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS personal_bucket_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          destination TEXT NOT NULL,
          country TEXT,
          tags TEXT[] NOT NULL DEFAULT '{}',
          best_months INT[] NOT NULL DEFAULT '{}',
          cost_per_day NUMERIC(10,2) NOT NULL DEFAULT 0,
          best_time_desc TEXT NOT NULL DEFAULT '',
          cost_note TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS crew_invites (
          invite_token TEXT PRIMARY KEY,
          inviter_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          inviter_email TEXT NOT NULL,
          invitee_email TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          accepted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          accepted_at TIMESTAMPTZ
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS crew_links (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          peer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, peer_user_id),
          CHECK (user_id <> peer_user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS poi_votes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
          poi_id UUID NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject')),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (poi_id, user_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS poi_shortlist_selections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
          poi_id UUID NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          selected BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (poi_id, user_id)
        )
        """,
    ]
    for stmt in statements:
        await conn.execute(stmt)
    await conn.execute("ALTER TABLE pois ADD COLUMN IF NOT EXISTS shortlisted BOOLEAN DEFAULT FALSE")


@app.on_event("startup")
async def _startup_db():
    global db_pool
    dsn = os.getenv(
        "POSTGRES_DSN",
        "postgresql://wanderplan:wanderplan_test@localhost:15432/wanderplan_test",
    )
    # SQLAlchemy-style DSN is used in compose; asyncpg expects postgresql://...
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)
    db_pool = await asyncpg.create_pool(
        dsn=dsn
    )
    async with db_pool.acquire() as conn:
        await _bootstrap_schema(conn)


@app.on_event("shutdown")
async def _shutdown_db():
    global db_pool
    if db_pool is not None:
        await db_pool.close()
        db_pool = None

# Add /auth/login endpoint
@app.post("/auth/register", response_model=AuthResponse, status_code=201)
async def register(request: RegisterRequest):
    normalized_email = (request.email or "").strip().lower()
    incoming_password = request.password or ""
    display_name = (request.name or "").strip() or normalized_email.split("@")[0]

    if "@" not in normalized_email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(incoming_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # In-memory seed/runtime users
    if normalized_email in USERS:
        raise HTTPException(status_code=409, detail="Email already exists")

    user_id = str(uuid4())
    if db_pool is not None:
        async with db_pool.acquire() as conn:
            existing = await conn.fetchrow("SELECT id FROM users WHERE email = $1", normalized_email)
            if existing:
                raise HTTPException(status_code=409, detail="Email already exists")
            await conn.execute(
                """
                INSERT INTO users (id, email, name, password_hash)
                VALUES ($1::uuid, $2, $3, $4)
                """,
                user_id,
                normalized_email,
                display_name,
                f"plain:{incoming_password}",
            )

    # Keep login compatibility even when DB is unavailable locally.
    USERS[normalized_email] = {
        "password": incoming_password,
        "user_id": user_id,
        "name": display_name,
    }

    return AuthResponse(
        accessToken=f"test-token:{user_id}",
        user_id=user_id,
        name=display_name if display_name else normalized_email.split("@")[0],
    )


@app.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    normalized_email = (request.email or "").strip().lower()
    incoming_password = request.password or ""

    user = USERS.get(normalized_email)
    if user and user["password"] == incoming_password:
        return AuthResponse(
            accessToken=f"test-token:{user['user_id']}",
            user_id=user["user_id"],
            name=user["name"]
        )

    if db_pool is not None:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, name, password_hash FROM users WHERE email = $1",
                normalized_email,
            )
            if not row:
                raise HTTPException(status_code=404, detail="User not found")

            stored = str(row["password_hash"] or "")
            valid = False
            if stored.startswith("plain:"):
                valid = stored[6:] == incoming_password
            elif stored:
                try:
                    # Supports pgcrypto hashes produced by crypt(..., gen_salt('bf')).
                    valid = bool(
                        await conn.fetchval(
                            "SELECT crypt($1, $2) = $2",
                            incoming_password,
                            stored,
                        )
                    )
                except Exception:
                    valid = False

        if not valid:
            matched_seed = USERS.get(normalized_email)
            if not matched_seed or matched_seed["password"] != incoming_password:
                raise HTTPException(status_code=401, detail="Invalid credentials")

        # Cache for subsequent logins without DB hit in the same process.
        USERS[normalized_email] = {
            "password": incoming_password,
            "user_id": str(row["id"]),
            "name": str(row["name"] or normalized_email.split("@")[0]),
        }
        return AuthResponse(
            accessToken=f"test-token:{row['id']}",
            user_id=str(row["id"]),
            name=str(row["name"] or normalized_email.split("@")[0]),
        )

    raise HTTPException(status_code=404, detail="User not found")


@app.post("/auth/password-reset", response_model=PasswordResetResponse)
async def password_reset(request: PasswordResetRequest):
    normalized_email = (request.email or "").strip().lower()
    new_password = request.new_password or ""

    if "@" not in normalized_email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user = USERS.get(normalized_email)
    if user:
        user["password"] = new_password

    if db_pool is not None:
        async with db_pool.acquire() as conn:
            await conn.execute(
                "UPDATE users SET password_hash = $1 WHERE LOWER(email) = $2",
                f"plain:{new_password}",
                normalized_email,
            )

    # Return a generic success message to avoid email enumeration.
    return PasswordResetResponse(
        ok=True,
        message="If an account exists for this email, the password has been updated",
    )


@app.post("/crew/invite-email")
async def crew_invite_email(request: CrewInviteEmailRequest, authorization: str | None = Header(default=None)):
    inviter_email = (request.inviter_email or "").strip().lower()
    invitee_email = (request.invitee_email or "").strip().lower()
    inviter_name = (request.inviter_name or "").strip() or "A WanderPlan user"

    if "@" not in invitee_email:
        raise HTTPException(status_code=400, detail="Invalid invitee email")

    authed_user_id = ""
    if authorization:
        try:
            authed_user_id = _parse_user_id_from_token(authorization)
        except HTTPException:
            authed_user_id = ""

    invite_token = str(uuid4())
    invitee_has_account = False
    if db_pool is not None:
        async with db_pool.acquire() as conn:
            inviter = None
            if authed_user_id:
                inviter = await conn.fetchrow(
                    "SELECT id, email, name FROM users WHERE id = $1",
                    authed_user_id,
                )
            if inviter is None:
                if "@" not in inviter_email:
                    raise HTTPException(status_code=400, detail="Invalid inviter email")
                inviter = await conn.fetchrow(
                    "SELECT id, email, name FROM users WHERE LOWER(email) = $1",
                    inviter_email,
                )
            if not inviter:
                raise HTTPException(status_code=404, detail="Inviter account not found")
            inviter_email = str(inviter["email"] or "").strip().lower()
            if inviter_email == invitee_email:
                raise HTTPException(status_code=400, detail="Cannot invite your own email")
            invitee_row = await conn.fetchrow(
                "SELECT id FROM users WHERE LOWER(email) = $1",
                invitee_email,
            )
            invitee_has_account = invitee_row is not None
            await conn.execute(
                """
                INSERT INTO crew_invites (invite_token, inviter_user_id, inviter_email, invitee_email, status)
                VALUES ($1, $2, $3, $4, 'pending')
                """,
                invite_token,
                str(inviter["id"]),
                inviter_email,
                invitee_email,
            )
            if not request.inviter_name and inviter["name"]:
                inviter_name = str(inviter["name"])
    else:
        if "@" not in inviter_email:
            raise HTTPException(status_code=400, detail="Invalid inviter email")
        if inviter_email == invitee_email:
            raise HTTPException(status_code=400, detail="Cannot invite your own email")

    delivery_mode = _crew_invite_delivery_mode()
    email_sent = False
    email_error = ""
    if delivery_mode == "email":
        email_sent, email_error = await _send_crew_invite_email(
            inviter_email=inviter_email,
            inviter_name=inviter_name,
            invitee_email=invitee_email,
            invite_token=invite_token,
            invitee_has_account=invitee_has_account,
        )

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    accept_link = f"{frontend_base}/?entry=home&invite_token={quote_plus(invite_token)}&invite_action=accept"
    reject_link = f"{frontend_base}/?entry=home&invite_token={quote_plus(invite_token)}&invite_action=reject"
    return {
        "ok": True,
        "invitee_email": invitee_email,
        "invite_token": invite_token,
        "email_sent": email_sent,
        "email_error": email_error or None,
        "delivery_mode": "email" if email_sent else "link_only",
        "invite_link": accept_link,
        "accept_link": accept_link,
        "reject_link": reject_link,
        "invitee_has_account": invitee_has_account,
    }


async def _crew_respond_to_invite(token: str, action: str, user_id: str) -> dict[str, Any]:
    token = (token or "").strip()
    action = (action or "accept").strip().lower()
    if action in {"accepted"}:
        action = "accept"
    if action in {"declined", "reject"}:
        action = "reject"
    if action not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="action must be accept or reject")
    if not token:
        raise HTTPException(status_code=400, detail="invite_token is required")
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT id, email FROM users WHERE id = $1", user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        my_email = str(user["email"] or "").strip().lower()

        invite = await conn.fetchrow(
            """
            SELECT invite_token, inviter_user_id, inviter_email, invitee_email, status, accepted_by_user_id
            FROM crew_invites
            WHERE invite_token = $1
            """,
            token,
        )
        if not invite:
            raise HTTPException(status_code=404, detail="Invite not found")

        if str(invite["invitee_email"] or "").strip().lower() != my_email:
            raise HTTPException(status_code=403, detail="Invite does not belong to this account")

        inviter_user_id = str(invite["inviter_user_id"] or "")
        if not inviter_user_id:
            raise HTTPException(status_code=404, detail="Inviter account no longer exists")

        current_status = str(invite["status"] or "").lower()
        if action == "accept":
            if current_status == "accepted":
                accepted_by = str(invite["accepted_by_user_id"] or "")
                if accepted_by and accepted_by != user_id:
                    raise HTTPException(status_code=409, detail="Invite already accepted by another account")
            if current_status == "declined":
                raise HTTPException(status_code=409, detail="Invite already declined")

            # Ensure reciprocal links exist even for idempotent accepts.
            await conn.execute(
                """
                INSERT INTO crew_links (user_id, peer_user_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, peer_user_id) DO NOTHING
                """,
                inviter_user_id,
                user_id,
            )
            await conn.execute(
                """
                INSERT INTO crew_links (user_id, peer_user_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, peer_user_id) DO NOTHING
                """,
                user_id,
                inviter_user_id,
            )
            await conn.execute(
                """
                UPDATE crew_invites
                SET status = 'accepted', accepted_by_user_id = $2, accepted_at = COALESCE(accepted_at, NOW())
                WHERE invite_token = $1
                """,
                token,
                user_id,
            )
            # If multiple pending invites were sent to the same email, mark them accepted too
            # so inviter status does not remain stale on an older "pending" token.
            await conn.execute(
                """
                UPDATE crew_invites
                SET status = 'accepted', accepted_by_user_id = $3, accepted_at = COALESCE(accepted_at, NOW())
                WHERE inviter_user_id = $1
                  AND LOWER(invitee_email) = $2
                  AND status = 'pending'
                """,
                inviter_user_id,
                my_email,
                user_id,
            )
            return {
                "ok": True,
                "action": "accept",
                "status": "accepted",
                "inviter_user_id": inviter_user_id,
                "invitee_user_id": user_id,
                "already_linked": current_status == "accepted",
            }

        # reject
        if current_status == "accepted":
            raise HTTPException(status_code=409, detail="Invite already accepted")
        if current_status == "declined":
            return {
                "ok": True,
                "action": "reject",
                "status": "declined",
                "inviter_user_id": inviter_user_id,
                "invitee_user_id": user_id,
                "already_linked": False,
            }

        await conn.execute(
            """
            UPDATE crew_invites
            SET status = 'declined', accepted_by_user_id = NULL, accepted_at = NOW()
            WHERE invite_token = $1
            """,
            token,
        )
        return {
            "ok": True,
            "action": "reject",
            "status": "declined",
            "inviter_user_id": inviter_user_id,
            "invitee_user_id": user_id,
            "already_linked": False,
        }


@app.post("/crew/invites/respond")
async def crew_respond_invite(body: CrewInviteRespondRequest, user_id: str = Depends(get_current_user_id)):
    return await _crew_respond_to_invite(body.invite_token, body.action, user_id)


@app.post("/crew/invites/accept")
async def crew_accept_invite(body: CrewInviteAcceptRequest, user_id: str = Depends(get_current_user_id)):
    return await _crew_respond_to_invite(body.invite_token, "accept", user_id)


@app.get("/crew/invites/sent")
async def crew_sent_invites(user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            WITH ranked AS (
              SELECT
                ci.invite_token,
                ci.invitee_email,
                ci.status,
                ci.created_at,
                ci.accepted_at,
                ci.accepted_by_user_id,
                ROW_NUMBER() OVER (
                  PARTITION BY LOWER(ci.invitee_email)
                  ORDER BY ci.created_at DESC
                ) AS rn
              FROM crew_invites ci
              WHERE ci.inviter_user_id = $1
            )
            SELECT
              r.invite_token,
              r.invitee_email,
              r.status,
              r.created_at,
              r.accepted_at,
              u.email AS accepted_by_email
            FROM ranked r
            LEFT JOIN users u ON u.id = r.accepted_by_user_id
            WHERE r.rn = 1
            ORDER BY r.created_at DESC
            """,
            user_id,
        )
    return {
        "invites": [
            {
                "invite_token": str(row["invite_token"] or ""),
                "invitee_email": str(row["invitee_email"] or ""),
                "status": str(row["status"] or "pending"),
                "created_at": row["created_at"].isoformat() if row["created_at"] else None,
                "accepted_at": row["accepted_at"].isoformat() if row["accepted_at"] else None,
                "accepted_by_email": str(row["accepted_by_email"] or ""),
            }
            for row in rows
        ]
    }


@app.get("/crew/links")
async def crew_links(user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT cl.peer_user_id, u.email, u.name
            FROM crew_links cl
            JOIN users u ON u.id = cl.peer_user_id
            WHERE cl.user_id = $1
            ORDER BY u.name ASC, u.email ASC
            """,
            user_id,
        )
    return {
        "links": [
            {
                "peer_user_id": str(row["peer_user_id"]),
                "email": str(row["email"] or ""),
                "name": str(row["name"] or ""),
            }
            for row in rows
        ]
    }


@app.get("/crew/peer-profiles")
async def crew_peer_profiles(user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT
              u.id AS peer_user_id,
              u.email,
              u.name,
              up.display_name,
              up.travel_styles,
              up.interests,
              up.budget_tier,
              up.dietary
            FROM crew_links cl
            JOIN users u ON u.id = cl.peer_user_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE cl.user_id = $1
            ORDER BY COALESCE(up.display_name, u.name) ASC, u.email ASC
            """,
            user_id,
        )
    peers = []
    for row in rows:
        default_name = str(row["name"] or row["email"] or "Traveler")
        interests = row["interests"]
        if isinstance(interests, str):
            try:
                interests = json.loads(interests)
            except Exception:
                interests = {}
        if not isinstance(interests, dict):
            interests = {}
        peers.append(
            {
                "peer_user_id": str(row["peer_user_id"]),
                "email": str(row["email"] or ""),
                "name": default_name,
                "profile": {
                    "display_name": str(row["display_name"] or default_name),
                    "travel_styles": list(row["travel_styles"] or []),
                    "interests": interests,
                    "budget_tier": str(row["budget_tier"] or "moderate"),
                    "dietary": list(row["dietary"] or []),
                },
            }
        )
    return {"peers": peers}


@app.put("/me/profile")
async def put_me_profile(body: MeProfileRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        user = await conn.fetchrow("SELECT name, email FROM users WHERE id = $1", user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        display_name = (body.display_name or "").strip() or str(user["name"] or "").strip() or str(user["email"]).split("@")[0]
        await conn.execute(
            """
            INSERT INTO user_profiles (user_id, display_name, travel_styles, interests, budget_tier, dietary, updated_at)
            VALUES ($1, $2, $3::text[], $4::jsonb, $5, $6::text[], NOW())
            ON CONFLICT (user_id)
            DO UPDATE SET
              display_name = EXCLUDED.display_name,
              travel_styles = EXCLUDED.travel_styles,
              interests = EXCLUDED.interests,
              budget_tier = EXCLUDED.budget_tier,
              dietary = EXCLUDED.dietary,
              updated_at = NOW()
            """,
            user_id,
            display_name,
            body.travel_styles or [],
            json.dumps(body.interests or {}),
            body.budget_tier or "moderate",
            body.dietary or [],
        )
    return {
        "ok": True,
        "profile": {
            "display_name": display_name,
            "travel_styles": body.travel_styles or [],
            "interests": body.interests or {},
            "budget_tier": body.budget_tier or "moderate",
            "dietary": body.dietary or [],
        },
    }


@app.get("/me/profile")
async def get_me_profile(user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.name, u.email, up.display_name, up.travel_styles, up.interests, up.budget_tier, up.dietary
            FROM users u
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE u.id = $1
            """,
            user_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    default_name = str(row["name"] or row["email"] or "Traveler")
    interests = row["interests"]
    if isinstance(interests, str):
        try:
            interests = json.loads(interests)
        except Exception:
            interests = {}
    if not isinstance(interests, dict):
        interests = {}
    return {
        "profile": {
            "display_name": str(row["display_name"] or default_name),
            "travel_styles": list(row["travel_styles"] or []),
            "interests": interests,
            "budget_tier": str(row["budget_tier"] or "moderate"),
            "dietary": list(row["dietary"] or []),
        }
    }


def _format_personal_bucket_item(row: asyncpg.Record) -> dict[str, Any]:
    item_id = str(row["id"])
    destination = str(row["destination"] or "")
    country = str(row["country"] or "")
    tags = list(row["tags"] or [])
    best_months = [int(x) for x in (row["best_months"] or [])]
    cost_per_day = float(row["cost_per_day"] or 0)
    best_time_desc = str(row["best_time_desc"] or "")
    cost_note = str(row["cost_note"] or "")
    return {
        "id": item_id,
        "destination": destination,
        "name": destination,
        "country": country,
        "tags": tags,
        "best_months": best_months,
        "bestMonths": best_months,
        "cost_per_day": cost_per_day,
        "costPerDay": cost_per_day,
        "best_time_desc": best_time_desc,
        "bestTimeDesc": best_time_desc,
        "cost_note": cost_note,
        "costNote": cost_note,
    }


@app.post("/me/bucket-list", status_code=201)
async def post_me_bucket_list(body: MeBucketItemRequest, user_id: str = Depends(get_current_user_id)):
    destination = (body.destination or "").strip()
    if not destination:
        raise HTTPException(status_code=400, detail="destination is required")
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO personal_bucket_items (
              user_id, destination, country, tags, best_months, cost_per_day, best_time_desc, cost_note
            )
            VALUES ($1, $2, $3, $4::text[], $5::int[], $6, $7, $8)
            RETURNING id, destination, country, tags, best_months, cost_per_day, best_time_desc, cost_note
            """,
            user_id,
            destination,
            (body.country or "").strip() or None,
            body.tags or [],
            body.best_months or [],
            body.cost_per_day or 0,
            body.best_time_desc or "",
            body.cost_note or "",
        )
    return {"item": _format_personal_bucket_item(row)}


@app.get("/me/bucket-list")
async def get_me_bucket_list(user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, destination, country, tags, best_months, cost_per_day, best_time_desc, cost_note
            FROM personal_bucket_items
            WHERE user_id = $1
            ORDER BY created_at DESC, destination ASC
            """,
            user_id,
        )
    return {"items": [_format_personal_bucket_item(row) for row in rows]}


@app.delete("/me/bucket-list/{item_id}")
async def delete_me_bucket_item(item_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        deleted = await conn.fetchrow(
            """
            DELETE FROM personal_bucket_items
            WHERE id = $1 AND user_id = $2
            RETURNING id
            """,
            item_id,
            user_id,
        )
    if not deleted:
        raise HTTPException(status_code=404, detail="Bucket item not found")
    return {"ok": True, "id": str(deleted["id"])}


@app.post("/nlp/extract-destinations")
async def extract_destinations(body: DestinationExtractionRequest):
    text = (body.text or "").strip()
    if not text:
        return {
            "destinations": [],
            "llm_used": False,
            "llm_raw_text": "",
            "parse_source": "empty_input",
            "llm_error": "empty input",
        }

    destinations, llm_used, llm_raw_text, parse_source, llm_error = await asyncio.to_thread(
        _anthropic_extract_destinations, text
    )
    return {
        "destinations": destinations,
        "llm_used": llm_used,
        "llm_raw_text": llm_raw_text,
        "parse_source": parse_source,
        "llm_error": llm_error,
    }


@app.post("/llm/messages")
async def llm_messages(body: LLMMessageRequest):
    return await asyncio.to_thread(_anthropic_messages_proxy, body)


@app.post("/trips", status_code=201)
async def create_trip(body: CreateTripRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow(
            """
            INSERT INTO trips (owner_id, name, status, duration_days)
            VALUES ($1, $2, 'planning', $3)
            RETURNING id, owner_id, name, status, duration_days
            """,
            user_id,
            body.name,
            body.duration_days,
        )
        await conn.execute(
            """
            INSERT INTO trip_members (trip_id, user_id, role, status, joined_at)
            VALUES ($1, $2, 'owner', 'accepted', NOW())
            ON CONFLICT (trip_id, user_id)
            DO UPDATE SET role = 'owner', status = 'accepted', joined_at = NOW()
            """,
            trip["id"],
            user_id,
        )

    return {
        "trip": {
            "id": str(trip["id"]),
            "owner_id": str(trip["owner_id"]),
            "name": trip["name"],
            "status": trip["status"],
            "duration_days": trip["duration_days"],
        }
    }


@app.get("/trips/{trip_id}")
async def get_trip(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow(
            "SELECT id, owner_id, name, status, duration_days FROM trips WHERE id = $1",
            trip_id,
        )
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        member = await conn.fetchrow(
            "SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not member:
            raise HTTPException(status_code=403, detail="Forbidden")

        members = await conn.fetch(
            """
            SELECT
              tm.user_id,
              tm.role,
              tm.status,
              u.name,
              u.email,
              up.display_name,
              up.interests,
              up.budget_tier,
              up.dietary
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE trip_id = $1
            ORDER BY tm.joined_at NULLS FIRST
            """,
            trip_id,
        )

    member_items: list[dict[str, Any]] = []
    for m in members:
        interests = m["interests"]
        if isinstance(interests, str):
            try:
                interests = json.loads(interests)
            except Exception:
                interests = {}
        if not isinstance(interests, dict):
            interests = {}

        member_items.append(
            {
                "user_id": str(m["user_id"]),
                "role": str(m["role"] or "member"),
                "status": str(m["status"] or "pending"),
                "name": str(m["name"] or ""),
                "email": str(m["email"] or ""),
                "profile": {
                    "display_name": str(m["display_name"] or m["name"] or ""),
                    "interests": interests,
                    "budget_tier": str(m["budget_tier"] or "moderate"),
                    "dietary": list(m["dietary"] or []),
                },
            }
        )

    return {
        "trip": {
            "id": str(trip["id"]),
            "owner_id": str(trip["owner_id"]),
            "name": trip["name"],
            "status": trip["status"],
            "duration_days": trip["duration_days"],
            "members": member_items,
        }
    }


@app.get("/trips/{trip_id}/planning-state")
async def get_trip_planning_state(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        row = await conn.fetchrow(
            """
            SELECT trip_id, current_step, state, updated_by, updated_at
            FROM trip_planning_states
            WHERE trip_id = $1
            """,
            trip_id,
        )
    if not row:
        return {
            "trip_id": trip_id,
            "current_step": 0,
            "state": {},
            "updated_by": None,
            "updated_at": None,
        }
    state = _json_obj(row["state"])
    return {
        "trip_id": str(row["trip_id"]),
        "current_step": int(row["current_step"] or 0),
        "state": state,
        "updated_by": str(row["updated_by"]) if row["updated_by"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@app.put("/trips/{trip_id}/planning-state")
async def put_trip_planning_state(
    trip_id: str,
    body: TripPlanningStateUpdateRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    incoming_state = body.state if isinstance(body.state, dict) else {}
    if body.current_step is not None:
        try:
            next_step = max(0, int(body.current_step))
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid current_step")
    else:
        next_step = None

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        membership = await conn.fetchrow(
            "SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not membership or str(membership["status"] or "pending").lower() != "accepted":
            raise HTTPException(status_code=403, detail="Only accepted trip members can update planning state")

        async with conn.transaction():
            # Ensure the row exists so concurrent writers always contend on one row lock.
            await conn.execute(
                """
                INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
                VALUES ($1, 0, '{}'::jsonb, $2, NOW())
                ON CONFLICT (trip_id) DO NOTHING
                """,
                trip_id,
                user_id,
            )
            existing = await conn.fetchrow(
                """
                SELECT current_step, state
                FROM trip_planning_states
                WHERE trip_id = $1
                FOR UPDATE
                """,
                trip_id,
            )
            existing_state = _json_obj((existing["state"] if existing else {}) or {})
            if body.merge:
                merged_state = _deep_merge_state(existing_state, incoming_state)
            else:
                merged_state = incoming_state

            step_value = next_step if next_step is not None else int((existing["current_step"] if existing else 0) or 0)
            row = await conn.fetchrow(
                """
                UPDATE trip_planning_states
                SET current_step = $2,
                    state = $3::jsonb,
                    updated_by = $4,
                    updated_at = NOW()
                WHERE trip_id = $1
                RETURNING trip_id, current_step, state, updated_by, updated_at
                """,
                trip_id,
                step_value,
                json.dumps(merged_state),
                user_id,
            )

    state = _json_obj(row["state"])
    return {
        "trip_id": str(row["trip_id"]),
        "current_step": int(row["current_step"] or 0),
        "state": state,
        "updated_by": str(row["updated_by"]) if row["updated_by"] else None,
        "updated_at": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@app.get("/trips/{trip_id}/consensus/stages/{stage_key}")
async def get_stage_consensus(
    trip_id: str,
    stage_key: str,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    stage = _normalize_consensus_stage_key(stage_key)

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        trip = await conn.fetchrow("SELECT owner_id FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        membership = await conn.fetchrow(
            "SELECT status, role FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        accepted_rows = await conn.fetch(
            """
            SELECT tm.user_id, tm.role, tm.status, u.name, u.email
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = $1 AND tm.status = 'accepted'
            ORDER BY tm.joined_at NULLS FIRST, u.email ASC
            """,
            trip_id,
        )
        planning_row = await conn.fetchrow(
            """
            SELECT current_step, state
            FROM trip_planning_states
            WHERE trip_id = $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            trip_id,
        )

    state = _json_obj((planning_row["state"] if planning_row else {}) or {})
    consensus_root = state.get("stage_consensus")
    if not isinstance(consensus_root, dict):
        consensus_root = {}
    stage_state = consensus_root.get(stage)
    if not isinstance(stage_state, dict):
        stage_state = {}

    accepted_members = [
        {
            "user_id": str(r["user_id"]),
            "role": str(r["role"] or "member"),
            "status": str(r["status"] or "accepted"),
            "name": str(r["name"] or ""),
            "email": str(r["email"] or ""),
        }
        for r in accepted_rows
    ]
    owner_id = str(trip["owner_id"])
    summary = _build_stage_consensus_summary(stage, stage_state, accepted_members, owner_id, user_id)
    my_status = str((membership["status"] if membership else "") or "").lower()
    return {
        "consensus": summary,
        "can_vote": my_status == "accepted",
        "can_finalize": owner_id == str(user_id),
        "current_step": int((planning_row["current_step"] if planning_row else 0) or 0),
    }


@app.post("/trips/{trip_id}/consensus/stages/{stage_key}/vote")
async def vote_stage_consensus(
    trip_id: str,
    stage_key: str,
    body: StageVoteRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    stage = _normalize_consensus_stage_key(stage_key)
    normalized_vote = _normalize_stage_vote(body.vote)

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        trip = await conn.fetchrow("SELECT owner_id FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        membership = await conn.fetchrow(
            "SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not membership or str(membership["status"] or "").lower() != "accepted":
            raise HTTPException(status_code=403, detail="Only accepted trip members can vote")
        accepted_rows = await conn.fetch(
            """
            SELECT tm.user_id, tm.role, tm.status, u.name, u.email
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = $1 AND tm.status = 'accepted'
            ORDER BY tm.joined_at NULLS FIRST, u.email ASC
            """,
            trip_id,
        )
        planning_row = await conn.fetchrow(
            """
            SELECT current_step, state
            FROM trip_planning_states
            WHERE trip_id = $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            trip_id,
        )
        state = _json_obj((planning_row["state"] if planning_row else {}) or {})
        consensus_root = state.get("stage_consensus")
        if not isinstance(consensus_root, dict):
            consensus_root = {}
        stage_state = consensus_root.get(stage)
        if not isinstance(stage_state, dict):
            stage_state = {}
        if stage_state.get("final_decision"):
            raise HTTPException(status_code=409, detail="Stage already finalized by organizer")

        votes = stage_state.get("votes")
        if not isinstance(votes, dict):
            votes = {}
        votes[str(user_id)] = normalized_vote
        stage_state["votes"] = votes
        stage_state["last_vote_at"] = datetime.now(timezone.utc).isoformat()
        stage_state["last_vote_by"] = str(user_id)
        consensus_root[stage] = stage_state
        state["stage_consensus"] = consensus_root
        current_step = int((planning_row["current_step"] if planning_row else 0) or 0)

        await conn.execute(
            """
            INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
            VALUES ($1, $2, $3::jsonb, $4, NOW())
            ON CONFLICT (trip_id)
            DO UPDATE SET current_step = EXCLUDED.current_step,
                          state = EXCLUDED.state,
                          updated_by = EXCLUDED.updated_by,
                          updated_at = NOW()
            """,
            trip_id,
            current_step,
            json.dumps(state),
            user_id,
        )

    accepted_members = [
        {
            "user_id": str(r["user_id"]),
            "role": str(r["role"] or "member"),
            "status": str(r["status"] or "accepted"),
            "name": str(r["name"] or ""),
            "email": str(r["email"] or ""),
        }
        for r in accepted_rows
    ]
    summary = _build_stage_consensus_summary(stage, stage_state, accepted_members, str(trip["owner_id"]), user_id)
    return {"ok": True, "consensus": summary}


@app.post("/trips/{trip_id}/consensus/stages/{stage_key}/finalize")
async def finalize_stage_consensus(
    trip_id: str,
    stage_key: str,
    body: StageFinalizeRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    stage = _normalize_consensus_stage_key(stage_key)
    decision = _normalize_stage_finalize_action(body.action)

    async with db_pool.acquire() as conn:
        await _require_trip_owner(conn, trip_id, user_id)
        membership = await conn.fetchrow(
            "SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not membership or str(membership["status"] or "").lower() != "accepted":
            raise HTTPException(status_code=403, detail="Organizer must be an accepted trip member")
        accepted_rows = await conn.fetch(
            """
            SELECT tm.user_id, tm.role, tm.status, u.name, u.email
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = $1 AND tm.status = 'accepted'
            ORDER BY tm.joined_at NULLS FIRST, u.email ASC
            """,
            trip_id,
        )
        planning_row = await conn.fetchrow(
            """
            SELECT current_step, state
            FROM trip_planning_states
            WHERE trip_id = $1
            ORDER BY updated_at DESC NULLS LAST
            LIMIT 1
            """,
            trip_id,
        )
        state = _json_obj((planning_row["state"] if planning_row else {}) or {})
        consensus_root = state.get("stage_consensus")
        if not isinstance(consensus_root, dict):
            consensus_root = {}
        stage_state = consensus_root.get(stage)
        if not isinstance(stage_state, dict):
            stage_state = {}
        stage_state["final_decision"] = decision
        stage_state["finalized_by"] = str(user_id)
        stage_state["finalized_at"] = datetime.now(timezone.utc).isoformat()
        consensus_root[stage] = stage_state
        state["stage_consensus"] = consensus_root
        current_step = int((planning_row["current_step"] if planning_row else 0) or 0)

        await conn.execute(
            """
            INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
            VALUES ($1, $2, $3::jsonb, $4, NOW())
            ON CONFLICT (trip_id)
            DO UPDATE SET current_step = EXCLUDED.current_step,
                          state = EXCLUDED.state,
                          updated_by = EXCLUDED.updated_by,
                          updated_at = NOW()
            """,
            trip_id,
            current_step,
            json.dumps(state),
            user_id,
        )
        owner_id = str(user_id)

    accepted_members = [
        {
            "user_id": str(r["user_id"]),
            "role": str(r["role"] or "member"),
            "status": str(r["status"] or "accepted"),
            "name": str(r["name"] or ""),
            "email": str(r["email"] or ""),
        }
        for r in accepted_rows
    ]
    summary = _build_stage_consensus_summary(stage, stage_state, accepted_members, owner_id, user_id)
    return {"ok": True, "consensus": summary}


@app.get("/me/trips")
async def get_my_trips(user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        my_trips = await conn.fetch(
            """
            SELECT t.id, t.owner_id, t.name, t.status, t.duration_days, tm.role AS my_role, tm.status AS my_status
            FROM trip_members tm
            JOIN trips t ON t.id = tm.trip_id
            WHERE tm.user_id = $1
            ORDER BY t.name ASC
            """,
            user_id,
        )

        trips: list[dict[str, Any]] = []
        for trip in my_trips:
            members = await conn.fetch(
                """
                SELECT
                  tm.user_id,
                  tm.role,
                  tm.status,
                  u.name,
                  u.email,
                  up.display_name,
                  up.interests,
                  up.budget_tier,
                  up.dietary
                FROM trip_members tm
                JOIN users u ON u.id = tm.user_id
                LEFT JOIN user_profiles up ON up.user_id = u.id
                WHERE tm.trip_id = $1
                ORDER BY tm.joined_at NULLS FIRST, u.email ASC
                """,
                trip["id"],
            )
            # Primary source for selected trip destinations in current flow.
            # Fallback to legacy trip_destinations if needed.
            try:
                dest_rows = await conn.fetch(
                    """
                    SELECT destination
                    FROM bucket_list_items
                    WHERE trip_id = $1
                    GROUP BY destination
                    ORDER BY COALESCE(SUM(vote_score), 0) DESC, destination ASC
                    """,
                    trip["id"],
                )
            except Exception:
                dest_rows = []
            if not dest_rows:
                try:
                    dest_rows = await conn.fetch(
                        "SELECT destination FROM trip_destinations WHERE trip_id = $1 ORDER BY destination ASC",
                        trip["id"],
                    )
                except Exception:
                    dest_rows = []

            member_items: list[dict[str, Any]] = []
            for m in members:
                interests = m["interests"]
                if isinstance(interests, str):
                    try:
                        interests = json.loads(interests)
                    except Exception:
                        interests = {}
                if not isinstance(interests, dict):
                    interests = {}

                member_items.append(
                    {
                        "user_id": str(m["user_id"]),
                        "role": str(m["role"] or "member"),
                        "status": str(m["status"] or "pending"),
                        "name": str(m["name"] or ""),
                        "email": str(m["email"] or ""),
                        "profile": {
                            "display_name": str(m["display_name"] or m["name"] or ""),
                            "interests": interests,
                            "budget_tier": str(m["budget_tier"] or "moderate"),
                            "dietary": list(m["dietary"] or []),
                        },
                    }
                )

            trips.append(
                {
                    "id": str(trip["id"]),
                    "owner_id": str(trip["owner_id"]),
                    "name": str(trip["name"] or ""),
                    "status": str(trip["status"] or "planning"),
                    "duration_days": int(trip["duration_days"] or 0),
                    "my_role": str(trip["my_role"] or "member"),
                    "my_status": str(trip["my_status"] or "pending"),
                    "destinations": [str(d["destination"]) for d in dest_rows],
                    "members": member_items,
                }
            )

    return {"trips": trips}


@app.post("/trips/{trip_id}/join")
async def join_trip(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow(
            "SELECT id, owner_id, name, status, duration_days FROM trips WHERE id = $1",
            trip_id,
        )
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        row = await conn.fetchrow(
            """
            UPDATE trip_members
            SET status = 'accepted', joined_at = NOW()
            WHERE trip_id = $1 AND user_id = $2
            RETURNING user_id, role, status
            """,
            trip_id,
            user_id,
        )
        if not row:
            existing = await conn.fetchrow(
                "SELECT user_id, role, status FROM trip_members WHERE trip_id = $1 AND user_id = $2",
                trip_id,
                user_id,
            )
            if not existing:
                raise HTTPException(status_code=403, detail="You are not invited to this trip")
            row = existing
        trip_status = await conn.fetchval(
            """
            UPDATE trips
            SET status = CASE
                WHEN COALESCE(status, '') IN ('', 'draft', 'saved', 'invited') THEN 'planning'
                ELSE status
            END
            WHERE id = $1
            RETURNING status
            """,
            trip_id,
        )

    return {
        "ok": True,
        "trip": {
            "id": str(trip["id"]),
            "owner_id": str(trip["owner_id"]),
            "name": str(trip["name"] or ""),
            "status": str(trip_status or trip["status"] or "planning"),
            "duration_days": int(trip["duration_days"] or 0),
        },
        "member": {
            "user_id": str(row["user_id"]),
            "role": str(row["role"] or "member"),
            "status": str(row["status"] or "pending"),
        },
    }


@app.post("/trips/{trip_id}/members", status_code=201)
async def invite_member(
    trip_id: str,
    body: InviteMemberRequest,
    user_id: str = Depends(get_current_user_id),
):
    try:
        UUID(str(trip_id))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trip id")

    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    trip_duration_days = 0
    trip_destinations: list[str] = []
    inviter_email = ""
    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow("SELECT owner_id, name, duration_days FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if str(trip["owner_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Only owner can invite members")

        invitee = await conn.fetchrow("SELECT id, email FROM users WHERE email = $1", body.email)
        if not invitee:
            raise HTTPException(status_code=404, detail="User not found")

        inviter = await conn.fetchrow("SELECT name, email FROM users WHERE id = $1", user_id)
        inviter_name = inviter["name"] if inviter and inviter["name"] else "A WanderPlan user"
        inviter_email = str(inviter["email"] or "").strip().lower() if inviter and inviter["email"] else "owner@example.com"
        trip_duration_days = int(trip["duration_days"] or 0)
        dest_rows = await conn.fetch(
            """
            SELECT DISTINCT destination
            FROM bucket_list_items
            WHERE trip_id = $1
            ORDER BY destination ASC
            LIMIT 8
            """,
            trip_id,
        )
        trip_destinations = [str(row["destination"] or "").strip() for row in dest_rows if str(row["destination"] or "").strip()]

        row = await conn.fetchrow(
            """
            INSERT INTO trip_members (trip_id, user_id, role, status)
            VALUES ($1, $2, $3, 'pending')
            ON CONFLICT (trip_id, user_id)
            DO UPDATE
            SET role = EXCLUDED.role,
                status = CASE WHEN trip_members.status = 'accepted' THEN 'accepted' ELSE 'pending' END
            RETURNING user_id, role, status
            """,
            trip_id,
            invitee["id"],
            body.role,
        )

    email_sent, email_error = await _send_trip_invite_email(
        to_email=invitee["email"],
        inviter_name=inviter_name,
        inviter_email=inviter_email,
        trip_name=trip["name"],
        trip_id=trip_id,
        duration_days=trip_duration_days,
        destinations=trip_destinations,
    )
    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    accept_link = f"{frontend_base}/?entry=home&join_trip_id={quote_plus(str(trip_id))}&trip_invite_action=accept"
    reject_link = f"{frontend_base}/?entry=home&join_trip_id={quote_plus(str(trip_id))}&trip_invite_action=reject"

    return {
        "user_id": str(row["user_id"]),
        "role": row["role"],
        "status": row["status"],
        "email": invitee["email"],
        "email_sent": email_sent,
        "email_error": email_error or None,
        "accept_link": accept_link,
        "reject_link": reject_link,
    }


@app.post("/trips/{trip_id}/respond")
async def respond_trip_invite(
    trip_id: str,
    body: TripInviteRespondRequest,
    user_id: str = Depends(get_current_user_id),
):
    action = (body.action or "accept").strip().lower()
    if action in {"accepted"}:
        action = "accept"
    if action in {"decline", "declined", "reject"}:
        action = "reject"
    if action not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="action must be accept or reject")

    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow(
            "SELECT id, owner_id, name, status, duration_days FROM trips WHERE id = $1",
            trip_id,
        )
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        membership = await conn.fetchrow(
            """
            SELECT user_id, role, status
            FROM trip_members
            WHERE trip_id = $1 AND user_id = $2
            """,
            trip_id,
            user_id,
        )
        if not membership:
            raise HTTPException(status_code=403, detail="You are not invited to this trip")

        current_status = str(membership["status"] or "pending").lower()
        if action == "accept":
            row = await conn.fetchrow(
                """
                UPDATE trip_members
                SET status = 'accepted', joined_at = NOW()
                WHERE trip_id = $1 AND user_id = $2
                RETURNING user_id, role, status
                """,
                trip_id,
                user_id,
            )
            normalized_trip = await conn.fetchrow(
                """
                UPDATE trips
                SET status = CASE
                    WHEN COALESCE(status, '') IN ('', 'draft', 'saved', 'invited') THEN 'planning'
                    ELSE status
                END
                WHERE id = $1
                RETURNING status
                """,
                trip_id,
            )
            return {
                "ok": True,
                "action": action,
                "trip": {
                    "id": str(trip["id"]),
                    "owner_id": str(trip["owner_id"]),
                    "name": str(trip["name"] or ""),
                    "status": str(normalized_trip["status"] if normalized_trip else trip["status"] or "planning"),
                    "duration_days": int(trip["duration_days"] or 0),
                },
                "member": {
                    "user_id": str(row["user_id"]),
                    "role": str(row["role"] or "member"),
                    "status": str(row["status"] or "accepted"),
                    "previous_status": current_status,
                },
            }

        if current_status == "accepted":
            raise HTTPException(status_code=409, detail="Invite already accepted")

        row = await conn.fetchrow(
            """
            UPDATE trip_members
            SET status = 'declined'
            WHERE trip_id = $1 AND user_id = $2
            RETURNING user_id, role, status
            """,
            trip_id,
            user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Membership not found")

        return {
            "ok": True,
            "action": action,
            "trip": {
                "id": str(trip["id"]),
                "owner_id": str(trip["owner_id"]),
                "name": str(trip["name"] or ""),
                "status": str(trip["status"] or "planning"),
                "duration_days": int(trip["duration_days"] or 0),
            },
            "member": {
                "user_id": str(row["user_id"]),
                "role": str(row["role"] or "member"),
                "status": str(row["status"] or "declined"),
                "previous_status": current_status,
            },
        }


@app.get("/trips/{trip_id}/destinations")
async def get_destinations(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        member = await conn.fetchrow(
            "SELECT 1 FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not member:
            raise HTTPException(status_code=403, detail="Forbidden")

        rows = await conn.fetch(
            """
            SELECT destination, COALESCE(SUM(vote_score), 0) AS votes
            FROM bucket_list_items
            WHERE trip_id = $1
            GROUP BY destination
            ORDER BY COALESCE(SUM(vote_score), 0) DESC, destination ASC
            """,
            trip_id,
        )

    return {
        "destinations": [
            {"name": row["destination"], "votes": int(row["votes"] or 0)} for row in rows
        ]
    }


@app.put("/trips/{trip_id}/destinations")
async def save_destinations(
    trip_id: str,
    body: SaveDestinationsRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    clean_destinations: list[str] = []
    seen: set[str] = set()
    for item in body.destinations:
        value = (item or "").strip()
        key = value.lower()
        if value and key not in seen:
            seen.add(key)
            clean_destinations.append(value)

    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow("SELECT id FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        member = await conn.fetchrow(
            "SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not member or str(member["status"] or "pending").lower() != "accepted":
            raise HTTPException(status_code=403, detail="Only accepted members can update destinations")

        await conn.execute(
            "DELETE FROM bucket_list_items WHERE trip_id = $1 AND added_by = $2",
            trip_id,
            user_id,
        )

        for destination in clean_destinations:
            votes = int(body.votes.get(destination, 0))
            await conn.execute(
                """
                INSERT INTO bucket_list_items (trip_id, destination, added_by, vote_score)
                VALUES ($1, $2, $3, $4)
                """,
                trip_id,
                destination,
                user_id,
                votes,
            )

        rows = await conn.fetch(
            """
            SELECT destination, COALESCE(SUM(vote_score), 0) AS votes
            FROM bucket_list_items
            WHERE trip_id = $1
            GROUP BY destination
            ORDER BY COALESCE(SUM(vote_score), 0) DESC, destination ASC
            """,
            trip_id,
        )

    return {
        "destinations": [
            {"name": row["destination"], "votes": int(row["votes"] or 0)} for row in rows
        ]
    }


@app.post("/trips/{trip_id}/bucket-list", status_code=201)
async def add_bucket_list_item(
    trip_id: str,
    body: BucketListItemRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        row = await conn.fetchrow(
            """
            INSERT INTO bucket_list_items (trip_id, destination, country, category, added_by, vote_score)
            VALUES ($1, $2, $3, $4, $5, 1)
            RETURNING id, destination, country, category, vote_score
            """,
            trip_id,
            body.destination.strip(),
            body.country,
            body.category,
            user_id,
        )
    return {
        "item": {
            "id": str(row["id"]),
            "destination": row["destination"],
            "country": row["country"],
            "category": row["category"],
            "vote_score": int(row["vote_score"] or 0),
        }
    }


@app.get("/trips/{trip_id}/bucket-list")
async def get_bucket_list(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        rows = await conn.fetch(
            """
            SELECT id, destination, country, category, vote_score
            FROM bucket_list_items
            WHERE trip_id = $1
            ORDER BY created_at ASC
            """,
            trip_id,
        )
    return {
        "items": [
            {
                "id": str(row["id"]),
                "destination": row["destination"],
                "country": row["country"],
                "category": row["category"],
                "vote_score": int(row["vote_score"] or 0),
            }
            for row in rows
        ]
    }


@app.get("/trips/{trip_id}/bucket-list/ranked")
async def get_ranked_bucket_list(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        total_members_row = await conn.fetchrow(
            "SELECT COUNT(*)::int AS c FROM trip_members WHERE trip_id = $1 AND status = 'accepted'",
            trip_id,
        )
        total_members = int(total_members_row["c"] or 1)
        rows = await conn.fetch(
            """
            SELECT destination, MAX(country) AS country, MAX(category) AS category, COALESCE(SUM(vote_score), 0) AS vote_count
            FROM bucket_list_items
            WHERE trip_id = $1
            GROUP BY destination
            ORDER BY COALESCE(SUM(vote_score), 0) DESC, destination ASC
            """,
            trip_id,
        )
    items = []
    for row in rows:
        vote_count = int(row["vote_count"] or 0)
        items.append(
            {
                "destination": row["destination"],
                "country": row["country"],
                "category": row["category"],
                "vote_count": vote_count,
                "total_members": total_members,
                "score": round(60 + (vote_count / max(total_members, 1)) * 40, 1),
            }
        )
    return {"items": items}


@app.get("/trips/{trip_id}/timing-analysis")
async def timing_analysis(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        destinations = await conn.fetch(
            "SELECT DISTINCT destination FROM bucket_list_items WHERE trip_id = $1",
            trip_id,
        )
        if not destinations:
            raise HTTPException(status_code=422, detail="No bucket list destinations available")

        await conn.execute("DELETE FROM timing_results WHERE trip_id = $1", trip_id)
        results = []
        for row in destinations:
            destination = row["destination"]
            month_scores, preferred, avoid, best_window = _timing_profile_for_destination(destination)
            await conn.execute(
                """
                INSERT INTO timing_results (trip_id, destination, month_scores, preferred_months, avoid_months, best_window)
                VALUES ($1, $2, $3::jsonb, $4::text[], $5::text[], $6::jsonb)
                """,
                trip_id,
                destination,
                json.dumps(month_scores),
                preferred,
                avoid,
                json.dumps(best_window),
            )
            results.append(
                {
                    "destination": destination,
                    "month_scores": month_scores,
                    "preferred_months": preferred,
                    "avoid_months": avoid,
                    "best_window": best_window,
                }
            )
    return {"timing_results": results}


@app.put("/trips/{trip_id}/members/{member_user_id}")
async def update_member_status(
    trip_id: str,
    member_user_id: str,
    body: UpdateMemberRequest,
    user_id: str = Depends(get_current_user_id),
):
    if user_id != member_user_id:
        raise HTTPException(status_code=403, detail="Cannot update another member status")
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE trip_members
            SET status = $1, joined_at = CASE WHEN $1 = 'accepted' THEN NOW() ELSE joined_at END
            WHERE trip_id = $2 AND user_id = $3
            RETURNING user_id, role, status
            """,
            body.status,
            trip_id,
            member_user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Membership not found")

    return {"user_id": str(row["user_id"]), "role": row["role"], "status": row["status"]}


@app.put("/trips/{trip_id}/members/{member_user_id}/interests")
async def save_interest_profile(
    trip_id: str,
    member_user_id: str,
    body: InterestProfileRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if user_id != member_user_id:
        raise HTTPException(status_code=403, detail="Cannot submit profile for another member")

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        await conn.execute(
            """
            INSERT INTO interest_profiles (trip_id, user_id, categories, intensity, must_do, avoid)
            VALUES ($1, $2, $3::text[], $4, $5::text[], $6::text[])
            ON CONFLICT (trip_id, user_id)
            DO UPDATE SET categories = EXCLUDED.categories,
                          intensity = EXCLUDED.intensity,
                          must_do = EXCLUDED.must_do,
                          avoid = EXCLUDED.avoid
            """,
            trip_id,
            member_user_id,
            body.categories,
            body.intensity,
            body.must_do,
            body.avoid,
        )
    return {
        "user_id": member_user_id,
        "categories": body.categories,
        "intensity": body.intensity,
    }


@app.get("/trips/{trip_id}/group-interests")
async def get_group_interests(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        counter = await _trip_interest_category_counter(conn, trip_id)
    merged = [cat for cat, _ in sorted(counter.items(), key=lambda item: (-item[1], item[0]))]
    return {"group_interests": {"categories": merged}}


@app.get("/trips/{trip_id}/pois")
async def get_pois(
    trip_id: str,
    user_id: str = Depends(get_current_user_id),
    destination: Optional[str] = None,
    limit: int = 20,
    shortlisted: Optional[bool] = None,
    approved: Optional[bool] = None,
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        base_query = """
            SELECT id, name, category, city, country, lat, lng, tags, rating, cost_estimate_usd, shortlisted, approved
            FROM pois
            WHERE trip_id = $1
        """
        params: list[Any] = [trip_id]
        if destination:
            base_query += " AND (city ILIKE $2 OR country ILIKE $2)"
            params.append(f"%{destination}%")
        if shortlisted is not None:
            idx = len(params) + 1
            base_query += f" AND shortlisted = ${idx}"
            params.append(shortlisted)
        if approved is not None:
            idx = len(params) + 1
            base_query += f" AND approved = ${idx}"
            params.append(approved)
        base_query += f" ORDER BY rating DESC NULLS LAST, created_at DESC LIMIT {max(1, min(limit, 50))}"
        rows = await conn.fetch(base_query, *params)
        if len(rows) == 0:
            existing_trip_poi_count = await conn.fetchval(
                "SELECT COUNT(*) FROM pois WHERE trip_id = $1",
                trip_id,
            )
            if existing_trip_poi_count:
                rows = []
            else:
                fallback_city = destination
                fallback_country = "Japan"
                if not fallback_city:
                    top_dest = await conn.fetchrow(
                        """
                        SELECT destination, country
                        FROM bucket_list_items
                        WHERE trip_id = $1
                        ORDER BY vote_score DESC, created_at ASC
                        LIMIT 1
                        """,
                        trip_id,
                    )
                    if top_dest:
                        fallback_city = top_dest["destination"]
                        fallback_country = top_dest["country"] or fallback_country
                if not fallback_city:
                    fallback_city = "Tokyo"
                counts = await _trip_interest_category_counter(conn, trip_id)
                ranked_categories = [cat for cat, _ in sorted(counts.items(), key=lambda x: (-x[1], x[0]))]
                if not ranked_categories:
                    ranked_categories = ["food", "culture"]
                inserted = 0
                for cat in ranked_categories[:3]:
                    for poi in POI_CATALOG.get(cat, []):
                        await conn.execute(
                            """
                            INSERT INTO pois (trip_id, name, category, city, country, tags, rating, cost_estimate_usd, shortlisted, approved)
                            VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, false, false)
                            ON CONFLICT DO NOTHING
                            """,
                            trip_id,
                            poi["name"],
                            poi["category"],
                            fallback_city,
                            fallback_country,
                            poi["tags"],
                            poi["rating"],
                            poi["cost"],
                        )
                        inserted += 1
                if inserted == 0:
                    for poi in POI_CATALOG["food"]:
                        await conn.execute(
                            """
                            INSERT INTO pois (trip_id, name, category, city, country, tags, rating, cost_estimate_usd, shortlisted, approved)
                            VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, false, false)
                            ON CONFLICT DO NOTHING
                            """,
                            trip_id,
                            poi["name"],
                            poi["category"],
                            fallback_city,
                            fallback_country,
                            poi["tags"],
                            poi["rating"],
                            poi["cost"],
                        )
                rows = await conn.fetch(base_query, *params)
        poi_ids = [str(r["id"]) for r in rows]
        vote_rows = []
        shortlist_rows = []
        if poi_ids:
            vote_rows = await conn.fetch(
                """
                SELECT poi_id, vote, user_id
                FROM poi_votes
                WHERE trip_id = $1 AND poi_id = ANY($2::uuid[])
                """,
                trip_id,
                poi_ids,
            )
            shortlist_rows = await conn.fetch(
                """
                SELECT poi_id, user_id, selected
                FROM poi_shortlist_selections
                WHERE trip_id = $1 AND poi_id = ANY($2::uuid[])
                """,
                trip_id,
                poi_ids,
            )
    # Build vote tallies per POI
    from collections import defaultdict
    tally: dict = defaultdict(lambda: {"approve": 0, "reject": 0, "my_vote": None})
    shortlist_tally: dict = defaultdict(lambda: {"selected": 0, "my_selected": None})
    for vr in vote_rows:
        pid = str(vr["poi_id"])
        tally[pid][str(vr["vote"])] += 1
        if str(vr["user_id"]) == str(user_id):
            tally[pid]["my_vote"] = str(vr["vote"])
    for sr in shortlist_rows:
        pid = str(sr["poi_id"])
        if bool(sr["selected"]):
            shortlist_tally[pid]["selected"] += 1
        if str(sr["user_id"]) == str(user_id):
            shortlist_tally[pid]["my_selected"] = bool(sr["selected"])
    return {
        "pois": [
            {
                "poi_id": str(row["id"]),
                "name": row["name"],
                "category": row["category"],
                "city": row["city"],
                "country": row["country"],
                "location": {"lat": float(row["lat"] or 0), "lng": float(row["lng"] or 0)},
                "tags": row["tags"] or [],
                "rating": float(row["rating"] or 0),
                "cost_estimate_usd": float(row["cost_estimate_usd"] or 0),
                "shortlisted": bool(row["shortlisted"]),
                "approved": bool(row["approved"]),
                "shortlist_counts": {
                    "selected": shortlist_tally[str(row["id"])]["selected"],
                    "my_selected": shortlist_tally[str(row["id"])]["my_selected"],
                },
                "vote_counts": {
                    "approve": tally[str(row["id"])]["approve"],
                    "reject": tally[str(row["id"])]["reject"],
                    "my_vote": tally[str(row["id"])]["my_vote"],
                },
            }
            for row in rows
        ]
    }


@app.post("/trips/{trip_id}/pois/sync")
async def sync_pois(
    trip_id: str,
    body: PoiSyncRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    clean_items: list[dict[str, Any]] = []
    for item in body.pois or []:
        name = str(item.name or "").strip()
        if not name:
            continue
        city = str(item.destination or "").strip()
        country = str(item.country or "").strip()
        category = str(item.category or "").strip().lower() or "culture"
        tags = [str(t or "").strip() for t in (item.tags or [])]
        tags = [t for t in tags if t]
        rating = None
        if item.rating is not None:
            try:
                rating = round(float(item.rating), 1)
            except Exception:
                rating = None
        try:
            cost_estimate = round(float(item.cost_estimate_usd or 0), 2)
        except Exception:
            cost_estimate = 0.0
        clean_items.append(
            {
                "poi_id": str(item.poi_id or "").strip(),
                "name": name,
                "category": category,
                "city": city,
                "country": country,
                "tags": tags,
                "rating": rating,
                "cost_estimate_usd": cost_estimate,
                "shortlisted": bool(item.shortlisted),
                "approved": bool(item.approved),
            }
        )

    if len(clean_items) == 0:
        return {"pois": []}

    synced_rows: list[Any] = []
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        member_row = await conn.fetchrow(
            "SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2",
            trip_id,
            user_id,
        )
        if not member_row or str(member_row["status"] or "pending").lower() != "accepted":
            raise HTTPException(status_code=403, detail="Only accepted trip members can sync POIs")
        for item in clean_items:
            updated = None
            pid = None
            if item["poi_id"]:
                try:
                    pid = str(UUID(item["poi_id"]))
                except Exception:
                    pid = None
            if pid:
                updated = await conn.fetchrow(
                    """
                    UPDATE pois
                    SET name = $1,
                        category = $2,
                        city = NULLIF($3, ''),
                        country = NULLIF($4, ''),
                        tags = $5::text[],
                        rating = $6,
                        cost_estimate_usd = $7,
                        shortlisted = $8,
                        approved = $9
                    WHERE id = $10 AND trip_id = $11
                    RETURNING id, name, category, city, country, tags, rating, cost_estimate_usd, shortlisted, approved
                    """,
                    item["name"],
                    item["category"],
                    item["city"],
                    item["country"],
                    item["tags"],
                    item["rating"],
                    item["cost_estimate_usd"],
                    item["shortlisted"],
                    item["approved"],
                    pid,
                    trip_id,
                )
            if not updated:
                existing = await conn.fetchrow(
                    """
                    SELECT id
                    FROM pois
                    WHERE trip_id = $1
                      AND LOWER(name) = LOWER($2)
                      AND COALESCE(LOWER(city), '') = COALESCE(LOWER($3), '')
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    trip_id,
                    item["name"],
                    item["city"],
                )
                if existing:
                    updated = await conn.fetchrow(
                        """
                        UPDATE pois
                        SET category = $1,
                            country = NULLIF($2, ''),
                            tags = $3::text[],
                            rating = $4,
                            cost_estimate_usd = $5,
                            shortlisted = $6,
                            approved = $7
                        WHERE id = $8 AND trip_id = $9
                        RETURNING id, name, category, city, country, tags, rating, cost_estimate_usd, shortlisted, approved
                        """,
                        item["category"],
                        item["country"],
                        item["tags"],
                        item["rating"],
                        item["cost_estimate_usd"],
                        item["shortlisted"],
                        item["approved"],
                        existing["id"],
                        trip_id,
                    )
                else:
                    updated = await conn.fetchrow(
                        """
                        INSERT INTO pois (trip_id, name, category, city, country, tags, rating, cost_estimate_usd, shortlisted, approved)
                        VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6::text[], $7, $8, $9, $10)
                        RETURNING id, name, category, city, country, tags, rating, cost_estimate_usd, shortlisted, approved
                        """,
                        trip_id,
                        item["name"],
                        item["category"],
                        item["city"],
                        item["country"],
                        item["tags"],
                        item["rating"],
                        item["cost_estimate_usd"],
                        item["shortlisted"],
                        item["approved"],
                    )
            if updated:
                synced_rows.append(updated)

    return {
        "pois": [
            {
                "poi_id": str(row["id"]),
                "name": row["name"],
                "category": row["category"],
                "city": row["city"],
                "country": row["country"],
                "tags": row["tags"] or [],
                "rating": float(row["rating"] or 0),
                "cost_estimate_usd": float(row["cost_estimate_usd"] or 0),
                "shortlisted": bool(row["shortlisted"]),
                "approved": bool(row["approved"]),
            }
            for row in synced_rows
        ]
    }


@app.post("/trips/{trip_id}/pois/{poi_id}/approve")
async def approve_poi(
    trip_id: str,
    poi_id: str,
    body: PoiApprovalRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        row = await conn.fetchrow(
            """
            UPDATE pois
            SET approved = $1
            WHERE id = $2 AND trip_id = $3
            RETURNING id, name, category, approved
            """,
            body.approved,
            poi_id,
            trip_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="POI not found")
    return {"poi": {"poi_id": str(row["id"]), "name": row["name"], "category": row["category"], "approved": bool(row["approved"])}}


@app.post("/trips/{trip_id}/pois/{poi_id}/shortlist")
async def shortlist_poi(
    trip_id: str,
    poi_id: str,
    body: PoiShortlistRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        exists = await conn.fetchval(
            "SELECT 1 FROM pois WHERE id = $1 AND trip_id = $2",
            poi_id,
            trip_id,
        )
        if not exists:
            raise HTTPException(status_code=404, detail="POI not found")
        await conn.execute(
            """
            INSERT INTO poi_shortlist_selections (trip_id, poi_id, user_id, selected)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (poi_id, user_id)
            DO UPDATE SET selected = EXCLUDED.selected, created_at = NOW()
            """,
            trip_id,
            poi_id,
            user_id,
            bool(body.shortlisted),
        )
        selected_count = await conn.fetchval(
            """
            SELECT COUNT(*)
            FROM poi_shortlist_selections
            WHERE trip_id = $1 AND poi_id = $2 AND selected = true
            """,
            trip_id,
            poi_id,
        )
        row = await conn.fetchrow(
            """
            UPDATE pois
            SET shortlisted = $1
            WHERE id = $2 AND trip_id = $3
            RETURNING id, name, category, shortlisted
            """,
            bool(selected_count),
            poi_id,
            trip_id,
        )
    return {
        "poi": {
            "poi_id": str(row["id"]),
            "name": row["name"],
            "category": row["category"],
            "shortlisted": bool(row["shortlisted"]),
        },
        "shortlist_counts": {
            "selected": int(selected_count or 0),
            "my_selected": bool(body.shortlisted),
        },
    }


@app.post("/trips/{trip_id}/pois/{poi_id}/vote")
async def vote_poi(
    trip_id: str,
    poi_id: str,
    body: PoiVoteRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    vote = "approve" if str(body.vote).lower() in {"approve", "yes", "true", "include"} else "reject"
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        poi = await conn.fetchrow(
            "SELECT shortlisted FROM pois WHERE id = $1 AND trip_id = $2",
            poi_id,
            trip_id,
        )
        if not poi:
            raise HTTPException(status_code=404, detail="POI not found")
        if not bool(poi["shortlisted"]):
            raise HTTPException(status_code=409, detail="POI is not on the shared shortlist")
        await conn.execute(
            """
            INSERT INTO poi_votes (trip_id, poi_id, user_id, vote)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (poi_id, user_id) DO UPDATE SET vote = EXCLUDED.vote, created_at = NOW()
            """,
            trip_id,
            poi_id,
            user_id,
            vote,
        )
        vote_rows = await conn.fetch(
            "SELECT vote, user_id FROM poi_votes WHERE poi_id = $1",
            poi_id,
        )
    approve_count = sum(1 for r in vote_rows if r["vote"] == "approve")
    reject_count = sum(1 for r in vote_rows if r["vote"] == "reject")
    return {
        "ok": True,
        "vote": vote,
        "vote_counts": {"approve": approve_count, "reject": reject_count, "my_vote": vote},
    }


@app.post("/trips/{trip_id}/pois/consolidate")
async def consolidate_poi_votes(
    trip_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Organizer locks POI voting: approve shortlisted POIs with majority votes, reject the rest."""
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_owner(conn, trip_id, user_id)
        member_count = await conn.fetchval(
            "SELECT COUNT(*) FROM trip_members WHERE trip_id = $1 AND status = 'accepted'",
            trip_id,
        )
        majority_needed = max(1, int(member_count // 2) + 1) if member_count else 1
        rows = await conn.fetch(
            """
            SELECT p.id,
                   p.shortlisted,
                   COUNT(pv.id) FILTER (WHERE pv.vote = 'approve') AS approve_count,
                   COUNT(pv.id) FILTER (WHERE pv.vote = 'reject')  AS reject_count
            FROM pois p
            LEFT JOIN poi_votes pv ON pv.poi_id = p.id AND pv.trip_id = p.trip_id
            WHERE p.trip_id = $1
            GROUP BY p.id
            """,
            trip_id,
        )
        approved_ids = []
        rejected_ids = []
        for row in rows:
            if not bool(row["shortlisted"]):
                rejected_ids.append(row["id"])
                continue
            approve_count = int(row["approve_count"] or 0)
            if approve_count >= majority_needed:
                approved_ids.append(row["id"])
            else:
                rejected_ids.append(row["id"])
        if approved_ids:
            await conn.execute(
                "UPDATE pois SET approved = true WHERE id = ANY($1::uuid[]) AND trip_id = $2",
                approved_ids,
                trip_id,
            )
        if rejected_ids:
            await conn.execute(
                "UPDATE pois SET approved = false WHERE id = ANY($1::uuid[]) AND trip_id = $2",
                rejected_ids,
                trip_id,
            )
    return {
        "ok": True,
        "shortlisted_count": len(approved_ids) + len(rejected_ids),
        "approved_count": len(approved_ids),
        "rejected_count": len(rejected_ids),
        "majority_needed": majority_needed,
    }


@app.get("/trips/{trip_id}/health-requirements")
async def get_health_requirements(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        rows = await conn.fetch(
            """
            SELECT id, name, category
            FROM pois
            WHERE trip_id = $1 AND approved = true
            ORDER BY created_at ASC
            """,
            trip_id,
        )
    requirements = []
    for row in rows:
        cert_required = "open_water_scuba" if str(row["category"]).lower() == "scuba" else None
        requirements.append(
            {
                "activity_id": str(row["id"]),
                "activity": row["name"],
                "certification_required": cert_required,
            }
        )
    return {"requirements": requirements}


@app.post("/trips/{trip_id}/members/{member_user_id}/health-acknowledgment")
async def health_acknowledgment(
    trip_id: str,
    member_user_id: str,
    body: HealthAcknowledgmentRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    if user_id != member_user_id:
        raise HTTPException(status_code=403, detail="Cannot submit another member's acknowledgment")

    alternatives = []
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        for ack in body.acknowledgments:
            alternative = None
            if ack.certification_required and not ack.user_has_cert:
                alternative = "snorkeling"
                await conn.execute(
                    "UPDATE pois SET approved = false WHERE id = $1 AND trip_id = $2",
                    ack.activity_id,
                    trip_id,
                )
                await conn.execute(
                    """
                    INSERT INTO pois (trip_id, name, category, city, country, tags, rating, cost_estimate_usd, approved)
                    VALUES ($1, $2, 'snorkeling', 'Okinawa', 'Japan', $3::text[], 4.6, 60, true)
                    """,
                    trip_id,
                    "Blue Lagoon Snorkeling Tour",
                    ["snorkeling", "ocean", "reef"],
                )
                alternatives.append({"name": "Blue Lagoon Snorkeling Tour", "category": "snorkeling", "tags": ["snorkeling"]})
            await conn.execute(
                """
                INSERT INTO health_acknowledgments (trip_id, user_id, activity_id, certification_required, user_has_cert, alternative_suggested)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                trip_id,
                member_user_id,
                ack.activity_id,
                ack.certification_required,
                ack.user_has_cert,
                alternative,
            )
    return {"processed": True, "alternatives_suggested": alternatives}


@app.post("/trips/{trip_id}/budget")
async def set_trip_budget(
    trip_id: str,
    body: BudgetRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_owner(conn, trip_id, user_id)
        trip = await conn.fetchrow("SELECT duration_days FROM trips WHERE id = $1", trip_id)
        duration_days = int(trip["duration_days"] or 7)
        total_budget = round(body.daily_budget * duration_days, 2)
        breakdown = _budget_breakdown(total_budget)
        await conn.execute(
            """
            INSERT INTO budgets (trip_id, currency, daily_target, total_budget, spent, remaining, breakdown, warning_active)
            VALUES ($1, $2, $3, $4, 0, $4, $5::jsonb, false)
            ON CONFLICT (trip_id)
            DO UPDATE SET currency = EXCLUDED.currency,
                          daily_target = EXCLUDED.daily_target,
                          total_budget = EXCLUDED.total_budget,
                          remaining = EXCLUDED.total_budget - budgets.spent,
                          breakdown = EXCLUDED.breakdown,
                          warning_active = false,
                          updated_at = NOW()
            """,
            trip_id,
            body.currency,
            body.daily_budget,
            total_budget,
            json.dumps(breakdown),
        )
    return {"budget": {"currency": body.currency, "daily_target": body.daily_budget, "total_budget": total_budget, "spent": 0, "remaining": total_budget, "breakdown": breakdown, "warning_active": False}}


@app.get("/trips/{trip_id}/budget/breakdown")
async def get_budget_breakdown(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        row = await conn.fetchrow(
            "SELECT currency, daily_target, total_budget, spent, remaining, breakdown, warning_active FROM budgets WHERE trip_id = $1",
            trip_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Budget not found")
    return {"budget": {"currency": row["currency"], "daily_target": float(row["daily_target"]), "total_budget": float(row["total_budget"]), "spent": float(row["spent"] or 0), "remaining": float(row["remaining"] or 0), "breakdown": _json_obj(row["breakdown"]), "warning_active": bool(row["warning_active"])}}


@app.post("/trips/{trip_id}/budget/increase")
async def increase_budget(trip_id: str, body: BudgetIncreaseRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_owner(conn, trip_id, user_id)
        current = await conn.fetchrow("SELECT daily_target, spent FROM budgets WHERE trip_id = $1", trip_id)
        if not current:
            raise HTTPException(status_code=404, detail="Budget not found")
        if body.new_daily_budget <= float(current["daily_target"]):
            raise HTTPException(status_code=422, detail="New budget must be higher than current")
        trip = await conn.fetchrow("SELECT duration_days FROM trips WHERE id = $1", trip_id)
        duration_days = int(trip["duration_days"] or 7)
        total_budget = round(body.new_daily_budget * duration_days, 2)
        breakdown = _budget_breakdown(total_budget)
        spent = float(current["spent"] or 0)
        remaining = round(total_budget - spent, 2)
        await conn.execute(
            """
            UPDATE budgets
            SET daily_target = $1,
                total_budget = $2,
                remaining = $3,
                breakdown = $4::jsonb,
                warning_active = false,
                updated_at = NOW()
            WHERE trip_id = $5
            """,
            body.new_daily_budget,
            total_budget,
            remaining,
            json.dumps(breakdown),
            trip_id,
        )
    return {"budget": {"daily_target": body.new_daily_budget, "total_budget": total_budget, "spent": spent, "remaining": remaining, "breakdown": breakdown, "warning_active": False}}


_AIRPORT_STATIC: list[dict[str, str]] = [
    {"iata": "ATL", "name": "Hartsfield-Jackson Atlanta International", "city": "Atlanta", "country": "US"},
    {"iata": "LAX", "name": "Los Angeles International", "city": "Los Angeles", "country": "US"},
    {"iata": "ORD", "name": "O'Hare International", "city": "Chicago", "country": "US"},
    {"iata": "MDW", "name": "Chicago Midway International", "city": "Chicago", "country": "US"},
    {"iata": "DFW", "name": "Dallas/Fort Worth International", "city": "Dallas", "country": "US"},
    {"iata": "DEN", "name": "Denver International", "city": "Denver", "country": "US"},
    {"iata": "JFK", "name": "John F. Kennedy International", "city": "New York", "country": "US"},
    {"iata": "LGA", "name": "LaGuardia Airport", "city": "New York", "country": "US"},
    {"iata": "EWR", "name": "Newark Liberty International", "city": "New York / Newark", "country": "US"},
    {"iata": "SFO", "name": "San Francisco International", "city": "San Francisco", "country": "US"},
    {"iata": "OAK", "name": "Oakland International", "city": "Oakland / San Francisco", "country": "US"},
    {"iata": "SJC", "name": "San Jose International", "city": "San Jose", "country": "US"},
    {"iata": "SEA", "name": "Seattle-Tacoma International", "city": "Seattle", "country": "US"},
    {"iata": "MIA", "name": "Miami International", "city": "Miami", "country": "US"},
    {"iata": "FLL", "name": "Fort Lauderdale-Hollywood International", "city": "Fort Lauderdale / Miami", "country": "US"},
    {"iata": "BOS", "name": "Boston Logan International", "city": "Boston", "country": "US"},
    {"iata": "LAS", "name": "Harry Reid International", "city": "Las Vegas", "country": "US"},
    {"iata": "PHX", "name": "Phoenix Sky Harbor International", "city": "Phoenix", "country": "US"},
    {"iata": "IAD", "name": "Washington Dulles International", "city": "Washington D.C.", "country": "US"},
    {"iata": "DCA", "name": "Ronald Reagan Washington National", "city": "Washington D.C.", "country": "US"},
    {"iata": "MSP", "name": "Minneapolis-Saint Paul International", "city": "Minneapolis", "country": "US"},
    {"iata": "DTW", "name": "Detroit Metropolitan Wayne County", "city": "Detroit", "country": "US"},
    {"iata": "PHL", "name": "Philadelphia International", "city": "Philadelphia", "country": "US"},
    {"iata": "CLT", "name": "Charlotte Douglas International", "city": "Charlotte", "country": "US"},
    {"iata": "NRT", "name": "Narita International Airport", "city": "Tokyo", "country": "JP"},
    {"iata": "HND", "name": "Haneda Airport", "city": "Tokyo", "country": "JP"},
    {"iata": "KIX", "name": "Kansai International Airport", "city": "Osaka / Kyoto", "country": "JP"},
    {"iata": "ITM", "name": "Osaka Itami Airport", "city": "Osaka", "country": "JP"},
    {"iata": "CTS", "name": "New Chitose Airport", "city": "Sapporo", "country": "JP"},
    {"iata": "LHR", "name": "Heathrow Airport", "city": "London", "country": "GB"},
    {"iata": "LGW", "name": "Gatwick Airport", "city": "London", "country": "GB"},
    {"iata": "STN", "name": "Stansted Airport", "city": "London", "country": "GB"},
    {"iata": "CDG", "name": "Charles de Gaulle Airport", "city": "Paris", "country": "FR"},
    {"iata": "ORY", "name": "Paris Orly Airport", "city": "Paris", "country": "FR"},
    {"iata": "AMS", "name": "Amsterdam Schiphol Airport", "city": "Amsterdam", "country": "NL"},
    {"iata": "FRA", "name": "Frankfurt Airport", "city": "Frankfurt", "country": "DE"},
    {"iata": "MUC", "name": "Munich Airport", "city": "Munich", "country": "DE"},
    {"iata": "TXL", "name": "Berlin Tegel Airport", "city": "Berlin", "country": "DE"},
    {"iata": "BER", "name": "Berlin Brandenburg Airport", "city": "Berlin", "country": "DE"},
    {"iata": "MAD", "name": "Adolfo Suárez Madrid–Barajas Airport", "city": "Madrid", "country": "ES"},
    {"iata": "BCN", "name": "Barcelona El Prat Airport", "city": "Barcelona", "country": "ES"},
    {"iata": "FCO", "name": "Leonardo da Vinci International Airport", "city": "Rome", "country": "IT"},
    {"iata": "MXP", "name": "Milan Malpensa Airport", "city": "Milan", "country": "IT"},
    {"iata": "LIN", "name": "Milan Linate Airport", "city": "Milan", "country": "IT"},
    {"iata": "ATH", "name": "Athens International Airport", "city": "Athens", "country": "GR"},
    {"iata": "JTR", "name": "Santorini (Thira) National Airport", "city": "Santorini", "country": "GR"},
    {"iata": "HER", "name": "Heraklion International Airport", "city": "Crete / Heraklion", "country": "GR"},
    {"iata": "SKG", "name": "Thessaloniki International Airport", "city": "Thessaloniki", "country": "GR"},
    {"iata": "DXB", "name": "Dubai International Airport", "city": "Dubai", "country": "AE"},
    {"iata": "AUH", "name": "Abu Dhabi International Airport", "city": "Abu Dhabi", "country": "AE"},
    {"iata": "SIN", "name": "Singapore Changi Airport", "city": "Singapore", "country": "SG"},
    {"iata": "BKK", "name": "Suvarnabhumi Airport", "city": "Bangkok", "country": "TH"},
    {"iata": "DMK", "name": "Don Mueang International Airport", "city": "Bangkok", "country": "TH"},
    {"iata": "HKG", "name": "Hong Kong International Airport", "city": "Hong Kong", "country": "HK"},
    {"iata": "PEK", "name": "Beijing Capital International Airport", "city": "Beijing", "country": "CN"},
    {"iata": "PKX", "name": "Beijing Daxing International Airport", "city": "Beijing", "country": "CN"},
    {"iata": "PVG", "name": "Shanghai Pudong International Airport", "city": "Shanghai", "country": "CN"},
    {"iata": "SHA", "name": "Shanghai Hongqiao International Airport", "city": "Shanghai", "country": "CN"},
    {"iata": "ICN", "name": "Incheon International Airport", "city": "Seoul", "country": "KR"},
    {"iata": "GMP", "name": "Gimpo International Airport", "city": "Seoul", "country": "KR"},
    {"iata": "SYD", "name": "Sydney Kingsford Smith Airport", "city": "Sydney", "country": "AU"},
    {"iata": "MEL", "name": "Melbourne Airport", "city": "Melbourne", "country": "AU"},
    {"iata": "BNE", "name": "Brisbane Airport", "city": "Brisbane", "country": "AU"},
    {"iata": "PER", "name": "Perth Airport", "city": "Perth", "country": "AU"},
    {"iata": "AKL", "name": "Auckland Airport", "city": "Auckland", "country": "NZ"},
    {"iata": "ZQN", "name": "Queenstown Airport", "city": "Queenstown", "country": "NZ"},
    {"iata": "CHC", "name": "Christchurch International Airport", "city": "Christchurch", "country": "NZ"},
    {"iata": "WLG", "name": "Wellington International Airport", "city": "Wellington", "country": "NZ"},
    {"iata": "YYZ", "name": "Toronto Pearson International Airport", "city": "Toronto", "country": "CA"},
    {"iata": "YVR", "name": "Vancouver International Airport", "city": "Vancouver", "country": "CA"},
    {"iata": "YUL", "name": "Montréal-Trudeau International Airport", "city": "Montreal", "country": "CA"},
    {"iata": "GRU", "name": "São Paulo/Guarulhos International Airport", "city": "São Paulo", "country": "BR"},
    {"iata": "GIG", "name": "Rio de Janeiro/Galeão International Airport", "city": "Rio de Janeiro", "country": "BR"},
    {"iata": "LIM", "name": "Jorge Chávez International Airport", "city": "Lima", "country": "PE"},
    {"iata": "BOG", "name": "El Dorado International Airport", "city": "Bogotá", "country": "CO"},
    {"iata": "MEX", "name": "Mexico City International Airport", "city": "Mexico City", "country": "MX"},
    {"iata": "CUN", "name": "Cancún International Airport", "city": "Cancún", "country": "MX"},
    {"iata": "NBO", "name": "Jomo Kenyatta International Airport", "city": "Nairobi", "country": "KE"},
    {"iata": "JNB", "name": "O.R. Tambo International Airport", "city": "Johannesburg", "country": "ZA"},
    {"iata": "CPT", "name": "Cape Town International Airport", "city": "Cape Town", "country": "ZA"},
    {"iata": "CMN", "name": "Mohammed V International Airport", "city": "Casablanca / Marrakech", "country": "MA"},
    {"iata": "RAK", "name": "Marrakech Menara Airport", "city": "Marrakech", "country": "MA"},
    {"iata": "CAI", "name": "Cairo International Airport", "city": "Cairo", "country": "EG"},
    {"iata": "MLE", "name": "Velana International Airport", "city": "Malé / Maldives", "country": "MV"},
    {"iata": "DPS", "name": "Ngurah Rai International Airport", "city": "Bali / Denpasar", "country": "ID"},
    {"iata": "CGK", "name": "Soekarno–Hatta International Airport", "city": "Jakarta", "country": "ID"},
    {"iata": "KUL", "name": "Kuala Lumpur International Airport", "city": "Kuala Lumpur", "country": "MY"},
    {"iata": "MNL", "name": "Ninoy Aquino International Airport", "city": "Manila", "country": "PH"},
    {"iata": "DEL", "name": "Indira Gandhi International Airport", "city": "Delhi", "country": "IN"},
    {"iata": "BOM", "name": "Chhatrapati Shivaji Maharaj International Airport", "city": "Mumbai", "country": "IN"},
    {"iata": "BLR", "name": "Kempegowda International Airport", "city": "Bangalore", "country": "IN"},
    {"iata": "IST", "name": "Istanbul Airport", "city": "Istanbul", "country": "TR"},
    {"iata": "SAW", "name": "Istanbul Sabiha Gökçen International Airport", "city": "Istanbul", "country": "TR"},
    {"iata": "TLV", "name": "Ben Gurion International Airport", "city": "Tel Aviv", "country": "IL"},
    {"iata": "PRG", "name": "Václav Havel Airport Prague", "city": "Prague", "country": "CZ"},
    {"iata": "BUD", "name": "Budapest Ferenc Liszt International Airport", "city": "Budapest", "country": "HU"},
    {"iata": "VIE", "name": "Vienna International Airport", "city": "Vienna", "country": "AT"},
    {"iata": "ZRH", "name": "Zurich Airport", "city": "Zurich", "country": "CH"},
    {"iata": "GVA", "name": "Geneva Airport", "city": "Geneva", "country": "CH"},
    {"iata": "CPH", "name": "Copenhagen Airport", "city": "Copenhagen", "country": "DK"},
    {"iata": "ARN", "name": "Stockholm Arlanda Airport", "city": "Stockholm", "country": "SE"},
    {"iata": "OSL", "name": "Oslo Gardermoen Airport", "city": "Oslo", "country": "NO"},
    {"iata": "HEL", "name": "Helsinki-Vantaa Airport", "city": "Helsinki", "country": "FI"},
    {"iata": "WAW", "name": "Warsaw Chopin Airport", "city": "Warsaw", "country": "PL"},
    {"iata": "LIS", "name": "Lisbon Humberto Delgado Airport", "city": "Lisbon", "country": "PT"},
    {"iata": "OPO", "name": "Francisco de Sá Carneiro Airport", "city": "Porto", "country": "PT"},
    {"iata": "SVO", "name": "Sheremetyevo International Airport", "city": "Moscow", "country": "RU"},
    {"iata": "LED", "name": "Pulkovo Airport", "city": "Saint Petersburg", "country": "RU"},
]


@app.get("/airports/search")
async def search_airports(
    q: str,
    user_id: str = Depends(get_current_user_id),
):
    """Search for airports by city name or keyword, returning IATA code options."""
    keyword = str(q or "").strip()
    if len(keyword) < 2:
        return {"airports": [], "source": "none"}

    # Try Amadeus locations API first
    if _amadeus_credentials_configured():
        try:
            data = _amadeus_request_json(
                "/v1/reference-data/locations",
                {"subType": "AIRPORT", "keyword": keyword, "page[limit]": "10", "view": "LIGHT"},
            )
            airports: list[dict[str, str]] = []
            for item in data.get("data", []):
                iata = str(item.get("iataCode") or "").upper().strip()
                if len(iata) != 3:
                    continue
                name = str(item.get("name") or iata).title()
                address = item.get("address") or {}
                city = str(address.get("cityName") or name).title()
                country = str(address.get("countryCode") or "").upper()
                airports.append({"iata": iata, "name": name, "city": city, "country": country})
            if airports:
                return {"airports": airports[:8], "source": "amadeus"}
        except Exception:
            pass  # fall through to static list

    # Static fallback: fuzzy match on city, name, or IATA code
    kw = keyword.lower()
    matches = [
        a for a in _AIRPORT_STATIC
        if kw in a["city"].lower() or kw in a["name"].lower() or kw == a["iata"].lower()
    ]
    # Prioritise exact IATA match at the top
    matches.sort(key=lambda a: (0 if kw == a["iata"].lower() else 1, a["city"]))
    return {"airports": matches[:8], "source": "static"}


@app.post("/trips/{trip_id}/flights/search")
async def search_flights(
    trip_id: str,
    body: FlightSearchRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    def _airport_code(value: str, fallback: str) -> str:
        cleaned = re.sub(r"[^A-Za-z]", "", str(value or "").upper())
        if len(cleaned) >= 3:
            return cleaned[:3]
        return fallback

    def _parse_departure(raw_date: str, fallback_offset_days: int) -> datetime:
        try:
            parsed = date.fromisoformat(str(raw_date)[:10])
            return datetime.combine(parsed, time(8, 0), tzinfo=timezone.utc)
        except Exception:
            return datetime.now(timezone.utc) + timedelta(days=max(1, fallback_offset_days))

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        budget = await conn.fetchrow("SELECT breakdown FROM budgets WHERE trip_id = $1", trip_id)
        budget_breakdown = _json_obj(budget["breakdown"]) if budget else {}
        budget_flight_hint = 500.0  # flights are personal; use a reasonable default

    start_airport = _airport_code(body.origin, "LAX")
    first_arrival = _airport_code(body.destination, "NRT")
    route_segments: list[dict[str, Any]] = []
    for idx, seg in enumerate(body.multi_city_segments):
        seg_from = _airport_code(seg.from_airport, start_airport)
        seg_to = _airport_code(seg.to_airport, first_arrival)
        if seg_from == seg_to:
            continue
        route_segments.append(
            {
                "from_airport": seg_from,
                "to_airport": seg_to,
                "depart_time": _parse_departure(seg.depart_date, idx + 1),
            }
        )

    if not route_segments:
        route_segments.append(
            {
                "from_airport": start_airport,
                "to_airport": first_arrival,
                "depart_time": _parse_departure(body.depart_date, 1),
            }
        )

    if body.round_trip and route_segments:
        last_to = route_segments[-1]["to_airport"]
        last_dep = route_segments[-1]["depart_time"]
        if last_to != start_airport:
            return_dep = _parse_departure(body.return_date or body.depart_date, len(route_segments) + 1)
            if return_dep <= last_dep:
                return_dep = last_dep + timedelta(days=2)
            route_segments.append(
                {
                    "from_airport": last_to,
                    "to_airport": start_airport,
                    "depart_time": return_dep,
                }
            )

    live_error = ""
    leg_groups: list[dict[str, Any]] = []
    option_source = "amadeus"
    try:
        live_leg_groups, live_error = await asyncio.to_thread(
            _build_live_leg_option_groups,
            route_segments=route_segments,
            max_price=0.0,  # Do not enforce budget cap on flight searches.
            cabin_class=body.cabin_class or "economy",
        )
        leg_groups = live_leg_groups
    except Exception as exc:
        live_error = str(exc)
        leg_groups = []

    if not leg_groups:
        option_source = "mock"
        mock_pricing_budget = max(900.0, budget_flight_hint)
        leg_groups = _build_mock_leg_option_groups(
            route_segments=route_segments,
            max_price=mock_pricing_budget,
            cabin_class=body.cabin_class or "economy",
        )

    flights: list[dict[str, Any]] = []
    legs_response: list[dict[str, Any]] = []
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        await conn.execute("DELETE FROM flight_options WHERE trip_id = $1", trip_id)
        for leg in leg_groups:
            leg_options_response: list[dict[str, Any]] = []
            for option in leg.get("options", []):
                row = await conn.fetchrow(
                    """
                    INSERT INTO flight_options (trip_id, airline, departure_airport, arrival_airport, departure_time, arrival_time, price_usd, stops, duration_min, selected)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
                    RETURNING id, airline, departure_airport, arrival_airport, departure_time, arrival_time, price_usd, stops, duration_min
                    """,
                    trip_id,
                    option["airline"],
                    option["departure_airport"],
                    option["arrival_airport"],
                    option["departure_time"],
                    option["arrival_time"],
                    option["price_usd"],
                    option["stops"],
                    option["duration_minutes"],
                )
                option_payload = {
                    "flight_id": str(row["id"]),
                    "leg_id": leg.get("leg_id", ""),
                    "airline": row["airline"],
                    "departure_airport": row["departure_airport"],
                    "arrival_airport": row["arrival_airport"],
                    "departure_time": row["departure_time"].isoformat(),
                    "arrival_time": row["arrival_time"].isoformat(),
                    "price_usd": float(row["price_usd"]),
                    "stops": int(row["stops"] or 0),
                    "duration_minutes": int(row["duration_min"] or 0),
                    "cabin_class": option.get("cabin_class", (body.cabin_class or "economy").title()),
                    "route_summary": f"{row['departure_airport']} -> {row['arrival_airport']}",
                    "legs_count": 1,
                    "legs": [],
                    "booking_url": option.get("booking_url", ""),
                    "source": option_source,
                }
                flights.append(option_payload)
                leg_options_response.append(option_payload)
            legs_response.append(
                {
                    "leg_id": leg.get("leg_id", ""),
                    "from_airport": leg.get("from_airport", ""),
                    "to_airport": leg.get("to_airport", ""),
                    "depart_date": leg.get("depart_date", ""),
                    "options": leg_options_response,
                }
            )

    segment_count = len(route_segments)
    total_options = sum(len(leg.get("options", [])) for leg in legs_response)
    return {
        "flights": flights,
        "legs": legs_response,
        "search_params": {
            "max_price": budget_flight_hint,
            "price_filter_applied": False,
            "round_trip": bool(body.round_trip),
            "segments": segment_count,
            "total_options": total_options,
            "source": option_source,
            "live_error": live_error or None,
        },
    }


@app.post("/trips/{trip_id}/flights/select")
async def select_flight(trip_id: str, body: FlightSelectRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        budget = await conn.fetchrow(
            """
            SELECT currency, daily_target, total_budget, spent, remaining, breakdown, warning_active
            FROM budgets
            WHERE trip_id = $1
            """,
            trip_id,
        )

        requested_ids: list[str] = []
        if body.leg_selections:
            requested_ids = [str(item.flight_id).strip() for item in body.leg_selections if str(item.flight_id).strip()]
        elif body.flight_id:
            requested_ids = [str(body.flight_id).strip()]
        if not requested_ids:
            raise HTTPException(status_code=400, detail="No flight selection provided")

        uuid_ids: list[UUID] = []
        invalid_count = 0
        for raw_id in requested_ids:
            try:
                uuid_ids.append(UUID(raw_id))
            except ValueError:
                invalid_count += 1

        if uuid_ids:
            selected_rows = await conn.fetch(
                """
                SELECT id, price_usd, departure_airport, arrival_airport, departure_time
                FROM flight_options
                WHERE trip_id = $1 AND id = ANY($2::uuid[])
                """,
                trip_id,
                uuid_ids,
            )
        else:
            selected_rows = []

        if not selected_rows and invalid_count > 0 and body.price_usd is not None:
            raise HTTPException(status_code=404, detail="Flight not found")

        if len(selected_rows) != len(uuid_ids):
            raise HTTPException(status_code=404, detail="One or more selected flights were not found")

        if body.leg_selections:
            leg_keys = {
                f"{row['departure_airport']}->{row['arrival_airport']}:{row['departure_time'].date().isoformat()}"
                for row in selected_rows
            }
            if len(leg_keys) != len(selected_rows):
                raise HTTPException(status_code=422, detail="Select at most one flight per leg")

        # Flights are a personal selection and must not mutate shared trip budget.
        updated = budget

        await conn.execute("UPDATE flight_options SET selected = false WHERE trip_id = $1", trip_id)
        if uuid_ids:
            await conn.execute(
                "UPDATE flight_options SET selected = true WHERE trip_id = $1 AND id = ANY($2::uuid[])",
                trip_id,
                uuid_ids,
            )

    response = {
        "selected": True,
        "selected_count": len(selected_rows),
        "selected_flight_ids": [str(row["id"]) for row in selected_rows],
    }
    if updated:
        response["budget"] = {
            "currency": updated["currency"],
            "daily_target": float(updated["daily_target"]),
            "total_budget": float(updated["total_budget"]),
            "spent": float(updated["spent"]),
            "remaining": float(updated["remaining"]),
            "breakdown": _json_obj(updated["breakdown"]),
            "warning_active": bool(updated["warning_active"]),
        }
    else:
        response["budget"] = None
    return response


@app.post("/trips/{trip_id}/stays/search")
async def search_stays(trip_id: str, body: StaySearchRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
    nights = max(1, (date.fromisoformat(body.check_out) - date.fromisoformat(body.check_in)).days)
    stays = [
        {"stay_id": "STAY-LUXURY-001", "name": f"Grand {body.city} Palace", "price_per_night_usd": 200.0, "rating": 4.8, "type": "Hotel", "nights": nights},
        {"stay_id": "STAY-PLUS-001", "name": f"{body.city} Central Suites", "price_per_night_usd": 140.0, "rating": 4.4, "type": "Hotel", "nights": nights},
        {"stay_id": "STAY-BASIC-001", "name": f"{body.city} Urban Lodge", "price_per_night_usd": 90.0, "rating": 4.1, "type": "Hostel", "nights": nights},
    ]
    if body.max_price is not None:
        stays = [s for s in stays if s["price_per_night_usd"] <= float(body.max_price)]
    return {"stays": stays}


@app.post("/trips/{trip_id}/stays/select")
async def select_stay(trip_id: str, body: StaySelectRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        budget = await conn.fetchrow("SELECT total_budget, spent, breakdown FROM budgets WHERE trip_id = $1", trip_id)
        if not budget:
            raise HTTPException(status_code=422, detail="Budget must be set before selecting stays")
        budget_breakdown = _json_obj(budget["breakdown"])
        allocation = float(budget_breakdown.get("accommodation", 0))
        requested = float(body.price_per_night) * int(body.nights)
        spent_before = float(budget["spent"] or 0)
        total_budget = float(budget["total_budget"] or 0)
        remaining_before = round(total_budget - spent_before, 2)
        if requested > remaining_before and not body.force_over_budget:
            await conn.execute("UPDATE budgets SET warning_active = true WHERE trip_id = $1", trip_id)
            return JSONResponse(
                status_code=422,
                content={
                    "error": {"code": "BUDGET_EXCEEDED", "message": "Stay exceeds accommodation allocation", "status": 422},
                    "budget_warning": {"allocation": allocation, "requested": requested, "category": "accommodation"},
                },
            )
        spent = round(spent_before + requested, 2)
        remaining = round(total_budget - spent, 2)
        await conn.execute("UPDATE budgets SET spent = $1, remaining = $2, warning_active = false WHERE trip_id = $3", spent, remaining, trip_id)
        updated = await conn.fetchrow("SELECT currency, daily_target, total_budget, spent, remaining, breakdown, warning_active FROM budgets WHERE trip_id = $1", trip_id)
    return {"selected": True, "budget": {"currency": updated["currency"], "daily_target": float(updated["daily_target"]), "total_budget": float(updated["total_budget"]), "spent": float(updated["spent"]), "remaining": float(updated["remaining"]), "breakdown": _json_obj(updated["breakdown"]), "warning_active": bool(updated["warning_active"])}}


@app.post("/trips/{trip_id}/availability", status_code=201)
async def submit_availability(trip_id: str, body: AvailabilityRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    if not body.date_ranges:
        raise HTTPException(status_code=422, detail="Provide at least one date range")

    trip_days = 1
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        trip = await conn.fetchrow("SELECT duration_days FROM trips WHERE id = $1", trip_id)
        planning_state_row = await conn.fetchrow(
            "SELECT state FROM trip_planning_states WHERE trip_id = $1",
            trip_id,
        )
        planning_state = _json_obj((planning_state_row["state"] if planning_state_row else {}) or {})
        trip_days = _resolve_required_trip_days(trip, planning_state)

    normalized_ranges: list[tuple[date, date]] = []
    for idx, window in enumerate(body.date_ranges):
        start_raw = str((window or {}).get("start") or "").strip()[:10]
        end_raw = str((window or {}).get("end") or "").strip()[:10]
        if not start_raw or not end_raw:
            raise HTTPException(status_code=422, detail=f"Range {idx + 1} is missing start/end")
        try:
            start_date = date.fromisoformat(start_raw)
            end_date = date.fromisoformat(end_raw)
        except Exception:
            raise HTTPException(status_code=422, detail=f"Range {idx + 1} has invalid dates")
        if end_date < start_date:
            raise HTTPException(status_code=422, detail=f"Range {idx + 1} has end before start")
        if _inclusive_day_count(start_date, end_date) < trip_days:
            raise HTTPException(status_code=422, detail=f"Range {idx + 1} must fit at least {trip_days} days")
        normalized_ranges.append((start_date, end_date))

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        await conn.execute("DELETE FROM availability_windows WHERE trip_id = $1 AND user_id = $2", trip_id, user_id)
        for start_date, end_date in normalized_ranges:
            await conn.execute(
                """
                INSERT INTO availability_windows (trip_id, user_id, start_date, end_date)
                VALUES ($1, $2, $3::date, $4::date)
                """,
                trip_id,
                user_id,
                start_date,
                end_date,
            )
    return {"user_id": user_id}


def _intersect_date_ranges(
    left: list[tuple[date, date]],
    right: list[tuple[date, date]],
) -> list[tuple[date, date]]:
    intersections: list[tuple[date, date]] = []
    for l_start, l_end in left:
        for r_start, r_end in right:
            start = max(l_start, r_start)
            end = min(l_end, r_end)
            if start <= end:
                intersections.append((start, end))
    intersections.sort(key=lambda item: (item[0], item[1]))
    return intersections


def _common_overlap_windows(
    member_ids: list[str],
    by_member: dict[str, list[tuple[date, date]]],
) -> list[tuple[date, date]]:
    if not member_ids:
        return []
    current = sorted(by_member.get(member_ids[0], []), key=lambda item: (item[0], item[1]))
    for uid in member_ids[1:]:
        current = _intersect_date_ranges(current, by_member.get(uid, []))
        if not current:
            break
    return current


def _inclusive_day_count(start: date, end: date) -> int:
    return max(1, (end - start).days + 1)


def _resolve_required_trip_days(trip_row: Any, planning_state: Any) -> int:
    base_days = max(1, int((trip_row["duration_days"] if trip_row else 0) or 1))
    if isinstance(planning_state, dict):
        try:
            locked_days = planning_state.get("duration_days_locked")
            if locked_days is not None:
                return max(1, int(locked_days))
        except Exception:
            pass
    return base_days


def _enumerate_trip_windows(
    ranges: list[tuple[date, date]],
    trip_days: int,
) -> list[tuple[date, date]]:
    required_days = max(1, int(trip_days or 1))
    windows: list[tuple[date, date]] = []
    seen: set[tuple[date, date]] = set()
    for start, end in ranges:
        span_days = _inclusive_day_count(start, end)
        if span_days < required_days:
            continue
        for offset in range(0, span_days - required_days + 1):
            win_start = start + timedelta(days=offset)
            win_end = win_start + timedelta(days=required_days - 1)
            item = (win_start, win_end)
            if item in seen:
                continue
            seen.add(item)
            windows.append(item)
    windows.sort(key=lambda item: (item[0], item[1]))
    return windows


def _sanitize_locked_availability_window(
    locked_window: Any,
    trip_days: int,
    overlap_windows: list[tuple[date, date]] | None = None,
) -> dict[str, str] | None:
    if not isinstance(locked_window, dict):
        return None
    try:
        start = date.fromisoformat(str(locked_window.get("start") or "").strip()[:10])
        end = date.fromisoformat(str(locked_window.get("end") or "").strip()[:10])
    except Exception:
        return None
    if end < start or _inclusive_day_count(start, end) != max(1, int(trip_days or 1)):
        return None
    overlaps = overlap_windows if isinstance(overlap_windows, list) else []
    if overlaps and not any(start >= overlap_start and end <= overlap_end for overlap_start, overlap_end in overlaps):
        return None
    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
    }


@app.get("/trips/{trip_id}/availability/overlap")
async def get_availability_overlap(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        trip = await conn.fetchrow(
            "SELECT duration_days FROM trips WHERE id = $1",
            trip_id,
        )
        members = await conn.fetch(
            """
            SELECT tm.user_id, u.name, u.email
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE tm.trip_id = $1 AND tm.status = 'accepted'
            """,
            trip_id,
        )
        windows = await conn.fetch("SELECT user_id, start_date, end_date FROM availability_windows WHERE trip_id = $1", trip_id)
        planning_state_row = await conn.fetchrow(
            "SELECT state FROM trip_planning_states WHERE trip_id = $1",
            trip_id,
        )
    planning_state = _json_obj((planning_state_row["state"] if planning_state_row else {}) or {})
    trip_days = _resolve_required_trip_days(trip, planning_state)
    locked_window = planning_state.get("availability_locked_window") if isinstance(planning_state, dict) else None

    if not members:
        locked_window = _sanitize_locked_availability_window(locked_window, trip_days, [])
        return {
            "overlap": None,
            "overlapping_windows": [],
            "closest_windows": [],
            "member_windows": [],
            "members_total": 0,
            "required_trip_days": trip_days,
            "prompt_members_to_adjust": True,
            "message": "No members found",
            "locked_window": locked_window,
            "is_locked": bool(locked_window),
        }

    member_ids = [str(row["user_id"]) for row in members]
    by_member: dict[str, list[tuple[date, date]]] = {uid: [] for uid in member_ids}
    for row in windows:
        uid = str(row["user_id"])
        if uid in by_member:
            by_member[uid].append((row["start_date"], row["end_date"]))

    member_windows_payload = [
        {
            "user_id": uid,
            "name": str(row["name"] or "").strip() or str(row["email"] or ""),
            "email": row["email"],
            "windows": [
                {"start": start.isoformat(), "end": end.isoformat()}
                for start, end in sorted(by_member.get(uid, []), key=lambda item: (item[0], item[1]))
            ],
        }
        for row, uid in zip(members, member_ids)
    ]

    full_overlap_windows = []
    if all(by_member.get(uid) for uid in member_ids):
        full_overlap_windows = _common_overlap_windows(member_ids, by_member)
    locked_window = _sanitize_locked_availability_window(locked_window, trip_days, full_overlap_windows)
    exact_overlap_windows = _enumerate_trip_windows(full_overlap_windows, trip_days)
    if exact_overlap_windows:
        best_start, best_end = exact_overlap_windows[0]
        overlapping_windows = [
            {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "overlap_days": _inclusive_day_count(start, end),
            }
            for start, end in exact_overlap_windows[:5]
        ]
        return {
            "overlap": {"start": best_start.isoformat(), "end": best_end.isoformat()},
            "overlapping_windows": overlapping_windows,
            "closest_windows": [],
            "member_windows": member_windows_payload,
            "members_total": len(member_ids),
            "required_trip_days": trip_days,
            "prompt_members_to_adjust": False,
            "message": f"Common {trip_days}-day overlap found",
            "locked_window": locked_window,
            "is_locked": bool(locked_window),
        }

    all_windows = [
        {"user_id": uid, "start": start, "end": end}
        for uid, ranges in by_member.items()
        for start, end in ranges
    ]
    suggestions = []
    seen_windows: set[tuple[date, date]] = set()
    for item in all_windows:
        candidate_windows = _enumerate_trip_windows([(item["start"], item["end"])], trip_days)
        for start, end in candidate_windows:
            if (start, end) in seen_windows:
                continue
            seen_windows.add((start, end))
            members_available = []
            for uid in member_ids:
                has_window = any(r[0] <= start and r[1] >= end for r in by_member.get(uid, []))
                if has_window:
                    members_available.append(uid)
            members_to_adjust = [uid for uid in member_ids if uid not in members_available]
            suggestions.append(
                {
                    "window": {"start": start.isoformat(), "end": end.isoformat()},
                    "members_available": members_available,
                    "members_to_adjust": members_to_adjust,
                    "overlap_days": _inclusive_day_count(start, end),
                }
            )
    suggestions.sort(key=lambda item: (-len(item["members_available"]), len(item["members_to_adjust"]), item["window"]["start"]))
    return {
        "overlap": None,
        "overlapping_windows": [],
        "closest_windows": suggestions[:5],
        "member_windows": member_windows_payload,
        "members_total": len(member_ids),
        "required_trip_days": trip_days,
        "prompt_members_to_adjust": True,
        "message": f"No common {trip_days}-day overlap found. Ask some members to adjust dates.",
        "locked_window": locked_window,
        "is_locked": bool(locked_window),
    }


@app.post("/trips/{trip_id}/availability/lock")
async def lock_availability_window(
    trip_id: str,
    body: AvailabilityLockRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    start_raw = str(body.start or "").strip()[:10]
    end_raw = str(body.end or "").strip()[:10]
    if not start_raw or not end_raw:
        raise HTTPException(status_code=422, detail="Missing start/end dates")
    try:
        lock_start = date.fromisoformat(start_raw)
        lock_end = date.fromisoformat(end_raw)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid lock date format")
    if lock_end < lock_start:
        raise HTTPException(status_code=422, detail="Lock end date cannot be before start date")

    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        trip = await conn.fetchrow("SELECT owner_id, duration_days FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if str(trip["owner_id"]) != str(user_id):
            raise HTTPException(status_code=403, detail="Only the trip owner can lock travel dates")
        planning_state_row = await conn.fetchrow(
            "SELECT state FROM trip_planning_states WHERE trip_id = $1",
            trip_id,
        )
        planning_state = _json_obj((planning_state_row["state"] if planning_state_row else {}) or {})
        trip_days = _resolve_required_trip_days(trip, planning_state)

        members = await conn.fetch(
            "SELECT user_id FROM trip_members WHERE trip_id = $1 AND status = 'accepted'",
            trip_id,
        )
        windows = await conn.fetch(
            "SELECT user_id, start_date, end_date FROM availability_windows WHERE trip_id = $1",
            trip_id,
        )
        member_ids = [str(row["user_id"]) for row in members]
        by_member: dict[str, list[tuple[date, date]]] = {uid: [] for uid in member_ids}
        for row in windows:
            uid = str(row["user_id"])
            if uid in by_member:
                by_member[uid].append((row["start_date"], row["end_date"]))

        if not member_ids or not all(by_member.get(uid) for uid in member_ids):
            raise HTTPException(status_code=422, detail="Every accepted member must submit availability before locking dates")

        if _inclusive_day_count(lock_start, lock_end) != trip_days:
            raise HTTPException(status_code=422, detail=f"Locked dates must cover exactly {trip_days} days")

        overlaps = _common_overlap_windows(member_ids, by_member)
        is_within_overlap = any(lock_start >= start and lock_end <= end for start, end in overlaps)
        if not is_within_overlap:
            raise HTTPException(status_code=422, detail="Locked dates must be inside a common overlap window")

        existing = await conn.fetchrow(
            """
            SELECT current_step, state
            FROM trip_planning_states
            WHERE trip_id = $1
            """,
            trip_id,
        )
        existing_state = _json_obj((existing["state"] if existing else {}) or {})
        if not isinstance(existing_state, dict):
            existing_state = {}
        existing_state["availability_locked_window"] = {
            "start": lock_start.isoformat(),
            "end": lock_end.isoformat(),
        }
        existing_state["availability_locked_by"] = str(user_id)
        existing_state["availability_locked_at"] = datetime.now(timezone.utc).isoformat()
        current_step = int((existing["current_step"] if existing else 0) or 0)
        await conn.execute(
            """
            INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
            VALUES ($1, $2, $3::jsonb, $4, NOW())
            ON CONFLICT (trip_id)
            DO UPDATE SET current_step = EXCLUDED.current_step,
                          state = EXCLUDED.state,
                          updated_by = EXCLUDED.updated_by,
                          updated_at = NOW()
            """,
            trip_id,
            current_step,
            json.dumps(existing_state),
            user_id,
        )

    return {
        "locked": True,
        "locked_window": {"start": lock_start.isoformat(), "end": lock_end.isoformat()},
        "locked_by": str(user_id),
    }


@app.put("/trips/{trip_id}/members/{member_user_id}/platform-preference")
async def set_platform_preference(
    trip_id: str,
    member_user_id: str,
    body: PlatformPreferenceRequest,
    user_id: str = Depends(get_current_user_id),
):
    if user_id != member_user_id:
        raise HTTPException(status_code=403, detail="Cannot update another member preference")
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        await conn.execute(
            """
            INSERT INTO member_platform_preferences (trip_id, user_id, platform)
            VALUES ($1, $2, $3)
            ON CONFLICT (trip_id, user_id)
            DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
            """,
            trip_id,
            member_user_id,
            body.platform,
        )
    return {"user_id": member_user_id, "platform": body.platform}


@app.post("/trips/{trip_id}/storyboard/generate")
async def generate_storyboards(trip_id: str, body: StoryboardGenerateRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        members = await conn.fetch(
            """
            SELECT tm.user_id, COALESCE(mpp.platform, 'instagram') AS platform
            FROM trip_members tm
            LEFT JOIN member_platform_preferences mpp
              ON mpp.trip_id = tm.trip_id AND mpp.user_id = tm.user_id
            WHERE tm.trip_id = $1 AND tm.status = 'accepted'
            """,
            trip_id,
        )
        if body.day_id:
            activity_rows = await conn.fetch(
                "SELECT title FROM itinerary_activities WHERE day_id = $1 ORDER BY created_at ASC",
                body.day_id,
            )
        else:
            activity_rows = await conn.fetch(
                """
                SELECT ia.title
                FROM itinerary_activities ia
                JOIN itinerary_days idy ON idy.id = ia.day_id
                WHERE idy.trip_id = $1
                ORDER BY idy.day_number ASC, ia.created_at ASC
                """,
                trip_id,
            )
        destinations = await conn.fetch("SELECT destination FROM bucket_list_items WHERE trip_id = $1 ORDER BY vote_score DESC, created_at ASC LIMIT 1", trip_id)
        destination_name = destinations[0]["destination"] if destinations else "your trip"
        titles = [row["title"] for row in activity_rows]
        generated = []
        for member in members:
            platform = str(member["platform"]).lower()
            content = _storyboard_text(platform, titles, destination_name)
            word_count = len([w for w in content.split() if w.strip()])
            await conn.execute(
                """
                INSERT INTO storyboards (trip_id, user_id, platform, content, word_count)
                VALUES ($1, $2, $3, $4, $5)
                """,
                trip_id,
                member["user_id"],
                platform,
                content,
                word_count,
            )
            generated.append({"user_id": str(member["user_id"]), "platform": platform, "content": content})
    return {"storyboards": generated}


@app.get("/trips/{trip_id}/storyboard/{member_user_id}")
async def get_storyboard(trip_id: str, member_user_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        if user_id != member_user_id:
            raise HTTPException(status_code=403, detail="Cannot view another member storyboard")
        row = await conn.fetchrow(
            """
            SELECT platform, content, word_count, generated_at
            FROM storyboards
            WHERE trip_id = $1 AND user_id = $2
            ORDER BY generated_at DESC
            LIMIT 1
            """,
            trip_id,
            member_user_id,
        )
        if not row:
            raise HTTPException(status_code=404, detail="Storyboard not found")
    return {"storyboard": {"platform": row["platform"], "content": row["content"], "word_count": int(row["word_count"] or 0), "generated_at": row["generated_at"].isoformat()}}


@app.post("/trips/{trip_id}/itinerary/approve")
async def approve_itinerary(trip_id: str, body: ItineraryApproveRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        await conn.execute("UPDATE itinerary_days SET approved = $1 WHERE trip_id = $2", body.approved, trip_id)
        trip = await conn.fetchrow(
            """
            UPDATE trips
            SET status = CASE
                WHEN $2::boolean = true THEN 'active'
                WHEN COALESCE(status, '') IN ('', 'draft', 'saved', 'invited', 'active') THEN 'planning'
                ELSE status
            END
            WHERE id = $1
            RETURNING id, owner_id, name, status, duration_days
            """,
            trip_id,
            body.approved,
        )
    return {
        "approved": body.approved,
        "trip": {
            "id": str(trip["id"]),
            "owner_id": str(trip["owner_id"]),
            "name": str(trip["name"] or ""),
            "status": str(trip["status"] or "planning"),
            "duration_days": int(trip["duration_days"] or 0),
        },
    }


@app.post("/trips/{trip_id}/itinerary/calendar-sync")
async def calendar_sync(trip_id: str, body: CalendarSyncRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        rows = await conn.fetch(
            """
            SELECT ia.id AS activity_id, ia.title, ia.location_name, idy.date, ia.time_slot
            FROM itinerary_activities ia
            JOIN itinerary_days idy ON idy.id = ia.day_id
            WHERE idy.trip_id = $1 AND idy.approved = true
            ORDER BY idy.day_number ASC, ia.time_slot ASC
            """,
            trip_id,
        )
        created = 0
        calendar_base = os.getenv("CALENDAR_API_BASE_URL", "").strip()
        for row in rows:
            slot = str(row["time_slot"] or "09:00-10:00")
            start_part, end_part = slot.split("-", 1) if "-" in slot else ("09:00", "10:00")
            day = row["date"] or date.today()
            start_dt = datetime.combine(day, time.fromisoformat(start_part), tzinfo=timezone.utc)
            end_dt = datetime.combine(day, time.fromisoformat(end_part), tzinfo=timezone.utc)
            if calendar_base:
                payload = {
                    "summary": row["title"],
                    "location": row["location_name"] or "",
                    "start": {"dateTime": start_dt.isoformat()},
                    "end": {"dateTime": end_dt.isoformat()},
                }
                try:
                    _post_calendar_event(calendar_base, body.calendar_id or "primary", payload)
                except (URLError, HTTPError):
                    raise HTTPException(status_code=502, detail="Calendar sync failed")
            await conn.execute(
                """
                INSERT INTO calendar_events (trip_id, activity_id, calendar_id, event_title, start_time, end_time, location, synced_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                """,
                trip_id,
                row["activity_id"],
                body.calendar_id or "primary",
                row["title"],
                start_dt,
                end_dt,
                row["location_name"] or "",
            )
            created += 1
    return {"synced": True, "events_created": created, "provider": body.provider}


@app.get("/trips/{trip_id}/itinerary")
async def get_itinerary(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        day_rows = await conn.fetch(
            """
            SELECT id, day_number, date, title, approved
            FROM itinerary_days
            WHERE trip_id = $1
            ORDER BY day_number ASC
            """,
            trip_id,
        )
        days = []
        for day in day_rows:
            activity_rows = await conn.fetch(
                """
                SELECT id, time_slot, title, category, location_name, cost_estimate
                FROM itinerary_activities
                WHERE day_id = $1
                ORDER BY time_slot ASC
                """,
                day["id"],
            )
            days.append(
                {
                    "day_id": str(day["id"]),
                    "day_number": int(day["day_number"]),
                    "date": day["date"].isoformat() if day["date"] else None,
                    "title": day["title"],
                    "approved": bool(day["approved"]),
                    "activities": [
                        {
                            "activity_id": str(a["id"]),
                            "time_slot": a["time_slot"],
                            "title": a["title"],
                            "category": a["category"],
                            "location": a["location_name"],
                            "cost_estimate": float(a["cost_estimate"] or 0),
                        }
                        for a in activity_rows
                    ],
                }
            )
    return {"itinerary": {"days": days}}


@app.get("/trips/{trip_id}/companion")
async def get_trip_companion(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        await _require_accepted_trip_member(conn, trip_id, user_id)

        trip = await conn.fetchrow(
            "SELECT id, owner_id, name, status, duration_days FROM trips WHERE id = $1",
            trip_id,
        )
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")

        trip_status = str(trip["status"] or "planning").lower()
        if trip_status not in {"active", "completed"}:
            raise HTTPException(status_code=409, detail="Trip is not active yet")

        members = await conn.fetch(
            """
            SELECT
              tm.user_id,
              tm.role,
              tm.status,
              u.name,
              u.email,
              up.display_name
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            LEFT JOIN user_profiles up ON up.user_id = u.id
            WHERE trip_id = $1
            ORDER BY tm.joined_at NULLS FIRST
            """,
            trip_id,
        )
        planning_row = await conn.fetchrow(
            "SELECT current_step, state FROM trip_planning_states WHERE trip_id = $1 ORDER BY updated_at DESC LIMIT 1",
            trip_id,
        )
        day_rows = await conn.fetch(
            """
            SELECT id, day_number, date, title, approved
            FROM itinerary_days
            WHERE trip_id = $1
            ORDER BY day_number ASC
            """,
            trip_id,
        )

        planning_state = _json_obj((planning_row["state"] if planning_row else {}) or {})
        locked_window = planning_state.get("availability_locked_window") if isinstance(planning_state, dict) else None

        day_items: list[dict[str, Any]] = []
        for day in day_rows:
            activity_rows = await conn.fetch(
                """
                SELECT id, time_slot, title, category, location_name
                FROM itinerary_activities
                WHERE day_id = $1
                ORDER BY time_slot ASC, created_at ASC
                """,
                day["id"],
            )
            items = [
                {
                    "activity_id": str(a["id"]),
                    "time_slot": str(a["time_slot"] or ""),
                    "title": str(a["title"] or ""),
                    "category": str(a["category"] or "activity"),
                    "location": str(a["location_name"] or ""),
                }
                for a in activity_rows
            ]
            day_items.append(
                {
                    "day_number": int(day["day_number"] or 0),
                    "date": day["date"].isoformat() if day["date"] else None,
                    "title": str(day["title"] or ""),
                    "approved": bool(day["approved"]),
                    "items": items,
                }
            )

    accepted_members = []
    for idx, m in enumerate(members):
        role = str(m["role"] or "member").lower()
        status = str(m["status"] or "pending").lower()
        if role != "owner" and status != "accepted":
            continue
        display_name = str(m["display_name"] or m["name"] or m["email"] or f"Member {idx + 1}")
        accepted_members.append(
            {
                "user_id": str(m["user_id"]),
                "role": role,
                "status": "accepted" if role == "owner" else status,
                "display_name": display_name,
                "email": str(m["email"] or ""),
            }
        )

    locked_start = _safe_iso_date((locked_window or {}).get("start")) if isinstance(locked_window, dict) else None
    locked_end = _safe_iso_date((locked_window or {}).get("end")) if isinstance(locked_window, dict) else None

    today = date.today()
    current_index = 0
    if day_items:
        dated = []
        for idx, day in enumerate(day_items):
            raw = _safe_iso_date(day.get("date"))
            if raw:
                dated.append((idx, raw))
        if dated:
            on_or_after = [idx for idx, raw in dated if raw >= today]
            current_index = on_or_after[0] if on_or_after else dated[-1][0]

    current_day = day_items[current_index] if day_items else None
    upcoming_days = day_items[current_index + 1 : current_index + 3] if day_items else []
    total_items = sum(len(day.get("items") or []) for day in day_items)
    approved_days = sum(1 for day in day_items if day.get("approved"))

    return {
        "companion": {
            "trip": {
                "id": str(trip["id"]),
                "owner_id": str(trip["owner_id"]),
                "name": str(trip["name"] or ""),
                "status": trip_status,
                "duration_days": int(trip["duration_days"] or 0),
            },
            "locked_window": {
                "start": locked_start.isoformat() if locked_start else None,
                "end": locked_end.isoformat() if locked_end else None,
            },
            "current_step": int((planning_row["current_step"] if planning_row else 0) or 0),
            "members": accepted_members,
            "days": day_items,
            "today": current_day,
            "upcoming": upcoming_days,
            "stats": {
                "day_count": len(day_items),
                "approved_days": approved_days,
                "item_count": total_items,
            },
        }
    }


_MEAL_SLOTS = ("Breakfast", "Lunch", "Dinner")
_MEAL_DEFAULT_TIME = {"Breakfast": "08:00", "Lunch": "13:00", "Dinner": "19:00"}
_MEAL_KEYWORD_BOOSTS = {
    "Breakfast": {"breakfast", "brunch", "bakery", "coffee", "cafe"},
    "Lunch": {"lunch", "market", "street", "ramen", "bistro"},
    "Dinner": {"dinner", "fine", "seafood", "steak", "wine"},
}


def _safe_iso_date(raw: Any) -> Optional[date]:
    text = str(raw or "").strip()[:10]
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except Exception:
        return None


def _safe_time_hhmm(raw: Any) -> Optional[time]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        return time.fromisoformat(text[:5])
    except Exception:
        return None


def _slot_times(slot: Any) -> tuple[Optional[time], Optional[time]]:
    text = str(slot or "").strip()
    if "-" not in text:
        return (_safe_time_hhmm(text), None)
    start_raw, end_raw = text.split("-", 1)
    return (_safe_time_hhmm(start_raw), _safe_time_hhmm(end_raw))


def _minutes_of_day(t: Optional[time]) -> Optional[int]:
    if not t:
        return None
    return int(t.hour) * 60 + int(t.minute)


def _hhmm_from_minutes(total_minutes: int) -> str:
    bounded = max(0, min(total_minutes, 23 * 60 + 59))
    h = bounded // 60
    m = bounded % 60
    return f"{h:02d}:{m:02d}"


def _extract_location_hint(raw: Any) -> str:
    text = str(raw or "").strip()
    if not text:
        return ""
    normalized = (
        text.replace("→", "->")
        .replace("|", ",")
        .replace("/", ",")
        .replace(";", ",")
    )
    if "->" in normalized:
        normalized = normalized.split("->", 1)[0]
    if "," in normalized:
        normalized = normalized.split(",", 1)[0]
    return normalized.strip()


def _normalize_place(city: Any, country: Any, fallback: str = "") -> tuple[str, str]:
    c = str(city or "").strip()
    k = str(country or "").strip()
    if not c and fallback:
        c = str(fallback).strip()
    return (c, k)


def _estimate_travel_minutes(
    from_city: str,
    from_country: str,
    to_city: str,
    to_country: str,
) -> int:
    fc = from_city.strip().lower()
    tc = to_city.strip().lower()
    fk = from_country.strip().lower()
    tk = to_country.strip().lower()
    if fc and tc and fc == tc:
        return 12 + (sum(ord(ch) for ch in fc) % 16)  # 12-27 min local transit
    if fk and tk and fk == tk:
        seed = (sum(ord(ch) for ch in (fc + tc + fk)) % 46)
        return 45 + seed  # 45-90 min regional transit
    seed = (sum(ord(ch) for ch in (fc + tc + fk + tk)) % 121)
    return 120 + seed  # 120-240 min major transfer


def _cuisine_from_tags(tags: list[str], default_value: str = "Local") -> str:
    if not tags:
        return default_value
    first = str(tags[0] or "").strip()
    if not first:
        return default_value
    return first.replace("_", " ").replace("-", " ").title()


def _fallback_meal_options(
    meal: str,
    city: str,
    country: str,
    near_poi: str,
    limit: int = 3,
) -> list[dict[str, Any]]:
    base_names = {
        "Breakfast": ["Sunrise Cafe", "Morning Bakery", "Local Breakfast House"],
        "Lunch": ["Market Bistro", "Street Kitchen", "Local Lunch Spot"],
        "Dinner": ["Evening Table", "Harbor Grill", "Chef's Local Kitchen"],
    }
    base_cost = {"Breakfast": 18.0, "Lunch": 32.0, "Dinner": 52.0}
    out: list[dict[str, Any]] = []
    for idx, base in enumerate(base_names.get(meal, [])):
        if len(out) >= limit:
            break
        label_city = city or "City"
        name = f"{label_city} {base}"
        cost = float(base_cost.get(meal, 30.0) + idx * 8)
        out.append(
            {
                "option_id": f"fallback-{meal.lower()}-{idx + 1}",
                "name": name,
                "city": city,
                "country": country,
                "tags": [meal.lower(), "local"],
                "cost": cost,
                "cuisine": "Local",
                "near_poi": near_poi,
            }
        )
    return out


def _meal_candidate_score(
    meal: str,
    candidate: dict[str, Any],
    anchor_city: str,
    anchor_country: str,
) -> float:
    city = str(candidate.get("city") or "").strip().lower()
    country = str(candidate.get("country") or "").strip().lower()
    anchor_city_l = anchor_city.strip().lower()
    anchor_country_l = anchor_country.strip().lower()
    tags = [str(t or "").strip().lower() for t in (candidate.get("tags") or []) if str(t or "").strip()]
    rating = float(candidate.get("rating") or 0)
    cost = float(candidate.get("cost") or 0)

    score = rating * 12.0
    if city and anchor_city_l and city == anchor_city_l:
        score += 80.0
    elif country and anchor_country_l and country == anchor_country_l:
        score += 35.0
    score -= min(cost, 250.0) * 0.06
    if any(token in _MEAL_KEYWORD_BOOSTS.get(meal, set()) for token in tags):
        score += 12.0
    if "food" in tags or "dining" in tags:
        score += 8.0
    return score


def _select_meal_options(
    meal: str,
    anchor_city: str,
    anchor_country: str,
    near_poi: str,
    food_candidates: list[dict[str, Any]],
    limit: int = 3,
) -> list[dict[str, Any]]:
    scored = sorted(
        food_candidates,
        key=lambda c: (-_meal_candidate_score(meal, c, anchor_city, anchor_country), str(c.get("name") or "").lower()),
    )
    picked: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row in scored:
        if len(picked) >= limit:
            break
        name = str(row.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        picked.append(
            {
                "option_id": str(row.get("id") or f"synthetic-{meal.lower()}-{len(picked)+1}"),
                "name": name,
                "city": str(row.get("city") or "").strip(),
                "country": str(row.get("country") or "").strip(),
                "tags": row.get("tags") or [],
                "cost": float(row.get("cost") or 0),
                "cuisine": _cuisine_from_tags(row.get("tags") or []),
                "near_poi": near_poi,
            }
        )
    if len(picked) < limit:
        for extra in _fallback_meal_options(meal, anchor_city, anchor_country, near_poi, limit=limit - len(picked)):
            picked.append(extra)
    return picked[:limit]


@app.get("/trips/{trip_id}/dining/suggestions")
async def dining_suggestions(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        trip_row = await conn.fetchrow(
            "SELECT duration_days, created_at FROM trips WHERE id = $1",
            trip_id,
        )
        planning_state_row = await conn.fetchrow(
            "SELECT state FROM trip_planning_states WHERE trip_id = $1",
            trip_id,
        )
        destination_rows = await conn.fetch(
            """
            SELECT destination, country
            FROM bucket_list_items
            WHERE trip_id = $1
            ORDER BY vote_score DESC, created_at ASC
            LIMIT 20
            """,
            trip_id,
        )
        itinerary_rows = await conn.fetch(
            """
            SELECT idy.day_number, idy.date, ia.title, ia.category, ia.location_name, ia.time_slot
            FROM itinerary_days idy
            LEFT JOIN itinerary_activities ia ON ia.day_id = idy.id
            WHERE idy.trip_id = $1
            ORDER BY idy.day_number ASC, ia.time_slot ASC NULLS LAST, ia.created_at ASC
            """,
            trip_id,
        )
        poi_rows = await conn.fetch(
            """
            SELECT id, name, category, city, country, tags, rating, cost_estimate_usd, approved
            FROM pois
            WHERE trip_id = $1
            ORDER BY approved DESC, rating DESC NULLS LAST, created_at ASC
            """,
            trip_id,
        )

    planning_state = (planning_state_row["state"] or {}) if planning_state_row else {}
    if not isinstance(planning_state, dict):
        planning_state = {}
    locked_window = planning_state.get("availability_locked_window")
    locked_start = _safe_iso_date((locked_window or {}).get("start")) if isinstance(locked_window, dict) else None
    locked_end = _safe_iso_date((locked_window or {}).get("end")) if isinstance(locked_window, dict) else None

    default_duration = int((trip_row["duration_days"] if trip_row else 0) or 0)
    default_duration = max(1, min(default_duration or 3, 21))

    ordered_day_dates: list[date] = []
    day_by_number: dict[int, date] = {}
    for row in itinerary_rows:
        try:
            day_number = int(row["day_number"] or 0)
        except Exception:
            day_number = 0
        day_date = row["date"]
        if day_number > 0 and isinstance(day_date, date):
            if day_number not in day_by_number:
                day_by_number[day_number] = day_date
    if day_by_number:
        ordered_day_dates = [day_by_number[k] for k in sorted(day_by_number.keys())]
    elif locked_start and locked_end and locked_end >= locked_start:
        days_in_window = (locked_end - locked_start).days + 1
        capped_days = max(1, min(days_in_window, default_duration))
        ordered_day_dates = [locked_start + timedelta(days=i) for i in range(capped_days)]
    else:
        base_date = (trip_row["created_at"].date() if trip_row and trip_row["created_at"] else date.today())
        ordered_day_dates = [base_date + timedelta(days=i) for i in range(default_duration)]

    fallback_destinations = [
        {
            "city": str(row["destination"] or "").strip(),
            "country": str(row["country"] or "").strip(),
        }
        for row in destination_rows
        if str(row["destination"] or "").strip()
    ]

    poi_candidates: list[dict[str, Any]] = []
    food_candidates: list[dict[str, Any]] = []
    for row in poi_rows:
        item = {
            "id": str(row["id"]),
            "name": str(row["name"] or "").strip(),
            "category": str(row["category"] or "").strip().lower(),
            "city": str(row["city"] or "").strip(),
            "country": str(row["country"] or "").strip(),
            "tags": row["tags"] or [],
            "rating": float(row["rating"] or 0),
            "cost": float(row["cost_estimate_usd"] or 0),
            "approved": bool(row["approved"]),
        }
        if item["name"]:
            poi_candidates.append(item)
            if item["category"] in {"food", "dining"}:
                food_candidates.append(item)

    if not food_candidates:
        for idx, seed in enumerate(POI_CATALOG.get("food", [])):
            food_candidates.append(
                {
                    "id": f"seed-food-{idx+1}",
                    "name": str(seed.get("name") or "").strip(),
                    "category": "food",
                    "city": str(seed.get("city") or "").strip(),
                    "country": str(seed.get("country") or "").strip(),
                    "tags": list(seed.get("tags") or []),
                    "rating": float(seed.get("rating") or 4.3),
                    "cost": float(seed.get("cost") or 22),
                    "approved": True,
                }
            )

    if not poi_candidates:
        for idx, seed in enumerate(POI_CATALOG.get("culture", [])[:3]):
            poi_candidates.append(
                {
                    "id": f"seed-poi-{idx+1}",
                    "name": str(seed.get("name") or "").strip(),
                    "category": str(seed.get("category") or "culture").lower(),
                    "city": str(seed.get("city") or "").strip(),
                    "country": str(seed.get("country") or "").strip(),
                    "tags": list(seed.get("tags") or []),
                    "rating": float(seed.get("rating") or 4.2),
                    "cost": float(seed.get("cost") or 0),
                    "approved": True,
                }
            )

    activities_by_date: dict[date, list[dict[str, Any]]] = {}
    for row in itinerary_rows:
        title = str(row["title"] or "").strip()
        category = str(row["category"] or "").strip().lower()
        if not title or category == "dining":
            continue
        try:
            day_number = int(row["day_number"] or 0)
        except Exception:
            day_number = 0
        day_date = row["date"]
        if not isinstance(day_date, date) and day_number > 0 and day_number <= len(ordered_day_dates):
            day_date = ordered_day_dates[day_number - 1]
        if not isinstance(day_date, date):
            continue
        start_t, end_t = _slot_times(row["time_slot"])
        location_hint = _extract_location_hint(row["location_name"])
        city_hint = location_hint
        country_hint = ""
        if not city_hint and fallback_destinations:
            city_hint = fallback_destinations[0]["city"]
            country_hint = fallback_destinations[0]["country"]
        activities_by_date.setdefault(day_date, []).append(
            {
                "title": title,
                "city": city_hint,
                "country": country_hint,
                "start": start_t,
                "end": end_t,
            }
        )

    for day_key in list(activities_by_date.keys()):
        activities_by_date[day_key].sort(
            key=lambda item: (_minutes_of_day(item.get("start")) or 0, str(item.get("title") or "").lower())
        )

    suggestions: list[dict[str, Any]] = []
    for day_idx, day_date in enumerate(ordered_day_dates):
        day_number = day_idx + 1
        day_activities = activities_by_date.get(day_date, [])
        fallback_poi = poi_candidates[day_idx % len(poi_candidates)] if poi_candidates else None
        fallback_dest = fallback_destinations[day_idx % len(fallback_destinations)] if fallback_destinations else {"city": "", "country": ""}
        fallback_city = str((fallback_poi or {}).get("city") or fallback_dest.get("city") or "").strip()
        fallback_country = str((fallback_poi or {}).get("country") or fallback_dest.get("country") or "").strip()

        def anchor_for_meal(meal_name: str) -> dict[str, Any]:
            if day_activities:
                if meal_name == "Breakfast":
                    return day_activities[0]
                if meal_name == "Lunch":
                    return day_activities[len(day_activities) // 2]
                return day_activities[-1]
            poi_name = str((fallback_poi or {}).get("name") or f"{fallback_city or 'Destination'} highlights").strip()
            return {
                "title": poi_name,
                "city": fallback_city,
                "country": fallback_country,
                "start": None,
                "end": None,
            }

        prev_anchor = None
        for meal_name in _MEAL_SLOTS:
            anchor = anchor_for_meal(meal_name)
            anchor_city, anchor_country = _normalize_place(
                anchor.get("city"),
                anchor.get("country"),
                fallback_city,
            )
            near_poi = str(anchor.get("title") or fallback_city or "trip highlights").strip()

            default_minutes = _minutes_of_day(_safe_time_hhmm(_MEAL_DEFAULT_TIME[meal_name])) or 12 * 60
            anchor_start = _minutes_of_day(anchor.get("start"))
            anchor_end = _minutes_of_day(anchor.get("end"))
            meal_minutes = default_minutes
            if meal_name == "Breakfast" and anchor_start is not None:
                meal_minutes = max(6 * 60 + 30, anchor_start - 90)
            elif meal_name == "Lunch" and anchor_end is not None:
                meal_minutes = max(11 * 60, anchor_end + 45)
            elif meal_name == "Dinner" and anchor_end is not None:
                meal_minutes = max(18 * 60, anchor_end + 75)
            meal_time = _hhmm_from_minutes(meal_minutes)

            transfer_between_pois = 0
            if prev_anchor:
                transfer_between_pois = _estimate_travel_minutes(
                    str(prev_anchor.get("city") or ""),
                    str(prev_anchor.get("country") or ""),
                    anchor_city,
                    anchor_country,
                )

            options = _select_meal_options(
                meal_name,
                anchor_city,
                anchor_country,
                near_poi,
                food_candidates,
                limit=3,
            )
            enriched_options = []
            for option in options:
                option_city, option_country = _normalize_place(option.get("city"), option.get("country"), anchor_city)
                travel_minutes = _estimate_travel_minutes(anchor_city, anchor_country, option_city, option_country)
                tags = option.get("tags") or []
                enriched_options.append(
                    {
                        "option_id": str(option.get("option_id") or ""),
                        "name": str(option.get("name") or "").strip(),
                        "city": option_city,
                        "country": option_country,
                        "tags": tags,
                        "cost": float(option.get("cost") or 0),
                        "cuisine": _cuisine_from_tags(tags),
                        "near_poi": near_poi,
                        "travel_minutes": int(travel_minutes),
                    }
                )
            if not enriched_options:
                prev_anchor = anchor
                continue

            top = enriched_options[0]
            slot_id = f"{day_date.isoformat()}-{meal_name.lower()}"
            suggestions.append(
                {
                    "id": str(top["option_id"] or slot_id),
                    "slot_id": slot_id,
                    "day": day_number,
                    "date": day_date.isoformat(),
                    "meal": meal_name,
                    "time": meal_time,
                    "name": top["name"],
                    "city": top["city"],
                    "country": top["country"],
                    "tags": top["tags"],
                    "cost": float(top["cost"]),
                    "cuisine": top["cuisine"],
                    "near_poi": near_poi,
                    "travel_from_poi_minutes": int(top["travel_minutes"]),
                    "travel_between_pois_minutes": int(transfer_between_pois),
                    "options": enriched_options,
                }
            )
            prev_anchor = anchor

    window = None
    if ordered_day_dates:
        window = {
            "start": ordered_day_dates[0].isoformat(),
            "end": ordered_day_dates[-1].isoformat(),
        }
    return {"window": window, "suggestions": suggestions}


@app.post("/analytics/event", status_code=202)
async def analytics_event(body: AnalyticsEventRequest):
    client_ts: Optional[datetime] = None
    if body.client_ts:
        try:
            normalized = body.client_ts.replace("Z", "+00:00")
            client_ts = datetime.fromisoformat(normalized)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid client_ts format")
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO analytics_events (session_id, trip_id, user_id, event_type, screen_name, properties, client_ts, server_ts)
            VALUES ($1, NULLIF($2, '')::uuid, NULLIF($3, '')::uuid, $4, $5, $6::jsonb, $7::timestamptz, NOW())
            """,
            body.session_id,
            body.trip_id or "",
            body.user_id or "",
            body.event_type,
            body.screen_name,
            json.dumps(body.properties or {}),
            client_ts,
        )
    return {"accepted": True}

@app.get("/health")
def health():
    return {"status": "ok"}

import logging
import uuid
from contextlib import asynccontextmanager

from core.intent_classifier import ClassificationResult, IntentClassifier, SystemIntent
from core.state_machine import (
    STAGE_AGENT_MAP,
    PlanningStateMachine,
    PlanningStage,
)
from models.trip_context import TripContext, TripMember
from schemas.messages import (
    ActionType,
    AgentID,
    AgentMessage,
    UserPrompt,
    UserReply,
)
from services.event_bus import EventBus
from services.shared_state import SharedStateService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Response formatter â€” converts agent output into simple user questions
# ---------------------------------------------------------------------------

RESPONSE_FORMATTER_PROMPT = """\
You are the user-facing voice of WanderPlan AI.

Given the specialist agent's response payload below, create a SIMPLE question
    from fastapi import FastAPI
    app = FastAPI()

_allowed_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
    @app.get("/health")
    def health():
         return {"status": "ok"}
or confirmation for the user.  The question must be one of:
  - yes/no: "Would you like to include X?"
  - choice:  "Which do you prefer?" with 2-4 labelled options
  - text:    "What city would you like to visit?"
  - number:  "How many days?"
  - date:    "When do you want to depart?"

## Agent Response
{agent_payload}

## Current Trip Context Summary
Destinations: {destinations}
Stage: {stage}

## Rules
- Keep the question under 2 sentences.
- Never overwhelm the user with details â€” distill to one decision.
- If the agent has completed its work with no further input needed, respond
  with a brief summary and set input_type to "none".

Respond in JSON:
{{
  "question_text": "...",
  "input_type": "yes_no" | "choice" | "text" | "number" | "date" | "none",
  "options": [],
  "default": null
}}
"""


class OrchestratorAgent:
    """
    The 15th agent â€” the brain of WanderPlan AI.

    Manages the full trip planning lifecycle by coordinating 14 specialist
    agents through an event-driven architecture.
    """

    def __init__(
        self,
        redis_url: str = "redis://redis:6379/0",
        kafka_bootstrap: str = "kafka:9092",
        llm_client: Any = None,
    ):
        self.state = SharedStateService(redis_url)
        self.bus = EventBus(bootstrap_servers=kafka_bootstrap, client_id="orchestrator")
        self.classifier = IntentClassifier(llm_client)
        self._llm = llm_client

        # In-memory map of trip_id â†’ state machine (also persisted in Redis)
        self._machines: dict[str, PlanningStateMachine] = {}

        # Pending response futures: correlation_id â†’ asyncio.Future
        self._pending: dict[str, Any] = {}

        # Connected WebSocket clients: trip_id â†’ WebSocket
        self._ws_clients: dict[str, list[WebSocket]] = {}

    # -- Lifecycle -----------------------------------------------------------

    async def startup(self):
        await self.state.connect()
        await self.bus.start()

        # Listen for agent responses
        await self.bus.subscribe(
            "agent_responses",
            self._handle_agent_response,
            group_id="orchestrator-responses",
        )

        # Listen for user replies forwarded from the frontend
        await self.bus.subscribe(
            "user_replies",
            self._handle_user_reply,
            group_id="orchestrator-user-replies",
        )

        logger.info("Orchestrator agent started")

    async def shutdown(self):
        await self.bus.stop()
        await self.state.disconnect()

    # -----------------------------------------------------------------------
    # PUBLIC API â€” called by the FastAPI gateway
    # -----------------------------------------------------------------------

    async def start_trip(self, user_id: str, user_name: str) -> TripContext:
        """Initialise a new trip planning session."""
        trip_id = str(uuid.uuid4())
        trip = TripContext(
            trip_id=trip_id,
            owner_id=user_id,
            members=[TripMember(user_id=user_id, name=user_name, role="owner")],
        )
        await self.state.create_trip(trip)

        sm = PlanningStateMachine()
        self._machines[trip_id] = sm

        logger.info("Trip %s created for user %s", trip_id, user_id)
        return trip

    async def handle_user_message(
        self, trip_id: str, user_message: str
    ) -> UserPrompt:
        """
        Main entry point for every user message.

        Flow:
          1. Classify intent
          2. Route to specialist or handle system intent
          3. Format response as a simple question
          4. Return UserPrompt to the frontend
        """
        trip = await self.state.get_trip(trip_id)
        if not trip:
            raise ValueError(f"Trip {trip_id} not found")

        # Save user message
        await self.state.append_message(trip_id, "user", user_message)

        sm = self._machines.get(trip_id)
        if not sm:
            sm = PlanningStateMachine(PlanningStage(trip.current_stage))
            self._machines[trip_id] = sm

        # 1. Classify intent
        classification = await self.classifier.classify(
            user_message=user_message,
            current_stage=sm.current_stage,
            completed_stages=list(sm._completed_stages),
        )

        # 2. Route
        if classification.system_intent:
            return await self._handle_system_intent(
                trip_id, trip, sm, classification
            )

        # Planning-stage intent â†’ dispatch to specialist
        target_stage = classification.planning_stage or sm.current_stage
        return await self._dispatch_to_agent(
            trip_id, trip, sm, target_stage, user_message, classification
        )

    async def get_status(self, trip_id: str) -> dict:
        """Return current planning progress."""
        sm = self._machines.get(trip_id)
        trip = await self.state.get_trip(trip_id)
        return {
            "trip_id": trip_id,
            "state_machine": sm.to_dict() if sm else None,
            "current_stage": trip.current_stage if trip else None,
        }

    # -----------------------------------------------------------------------
    # INTERNAL â€” system intent handling
    # -----------------------------------------------------------------------

    async def _handle_system_intent(
        self,
        trip_id: str,
        trip: TripContext,
        sm: PlanningStateMachine,
        classification: ClassificationResult,
    ) -> UserPrompt:
        intent = classification.system_intent

        if intent == SystemIntent.GREETING:
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text=(
                    "Welcome to WanderPlan AI! Let's plan your perfect trip. "
                    "Where have you always dreamed of going?"
                ),
                input_type="text",
            )

        if intent == SystemIntent.HELP:
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text=(
                    "I help you plan trips step by step â€” from dream destinations "
                    "to a calendar-ready itinerary. Just tell me where you'd like "
                    "to go, and I'll guide you through the rest!"
                ),
                input_type="text",
            )

        if intent == SystemIntent.STATUS:
            pct = sm.progress_pct
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text=(
                    f"Your trip is {pct}% planned. "
                    f"We're currently on: {sm.current_stage.value.replace('_', ' ').title()}. "
                    "Ready to continue?"
                ),
                input_type="yes_no",
            )

        if intent == SystemIntent.UNDO:
            prev_stages = [s for s in sm._completed_stages]
            if prev_stages:
                last = max(prev_stages, key=lambda s: list(PlanningStage).index(s))
                sm.rewind(last)
                await self.state.set_stage(trip_id, sm.current_stage.value)
                return UserPrompt(
                    trip_id=trip_id,
                    stage=sm.current_stage,
                    question_text=(
                        f"I've gone back to the {sm.current_stage.value.replace('_', ' ')} "
                        "stage. What would you like to change?"
                    ),
                    input_type="text",
                )
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text="There's nothing to undo yet. What would you like to do?",
                input_type="text",
            )

        if intent == SystemIntent.RESTART:
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text="Are you sure you want to start over? All progress will be lost.",
                input_type="yes_no",
            )

        # CLARIFICATION / OUT_OF_SCOPE
        return UserPrompt(
            trip_id=trip_id,
            stage=sm.current_stage,
            question_text=(
                "I'm focused on planning your trip. Could you tell me more about "
                "your travel preferences or where you'd like to go?"
            ),
            input_type="text",
        )

    # -----------------------------------------------------------------------
    # INTERNAL â€” specialist agent dispatch
    # -----------------------------------------------------------------------

    async def _dispatch_to_agent(
        self,
        trip_id: str,
        trip: TripContext,
        sm: PlanningStateMachine,
        target_stage: PlanningStage,
        user_message: str,
        classification: ClassificationResult,
    ) -> UserPrompt:
        """
        Send a request to the specialist agent responsible for `target_stage`,
        wait for its response, then format as a user prompt.
        """
        import asyncio

        target_agent = STAGE_AGENT_MAP.get(target_stage)
        if not target_agent:
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text="Something went wrong. Let's try that again â€” what would you like to do?",
                input_type="text",
            )

        correlation_id = str(uuid.uuid4())

        # Create a future so we can await the agent's async response
        loop = asyncio.get_event_loop()
        future = loop.create_future()
        self._pending[correlation_id] = future

        # Build and publish the request
        request = AgentMessage(
            trip_id=trip_id,
            agent_id=AgentID.ORCHESTRATOR,
            action=ActionType.REQUEST,
            payload={
                "target_agent": target_agent.value,
                "user_message": user_message,
                "entities": classification.extracted_entities,
                "stage": target_stage.value,
            },
            correlation_id=correlation_id,
            stage=target_stage,
        )
        await self.bus.publish("agent_requests", request)
        logger.info(
            "Dispatched to %s (correlation=%s)", target_agent.value, correlation_id
        )

        # Wait for response (with timeout)
        try:
            response: AgentMessage = await asyncio.wait_for(future, timeout=30.0)
        except asyncio.TimeoutError:
            self._pending.pop(correlation_id, None)
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text=(
                    "The planning agent took too long. "
                    "Would you like to try again?"
                ),
                input_type="yes_no",
            )
        finally:
            self._pending.pop(correlation_id, None)

        # Check if agent needs more user input or is done
        if response.requires_user_input:
            return await self._format_agent_response(trip_id, trip, sm, response)
        else:
            # Agent completed â€” advance the state machine
            sm.advance()
            await self.state.set_stage(trip_id, sm.current_stage.value)
            await self.state.mark_agent_complete(trip_id, target_agent.value)

            if sm.is_complete:
                return UserPrompt(
                    trip_id=trip_id,
                    stage=PlanningStage.COMPLETED,
                    question_text=(
                        "Your trip plan is complete! Would you like to export "
                        "it to your calendar?"
                    ),
                    input_type="yes_no",
                )

            # Auto-advance to next stage prompt
            next_agent = STAGE_AGENT_MAP.get(sm.current_stage)
            return UserPrompt(
                trip_id=trip_id,
                stage=sm.current_stage,
                question_text=(
                    f"Great, {target_stage.value.replace('_', ' ')} is done! "
                    f"Let's move on to {sm.current_stage.value.replace('_', ' ')}. "
                    "Ready?"
                ),
                input_type="yes_no",
            )

    async def _format_agent_response(
        self,
        trip_id: str,
        trip: TripContext,
        sm: PlanningStateMachine,
        response: AgentMessage,
    ) -> UserPrompt:
        """Use LLM to distill the agent's payload into a simple user question."""
        import json

        prompt = RESPONSE_FORMATTER_PROMPT.format(
            agent_payload=json.dumps(response.payload, default=str),
            destinations=", ".join(trip.bucket_list) or "not set yet",
            stage=sm.current_stage.value,
        )

        raw = await self._llm.acomplete(prompt)

        try:
            text = raw.strip()
            if text.startswith("```"):
                text = "\n".join(text.split("\n")[1:])
            if text.endswith("```"):
                text = "\n".join(text.split("\n")[:-1])
            data = json.loads(text)
        except (json.JSONDecodeError, Exception):
            data = {
                "question_text": response.payload.get(
                    "summary", "How would you like to proceed?"
                ),
                "input_type": "text",
                "options": [],
            }

        return UserPrompt(
            trip_id=trip_id,
            stage=sm.current_stage,
            question_text=data["question_text"],
            input_type=data.get("input_type", "text"),
            options=data.get("options", []),
            default=data.get("default"),
        )

    # -----------------------------------------------------------------------
    # INTERNAL â€” Kafka consumer callbacks
    # -----------------------------------------------------------------------

    async def _handle_agent_response(self, message: AgentMessage) -> None:
        """Resolve the pending future for the correlation_id."""
        cid = message.correlation_id
        if cid and cid in self._pending:
            future = self._pending[cid]
            if not future.done():
                future.set_result(message)

    async def _handle_user_reply(self, message: AgentMessage) -> None:
        """Process a user reply forwarded from the frontend via Kafka."""
        trip_id = message.trip_id
        user_text = message.payload.get("answer", "")
        if user_text:
            prompt = await self.handle_user_message(trip_id, user_text)
            # Push prompt back to frontend via WebSocket or Kafka
            ws_list = self._ws_clients.get(trip_id, [])
            for ws in ws_list:
                await ws.send_json(prompt.model_dump(mode="json"))

    # -----------------------------------------------------------------------
    # FastAPI application
    # -----------------------------------------------------------------------

    def create_app(self) -> FastAPI:
        orch = self

        @asynccontextmanager
        async def lifespan(app: FastAPI):
            await orch.startup()
            yield
            await orch.shutdown()

        app = FastAPI(
            title="WanderPlan AI - Orchestrator",
            version="1.0.0",
            lifespan=lifespan,
        )

        @app.get("/health")
        async def health():
            return {"status": "healthy", "agent": "orchestrator"}

        @app.post("/trips")
        async def create_trip(user_id: str, user_name: str):
            trip = await orch.start_trip(user_id, user_name)
            return trip.model_dump(mode="json")

        @app.post("/trips/{trip_id}/message")
        async def send_message(trip_id: str, body: dict):
            prompt = await orch.handle_user_message(trip_id, body["message"])
            return prompt.model_dump(mode="json")

        @app.get("/trips/{trip_id}/status")
        async def trip_status(trip_id: str):
            return await orch.get_status(trip_id)

        @app.websocket("/trips/{trip_id}/ws")
        async def websocket_endpoint(websocket: WebSocket, trip_id: str):
            await websocket.accept()
            orch._ws_clients.setdefault(trip_id, []).append(websocket)
            try:
                while True:
                    data = await websocket.receive_json()
                    prompt = await orch.handle_user_message(
                        trip_id, data.get("message", "")
                    )
                    await websocket.send_json(prompt.model_dump(mode="json"))
            except WebSocketDisconnect:
                orch._ws_clients[trip_id].remove(websocket)

        return app
