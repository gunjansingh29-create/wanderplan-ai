"""
WanderPlan AI - Application Settings
Central configuration loaded from environment variables.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application-wide settings loaded from env vars / .env file."""

    # --- Infrastructure ---
    redis_url: str = "redis://redis:6379/0"
    kafka_bootstrap: str = "kafka:9092"
    postgres_dsn: str = "postgresql+asyncpg://wanderplan:wanderplan_dev@postgres:5432/wanderplan"
    mongodb_uri: str = "mongodb://wanderplan:wanderplan_dev@mongodb:27017/wanderplan"
    elasticsearch_url: str = "http://elasticsearch:9200"

    # --- Vector Store ---
    pinecone_api_key: str = ""
    pinecone_index: str = "wanderplan"

    # --- LLM ---
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"
    llm_temperature: float = 0.3
    llm_max_tokens: int = 4096

    # --- External APIs ---
    amadeus_api_key: str = ""
    amadeus_api_secret: str = ""
    google_places_api_key: str = ""
    yelp_api_key: str = ""
    weather_api_key: str = ""

    # --- Auth ---
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 1440  # 24 hours

    # --- App ---
    log_level: str = "INFO"
    environment: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
