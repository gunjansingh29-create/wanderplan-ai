from __future__ import annotations

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
from fastapi import FastAPI
app = FastAPI()
@app.get("/health")
def health():
    return {"status": "ok"}

import logging
import uuid
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

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
# Response formatter — converts agent output into simple user questions
# ---------------------------------------------------------------------------

RESPONSE_FORMATTER_PROMPT = """\
You are the user-facing voice of WanderPlan AI.

Given the specialist agent's response payload below, create a SIMPLE question
    from fastapi import FastAPI
    app = FastAPI()
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
- Never overwhelm the user with details — distill to one decision.
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
    The 15th agent — the brain of WanderPlan AI.

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

        # In-memory map of trip_id → state machine (also persisted in Redis)
        self._machines: dict[str, PlanningStateMachine] = {}

        # Pending response futures: correlation_id → asyncio.Future
        self._pending: dict[str, Any] = {}

        # Connected WebSocket clients: trip_id → WebSocket
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
    # PUBLIC API — called by the FastAPI gateway
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

        # Planning-stage intent → dispatch to specialist
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
    # INTERNAL — system intent handling
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
                    "I help you plan trips step by step — from dream destinations "
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
    # INTERNAL — specialist agent dispatch
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
                question_text="Something went wrong. Let's try that again — what would you like to do?",
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
            # Agent completed — advance the state machine
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
    # INTERNAL — Kafka consumer callbacks
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
