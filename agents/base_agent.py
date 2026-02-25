"""
WanderPlan AI - Base Agent
Abstract base class for all 15 agents in the system.
Each agent runs as an independent FastAPI microservice with:
  - Its own LLM context window
  - Tool access (external APIs)
  - Vector memory store (Pinecone)
  - Event bus connection (Kafka)
  - Shared state access (Redis)
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from typing import Any, Optional

from fastapi import FastAPI
from pydantic import BaseModel

from models.trip_context import TripContext
from schemas.messages import (
    ActionType,
    AgentID,
    AgentMessage,
    AgentRegistration,
    PlanningStage,
    UserPrompt,
)
from services.event_bus import EventBus
from services.shared_state import SharedStateService
from services.vector_memory import VectorMemoryStore

logger = logging.getLogger(__name__)


class AgentConfig(BaseModel):
    """Configuration injected into every agent at startup."""
    agent_id: AgentID
    agent_name: str
    version: str = "1.0.0"
    port: int = 8000
    redis_url: str = "redis://redis:6379/0"
    kafka_bootstrap: str = "kafka:9092"
    pinecone_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"
    llm_temperature: float = 0.3
    llm_max_tokens: int = 4096
    system_prompt: str = ""


class BaseAgent(ABC):
    """
    Abstract base for every WanderPlan agent microservice.

    Subclasses implement:
      - `process(trip_context, message) -> AgentMessage`  (core logic)
      - `system_prompt` property                          (LLM persona)
      - `tools` property                                  (external API tools)
    """

    def __init__(self, config: AgentConfig):
        self.config = config
        self.agent_id = config.agent_id
        self.state = SharedStateService(config.redis_url)
        self.bus = EventBus(
            bootstrap_servers=config.kafka_bootstrap,
            client_id=config.agent_id.value,
        )
        self.memory = VectorMemoryStore(api_key=config.pinecone_api_key)
        self._app: Optional[FastAPI] = None

    # -- Lifecycle -----------------------------------------------------------

    async def startup(self):
        """Connect to infrastructure and register with the orchestrator."""
        await self.state.connect()
        await self.bus.start()
        if self.config.pinecone_api_key:
            await self.memory.initialise()

        # Subscribe to requests addressed to this agent
        await self.bus.subscribe(
            "agent_requests",
            self._handle_request,
            group_id=f"agent-{self.agent_id.value}",
        )

        # Publish registration
        reg = AgentRegistration(
            agent_id=self.agent_id,
            version=self.config.version,
            capabilities=self.capabilities,
            health_endpoint=f"http://{self.agent_id.value}:{self.config.port}/health",
            kafka_topics=["agent_requests", "agent_responses", "trip_context"],
        )
        reg_msg = AgentMessage(
            trip_id="__system__",
            agent_id=self.agent_id,
            action=ActionType.HEARTBEAT,
            payload=reg.model_dump(mode="json"),
        )
        await self.bus.publish("agent_registry", reg_msg)
        logger.info("%s agent started on port %d", self.config.agent_name, self.config.port)

    async def shutdown(self):
        await self.bus.stop()
        await self.state.disconnect()

    # -- Abstract interface --------------------------------------------------

    @property
    @abstractmethod
    def capabilities(self) -> list[str]:
        """List of capability strings for service discovery."""
        ...

    @abstractmethod
    async def process(
        self, trip: TripContext, message: AgentMessage
    ) -> AgentMessage:
        """
        Core agent logic.  Receives the current trip context and an inbound
        request message; returns a response message with updated payload.
        """
        ...

    # -- Helpers for subclasses -----------------------------------------------

    def make_response(
        self,
        trip_id: str,
        payload: dict[str, Any],
        requires_user_input: bool = False,
        correlation_id: str | None = None,
        stage: PlanningStage | None = None,
    ) -> AgentMessage:
        return AgentMessage(
            trip_id=trip_id,
            agent_id=self.agent_id,
            action=ActionType.RESPONSE,
            payload=payload,
            requires_user_input=requires_user_input,
            correlation_id=correlation_id,
            stage=stage,
        )

    def make_user_prompt(
        self,
        trip_id: str,
        question: str,
        stage: PlanningStage,
        input_type: str = "yes_no",
        options: list[str] | None = None,
    ) -> UserPrompt:
        return UserPrompt(
            trip_id=trip_id,
            stage=stage,
            question_text=question,
            input_type=input_type,
            options=options or [],
        )

    async def update_trip_context(
        self, trip_id: str, updates: dict[str, Any]
    ) -> TripContext:
        """Write agent results back to the shared Redis state."""
        trip = await self.state.update_trip(trip_id, updates)
        # Publish update event to the trip_context stream
        event = AgentMessage(
            trip_id=trip_id,
            agent_id=self.agent_id,
            action=ActionType.UPDATE,
            payload=updates,
        )
        await self.bus.publish("trip_context", event)
        return trip

    # -- Internal message handling -------------------------------------------

    async def _handle_request(self, message: AgentMessage) -> None:
        """
        Kafka consumer callback.
        Filters for messages addressed to this agent, then calls `process`.
        """
        # Only handle messages meant for this agent
        if message.payload.get("target_agent") != self.agent_id.value:
            return

        try:
            trip = await self.state.get_trip(message.trip_id)
            if trip is None:
                logger.warning("Trip %s not found, ignoring request", message.trip_id)
                return

            response = await self.process(trip, message)
            await self.bus.publish("agent_responses", response)

        except Exception:
            logger.exception("Error processing request in %s", self.agent_id.value)
            error_msg = AgentMessage(
                trip_id=message.trip_id,
                agent_id=self.agent_id,
                action=ActionType.ERROR,
                payload={"error": "internal_agent_error"},
                correlation_id=message.correlation_id,
            )
            await self.bus.publish("agent_responses", error_msg)

    # -- FastAPI app factory --------------------------------------------------

    def create_app(self) -> FastAPI:
        agent = self

        @asynccontextmanager
        async def lifespan(app: FastAPI):
            await agent.startup()
            yield
            await agent.shutdown()

        app = FastAPI(
            title=f"WanderPlan - {self.config.agent_name}",
            version=self.config.version,
            lifespan=lifespan,
        )

        @app.get("/health")
        async def health():
            return {"status": "healthy", "agent": self.agent_id.value}

        @app.get("/info")
        async def info():
            return {
                "agent_id": self.agent_id.value,
                "name": self.config.agent_name,
                "version": self.config.version,
                "capabilities": self.capabilities,
            }

        self._app = app
        return app
