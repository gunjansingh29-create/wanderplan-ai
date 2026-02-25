"""
WanderPlan AI - Shared State Service
Redis-backed trip session store with atomic read/write operations.
All agents access the evolving trip plan through this service.
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

import redis.asyncio as redis

from models.trip_context import TripContext


class SharedStateService:
    """
    Provides atomic, JSON-serialised access to the TripContext stored in Redis.
    Key format: trip:{trip_id}
    Uses Redis JSON (RedisJSON module) or plain string serialisation fallback.
    """

    KEY_PREFIX = "trip:"
    LOCK_PREFIX = "lock:trip:"
    TTL_SECONDS = 86400 * 7  # 7-day session expiry

    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self._redis: Optional[redis.Redis] = None
        self._redis_url = redis_url

    async def connect(self):
        self._redis = redis.from_url(
            self._redis_url, decode_responses=True
        )

    async def disconnect(self):
        if self._redis:
            await self._redis.close()

    # -- CRUD ----------------------------------------------------------------

    async def create_trip(self, trip: TripContext) -> TripContext:
        key = f"{self.KEY_PREFIX}{trip.trip_id}"
        await self._redis.set(
            key,
            trip.model_dump_json(),
            ex=self.TTL_SECONDS,
        )
        return trip

    async def get_trip(self, trip_id: str) -> Optional[TripContext]:
        key = f"{self.KEY_PREFIX}{trip_id}"
        raw = await self._redis.get(key)
        if raw is None:
            return None
        return TripContext.model_validate_json(raw)

    async def update_trip(self, trip_id: str, updates: dict[str, Any]) -> TripContext:
        """
        Atomic read-modify-write with an advisory lock.
        `updates` is a dict of top-level TripContext fields to merge.
        """
        lock_key = f"{self.LOCK_PREFIX}{trip_id}"
        lock = self._redis.lock(lock_key, timeout=5)

        async with lock:
            trip = await self.get_trip(trip_id)
            if trip is None:
                raise ValueError(f"Trip {trip_id} not found")

            data = trip.model_dump()
            for field, value in updates.items():
                if field in data:
                    if isinstance(data[field], list) and isinstance(value, list):
                        # Append semantics for lists
                        data[field].extend(value)
                    elif isinstance(data[field], dict) and isinstance(value, dict):
                        # Merge semantics for dicts
                        data[field].update(value)
                    else:
                        data[field] = value

            data["updated_at"] = datetime.utcnow().isoformat()
            updated_trip = TripContext.model_validate(data)

            key = f"{self.KEY_PREFIX}{trip_id}"
            await self._redis.set(
                key,
                updated_trip.model_dump_json(),
                ex=self.TTL_SECONDS,
            )
            return updated_trip

    async def set_field(self, trip_id: str, field: str, value: Any) -> None:
        """Overwrite a single field atomically."""
        await self.update_trip(trip_id, {field: value})

    async def delete_trip(self, trip_id: str) -> bool:
        key = f"{self.KEY_PREFIX}{trip_id}"
        return bool(await self._redis.delete(key))

    # -- Stage management ----------------------------------------------------

    async def set_stage(self, trip_id: str, stage: str) -> None:
        await self.set_field(trip_id, "current_stage", stage)

    async def mark_agent_complete(self, trip_id: str, agent_id: str) -> None:
        trip = await self.get_trip(trip_id)
        if trip:
            trip.agent_completions[agent_id] = True
            await self.update_trip(trip_id, {
                "agent_completions": trip.agent_completions
            })

    # -- Conversation history ------------------------------------------------

    async def append_message(
        self, trip_id: str, role: str, content: str
    ) -> None:
        trip = await self.get_trip(trip_id)
        if trip:
            trip.conversation_history.append(
                {"role": role, "content": content, "ts": datetime.utcnow().isoformat()}
            )
            # Keep last 100 messages
            if len(trip.conversation_history) > 100:
                trip.conversation_history = trip.conversation_history[-100:]
            key = f"{self.KEY_PREFIX}{trip_id}"
            await self._redis.set(key, trip.model_dump_json(), ex=self.TTL_SECONDS)
