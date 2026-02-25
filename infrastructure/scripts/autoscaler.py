#!/usr/bin/env python3
"""
WanderPlan AI — Container Autoscaler
Replaces AWS ECS Fargate Auto-Scaling Policies

Monitors CPU, memory, and Kafka consumer lag via Prometheus, then scales
agent containers up/down using the Docker API.

Scaling policies:
  - CPU > 70%  for 2 minutes  → scale up
  - CPU < 20%  for 5 minutes  → scale down
  - Kafka lag > 100 messages  → scale up
  - Memory > 80%              → scale up
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field

import docker
import httpx

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [autoscaler] %(levelname)s %(message)s",
)
log = logging.getLogger("autoscaler")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://prometheus:9090")
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "30"))
SCALE_UP_CPU = float(os.getenv("SCALE_UP_CPU_THRESHOLD", "70"))
SCALE_DOWN_CPU = float(os.getenv("SCALE_DOWN_CPU_THRESHOLD", "20"))
SCALE_UP_MEMORY = float(os.getenv("SCALE_UP_MEMORY_THRESHOLD", "80"))
SCALE_UP_QUEUE_DEPTH = int(os.getenv("SCALE_UP_QUEUE_DEPTH", "100"))
MIN_REPLICAS = int(os.getenv("MIN_REPLICAS", "1"))
MAX_REPLICAS = int(os.getenv("MAX_REPLICAS", "5"))
COOLDOWN_SECONDS = int(os.getenv("COOLDOWN_SECONDS", "120"))
SCALE_UP_SUSTAINED = int(os.getenv("SCALE_UP_SUSTAINED_CHECKS", "4"))    # 4 × 30s = 2min
SCALE_DOWN_SUSTAINED = int(os.getenv("SCALE_DOWN_SUSTAINED_CHECKS", "10"))  # 10 × 30s = 5min

# Agent services that can be scaled (orchestrator has special handling)
SCALABLE_AGENTS = [
    "bucket-list", "timing", "interest-profiler", "health-accessibility",
    "poi-discovery", "duration-optimizer", "availability", "budget",
    "flight", "accommodation", "dining", "itinerary", "calendar",
    "group-coordinator",
]

ORCHESTRATOR_SERVICE = "orchestrator"

# ---------------------------------------------------------------------------
# State tracking
# ---------------------------------------------------------------------------

@dataclass
class AgentMetrics:
    cpu_pct: float = 0.0
    memory_pct: float = 0.0
    kafka_lag: int = 0
    error_rate: float = 0.0
    current_replicas: int = 1

@dataclass
class ScaleState:
    high_cpu_count: int = 0
    low_cpu_count: int = 0
    high_memory_count: int = 0
    high_lag_count: int = 0
    last_scale_time: float = 0.0

agent_states: dict[str, ScaleState] = {}

# ---------------------------------------------------------------------------
# Prometheus queries
# ---------------------------------------------------------------------------

async def query_prometheus(client: httpx.AsyncClient, query: str) -> dict:
    """Execute a PromQL instant query."""
    try:
        resp = await client.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": query},
            timeout=10.0,
        )
        data = resp.json()
        if data.get("status") == "success":
            return data.get("data", {}).get("result", [])
    except Exception as e:
        log.warning("Prometheus query failed: %s", e)
    return []


async def get_agent_metrics(client: httpx.AsyncClient) -> dict[str, AgentMetrics]:
    """Fetch current metrics for all agents from Prometheus."""
    metrics: dict[str, AgentMetrics] = {}

    # CPU usage per container
    cpu_results = await query_prometheus(
        client,
        'rate(container_cpu_usage_seconds_total{name=~"wanderplan-.*"}[2m]) * 100'
    )
    for r in cpu_results:
        name = r["metric"].get("name", "").replace("wanderplan-", "")
        if name:
            metrics.setdefault(name, AgentMetrics()).cpu_pct = float(r["value"][1])

    # Memory usage per container
    mem_results = await query_prometheus(
        client,
        'container_memory_usage_bytes{name=~"wanderplan-.*"} / container_spec_memory_limit_bytes{name=~"wanderplan-.*"} * 100'
    )
    for r in mem_results:
        name = r["metric"].get("name", "").replace("wanderplan-", "")
        if name:
            metrics.setdefault(name, AgentMetrics()).memory_pct = float(r["value"][1])

    # Kafka consumer lag
    lag_results = await query_prometheus(
        client,
        'sum(kafka_consumer_group_lag) by (group)'
    )
    for r in lag_results:
        group = r["metric"].get("group", "")
        # Map consumer group to agent name
        for agent in SCALABLE_AGENTS:
            if agent.replace("-", "_") in group or agent in group:
                metrics.setdefault(agent, AgentMetrics()).kafka_lag = int(float(r["value"][1]))

    return metrics

# ---------------------------------------------------------------------------
# Docker scaling
# ---------------------------------------------------------------------------

def get_docker_client() -> docker.DockerClient:
    return docker.DockerClient(base_url="unix:///var/run/docker.sock")


def get_current_replicas(docker_client: docker.DockerClient, service_name: str) -> int:
    """Count running containers for a service."""
    containers = docker_client.containers.list(
        filters={"name": f"wanderplan-{service_name}", "status": "running"}
    )
    return len(containers)


def scale_service(docker_client: docker.DockerClient, service_name: str, target: int) -> bool:
    """Scale a service by starting or stopping containers."""
    current = get_current_replicas(docker_client, service_name)
    if current == target:
        return False

    if target > current:
        log.info("SCALE UP: %s from %d → %d replicas", service_name, current, target)
        # Use docker compose scale via subprocess
        import subprocess
        subprocess.run(
            ["docker", "compose", "-f", "docker-compose.prod.yml",
             "up", "-d", "--scale", f"{service_name}={target}", "--no-recreate"],
            cwd="/app/infrastructure/production",
            capture_output=True,
        )
    elif target < current:
        log.info("SCALE DOWN: %s from %d → %d replicas", service_name, current, target)
        import subprocess
        subprocess.run(
            ["docker", "compose", "-f", "docker-compose.prod.yml",
             "up", "-d", "--scale", f"{service_name}={target}", "--no-recreate"],
            cwd="/app/infrastructure/production",
            capture_output=True,
        )

    return True

# ---------------------------------------------------------------------------
# Scaling decision engine
# ---------------------------------------------------------------------------

def evaluate_scaling(
    agent_name: str,
    metrics: AgentMetrics,
    state: ScaleState,
) -> int | None:
    """
    Returns target replica count, or None if no change needed.
    Implements sustained-threshold scaling to avoid flapping.
    """
    now = time.time()

    # Cooldown check
    if now - state.last_scale_time < COOLDOWN_SECONDS:
        return None

    current = metrics.current_replicas

    # --- Scale UP conditions ---
    needs_up = False

    if metrics.cpu_pct > SCALE_UP_CPU:
        state.high_cpu_count += 1
    else:
        state.high_cpu_count = max(0, state.high_cpu_count - 1)

    if metrics.memory_pct > SCALE_UP_MEMORY:
        state.high_memory_count += 1
    else:
        state.high_memory_count = max(0, state.high_memory_count - 1)

    if metrics.kafka_lag > SCALE_UP_QUEUE_DEPTH:
        state.high_lag_count += 1
    else:
        state.high_lag_count = max(0, state.high_lag_count - 1)

    if state.high_cpu_count >= SCALE_UP_SUSTAINED:
        needs_up = True
        log.info("%s: CPU %.1f%% sustained over threshold for %d checks",
                 agent_name, metrics.cpu_pct, state.high_cpu_count)

    if state.high_memory_count >= SCALE_UP_SUSTAINED:
        needs_up = True
        log.info("%s: Memory %.1f%% sustained over threshold", agent_name, metrics.memory_pct)

    if state.high_lag_count >= SCALE_UP_SUSTAINED:
        needs_up = True
        log.info("%s: Kafka lag %d sustained over threshold", agent_name, metrics.kafka_lag)

    if needs_up and current < MAX_REPLICAS:
        state.high_cpu_count = 0
        state.high_memory_count = 0
        state.high_lag_count = 0
        state.last_scale_time = now
        return min(current + 1, MAX_REPLICAS)

    # --- Scale DOWN conditions ---
    if metrics.cpu_pct < SCALE_DOWN_CPU and metrics.kafka_lag < 10:
        state.low_cpu_count += 1
    else:
        state.low_cpu_count = 0

    if state.low_cpu_count >= SCALE_DOWN_SUSTAINED and current > MIN_REPLICAS:
        state.low_cpu_count = 0
        state.last_scale_time = now
        return max(current - 1, MIN_REPLICAS)

    return None

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

async def main():
    log.info("WanderPlan Autoscaler starting")
    log.info(
        "Config: CPU_UP=%s%% CPU_DOWN=%s%% MEM_UP=%s%% LAG_UP=%d "
        "MIN=%d MAX=%d INTERVAL=%ds COOLDOWN=%ds",
        SCALE_UP_CPU, SCALE_DOWN_CPU, SCALE_UP_MEMORY, SCALE_UP_QUEUE_DEPTH,
        MIN_REPLICAS, MAX_REPLICAS, CHECK_INTERVAL, COOLDOWN_SECONDS,
    )

    docker_client = get_docker_client()

    async with httpx.AsyncClient() as http_client:
        while True:
            try:
                all_metrics = await get_agent_metrics(http_client)

                for agent_name in SCALABLE_AGENTS + [ORCHESTRATOR_SERVICE]:
                    am = all_metrics.get(agent_name, AgentMetrics())
                    am.current_replicas = get_current_replicas(docker_client, agent_name)

                    state = agent_states.setdefault(agent_name, ScaleState())
                    target = evaluate_scaling(agent_name, am, state)

                    if target is not None:
                        scale_service(docker_client, agent_name, target)

            except Exception:
                log.exception("Autoscaler check failed")

            await asyncio.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main())
