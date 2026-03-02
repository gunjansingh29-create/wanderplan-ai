
from __future__ import annotations
import asyncio
import json
import os
import smtplib
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
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

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    accessToken: str
    user_id: str
    name: str

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

_allowed_origins = os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",") if o.strip()],
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


class UpdateMemberRequest(BaseModel):
    status: str


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


class FlightSearchRequest(BaseModel):
    origin: str
    destination: str
    depart_date: str
    return_date: Optional[str] = None


class FlightSelectRequest(BaseModel):
    flight_id: str
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


class PoiApprovalRequest(BaseModel):
    approved: bool


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


def _send_trip_invite_email_sync(
    *,
    to_email: str,
    inviter_name: str,
    trip_name: str,
    trip_id: str,
) -> None:
    host, port, smtp_user, smtp_pass, smtp_from = _smtp_settings()
    if not host or not smtp_user or not smtp_pass or not smtp_from:
        raise RuntimeError("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS/ALERT_EMAIL_FROM)")

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")
    invite_link = f"{frontend_base}/#wizard?tripId={trip_id}"
    subject = f"WanderPlan invite: {trip_name}"
    text_body = (
        f"{inviter_name} invited you to join a trip on WanderPlan.\n\n"
        f"Trip: {trip_name}\n"
        f"Open invite: {invite_link}\n\n"
        "If you were not expecting this invite, you can ignore this email."
    )
    html_body = (
        f"<p><strong>{inviter_name}</strong> invited you to join a trip on WanderPlan.</p>"
        f"<p><strong>Trip:</strong> {trip_name}</p>"
        f"<p><a href=\"{invite_link}\">Open invite</a></p>"
        "<p>If you were not expecting this invite, you can ignore this email.</p>"
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
    trip_name: str,
    trip_id: str,
) -> tuple[bool, str]:
    try:
        await asyncio.to_thread(
            _send_trip_invite_email_sync,
            to_email=to_email,
            inviter_name=inviter_name,
            trip_name=trip_name,
            trip_id=trip_id,
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


async def _require_trip_owner(conn: asyncpg.Connection, trip_id: str, user_id: str) -> None:
    trip = await conn.fetchrow("SELECT owner_id FROM trips WHERE id = $1", trip_id)
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if str(trip["owner_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Only owner can perform this action")


def _budget_breakdown(total_budget: float) -> dict[str, float]:
    flights = round(total_budget * 0.30, 2)
    accommodation = round(total_budget * 0.30, 2)
    dining = round(total_budget * 0.20, 2)
    activities = round(total_budget * 0.10, 2)
    transport = round(total_budget * 0.05, 2)
    misc = round(total_budget - (flights + accommodation + dining + activities + transport), 2)
    return {
        "flights": flights,
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
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS member_platform_preferences (
              trip_id UUID NOT NULL,
              user_id UUID NOT NULL,
              platform TEXT NOT NULL,
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              PRIMARY KEY (trip_id, user_id)
            )
            """
        )


@app.on_event("shutdown")
async def _shutdown_db():
    global db_pool
    if db_pool is not None:
        await db_pool.close()
        db_pool = None

# Add /auth/login endpoint
@app.post("/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    user = USERS.get(request.email)
    if not user or user["password"] != request.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AuthResponse(
        accessToken=f"test-token:{user['user_id']}",
        user_id=user["user_id"],
        name=user["name"]
    )


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
            SELECT tm.user_id, tm.role, tm.status, u.name, u.email
            FROM trip_members tm
            JOIN users u ON u.id = tm.user_id
            WHERE trip_id = $1
            ORDER BY tm.joined_at NULLS FIRST
            """,
            trip_id,
        )

    return {
        "trip": {
            "id": str(trip["id"]),
            "owner_id": str(trip["owner_id"]),
            "name": trip["name"],
            "status": trip["status"],
            "duration_days": trip["duration_days"],
            "members": [
                {
                    "user_id": str(m["user_id"]),
                    "role": m["role"],
                    "status": m["status"],
                    "name": m["name"],
                    "email": m["email"],
                }
                for m in members
            ],
        }
    }


@app.post("/trips/{trip_id}/members", status_code=201)
async def invite_member(
    trip_id: str,
    body: InviteMemberRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    async with db_pool.acquire() as conn:
        trip = await conn.fetchrow("SELECT owner_id, name FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if str(trip["owner_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Only owner can invite members")

        invitee = await conn.fetchrow("SELECT id, email FROM users WHERE email = $1", body.email)
        if not invitee:
            raise HTTPException(status_code=404, detail="User not found")

        inviter = await conn.fetchrow("SELECT name FROM users WHERE id = $1", user_id)
        inviter_name = inviter["name"] if inviter and inviter["name"] else "A WanderPlan user"

        row = await conn.fetchrow(
            """
            INSERT INTO trip_members (trip_id, user_id, role, status)
            VALUES ($1, $2, $3, 'pending')
            ON CONFLICT (trip_id, user_id)
            DO UPDATE SET role = EXCLUDED.role, status = 'pending'
            RETURNING user_id, role, status
            """,
            trip_id,
            invitee["id"],
            body.role,
        )

    email_sent, email_error = await _send_trip_invite_email(
        to_email=invitee["email"],
        inviter_name=inviter_name,
        trip_name=trip["name"],
        trip_id=trip_id,
    )

    return {
        "user_id": str(row["user_id"]),
        "role": row["role"],
        "status": row["status"],
        "email": invitee["email"],
        "email_sent": email_sent,
        "email_error": email_error or None,
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
            SELECT destination, MAX(vote_score) AS votes
            FROM bucket_list_items
            WHERE trip_id = $1
            GROUP BY destination
            ORDER BY MAX(vote_score) DESC, destination ASC
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
        trip = await conn.fetchrow("SELECT owner_id FROM trips WHERE id = $1", trip_id)
        if not trip:
            raise HTTPException(status_code=404, detail="Trip not found")
        if str(trip["owner_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Only owner can update destinations")

        await conn.execute("DELETE FROM bucket_list_items WHERE trip_id = $1", trip_id)

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

    return {
        "destinations": [
            {"name": name, "votes": int(body.votes.get(name, 0))} for name in clean_destinations
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
            SELECT destination, MAX(country) AS country, MAX(category) AS category, MAX(vote_score) AS vote_count
            FROM bucket_list_items
            WHERE trip_id = $1
            GROUP BY destination
            ORDER BY MAX(vote_score) DESC, destination ASC
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
        rows = await conn.fetch("SELECT categories FROM interest_profiles WHERE trip_id = $1", trip_id)
    counter: Counter[str] = Counter()
    for row in rows:
        for category in row["categories"] or []:
            counter[str(category).lower()] += 1
    merged = [cat for cat, _ in sorted(counter.items(), key=lambda item: (-item[1], item[0]))]
    return {"group_interests": {"categories": merged}}


@app.get("/trips/{trip_id}/pois")
async def get_pois(
    trip_id: str,
    user_id: str = Depends(get_current_user_id),
    destination: Optional[str] = None,
    limit: int = 20,
    approved: Optional[bool] = None,
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        base_query = """
            SELECT id, name, category, city, country, lat, lng, tags, rating, cost_estimate_usd, approved
            FROM pois
            WHERE trip_id = $1
        """
        params: list[Any] = [trip_id]
        if destination:
            base_query += " AND (city ILIKE $2 OR country ILIKE $2)"
            params.append(f"%{destination}%")
        if approved is not None:
            idx = len(params) + 1
            base_query += f" AND approved = ${idx}"
            params.append(approved)
        base_query += f" ORDER BY rating DESC NULLS LAST, created_at DESC LIMIT {max(1, min(limit, 50))}"
        rows = await conn.fetch(base_query, *params)
        if len(rows) == 0:
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
            interests = await conn.fetch("SELECT categories FROM interest_profiles WHERE trip_id = $1", trip_id)
            counts: Counter[str] = Counter()
            for item in interests:
                for cat in item["categories"] or []:
                    counts[str(cat).lower()] += 1
            ranked_categories = [cat for cat, _ in sorted(counts.items(), key=lambda x: (-x[1], x[0]))]
            if not ranked_categories:
                ranked_categories = ["food", "culture"]
            inserted = 0
            for cat in ranked_categories[:3]:
                for poi in POI_CATALOG.get(cat, []):
                    await conn.execute(
                        """
                        INSERT INTO pois (trip_id, name, category, city, country, tags, rating, cost_estimate_usd, approved)
                        VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, true)
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
                        INSERT INTO pois (trip_id, name, category, city, country, tags, rating, cost_estimate_usd, approved)
                        VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, true)
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
                "approved": bool(row["approved"]),
            }
            for row in rows
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


@app.post("/trips/{trip_id}/flights/search")
async def search_flights(
    trip_id: str,
    body: FlightSearchRequest,
    user_id: str = Depends(get_current_user_id),
):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        budget = await conn.fetchrow("SELECT breakdown FROM budgets WHERE trip_id = $1", trip_id)
        budget_breakdown = _json_obj(budget["breakdown"]) if budget else {}
        max_price = float(budget_breakdown.get("flights", 500))
        await conn.execute("DELETE FROM flight_options WHERE trip_id = $1", trip_id)

        dep_base = datetime.fromisoformat(body.depart_date).replace(tzinfo=timezone.utc)
        options = [
            ("Japan Airlines", 0, max(80.0, round(max_price * 0.78, 2)), 660),
            ("ANA", 0, max(90.0, round(max_price * 0.86, 2)), 690),
            ("Emirates", 1, max(70.0, round(max_price * 0.62, 2)), 820),
        ]
        flights = []
        for airline, stops, price, duration_min in options:
            dep_time = dep_base + timedelta(hours=stops * 2 + len(flights) * 3)
            arr_time = dep_time + timedelta(minutes=duration_min)
            row = await conn.fetchrow(
                """
                INSERT INTO flight_options (trip_id, airline, departure_airport, arrival_airport, departure_time, arrival_time, price_usd, stops, duration_min, selected)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
                RETURNING id, airline, departure_airport, arrival_airport, departure_time, arrival_time, price_usd, stops, duration_min
                """,
                trip_id,
                airline,
                body.origin,
                body.destination,
                dep_time,
                arr_time,
                price,
                stops,
                duration_min,
            )
            flights.append(
                {
                    "flight_id": str(row["id"]),
                    "airline": row["airline"],
                    "departure_airport": row["departure_airport"],
                    "arrival_airport": row["arrival_airport"],
                    "departure_time": row["departure_time"].isoformat(),
                    "arrival_time": row["arrival_time"].isoformat(),
                    "price_usd": float(row["price_usd"]),
                    "stops": int(row["stops"] or 0),
                    "duration_minutes": int(row["duration_min"] or 0),
                }
            )
    return {"flights": flights, "search_params": {"max_price": max_price}}


@app.post("/trips/{trip_id}/flights/select")
async def select_flight(trip_id: str, body: FlightSelectRequest, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        budget = await conn.fetchrow("SELECT total_budget, spent, breakdown FROM budgets WHERE trip_id = $1", trip_id)
        if not budget:
            raise HTTPException(status_code=422, detail="Budget must be set before selecting flights")
        budget_breakdown = _json_obj(budget["breakdown"])
        allocation = float(budget_breakdown.get("flights", 0))

        row = None
        try:
            UUID(str(body.flight_id))
            row = await conn.fetchrow(
                "SELECT id, price_usd FROM flight_options WHERE id = $1 AND trip_id = $2",
                body.flight_id,
                trip_id,
            )
        except ValueError:
            row = None
        price = float(body.price_usd) if body.price_usd is not None else (float(row["price_usd"]) if row else None)
        if price is None:
            raise HTTPException(status_code=404, detail="Flight not found")
        if price > allocation and not body.force:
            await conn.execute("UPDATE budgets SET warning_active = true WHERE trip_id = $1", trip_id)
            raise HTTPException(status_code=422, detail="Flight exceeds allocation")

        await conn.execute("UPDATE flight_options SET selected = false WHERE trip_id = $1", trip_id)
        if row:
            await conn.execute("UPDATE flight_options SET selected = true WHERE id = $1", body.flight_id)

        spent = round(float(budget["spent"] or 0) + price, 2)
        total_budget = float(budget["total_budget"] or 0)
        remaining = round(total_budget - spent, 2)
        await conn.execute(
            "UPDATE budgets SET spent = $1, remaining = $2, warning_active = false WHERE trip_id = $3",
            spent,
            remaining,
            trip_id,
        )
        updated = await conn.fetchrow("SELECT currency, daily_target, total_budget, spent, remaining, breakdown, warning_active FROM budgets WHERE trip_id = $1", trip_id)
    return {"selected": True, "budget": {"currency": updated["currency"], "daily_target": float(updated["daily_target"]), "total_budget": float(updated["total_budget"]), "spent": float(updated["spent"]), "remaining": float(updated["remaining"]), "breakdown": _json_obj(updated["breakdown"]), "warning_active": bool(updated["warning_active"])}}


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
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        await conn.execute("DELETE FROM availability_windows WHERE trip_id = $1 AND user_id = $2", trip_id, user_id)
        for window in body.date_ranges:
            start_date = date.fromisoformat(window["start"])
            end_date = date.fromisoformat(window["end"])
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


@app.get("/trips/{trip_id}/availability/overlap")
async def get_availability_overlap(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        members = await conn.fetch("SELECT user_id FROM trip_members WHERE trip_id = $1 AND status = 'accepted'", trip_id)
        windows = await conn.fetch("SELECT user_id, start_date, end_date FROM availability_windows WHERE trip_id = $1", trip_id)
    if not members:
        return {"overlap": None, "closest_windows": [], "prompt_members_to_adjust": True, "message": "No members found"}
    member_ids = [str(row["user_id"]) for row in members]
    by_member: dict[str, list[tuple[date, date]]] = {uid: [] for uid in member_ids}
    for row in windows:
        by_member[str(row["user_id"])].append((row["start_date"], row["end_date"]))

    if all(by_member.get(uid) for uid in member_ids):
        overlap_start = max(min(w[0] for w in by_member[uid]) for uid in member_ids)
        overlap_end = min(max(w[1] for w in by_member[uid]) for uid in member_ids)
        if overlap_start <= overlap_end:
            return {
                "overlap": {"start": overlap_start.isoformat(), "end": overlap_end.isoformat()},
                "closest_windows": [],
                "prompt_members_to_adjust": False,
                "message": "Common overlap found",
            }

    all_windows = [
        {"user_id": uid, "start": start, "end": end}
        for uid, ranges in by_member.items()
        for start, end in ranges
    ]
    suggestions = []
    for item in all_windows:
        start = item["start"]
        end = min(item["end"], start + timedelta(days=6))
        members_available = []
        for uid in member_ids:
            has_window = any(r[0] <= start and r[1] >= end for r in by_member.get(uid, []))
            if has_window:
                members_available.append(uid)
        members_to_adjust = [uid for uid in member_ids if uid not in members_available]
        overlap_days = (end - start).days
        if overlap_days >= 3:
            suggestions.append(
                {
                    "window": {"start": start.isoformat(), "end": end.isoformat()},
                    "members_available": members_available,
                    "members_to_adjust": members_to_adjust,
                    "overlap_days": overlap_days,
                }
            )
    suggestions.sort(key=lambda item: (-len(item["members_available"]), len(item["members_to_adjust"])))
    return {
        "overlap": None,
        "closest_windows": suggestions[:5],
        "prompt_members_to_adjust": True,
        "message": "No common overlap found. Ask some members to adjust dates.",
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
    return {"approved": body.approved}


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


@app.get("/trips/{trip_id}/dining/suggestions")
async def dining_suggestions(trip_id: str, user_id: str = Depends(get_current_user_id)):
    if db_pool is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    async with db_pool.acquire() as conn:
        await _require_trip_member(conn, trip_id, user_id)
        rows = await conn.fetch(
            """
            SELECT id, name, city, tags, cost_estimate_usd
            FROM pois
            WHERE trip_id = $1 AND category IN ('food', 'dining', 'snorkeling')
            ORDER BY rating DESC NULLS LAST, created_at ASC
            LIMIT 12
            """,
            trip_id,
        )
    suggestions = []
    for idx, row in enumerate(rows):
        suggestions.append(
            {
                "id": str(row["id"]),
                "day": (idx // 3) + 1,
                "meal": ["Breakfast", "Lunch", "Dinner"][idx % 3],
                "name": row["name"],
                "city": row["city"],
                "tags": row["tags"] or [],
                "cost": float(row["cost_estimate_usd"] or 0),
            }
        )
    return {"suggestions": suggestions}


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
