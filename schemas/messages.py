"""
WanderPlan AI - Message Schemas
Defines the canonical message formats for inter-agent communication via Kafka/RabbitMQ.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AgentID(str, Enum):
    """All 15 agents in the WanderPlan system."""
    ORCHESTRATOR        = "orchestrator"
    BUCKET_LIST         = "bucket_list"
    TIMING              = "timing"
    INTEREST_PROFILER   = "interest_profiler"
    HEALTH_ACCESSIBILITY = "health_accessibility"
    POI_DISCOVERY       = "poi_discovery"
    DURATION_OPTIMIZER  = "duration_optimizer"
    AVAILABILITY        = "availability"
    BUDGET              = "budget"
    FLIGHT              = "flight"
    ACCOMMODATION       = "accommodation"
    DINING              = "dining"
    ITINERARY           = "itinerary"
    CALENDAR            = "calendar"
    GROUP_COORDINATOR   = "group_coordinator"


class ActionType(str, Enum):
    """Standardised action verbs agents use in messages."""
    REQUEST             = "request"           # orchestrator -> specialist
    RESPONSE            = "response"          # specialist -> orchestrator
    UPDATE              = "update"            # any agent -> trip_context stream
    USER_PROMPT         = "user_prompt"       # orchestrator -> frontend
    USER_REPLY          = "user_reply"        # frontend -> orchestrator
    ERROR               = "error"
    HEARTBEAT           = "heartbeat"


class PlanningStage(str, Enum):
    """Linear workflow stages tracked by the orchestrator state machine."""
    BUCKET_LIST  = "bucket_list"
    TIMING       = "timing"
    INTERESTS    = "interests"
    HEALTH       = "health"
    POIS         = "pois"
    DURATION     = "duration"
    AVAILABILITY = "availability"
    BUDGET       = "budget"
    FLIGHTS      = "flights"
    STAYS        = "stays"
    DINING       = "dining"
    ITINERARY    = "itinerary"
    CALENDAR     = "calendar"
    COMPLETED    = "completed"


# ---------------------------------------------------------------------------
# Core message envelope — every Kafka/RabbitMQ message uses this schema
# ---------------------------------------------------------------------------

class AgentMessage(BaseModel):
    """
    Canonical message schema for inter-agent communication.
    Published to Kafka topic `trip_context` or routed via RabbitMQ exchanges.
    """
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trip_id: str
    agent_id: AgentID
    action: ActionType
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    requires_user_input: bool = False
    correlation_id: Optional[str] = None        # links request ↔ response
    stage: Optional[PlanningStage] = None        # current planning stage
    priority: int = Field(default=5, ge=1, le=10)
    ttl_seconds: int = Field(default=300)        # message expiry

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat()}


# ---------------------------------------------------------------------------
# User-facing prompt envelope — simplified yes/no or minimal-input question
# ---------------------------------------------------------------------------

class UserPrompt(BaseModel):
    """Formatted question the orchestrator sends to the frontend."""
    trip_id: str
    stage: PlanningStage
    question_text: str
    input_type: str = "yes_no"                   # yes_no | choice | text | date | number
    options: list[str] = Field(default_factory=list)
    default: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class UserReply(BaseModel):
    """User's answer coming back from the frontend."""
    trip_id: str
    stage: PlanningStage
    answer: str
    raw_input: Optional[str] = None


# ---------------------------------------------------------------------------
# Agent registration / discovery
# ---------------------------------------------------------------------------

class AgentRegistration(BaseModel):
    """Published on startup so the orchestrator knows which agents are alive."""
    agent_id: AgentID
    version: str
    capabilities: list[str]
    health_endpoint: str                         # e.g. http://bucket-list:8001/health
    kafka_topics: list[str]
    registered_at: datetime = Field(default_factory=datetime.utcnow)
