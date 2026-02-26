# WanderPlan AI — Performance Tests

k6-based load and soak tests covering all high-traffic paths in the WanderPlan AI system.

---

## Test suite overview

| # | File | Scenario | VUs | Duration | Key threshold |
|---|------|----------|-----|----------|---------------|
| 01 | `01-search-performance.js` | 500 concurrent flight searches | 500 | ~7 min | p95 < 3 s, p99 < 5 s |
| 02 | `02-agent-orchestration.js` | 100 concurrent 14-stage pipelines | 100 | 8 min | Agent p95 < 2 s, Kafka p95 < 500 ms |
| 03 | `03-database-load.js` | 1 000 concurrent itinerary reads | 1 000 | ~5 min | p95 < 200 ms, cache hit > 70 % |
| 04 | `04-calendar-sync-burst.js` | 200 trips approved simultaneously | 200 | ≤ 6 min | All 6 000 events created < 5 min |
| 05 | `05-websocket-connections.js` | 500 concurrent group chat sessions | 500 | ~4 min | Delivery p95 < 100 ms, 0 drops |
| 06 | `06-storyboard-generation.js` | 100 concurrent LLM-backed requests | 100 | ~4 min | All complete < 30 s, retries ≤ 2 avg |
| 07 | `07-soak-test.js` | Realistic mixed traffic for 2 hours | 65 | 2 hours | Drift < 500 ms, 0 pool exhaustions |

---

## Prerequisites

### 1. Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker alternative (no install required)
docker run --rm -i grafana/k6 run - < 01-search-performance.js
```

Minimum required version: **k6 v0.51.0** (for `k6/ws` and `SharedArray` support).

### 2. Start the stack

```bash
# From project root
docker compose -f infrastructure/docker-compose.yml up -d --wait

# Verify all 15 agents are healthy
curl http://localhost:8080/health | jq .
```

### 3. Seed performance test data

The database load test and calendar sync burst test rely on 500 pre-built trips
and 200 test accounts that must exist before you run those tests.

```bash
# Seed users + trips + itinerary data
psql $DATABASE_URL -f tests/performance/seed/perf-seed.sql

# Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users WHERE email LIKE 'perf-user%'"
# → 200
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trips WHERE id::text LIKE 'aaaaaaaa%'"
# → 500
```

---

## Running the tests

### Quick smoke test (5 VUs, 30 seconds)

```bash
cd tests/performance
k6 run --vus 5 --duration 30s 01-search-performance.js
```

### Individual tests

```bash
k6 run 01-search-performance.js   # Search performance
k6 run 02-agent-orchestration.js  # Agent pipeline
k6 run 03-database-load.js        # DB load
k6 run 04-calendar-sync-burst.js  # Calendar burst
k6 run 05-websocket-connections.js # WebSocket
k6 run 06-storyboard-generation.js # LLM storyboard
k6 run 07-soak-test.js            # 2-hour soak
```

### Target a different environment

```bash
# Staging
k6 run -e API_BASE_URL=https://staging.wanderplan.ai/v1 \
       -e WS_BASE_URL=wss://staging.wanderplan.ai/v1 \
       01-search-performance.js

# Production (read-only DB load test only)
k6 run -e API_BASE_URL=https://api.wanderplan.ai/v1 \
       --vus 10 --duration 1m 03-database-load.js
```

### With real-time Grafana metrics

```bash
# Start InfluxDB + Grafana (if not already running)
docker compose -f infrastructure/docker-compose.yml up -d prometheus grafana

# Stream k6 metrics to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 01-search-performance.js

# Or stream to statsd / Prometheus remote-write
k6 run --out statsd=localhost:8125 01-search-performance.js
k6 run --out experimental-prometheus-rw=http://localhost:9091/api/v1/write \
       01-search-performance.js

# Open Grafana (import grafana/k6-dashboard.json)
open http://localhost:3001
# Login: admin / admin
```

### Shorten the soak test (CI environments)

```bash
# 30-minute soak instead of 2 hours
k6 run -e SOAK_DURATION_MINUTES=30 07-soak-test.js
```

---

## Test architecture

```
tests/performance/
├── 01-search-performance.js       # Test 1: Flight search load
├── 02-agent-orchestration.js      # Test 2: 14-stage pipeline
├── 03-database-load.js            # Test 3: Itinerary reads
├── 04-calendar-sync-burst.js      # Test 4: Calendar sync burst
├── 05-websocket-connections.js    # Test 5: WS group chat
├── 06-storyboard-generation.js    # Test 6: LLM storyboard
├── 07-soak-test.js                # Test 7: 2-hour soak
│
├── config/
│   └── thresholds.js              # All pass/fail thresholds
│
├── utils/
│   ├── auth.js                    # Token acquisition + per-VU cache
│   ├── env.js                     # ENV vars, airport pools, helpers
│   └── trip-factory.js            # Trip CRUD + all 14 stage helpers
│
├── seed/
│   └── perf-seed.sql              # 200 users + 500 trips + itinerary data
│
├── grafana/
│   └── k6-dashboard.json          # Grafana dashboard (import via UI)
│
├── results/                        # HTML/JSON reports (git-ignored)
└── README.md
```

### Key design decisions

**Per-VU token caching** — Each virtual user authenticates once on first iteration and caches the token in VU-local state. This keeps auth overhead negligible (<1% of test duration) without sharing tokens across VUs.

**Pre-seeded trip IDs** — The database load test (03) uses deterministic UUIDs (`aaaaaaaa-aaaa-aaaa-aaaa-000000000001` through `...000500`) seeded before the test. This eliminates creation latency from the read-path measurement.

**Weighted traffic mix** — Test 03 uses a probability-weighted dispatch (`Math.random()` against breakpoints) to model real traffic: 45% full itinerary reads, 20% page bundles, 15% Elasticsearch POI searches, 10% Redis budget reads, 10% MongoDB analytics.

**Exponential back-off** — Tests 04 and 06 implement retry-with-jitter so the test itself exercises the retry path rather than simply erroring out. The `storyboard_retry_count` metric reveals whether the queue is absorbing load correctly.

**Round-trip latency for WebSockets** — Test 05 embeds `Date.now()` in every chat message. When the server echoes the message back, the VU computes `Date.now() - msg.timestamp` and records it as `ws_message_delivery_latency`. This gives sub-millisecond precision without a shared clock.

**Drift detection in soak test** — Test 07 records a p95 baseline in the first 10 minutes, then every subsequent 10-minute window compares to it. The `response_time_drift` metric triggers a threshold failure if any window exceeds the baseline by 500 ms.

---

## Thresholds reference

All thresholds are defined in `config/thresholds.js` and imported by each test.

| Metric | Test | Threshold |
|--------|------|-----------|
| `http_req_duration{scenario:flight_search}` | 01 | p95 < 3 000 ms, p99 < 5 000 ms |
| `kafka_message_latency` | 02 | p95 < 500 ms |
| `agent_response_time` | 02 | p95 < 2 000 ms, max < 8 000 ms |
| `http_req_duration{scenario:itinerary_read}` | 03 | p95 < 200 ms, p99 < 400 ms |
| `db_cache_hit_rate` | 03 | rate > 0.70 |
| `calendar_events_created` | 04 | count > 5 900 |
| `calendar_rate_limit_errors` | 04 | count < 1 |
| `sync_total_duration` | 04 | max < 300 000 ms |
| `ws_message_delivery_latency` | 05 | p95 < 100 ms, p99 < 250 ms |
| `ws_dropped_connections` | 05 | count < 1 |
| `storyboard_completion_time` | 06 | p95 < 30 000 ms |
| `storyboard_retry_count` | 06 | avg < 2 |
| `storyboard_completed` | 06 | count ≥ 95 |
| `response_time_drift` | 07 | max < 500 ms |
| `db_pool_exhaustion_errors` | 07 | count < 1 |
| `kafka_consumer_lag` | 07 | max < 1 000 |

---

## CI integration

### GitHub Actions example

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 3 * * 1'   # Monday 03:00 UTC (off-peak)
  workflow_dispatch:
    inputs:
      test:
        description: 'Which test to run'
        required: true
        default: 'smoke'
        type: choice
        options: [smoke, search, orchestration, db, calendar, ws, storyboard, soak]

jobs:
  perf-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: wanderplan
          POSTGRES_USER: wanderplan
          POSTGRES_PASSWORD: wanderplan_dev
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Install k6
        run: |
          sudo gpg --no-default-keyring \
            --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
            --keyserver hkp://keyserver.ubuntu.com:80 \
            --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] \
            https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update && sudo apt-get install k6

      - name: Start WanderPlan stack
        run: docker compose -f infrastructure/docker-compose.yml up -d --wait
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Seed performance data
        run: psql $DATABASE_URL -f tests/performance/seed/perf-seed.sql
        env:
          DATABASE_URL: postgresql://wanderplan:wanderplan_dev@localhost:5432/wanderplan

      - name: Run performance test
        run: |
          TEST="${{ github.event.inputs.test || 'search' }}"
          case "$TEST" in
            smoke)        k6 run --vus 5 --duration 30s tests/performance/01-search-performance.js ;;
            search)       k6 run tests/performance/01-search-performance.js ;;
            orchestration)k6 run tests/performance/02-agent-orchestration.js ;;
            db)           k6 run tests/performance/03-database-load.js ;;
            calendar)     k6 run tests/performance/04-calendar-sync-burst.js ;;
            ws)           k6 run tests/performance/05-websocket-connections.js ;;
            storyboard)   k6 run tests/performance/06-storyboard-generation.js ;;
            soak)         k6 run -e SOAK_DURATION_MINUTES=30 tests/performance/07-soak-test.js ;;
          esac
        env:
          API_BASE_URL: http://localhost:8080/v1
          WS_BASE_URL:  ws://localhost:8080/v1

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: perf-report-${{ github.run_id }}
          path: tests/performance/results/*.html
          retention-days: 30
```

---

## Interpreting results

### Pass / fail

k6 exits with code `0` if all thresholds pass, `99` if any threshold fails.
In CI, a non-zero exit causes the pipeline step to fail.

### HTML reports

Each test writes an HTML report to `results/NN-test-name-TIMESTAMP.html`.
Open these in a browser — they include interactive charts for all metrics.

### Key signals to watch

| Signal | What it means |
|--------|---------------|
| p95 response time trending upward | Memory leak or thread pool saturation |
| `db_pool_exhaustion_errors` > 0 | `max_connections` too low for the load; increase pool size or scale horizontally |
| `kafka_consumer_lag` > 1 000 | Agents processing slower than messages are published; consider adding partitions |
| `ws_dropped_connections` > 0 | WebSocket proxy timeout too short, or the orchestrator is not sending pings |
| `calendar_rate_limit_errors` > 0 | Sync service is not queuing/back-off correctly before calling Google Calendar |
| `storyboard_retry_count` avg > 2 | LLM API is consistently throttling; consider a circuit breaker |
| `response_time_drift` > 200 ms | GC pressure or connection pool creep in the soak window |

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE_URL` | `http://localhost:8080/v1` | Kong proxy URL |
| `WS_BASE_URL` | `ws://localhost:8080/v1` | WebSocket base URL |
| `RAMP_UP` | `30` | VU ramp-up time in seconds |
| `RAMP_DOWN` | `30` | VU ramp-down time in seconds |
| `SLEEP_MIN` | `0.5` | Minimum think time (seconds) |
| `SLEEP_MAX` | `2.0` | Maximum think time (seconds) |
| `SOAK_DURATION_MINUTES` | `120` | Soak test duration (minutes) |
| `INFLUX_URL` | _(unset)_ | InfluxDB URL for metric streaming |
| `TEST_VERSION` | `local` | Tag applied to all k6 metrics |
