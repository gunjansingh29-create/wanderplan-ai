# WanderPlan AI — System Architecture

## 1. Architecture Overview

WanderPlan AI is a multi-agent microservices platform where **15 specialized AI agents** collaborate to produce complete travel plans. A central **Orchestrator Agent** receives all user input, classifies intent, routes to the appropriate specialist, and formats responses as simple yes/no or minimal-input questions.

```
                         ┌──────────────────────────────────────────────────────────────┐
                         │                        CLIENTS                               │
                         │   Next.js Frontend  ·  Mobile App  ·  Third-party Integrations│
                         └──────────────┬───────────────────────────────┬───────────────┘
                                        │ HTTPS / WSS                  │
                                        ▼                              ▼
                         ┌──────────────────────────────────────────────────────────────┐
                         │                    KONG API GATEWAY                          │
                         │  JWT Auth · Rate Limiting · CORS · Request Routing           │
                         │  Port 8080 (public) · Port 8081 (admin)                      │
                         └──────────────────────────┬───────────────────────────────────┘
                                                    │
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              ORCHESTRATOR AGENT (Port 8000)                               │
│                                                                                           │
│  ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────────────────────────┐  │
│  │ Intent Classifier│──▶│  State Machine    │──▶│  Response Formatter                  │  │
│  │ (LLM-based)     │   │  (13-stage FSM)   │   │  (distills to yes/no questions)     │  │
│  └─────────────────┘   └───────────────────┘   └──────────────────────────────────────┘  │
│                                                                                           │
│  Stages: bucket_list → timing → interests → health → POIs → duration →                   │
│          availability → budget → flights → stays → dining → itinerary → calendar          │
└───────────┬───────────────────────┬───────────────────────────────┬───────────────────────┘
            │ Kafka: agent_requests │ Kafka: agent_responses        │ Kafka: trip_context
            ▼                       ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                            APACHE KAFKA EVENT BUS                                         │
│                                                                                           │
│  Topics:                                                                                  │
│  ├── wanderplan.agent.requests    (orchestrator → specialist agents)                      │
│  ├── wanderplan.agent.responses   (specialist agents → orchestrator)                      │
│  ├── wanderplan.trip.context      (any agent → shared event stream)                       │
│  ├── wanderplan.user.prompts      (orchestrator → frontend)                               │
│  ├── wanderplan.user.replies      (frontend → orchestrator)                               │
│  ├── wanderplan.agent.registry    (agent heartbeats / discovery)                          │
│  └── wanderplan.dlq               (dead letter queue for failed messages)                 │
│                                                                                           │
│  Partition key: trip_id (ordering guarantee per trip)                                      │
└───────────────────────────────────────────────────────────────────────────────────────────┘
            │                       │                               │
            ▼                       ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                         14 SPECIALIST AGENT MICROSERVICES                                  │
│                                                                                           │
│  Each agent runs as an independent FastAPI service with:                                   │
│  • Its own LLM context window (Claude via Anthropic API)                                  │
│  • Tool access to external APIs                                                           │
│  • Vector memory store (Pinecone namespace per agent per trip)                             │
│  • Kafka consumer/producer for event-driven communication                                  │
│  • Redis client for shared trip state access                                               │
│                                                                                           │
│  ┌─────────────┐ ┌─────────┐ ┌───────────────┐ ┌──────────────────┐ ┌──────────────┐    │
│  │ 1. Bucket   │ │ 2.Timing│ │ 3. Interest   │ │ 4. Health &      │ │ 5. POI       │    │
│  │    List     │ │         │ │    Profiler   │ │    Accessibility │ │    Discovery  │    │
│  │  :8001      │ │  :8002  │ │  :8003        │ │  :8004           │ │  :8005        │    │
│  └─────────────┘ └─────────┘ └───────────────┘ └──────────────────┘ └──────────────┘    │
│                                                                                           │
│  ┌─────────────┐ ┌───────────┐ ┌────────┐ ┌────────┐ ┌───────────────┐                   │
│  │ 6. Duration │ │ 7. Avail- │ │ 8.     │ │ 9.     │ │ 10. Accommo-  │                   │
│  │  Optimizer  │ │   ability │ │ Budget │ │ Flight │ │     dation    │                   │
│  │  :8006      │ │  :8007    │ │ :8008  │ │ :8009  │ │  :8010        │                   │
│  └─────────────┘ └───────────┘ └────────┘ └────────┘ └───────────────┘                   │
│                                                                                           │
│  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌────────────────┐                               │
│  │ 11.     │ │ 12. Itin- │ │ 13.      │ │ 14. Group      │                               │
│  │ Dining  │ │   erary   │ │ Calendar │ │   Coordinator  │                               │
│  │ :8011   │ │  :8012    │ │ :8013    │ │  :8014         │                               │
│  └─────────┘ └───────────┘ └──────────┘ └────────────────┘                               │
└───────────────────────────────────────────────────────────────────────────────────────────┘
            │                       │                               │
            ▼                       ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA & INFRASTRUCTURE LAYER                                  │
│                                                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │    Redis      │  │  PostgreSQL  │  │   MongoDB    │  │Elasticsearch │  │  Pinecone  │ │
│  │ Trip session  │  │ Users, auth, │  │ Trip plans,  │  │ Full-text    │  │ Vector     │ │
│  │ store, cache  │  │ bookings,    │  │ content,     │  │ search over  │  │ memory per │ │
│  │ :6379         │  │ payments     │  │ templates    │  │ POIs, hotels │  │ agent/trip │ │
│  │              │  │ :5432         │  │ :27017       │  │ :9200        │  │ (cloud)    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                                           │
│  ┌─────────────────────────────┐  ┌────────────────────────────────────┐                  │
│  │  Prometheus + Grafana       │  │  Kafka UI                          │                  │
│  │  Metrics & dashboards       │  │  Message monitoring                │                  │
│  │  :9091 / :3001              │  │  :9090                             │                  │
│  └─────────────────────────────┘  └────────────────────────────────────┘                  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL API INTEGRATIONS                                    │
│                                                                                           │
│  Flights:    Amadeus · Skyscanner · Google Flights · Kiwi                                │
│  Hotels:     Booking.com · Airbnb · Hotels.com · Expedia                                 │
│  POIs:       Google Places · TripAdvisor · Viator · Foursquare                           │
│  Dining:     Yelp · TheFork · Google Places · TripAdvisor                                │
│  Weather:    OpenWeatherMap · WeatherAPI · Visual Crossing                                │
│  Calendars:  Google Calendar API · Microsoft Graph (Outlook)                             │
│  Maps:       Google Maps · Mapbox (routing, distances)                                    │
│  Currency:   Open Exchange Rates · Fixer.io                                              │
│  Health:     WHO travel advisories · CDC vaccination DB                                  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 15 Agents

| #  | Agent                  | ID                     | Port | Stage        | Primary Responsibility                                           | External APIs                          |
|----|------------------------|------------------------|------|--------------|------------------------------------------------------------------|----------------------------------------|
| 1  | Bucket List            | `bucket_list`          | 8001 | bucket_list  | Collect dream destinations, normalize vague wishes               | —                                      |
| 2  | Timing                 | `timing`               | 8002 | timing       | Optimal travel windows (weather, events, pricing)                | Weather APIs, Event calendars          |
| 3  | Interest Profiler      | `interest_profiler`    | 8003 | interests    | Build traveller interest/activity profiles                       | —                                      |
| 4  | Health & Accessibility | `health_accessibility` | 8004 | health       | Dietary, mobility, medical, vaccination requirements             | WHO, CDC                               |
| 5  | POI Discovery          | `poi_discovery`        | 8005 | pois         | Find and rank attractions/activities                             | Google Places, TripAdvisor, Viator     |
| 6  | Duration Optimizer     | `duration_optimizer`   | 8006 | duration     | Recommend trip length from POI count/pace/budget                 | —                                      |
| 7  | Availability           | `availability`         | 8007 | availability | Coordinate schedules, find overlapping windows                   | Google Calendar, Outlook               |
| 8  | Budget                 | `budget`               | 8008 | budget       | Budget planning, category allocation, spend tracking             | Currency APIs, Cost-of-living indices  |
| 9  | Flight                 | `flight`               | 8009 | flights      | Search and compare flights                                       | Amadeus, Skyscanner, Kiwi             |
| 10 | Accommodation          | `accommodation`        | 8010 | stays        | Search hotels, Airbnbs, hostels                                  | Booking.com, Airbnb, Hotels.com       |
| 11 | Dining                 | `dining`               | 8011 | dining       | Restaurant recommendations matching dietary/budget               | Yelp, Google Places, TheFork          |
| 12 | Itinerary              | `itinerary`            | 8012 | itinerary    | Assemble day-by-day plan from all upstream data                  | Google Maps (routing)                  |
| 13 | Calendar               | `calendar`             | 8013 | calendar     | Export itinerary to ICS/Google Calendar/Outlook                  | Google Calendar API, MS Graph          |
| 14 | Group Coordinator      | `group_coordinator`    | 8014 | (cross-stage)| Merge preferences, resolve conflicts for group trips             | —                                      |
| 15 | Orchestrator           | `orchestrator`         | 8000 | (controller) | Intent classification, routing, state machine, response formatting| —                                     |

---

## 3. Orchestrator State Machine

The Orchestrator tracks planning progress through a **13-stage finite state machine** with support for `advance`, `skip`, `rewind`, and `retry` transitions.

```
                    ┌──────────────────────────────────────────────────────────────────┐
                    │                    PLANNING STATE MACHINE                        │
                    │                                                                  │
   ┌────────────┐   │   ┌──────────┐   ┌─────────┐   ┌──────────┐   ┌────────┐       │
   │ USER INPUT │──▶│──▶│ bucket   │──▶│ timing  │──▶│interests │──▶│ health │       │
   └────────────┘   │   │ _list    │   │         │   │          │   │        │       │
                    │   └──────────┘   └─────────┘   └──────────┘   └────┬───┘       │
                    │                                                     │            │
                    │   ┌──────────┐   ┌──────────┐  ┌────────────┐   ┌──▼───┐       │
                    │   │ budget   │◀──│ avail-   │◀─│ duration   │◀──│ POIs │       │
                    │   │          │   │ ability  │  │            │   │      │       │
                    │   └────┬─────┘   └──────────┘  └────────────┘   └──────┘       │
                    │        │                                                        │
                    │   ┌────▼─────┐   ┌──────────┐  ┌────────────┐   ┌──────────┐   │
                    │   │ flights  │──▶│  stays   │─▶│  dining    │──▶│itinerary │   │
                    │   │          │   │          │  │            │   │          │   │
                    │   └──────────┘   └──────────┘  └────────────┘   └────┬─────┘   │
                    │                                                      │          │
                    │   ┌────────────┐   ┌───────────┐                     │          │
                    │   │ COMPLETED  │◀──│ calendar  │◀────────────────────┘          │
                    │   │            │   │           │                                 │
                    │   └────────────┘   └───────────┘                                 │
                    │                                                                  │
                    │  Transitions: advance() · skip() · rewind(target) · retry()      │
                    └──────────────────────────────────────────────────────────────────┘
```

**Transition Rules:**
- `advance()`: Mark current stage complete, move to next stage
- `skip()`: Skip a stage if data was pre-provided (e.g., user gave dates upfront)
- `rewind(target)`: Go back to a previous stage, clearing completions from target onward
- `retry()`: Re-enter the current stage after a transient error (tracks error count)

---

## 4. Message Schema

Every inter-agent message on Kafka follows the `AgentMessage` envelope:

```json
{
  "message_id": "uuid-v4",
  "trip_id": "uuid-v4",
  "agent_id": "bucket_list",
  "action": "request | response | update | user_prompt | user_reply | error | heartbeat",
  "payload": { },
  "timestamp": "2025-04-01T12:00:00Z",
  "requires_user_input": false,
  "correlation_id": "uuid-v4",
  "stage": "bucket_list",
  "priority": 5,
  "ttl_seconds": 300
}
```

**Kafka Topics & Routing:**

| Topic                          | Publisher           | Consumer            | Purpose                          |
|-------------------------------|---------------------|---------------------|----------------------------------|
| `wanderplan.agent.requests`    | Orchestrator        | Specialist agents   | Dispatched work requests         |
| `wanderplan.agent.responses`   | Specialist agents   | Orchestrator        | Agent results / user prompts     |
| `wanderplan.trip.context`      | Any agent           | All agents          | Shared event stream (state changes)|
| `wanderplan.user.prompts`      | Orchestrator        | Frontend            | Questions for the user           |
| `wanderplan.user.replies`      | Frontend            | Orchestrator        | User answers                     |
| `wanderplan.agent.registry`    | All agents          | Orchestrator        | Health/discovery heartbeats      |
| `wanderplan.dlq`               | Event bus           | Ops/monitoring      | Failed message dead-letter queue |

---

## 5. Shared State (Redis)

The full trip plan lives in Redis as a JSON-serialized `TripContext` object, keyed by `trip:{trip_id}`.

```json
{
  "trip_id": "abc-123",
  "owner_id": "user-456",
  "current_stage": "budget",
  "members": [
    {"user_id": "user-456", "name": "Alice", "role": "owner"},
    {"user_id": "user-789", "name": "Bob", "role": "member"}
  ],
  "bucket_list": ["Tokyo", "Kyoto", "Osaka"],
  "timing_results": {
    "preferred_months": ["March", "April"],
    "best_window": {"start": "2025-03-20", "end": "2025-04-05"}
  },
  "interest_profiles": [...],
  "health_flags": [...],
  "pois": [...],
  "duration_days": 14,
  "availability_windows": [{"start": "2025-03-15", "end": "2025-04-15"}],
  "budget": {
    "currency": "USD",
    "daily_target": 200,
    "total_budget": 2800,
    "spent": 0,
    "remaining": 2800,
    "breakdown": {"flights": 840, "accommodation": 840, "dining": 560, "activities": 280, "transport": 140, "misc": 140}
  },
  "flights": [...],
  "hotels": [...],
  "dining": [...],
  "itinerary": [
    {
      "day_number": 1,
      "date": "2025-03-20",
      "city": "Tokyo",
      "theme": "Arrival & Exploration",
      "activities": [...],
      "meals": [...],
      "accommodation": {...},
      "daily_budget_usd": 200
    }
  ],
  "calendar_export": null,
  "agent_completions": {"bucket_list": true, "timing": true, "interests": true}
}
```

**Access Pattern:**
- Atomic read-modify-write with Redis advisory locks
- 7-day TTL with automatic expiry
- List fields use append semantics; dict fields use merge semantics

---

## 6. Agent Runtime Architecture

Each of the 15 agents follows an identical runtime structure:

```
┌──────────────────────────────────────────────────────┐
│                 AGENT MICROSERVICE                    │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              FastAPI Application               │  │
│  │  GET  /health     — liveness probe             │  │
│  │  GET  /info       — capabilities & version     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │            Agent Business Logic                │  │
│  │  • process(trip_context, message) → response   │  │
│  │  • LLM calls (Claude via Anthropic SDK)        │  │
│  │  • External API tool calls                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Kafka   │  │  Redis   │  │  Pinecone        │   │
│  │ Consumer │  │  Client  │  │  Vector Memory   │   │
│  │ Producer │  │ (shared  │  │  (agent:trip_id  │   │
│  │          │  │  state)  │  │   namespace)     │   │
│  └──────────┘  └──────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────┘
```

**Vector Memory (Pinecone):**
- Each agent has its own namespace: `{agent_id}:{trip_id}`
- Used for semantic search over trip-specific knowledge
- 1536-dimension embeddings (text-embedding-3-small compatible)
- Operations: `upsert`, `query`, `clear_trip`

---

## 7. API Gateway (Kong)

```
Internet → Kong :8080 → Agent Services

Route Configuration:
  /api/trips/*           →  orchestrator:8000   (public, JWT required)
  /ws/trips/*            →  orchestrator:8000   (WebSocket upgrade)
  /internal/agents/*     →  individual agents   (internal only, IP restricted)

Global Plugins:
  • JWT Authentication (HS256)
  • Rate Limiting (60 req/min per consumer, Redis-backed)
  • CORS (configurable origins)
  • Request Size Limiting (10 MB)
  • File Logging
  • IP Restriction (internal endpoints only from 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
```

---

## 8. Tech Stack Summary

| Layer              | Technology                    | Purpose                                    |
|-------------------|-------------------------------|-------------------------------------------|
| Frontend           | Next.js (Node.js)             | User interface, WebSocket client          |
| API Gateway        | Kong 3.6 (DB-less mode)       | Auth, rate limiting, routing              |
| Agent Services     | Python 3.12 / FastAPI         | All 15 agent microservices                |
| Agent Framework    | LangChain + Anthropic SDK     | LLM orchestration, tool use, chains      |
| LLM                | Claude (Sonnet/Opus)          | Intent classification, agent reasoning    |
| Messaging          | Apache Kafka (Confluent 7.6)  | Event-driven inter-agent communication    |
| Session Store      | Redis 7                       | Trip context, caching, pub/sub            |
| User/Booking Data  | PostgreSQL 16                 | Users, authentication, bookings, payments |
| Trip Plans/Content | MongoDB 7                     | Trip plan documents, templates, content   |
| Search             | Elasticsearch 8.13            | Full-text search over POIs, hotels, etc.  |
| Vector Store       | Pinecone (Serverless)         | Semantic memory per agent per trip        |
| Observability      | Prometheus + Grafana          | Metrics, dashboards, alerting             |
| Message Monitoring | Kafka UI                      | Visual Kafka topic inspection             |
| Containerisation   | Docker + Docker Compose       | Local dev and deployment                  |

---

## 9. Data Flow Example: Complete Trip Planning Session

```
User: "I want to visit Japan in spring"
  │
  ▼
[Kong Gateway] → JWT validated → rate limit checked
  │
  ▼
[Orchestrator Agent]
  ├── 1. Intent Classifier → planning:bucket_list (confidence: 0.92)
  │      Entities: {destinations: ["Japan"], preferences: ["spring"]}
  │
  ├── 2. State Machine: current_stage = bucket_list
  │
  ├── 3. Dispatch → Kafka: agent_requests → target: bucket_list
  │
  ▼
[Bucket List Agent]
  ├── Receives request, reads TripContext from Redis
  ├── Stores ["Japan"] in trip.bucket_list via Redis
  ├── Publishes update to Kafka: trip_context
  ├── Returns response to Kafka: agent_responses
  │
  ▼
[Orchestrator Agent]
  ├── 4. Resolves pending future via correlation_id
  ├── 5. Agent completed → state_machine.advance() → timing
  ├── 6. Response Formatter (LLM) →
  │      "Japan in spring — great choice! March or April?"
  │      input_type: "choice", options: ["March", "April"]
  │
  ▼
User: "April"
  │
  ▼
[Orchestrator] → Intent: planning:timing → dispatch to Timing Agent
  │
  ▼
[Timing Agent]
  ├── Calls Weather API for Japan in April
  ├── Finds cherry blossom season alignment
  ├── Stores TimingResult in Redis
  ├── Returns: "April is peak cherry blossom. Best two weeks: April 1-15"
  │
  ▼
[Orchestrator] → advance() → interests stage
  ├── "Perfect timing! Are you more into culture and temples, or outdoor adventure?"
  │
  ... (continues through all 13 stages) ...
  │
  ▼
[Calendar Agent]
  ├── Generates ICS file from finalized itinerary
  ├── "Your 14-day Japan itinerary is ready! Export to Google Calendar?"
  │
  ▼
[State Machine] → COMPLETED
```

---

## 10. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Compose Network                       │
│                      (wanderplan bridge)                         │
│                                                                  │
│  ┌──────────┐                                                   │
│  │  Kong     │ :8080 (public)  :8081 (admin)                    │
│  └────┬─────┘                                                   │
│       │                                                         │
│  ┌────▼──────────────────────────────────────────────────────┐  │
│  │           15 Agent Containers                              │  │
│  │  orchestrator:8000  bucket-list:8001  timing:8002          │  │
│  │  interest-profiler:8003  health-accessibility:8004          │  │
│  │  poi-discovery:8005  duration-optimizer:8006                │  │
│  │  availability:8007  budget:8008  flight:8009                │  │
│  │  accommodation:8010  dining:8011  itinerary:8012            │  │
│  │  calendar:8013  group-coordinator:8014                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────┐ ┌──────────┐ ┌───────┐ ┌───────────────────┐   │
│  │ Kafka+ZK   │ │  Redis   │ │ PG 16 │ │ MongoDB + ES      │   │
│  │ :9092      │ │  :6379   │ │ :5432 │ │ :27017  :9200     │   │
│  └────────────┘ └──────────┘ └───────┘ └───────────────────┘   │
│                                                                  │
│  ┌────────────────┐ ┌────────────┐                              │
│  │ Prometheus     │ │ Grafana    │                              │
│  │ :9091          │ │ :3001      │                              │
│  └────────────────┘ └────────────┘                              │
│                                                                  │
│  ┌────────────┐                                                 │
│  │ Kafka UI   │                                                 │
│  │ :9090      │                                                 │
│  └────────────┘                                                 │
└─────────────────────────────────────────────────────────────────┘
```

All 15 agents share a single `Dockerfile.agent` base image with the command overridden per service in `docker-compose.yml`.

---

## 11. File Structure

```
wanderplan-ai/
├── agents/
│   ├── __init__.py
│   ├── base_agent.py              # Abstract base class for all agents
│   ├── orchestrator.py            # Agent 15: central coordinator
│   └── specialists/
│       ├── __init__.py
│       ├── bucket_list.py         # Agent 1
│       ├── timing.py              # Agent 2
│       ├── interest_profiler.py   # Agent 3
│       ├── health_accessibility.py# Agent 4
│       ├── poi_discovery.py       # Agent 5
│       ├── duration_optimizer.py  # Agent 6
│       ├── availability.py        # Agent 7
│       ├── budget.py              # Agent 8
│       ├── flight.py              # Agent 9
│       ├── accommodation.py       # Agent 10
│       ├── dining.py              # Agent 11
│       ├── itinerary.py           # Agent 12
│       ├── calendar_agent.py      # Agent 13
│       └── group_coordinator.py   # Agent 14
├── core/
│   ├── __init__.py
│   ├── state_machine.py           # 13-stage planning FSM
│   └── intent_classifier.py       # LLM-based intent classification
├── schemas/
│   ├── __init__.py
│   └── messages.py                # AgentMessage, UserPrompt, UserReply
├── models/
│   ├── __init__.py
│   └── trip_context.py            # TripContext and all sub-models
├── services/
│   ├── __init__.py
│   ├── shared_state.py            # Redis-backed trip session store
│   ├── event_bus.py               # Kafka producer/consumer wrapper
│   └── vector_memory.py           # Pinecone vector memory service
├── config/
│   ├── __init__.py
│   └── settings.py                # Pydantic settings from env vars
├── gateway/
│   └── kong.yml                   # Kong declarative configuration
├── infrastructure/
│   ├── docker-compose.yml         # Full stack: 15 agents + infra
│   ├── Dockerfile.agent           # Shared agent base image
│   └── prometheus.yml             # Prometheus scrape config
├── docs/
│   └── ARCHITECTURE.md            # This document
└── requirements.txt               # Python dependencies
```
