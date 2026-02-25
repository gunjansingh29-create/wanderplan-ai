"""
WanderPlan AI - Event Bus
Kafka-based event-driven communication layer for inter-agent messaging.
Provides both a producer (publish) and consumer (subscribe) interface.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Awaitable, Callable

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from schemas.messages import AgentMessage

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Kafka topics
# ---------------------------------------------------------------------------

TOPICS = {
    "trip_context":     "wanderplan.trip.context",       # shared event stream
    "agent_requests":   "wanderplan.agent.requests",     # orchestrator → agents
    "agent_responses":  "wanderplan.agent.responses",    # agents → orchestrator
    "user_prompts":     "wanderplan.user.prompts",       # orchestrator → frontend
    "user_replies":     "wanderplan.user.replies",       # frontend → orchestrator
    "agent_registry":   "wanderplan.agent.registry",     # agent heartbeats
    "dead_letter":      "wanderplan.dlq",                # failed messages
}

MessageHandler = Callable[[AgentMessage], Awaitable[None]]


class EventBus:
    """
    Thin async wrapper around Kafka for agent-to-agent communication.

    Usage:
        bus = EventBus(bootstrap_servers="kafka:9092")
        await bus.start()

        # Publish
        await bus.publish("trip_context", message)

        # Subscribe
        await bus.subscribe("agent_requests", handler_fn)

        await bus.stop()
    """

    def __init__(
        self,
        bootstrap_servers: str = "kafka:9092",
        client_id: str = "wanderplan",
    ):
        self._bootstrap = bootstrap_servers
        self._client_id = client_id
        self._producer: AIOKafkaProducer | None = None
        self._consumers: list[AIOKafkaConsumer] = []

    async def start(self):
        self._producer = AIOKafkaProducer(
            bootstrap_servers=self._bootstrap,
            client_id=self._client_id,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
            acks="all",
            enable_idempotence=True,
        )
        await self._producer.start()
        logger.info("Kafka producer started")

    async def stop(self):
        if self._producer:
            await self._producer.stop()
        for consumer in self._consumers:
            await consumer.stop()
        logger.info("Kafka event bus stopped")

    # -- Publish -------------------------------------------------------------

    async def publish(self, topic_key: str, message: AgentMessage) -> None:
        """
        Publish an AgentMessage to the named topic.
        The trip_id is used as the partition key for ordering guarantees.
        """
        topic = TOPICS[topic_key]
        value = message.model_dump(mode="json")

        await self._producer.send_and_wait(
            topic=topic,
            key=message.trip_id,
            value=value,
        )
        logger.debug("Published to %s: %s", topic, message.message_id)

    # -- Subscribe -----------------------------------------------------------

    async def subscribe(
        self,
        topic_key: str,
        handler: MessageHandler,
        group_id: str | None = None,
    ) -> None:
        """
        Subscribe to a topic and invoke `handler` for each message.
        Runs in a background task — call from within an asyncio event loop.
        """
        import asyncio

        topic = TOPICS[topic_key]
        consumer = AIOKafkaConsumer(
            topic,
            bootstrap_servers=self._bootstrap,
            group_id=group_id or f"{self._client_id}-{topic_key}",
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
            auto_offset_reset="latest",
            enable_auto_commit=True,
        )
        self._consumers.append(consumer)
        await consumer.start()
        logger.info("Subscribed to %s (group=%s)", topic, group_id)

        async def _consume():
            try:
                async for record in consumer:
                    try:
                        msg = AgentMessage.model_validate(record.value)
                        await handler(msg)
                    except Exception:
                        logger.exception(
                            "Error processing message from %s", topic
                        )
                        # Publish to dead-letter queue
                        await self._send_to_dlq(record.value, topic)
            except asyncio.CancelledError:
                pass

        asyncio.create_task(_consume())

    # -- Dead letter queue ---------------------------------------------------

    async def _send_to_dlq(self, raw_value: dict, source_topic: str) -> None:
        if self._producer:
            dlq_msg = {
                "source_topic": source_topic,
                "original_message": raw_value,
                "error": "processing_failed",
            }
            await self._producer.send_and_wait(
                topic=TOPICS["dead_letter"],
                value=dlq_msg,
            )
