/**
 * Performance Test 07 — 2-Hour Soak Test
 * ───────────────────────────────────────
 * Runs a realistic mixed-traffic simulation for 2 hours to detect:
 *   - Memory leaks (response times drifting upward over time)
 *   - Database connection pool exhaustion (postgres max_connections hit)
 *   - Redis memory growth (session cache not being evicted)
 *   - Kafka consumer lag accumulation (agents falling behind)
 *   - File descriptor leaks (WebSocket connections not cleaned up)
 *   - Gradual throughput degradation (GC pressure in Python agents)
 *
 * Traffic model:
 *   50 new users register per hour (0.83/min = ~1 new user every 72s)
 *   200 active trips in various planning stages at any time
 *   30 flight searches per minute (simulates browsing/comparison)
 *   Organic mix of reads vs writes (70/30 split)
 *
 * Measurement windows:
 *   The test records baseline metrics in the first 10 minutes, then
 *   compares every subsequent 10-minute window to detect drift.
 *   `response_time_drift` = current p95 - baseline p95.
 *
 * Success criteria:
 *   ✅ p95 response time stable throughout (< +500ms drift from baseline)
 *   ✅ Error rate < 2% throughout the full 2 hours
 *   ✅ No DB connection pool exhaustion (0 pool errors)
 *   ✅ Throughput ≥ 5 req/s throughout
 *   ✅ Memory growth is bounded (no infinite growth pattern)
 *
 * Run:
 *   k6 run tests/performance/07-soak-test.js
 *   # This test takes 2+ hours. Use screen/tmux.
 *   k6 run --out influxdb=http://localhost:8086/k6 07-soak-test.js
 */

import http        from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { SOAK_THRESHOLDS }         from './config/thresholds.js';
import { getVuToken, authHeaders, resetVuToken } from './utils/auth.js';
import {
  createTrip, addBucketListItems, getTimingAnalysis,
  submitInterests, setBudget, searchAndSelectFlight,
  approveItinerary, triggerCalendarSync,
  fetchItinerary, fetchItineraryPageBundle,
} from './utils/trip-factory.js';
import {
  BASE_URL,
  PERF_TRIP_IDS, PERF_USERS,
  randomFrom, randInt, isoDatePlusDays, thinkTime,
} from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const responseTimeDrift     = new Trend('response_time_drift',      true);
const dbPoolErrors          = new Counter('db_pool_exhaustion_errors');
const redisMemoryGrowth     = new Trend('redis_memory_mb',          true);
const kafkaLagGauge         = new Gauge('kafka_consumer_lag');
const newUserSuccessRate    = new Rate('new_user_registration_rate');
const searchSuccessRate     = new Rate('search_success_rate_soak');
const readSuccessRate       = new Rate('read_success_rate_soak');
const activeTripsGauge      = new Gauge('active_trips_gauge');
const errorRate             = new Rate('overall_error_rate');

// Sliding window baseline tracker (updated every 10 minutes by health-check VU)
let baselineP95Ms = 0;
let windowStart   = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

const SOAK_DURATION_MINUTES = parseInt(__ENV.SOAK_DURATION_MINUTES || '120');

export const options = {
  scenarios: {
    // ── Organic reads (70% of traffic) ─────────────────────────────────────
    organic_reads: {
      executor:         'constant-vus',
      vus:              40,
      duration:         `${SOAK_DURATION_MINUTES}m`,
      gracefulStop:     '30s',
      tags:             { scenario: 'organic_reads' },
    },

    // ── Flight searches (30 / min = 0.5/s across 5 VUs) ───────────────────
    flight_searches: {
      executor:         'constant-arrival-rate',
      rate:             30,
      timeUnit:         '1m',
      duration:         `${SOAK_DURATION_MINUTES}m`,
      preAllocatedVUs:  5,
      maxVUs:           15,
      tags:             { scenario: 'flight_search', endpoint: 'flight_search' },
    },

    // ── Active trips progressing through stages ────────────────────────────
    active_trips: {
      executor:         'constant-vus',
      vus:              20,
      duration:         `${SOAK_DURATION_MINUTES}m`,
      gracefulStop:     '60s',
      tags:             { scenario: 'agent_step' },
    },

    // ── New user registrations (50/hour = 0.83/min) ────────────────────────
    new_registrations: {
      executor:         'constant-arrival-rate',
      rate:             50,
      timeUnit:         '1h',
      duration:         `${SOAK_DURATION_MINUTES}m`,
      preAllocatedVUs:  2,
      maxVUs:           5,
      tags:             { scenario: 'registration', endpoint: 'register' },
    },

    // ── Health monitor: infrastructure metrics every 30s ───────────────────
    health_monitor: {
      executor:         'constant-arrival-rate',
      rate:             2,         // 2 per minute
      timeUnit:         '1m',
      duration:         `${SOAK_DURATION_MINUTES}m`,
      preAllocatedVUs:  1,
      maxVUs:           3,
      tags:             { scenario: 'health_monitor' },
    },
  },

  thresholds: {
    ...SOAK_THRESHOLDS,

    // Scenario-specific
    'http_req_duration{scenario:organic_reads}':   ['p(95)<500'],
    'http_req_duration{scenario:flight_search}':   ['p(95)<3000'],
    'http_req_duration{scenario:agent_step}':      ['p(95)<2000'],
    'http_req_failed{scenario:organic_reads}':     ['rate<0.01'],
    'http_req_failed{scenario:flight_search}':     ['rate<0.02'],

    // Soak-specific stability checks
    'response_time_drift':                         ['max<500'],
    'db_pool_exhaustion_errors':                   ['count<1'],
    'new_user_registration_rate':                  ['rate>0.95'],
    'kafka_consumer_lag':                          ['max<1000'],  // <1000 msgs behind
  },

  // Stream metrics to InfluxDB if available
  ...((__ENV.INFLUX_URL) ? {
    ext: {
      loadimpact: {
        projectID: 1234567,
        name: 'WanderPlan Soak Test',
      },
    },
  } : {}),

  tags: { test_name: 'soak_test', duration_min: String(SOAK_DURATION_MINUTES) },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Classify HTTP response and record error metrics. */
function record(res, scenarioTag) {
  const ok = res && res.status >= 200 && res.status < 300;
  errorRate.add(ok ? 0 : 1);
  if (res && res.status === 503) dbPoolErrors.add(1);
  return ok;
}

/**
 * Detect response time drift relative to the baseline window.
 * Called by the health monitor VU.
 */
function measureDrift(currentP95Ms) {
  if (baselineP95Ms === 0) {
    // First measurement is the baseline
    baselineP95Ms = currentP95Ms;
    console.log(`📊 Soak baseline set: p95=${baselineP95Ms}ms`);
    return 0;
  }
  const drift = currentP95Ms - baselineP95Ms;
  responseTimeDrift.add(Math.max(0, drift));
  return drift;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Organic reads
// ─────────────────────────────────────────────────────────────────────────────

let readToken = null;

export function organic_reads() {
  if (!readToken) readToken = getVuToken().token;

  const roll = Math.random();

  if (roll < 0.50) {
    // 50%: itinerary page bundle (most common read)
    const res = fetchItineraryPageBundle(readToken);
    readSuccessRate.add(record(res, 'organic_reads') ? 1 : 0);

  } else if (roll < 0.70) {
    // 20%: single itinerary read
    const res = fetchItinerary(readToken);
    readSuccessRate.add(record(res, 'organic_reads') ? 1 : 0);

  } else if (roll < 0.85) {
    // 15%: trip summary read
    const tripId = randomFrom(PERF_TRIP_IDS);
    const res = http.get(
      `${BASE_URL}/trips/${tripId}`,
      { headers: authHeaders(readToken), tags: { endpoint: 'trip_summary' } }
    );
    record(res, 'organic_reads');

  } else if (roll < 0.95) {
    // 10%: budget breakdown
    const tripId = randomFrom(PERF_TRIP_IDS);
    const res = http.get(
      `${BASE_URL}/trips/${tripId}/budget/breakdown`,
      { headers: authHeaders(readToken), tags: { endpoint: 'budget_read' } }
    );
    record(res, 'organic_reads');

  } else {
    // 5%: POI search
    const tripId = randomFrom(PERF_TRIP_IDS);
    const res = http.get(
      `${BASE_URL}/trips/${tripId}/pois?limit=10`,
      { headers: authHeaders(readToken), tags: { endpoint: 'pois_read' } }
    );
    record(res, 'organic_reads');
  }

  sleep(0.5 + Math.random() * 1.5);  // 0.5–2s think time
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Flight searches
// ─────────────────────────────────────────────────────────────────────────────

let searchToken = null;
let searchTripId = null;

export function flight_searches() {
  if (!searchToken) {
    searchToken  = getVuToken().token;
    // Create a stub trip for searches (reuse across iterations)
    const res = http.post(
      `${BASE_URL}/trips`,
      JSON.stringify({ name: `Soak Search VU${__VU}`, travel_style: 'solo', destinations: ['Tokyo'] }),
      { headers: authHeaders(searchToken), tags: { endpoint: 'create_trip' } }
    );
    try { searchTripId = JSON.parse(res.body)?.trip?.id; } catch {}
  }

  if (!searchTripId) return;

  const origin      = randomFrom(['LAX', 'JFK', 'ORD', 'SFO', 'MIA', 'SEA', 'LHR', 'CDG']);
  const destination = randomFrom(['NRT', 'HND', 'ICN', 'BKK', 'SYD', 'DXB', 'FCO', 'BCN']);
  const res = http.post(
    `${BASE_URL}/trips/${searchTripId}/flights/search`,
    JSON.stringify({
      origin_airport:      origin,
      destination_airport: destination,
      departure_date:      isoDatePlusDays(randInt(14, 180)),
      cabin_class:         'economy',
      passengers:          1,
    }),
    {
      headers: authHeaders(searchToken),
      tags:    { scenario: 'flight_search', endpoint: 'flight_search' },
    }
  );

  const ok = record(res, 'flight_search');
  searchSuccessRate.add(ok ? 1 : 0);

  check(res, {
    'soak search: 200':          r => r.status === 200,
    'soak search: has results':  r => {
      try { return Array.isArray(JSON.parse(r.body)?.flights); } catch { return false; }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Active trips advancing through stages
// ─────────────────────────────────────────────────────────────────────────────

let tripToken  = null;
let tripUserId = null;
let activeTripId = null;
let currentStage = 0;

const STAGE_FNS = [
  (tok, uid) => createTrip(tok),
  (tok, uid, tid) => addBucketListItems(tok, tid),
  (tok, uid, tid) => getTimingAnalysis(tok, tid),
  (tok, uid, tid) => submitInterests(tok, tid, uid),
  (tok, uid, tid) => setBudget(tok, tid, randInt(100, 300)),
  (tok, uid, tid) => searchAndSelectFlight(tok, tid),
  (tok, uid, tid) => approveItinerary(tok, tid),
  (tok, uid, tid) => triggerCalendarSync(tok, tid),
];

export function active_trips() {
  if (!tripToken) {
    const auth = getVuToken();
    tripToken  = auth.token;
    tripUserId = auth.userId;
  }

  // Execute current stage
  let result;
  if (currentStage === 0) {
    // Create a new trip
    activeTripId = createTrip(tripToken);
    if (activeTripId) {
      activeTripsGauge.add(1);
      currentStage = 1;
    }
  } else if (activeTripId && currentStage < STAGE_FNS.length) {
    result = STAGE_FNS[currentStage]?.(tripToken, tripUserId, activeTripId);
    if (result) record(result, 'agent_step');
    currentStage++;

    if (currentStage >= STAGE_FNS.length) {
      // Trip complete — start a new one
      activeTripsGauge.add(-1);
      activeTripId  = null;
      currentStage  = 0;
      sleep(randInt(5, 30));  // rest between trips
    }
  }

  thinkTime();  // Realistic think time between stages
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: New user registrations
// ─────────────────────────────────────────────────────────────────────────────

let registrationIndex = 0;

export function new_registrations() {
  // Generate a unique email per iteration to avoid 409 conflicts
  const ts    = Date.now();
  const email = `soak-new-${ts}-${randInt(1000, 9999)}@wanderplan-perf.test`;

  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({
      email,
      password: 'SoakTest1!',
      name:     `Soak User ${ts}`,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags:    { scenario: 'registration', endpoint: 'register' },
    }
  );

  const ok = res.status === 201 || res.status === 409;  // 409 = already registered
  newUserSuccessRate.add(ok ? 1 : 0);

  check(res, {
    'registration: accepted': r => r.status === 201 || r.status === 409,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario: Health monitor (infrastructure metrics polling)
// ─────────────────────────────────────────────────────────────────────────────

let monitorToken = null;

export function health_monitor() {
  if (!monitorToken) monitorToken = getVuToken().token;

  // Check DB connection pool usage
  const poolRes = http.get(`${BASE_URL}/admin/health/db`, {
    headers: authHeaders(monitorToken),
    tags:    { scenario: 'health_monitor', type: 'db_pool' },
    timeout: '10s',
  });

  if (poolRes.status === 200) {
    try {
      const { pool_used, pool_max, pool_waiting } = JSON.parse(poolRes.body);
      const utilisation = pool_used / pool_max;

      if (utilisation > 0.90) {
        console.warn(`⚠️  DB pool ${(utilisation * 100).toFixed(0)}% full (${pool_used}/${pool_max})`);
      }
      if (pool_waiting > 0) {
        console.warn(`⚠️  ${pool_waiting} queries waiting for a DB connection`);
        dbPoolErrors.add(pool_waiting);
      }
    } catch {}
  }

  // Check Redis memory
  const redisRes = http.get(`${BASE_URL}/admin/health/redis`, {
    headers: authHeaders(monitorToken),
    tags:    { scenario: 'health_monitor', type: 'redis' },
    timeout: '5s',
  });

  if (redisRes.status === 200) {
    try {
      const { used_memory_mb } = JSON.parse(redisRes.body);
      if (used_memory_mb) redisMemoryGrowth.add(used_memory_mb);
    } catch {}
  }

  // Check Kafka consumer lag
  const kafkaRes = http.get(`${BASE_URL}/admin/health/kafka`, {
    headers: authHeaders(monitorToken),
    tags:    { scenario: 'health_monitor', type: 'kafka' },
    timeout: '5s',
  });

  if (kafkaRes.status === 200) {
    try {
      const { total_lag } = JSON.parse(kafkaRes.body);
      if (total_lag !== undefined) {
        kafkaLagGauge.add(total_lag);
        if (total_lag > 1000) {
          console.warn(`⚠️  Kafka consumer lag: ${total_lag} messages behind`);
        }
      }
    } catch {}
  }

  // Measure response time drift every 10 minutes
  const elapsed = Date.now() - windowStart;
  if (elapsed > 600000) {  // 10 minutes
    // Get current p95 from a synthetic probe
    const probeStart = Date.now();
    const probeRes = http.get(
      `${BASE_URL}/trips/${PERF_TRIP_IDS[0]}/itinerary`,
      { headers: authHeaders(monitorToken) }
    );
    const probeMs = Date.now() - probeStart;

    const drift = measureDrift(probeMs);
    if (drift > 500) {
      console.warn(`⚠️  Response time drift: +${drift}ms above baseline`);
    } else {
      console.log(`📊 Response time drift: +${drift}ms (within threshold)`);
    }

    windowStart = Date.now();  // Reset window
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Default export (orchestrates all scenarios via exec routing in options)
// k6 calls the exported function matching the scenario name
// ─────────────────────────────────────────────────────────────────────────────

export default function () {
  // Fallback if scenario routing is not configured
  organic_reads();
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  const durationHours = (SOAK_DURATION_MINUTES / 60).toFixed(1);
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  WanderPlan AI — ${durationHours}-Hour Soak Test                    ║
  ║                                                          ║
  ║  Traffic model:                                          ║
  ║    • 40 VUs organic reads (70% reads)                   ║
  ║    • 30 flight searches/min                              ║
  ║    • 20 VUs active trip pipelines                        ║
  ║    • 50 new registrations/hour                           ║
  ║    • Health monitor every 30s                            ║
  ║                                                          ║
  ║  Success criteria:                                       ║
  ║    ✓ p95 < 3s, drift < 500ms throughout                 ║
  ║    ✓ Error rate < 2%                                     ║
  ║    ✓ 0 DB pool exhaustion events                         ║
  ╚══════════════════════════════════════════════════════════╝
  `);

  // Verify the stack is healthy before the long soak
  const healthRes = http.get(`${BASE_URL.replace('/v1', '')}/health`, { timeout: '10s' });
  if (healthRes.status !== 200) {
    console.error(`❌ Health check failed before soak: ${healthRes.status}`);
  } else {
    console.log('✅ Stack health check passed. Starting soak test...');
  }

  windowStart = Date.now();
  return { startTime: Date.now() };
}

export function teardown(data) {
  const hours = ((Date.now() - data.startTime) / 3600000).toFixed(2);
  console.log(`\n✅ Soak test completed after ${hours} hours`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/07-soak-test-${ts}.html`]: htmlReport(data),
    [`results/07-soak-test-${ts}.json`]: JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
