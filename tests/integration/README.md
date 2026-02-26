# WanderPlan AI — Integration Tests

Cross-service integration tests that exercise the full HTTP API through Supertest, with real dependent services managed by Docker Compose and a seeded Postgres test database.

---

## Quick Start

```bash
# From this directory:
cd tests/integration

# 1. Install test dependencies
npm install

# 2. Bring up the isolated test stack (Postgres, Redis, Kafka, mock APIs, all agents)
npm run stack:up

# 3. Run all 10 integration test suites
npm run test:integration

# 4. Tear down when done
npm run stack:down
```

One-liner for CI:

```bash
npm run ci
```

---

## Architecture

```
tests/integration/
├── setup/
│   ├── docker-compose.test.yml   # Isolated test stack (ports 18000, 15432, …)
│   ├── seed.sql                  # Schema + deterministic seed data
│   ├── helpers.js                # Shared auth, factory, assertion, DB utilities
│   ├── jest.setup.js             # globalSetup / globalTeardown hooks
│   ├── sequencer.js              # Alphabetical test-file ordering
│   └── mock-server/
│       └── server.js             # Stubs: Amadeus flights, Google Places, Calendar API
│
├── 01-trip-creation-flow.test.js
├── 02-bucket-list-timing-pipeline.test.js
├── 03-interest-poi-pipeline.test.js
├── 04-budget-flight-integration.test.js
├── 05-itinerary-calendar-sync.test.js
├── 06-storyboard-generation.test.js
├── 07-analytics-pipeline.test.js
├── 08-over-budget-flow.test.js
├── 09-availability-edge-cases.test.js
├── 10-health-requirement-cascade.test.js
│
├── jest.integration.config.js
├── package.json
└── README.md
```

---

## Test Suites

| # | File | Scenario | Key Assertions |
|---|------|----------|----------------|
| 01 | `01-trip-creation-flow` | Create trip → invite member → accept | DB has 2 rows: owner + member with correct roles |
| 02 | `02-bucket-list-timing-pipeline` | Add 3 destinations → trigger timing | Each destination has `month_scores` (0–10), `best_window` with valid ISO dates |
| 03 | `03-interest-poi-pipeline` | 3 members submit divergent interests → request POIs | POIs match group overlap (≥2 members), not solo preferences |
| 04 | `04-budget-flight-integration` | Daily budget $150 → search flights | No flight exceeds `total * 0.30 = $315`; formula verified |
| 05 | `05-itinerary-calendar-sync` | Approve 5-day/30-item itinerary → calendar sync | Exactly 30 events created in mock Calendar API; no overlaps within a day |
| 06 | `06-storyboard-generation` | 4 activities + 4 platforms → storyboard | Instagram ≥3 hashtags, Twitter ≤280 chars, Blog ≥300 words, TikTok ≤300 chars |
| 07 | `07-analytics-pipeline` | Fire 13 screen-transition events | `analytics_events` has all 13 `screen_view` rows with correct `screen_name` values |
| 08 | `08-over-budget-flow` | Low budget → expensive hotel → warning → increase | 422 + `budget_warning`; after increase, new total recalculated; subsequent screens use updated budget |
| 09 | `09-availability-edge-cases` | 5 members, zero overlap | `overlap=null`, `closest_windows` ranked by `members_available`, `prompt_members_to_adjust=true` |
| 10 | `10-health-requirement-cascade` | Approve scuba → user has no cert → cascade | Scuba POI de-approved; snorkeling alternative added; `health_acknowledgments` row persisted |

---

## Port Map (Test Stack)

| Service | Host Port | Container Port |
|---------|-----------|----------------|
| Orchestrator | 18000 | 8000 |
| Postgres | 15432 | 5432 |
| Redis | 16379 | 6379 |
| MongoDB | 27018 | 27017 |
| Kafka | 19092 | 9092 |
| Mock APIs | 4000 | 4000 |

Test ports are offset by +10000 to avoid conflicts with a running local dev stack.

---

## Seed Data

`setup/seed.sql` seeds six users with well-known UUIDs (`000...0001` through `000...0006`) and one pre-built trip (`aaa...0001`). These identifiers are stable across test runs.

| User | Email | Role in seeded trip |
|------|-------|---------------------|
| Alice | alice@test.com | owner |
| Bob | bob@test.com | member |
| Carol–Frank | *@test.com | not on seeded trip |

---

## Environment Variables

The following variables are read at test startup (defaults shown):

```
API_BASE_URL=http://localhost:18000
MOCK_API_URL=http://localhost:4000
POSTGRES_HOST=localhost
POSTGRES_PORT=15432
POSTGRES_DB=wanderplan_test
POSTGRES_USER=wanderplan
POSTGRES_PASSWORD=wanderplan_test
SKIP_DOCKER_UP=false     # set true if stack is already running
SKIP_DOCKER_DOWN=false   # set true to keep stack alive after tests
```

---

## Running a Single Suite

```bash
# Run only the budget-flight test
npm run test:integration:single -- 04-budget

# Run only availability edge cases
npm run test:integration:single -- 09-availability
```

---

## CI Integration (GitHub Actions example)

```yaml
jobs:
  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Install deps
        run: cd tests/integration && npm ci
      - name: Run integration tests
        run: cd tests/integration && npm run ci
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      - name: Upload JUnit report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-results
          path: tests/integration/reports/integration-results.xml
```
