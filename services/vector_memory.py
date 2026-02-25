"""
WanderPlan AI - Vector Memory Service
Per-agent vector store (Pinecone) for trip-specific knowledge retrieval.
Each agent maintains its own namespace for semantic search over trip data.
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional

from pinecone import Pinecone, ServerlessSpec

logger = logging.getLogger(__name__)


class VectorMemoryStore:
    """
    Wraps Pinecone to give each agent a namespaced vector memory.

    Each agent stores embeddings scoped to a trip_id namespace, enabling:
      - Semantic search over past user preferences
      - Retrieval of similar POIs, itineraries, dining options
      - Context-aware responses grounded in trip-specific knowledge
    """

    def __init__(
        self,
        api_key: str,
        index_name: str = "wanderplan",
        dimension: int = 1536,             # OpenAI text-embedding-3-small
        metric: str = "cosine",
        cloud: str = "aws",
        region: str = "us-east-1",
    ):
        self._pc = Pinecone(api_key=api_key)
        self._index_name = index_name
        self._dimension = dimension
        self._metric = metric
        self._cloud = cloud
        self._region = region
        self._index = None

    async def initialise(self):
        """Create the index if it doesn't exist, then connect."""
        existing = [idx.name for idx in self._pc.list_indexes()]
        if self._index_name not in existing:
            self._pc.create_index(
                name=self._index_name,
                dimension=self._dimension,
                metric=self._metric,
                spec=ServerlessSpec(cloud=self._cloud, region=self._region),
            )
            logger.info("Created Pinecone index: %s", self._index_name)

        self._index = self._pc.Index(self._index_name)

    # -- Write ---------------------------------------------------------------

    async def upsert(
        self,
        agent_id: str,
        trip_id: str,
        texts: list[str],
        embeddings: list[list[float]],
        metadata_list: list[dict[str, Any]] | None = None,
    ) -> int:
        """
        Store embeddings with metadata in the agent's trip namespace.
        Returns the number of vectors upserted.
        """
        namespace = f"{agent_id}:{trip_id}"
        vectors = []
        for i, (text, emb) in enumerate(zip(texts, embeddings)):
            vec_id = hashlib.sha256(f"{namespace}:{text}".encode()).hexdigest()[:32]
            meta = (metadata_list[i] if metadata_list else {})
            meta.update({"text": text, "agent_id": agent_id, "trip_id": trip_id})
            vectors.append({"id": vec_id, "values": emb, "metadata": meta})

        self._index.upsert(vectors=vectors, namespace=namespace)
        logger.debug("Upserted %d vectors to ns=%s", len(vectors), namespace)
        return len(vectors)

    # -- Read ----------------------------------------------------------------

    async def query(
        self,
        agent_id: str,
        trip_id: str,
        query_embedding: list[float],
        top_k: int = 5,
        filter_metadata: dict | None = None,
    ) -> list[dict[str, Any]]:
        """
        Semantic search within the agent's trip namespace.
        Returns list of {id, score, metadata} dicts.
        """
        namespace = f"{agent_id}:{trip_id}"
        results = self._index.query(
            vector=query_embedding,
            top_k=top_k,
            namespace=namespace,
            include_metadata=True,
            filter=filter_metadata,
        )
        return [
            {
                "id": match.id,
                "score": match.score,
                "metadata": match.metadata,
            }
            for match in results.matches
        ]

    # -- Delete --------------------------------------------------------------

    async def clear_trip(self, agent_id: str, trip_id: str) -> None:
        """Remove all vectors for a specific trip from this agent's namespace."""
        namespace = f"{agent_id}:{trip_id}"
        self._index.delete(delete_all=True, namespace=namespace)
        logger.info("Cleared namespace %s", namespace)
