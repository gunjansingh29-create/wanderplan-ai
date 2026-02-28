
from __future__ import annotations
import asyncio
import os
import smtplib
from email.message import EmailMessage
from typing import Any, Optional

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
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


async def get_current_user_id(authorization: str = Header(...)) -> str:
    return _parse_user_id_from_token(authorization)


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
