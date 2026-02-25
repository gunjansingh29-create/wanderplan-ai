"""
WanderPlan AI - Intent Classifier
LLM-based classifier that determines user intent and maps it to the
appropriate planning stage or system action.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel

from schemas.messages import PlanningStage


class SystemIntent(str, Enum):
    """Non-planning intents the orchestrator handles directly."""
    GREETING        = "greeting"
    HELP            = "help"
    STATUS          = "status"
    UNDO            = "undo"
    RESTART         = "restart"
    CLARIFICATION   = "clarification"
    OUT_OF_SCOPE    = "out_of_scope"


class ClassificationResult(BaseModel):
    planning_stage: Optional[PlanningStage] = None
    system_intent: Optional[SystemIntent] = None
    confidence: float = 0.0
    extracted_entities: dict = {}
    raw_reasoning: str = ""


# The prompt template used by the orchestrator's LLM call
INTENT_CLASSIFICATION_PROMPT = """\
You are the intent classifier for WanderPlan AI, a travel planning assistant.

Given the user's message and the current planning stage, determine the user's intent.

## Current Planning Stage
{current_stage}

## Completed Stages
{completed_stages}

## User Message
{user_message}

## Instructions
Classify the intent into ONE of the following categories:

### Planning Stage Intents (map to a specialist agent)
- bucket_list: User is talking about dream destinations, wish-list items, or places they want to visit.
- timing: User is discussing when to travel, seasons, months, weather preferences.
- interests: User is describing their interests, activity preferences, travel style.
- health: User mentions health conditions, dietary needs, accessibility, allergies, mobility.
- pois: User asks about specific attractions, landmarks, things to do/see.
- duration: User discusses trip length, number of days, how long to stay.
- availability: User mentions dates they are free, schedule constraints, time-off windows.
- budget: User discusses money, costs, budget limits, spending preferences.
- flights: User asks about flights, airlines, airports, air travel.
- stays: User asks about hotels, hostels, Airbnb, accommodation.
- dining: User asks about restaurants, food, meals, cuisine.
- itinerary: User wants a day-by-day plan, schedule, or asks about organizing the trip.
- calendar: User wants to export, sync, or save the plan to a calendar.

### System Intents (handled by orchestrator directly)
- greeting: User says hello or starts a conversation.
- help: User asks what the system can do or needs guidance.
- status: User asks about progress or current plan state.
- undo: User wants to go back and change a previous decision.
- restart: User wants to start over.
- clarification: User is responding to a previous question with an answer.
- out_of_scope: Message is unrelated to travel planning.

## Response Format (JSON)
{{
  "intent_type": "planning" | "system",
  "intent_value": "<stage_name or system_intent>",
  "confidence": 0.0-1.0,
  "entities": {{
    "destinations": [],
    "dates": [],
    "budget_amount": null,
    "people_count": null,
    "preferences": []
  }},
  "reasoning": "<one sentence>"
}}
"""


class IntentClassifier:
    """
    Wraps an LLM call to classify user intent.
    The actual LLM client is injected to keep this class testable.
    """

    def __init__(self, llm_client):
        """
        Args:
            llm_client: Any object with an async `acomplete(prompt: str) -> str`
                        method (e.g. LangChain ChatModel wrapper).
        """
        self._llm = llm_client

    async def classify(
        self,
        user_message: str,
        current_stage: PlanningStage,
        completed_stages: list[PlanningStage],
    ) -> ClassificationResult:
        prompt = INTENT_CLASSIFICATION_PROMPT.format(
            current_stage=current_stage.value,
            completed_stages=", ".join(s.value for s in completed_stages),
            user_message=user_message,
        )

        raw = await self._llm.acomplete(prompt)

        return self._parse_response(raw)

    # -- internal ------------------------------------------------------------

    @staticmethod
    def _parse_response(raw: str) -> ClassificationResult:
        import json

        # Strip markdown code fences if present
        text = raw.strip()
        if text.startswith("```"):
            text = "\n".join(text.split("\n")[1:])
        if text.endswith("```"):
            text = "\n".join(text.split("\n")[:-1])

        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return ClassificationResult(
                system_intent=SystemIntent.CLARIFICATION,
                confidence=0.0,
                raw_reasoning="Failed to parse LLM classification output",
            )

        result = ClassificationResult(
            confidence=data.get("confidence", 0.0),
            extracted_entities=data.get("entities", {}),
            raw_reasoning=data.get("reasoning", ""),
        )

        if data.get("intent_type") == "planning":
            try:
                result.planning_stage = PlanningStage(data["intent_value"])
            except ValueError:
                result.system_intent = SystemIntent.CLARIFICATION
        else:
            try:
                result.system_intent = SystemIntent(data["intent_value"])
            except ValueError:
                result.system_intent = SystemIntent.CLARIFICATION

        return result
