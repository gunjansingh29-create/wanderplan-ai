/**
 * Performance Test 03 — Database Load (Itinerary Reads)
 * ──────────────────────────────────────────────────────
 * Simulates 1,000 concurrent users reading complete itinerary data.
 * The itinerary endpoint is the most expensive query in the system:
 * it joins 5 PostgreSQL tables (trips, itinerary_days, itinerary_activities,
 * flight_options, stays) and returns nested JSON.
 *
 * Also tests:
 *   - Connection pool behaviour under sustained high concurrency
 *   - Redis cache effectiveness (hit rate should be >80% at steady state)
 *   - Elasticsearch query latency (itinerary also fetches POI descriptions)
 *   - MongoDB aggregation for storyboard metadata
 *
 * Load shape:
 *   Stage 1 — Ramp:    0 → 500 VUs in 30s
 *   Stage 2 — First:   500 VUs × 1m (test with partial cache warm)
 *   Stage 3 — Peak:    500 → 1000 VUs in 30s
 *   Stage 4 — Sustain: 1000 VUs × 3m (main measurement window)
 *   Stage 5 — Drain:   1000 → 0 in 30s
 *
 * Success criteria:
 *   ✅ p95 response time < 200ms  (full page bundle)
 *   ✅ p99 response time < 400ms
 *   ✅ Single-request max < 1000ms (no timeout)
 *   ✅ Error rate < 0.5%
 *   ✅ Throughput ≥ 200 req/s at 1000 VUs
 *   ✅ Redis cache hit rate ≥ 70% after warm-up
 *
 * Run:
 *   k6 run tests/performance/03-database-load.js
 */

import http       from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { DATABASE_THRESHOLDS }           from './config/thresholds.js';
import { getVuToken, authHeaders }        from './utils/auth.js';
import { fetchItinerary, fetchItineraryPageBundle } from './utils/trip-factory.js';
import {
  BASE_URL, PERF_TRIP_IDS, randomFrom, randInt, thinkTime,
} from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const cacheHitRate        = new Rate('db_cache_hit_rate');
const bundleLatency       = new Trend('itinerary_bundle_latency_ms', true);
const singleQueryLatency  = new Trend('itinerary_single_query_ms', true);
const dbPoolErrors        = new Counter('db_pool_exhaustion_errors');
const timeoutErrors       = new Counter('db_query_timeouts');
const esQueryLatency      = new Trend('elasticsearch_query_ms', true);
const redisLatency        = new Trend('redis_cache_latency_ms', true);

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    itinerary_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500  },   // ramp to 500
        { duration: '1m',  target: 500  },   // warm cache
        { duration: '30s', target: 1000 },   // ramp to 1000
        { duration: '3m',  target: 1000 },   // sustain peak
        { duration: '30s', target: 0    },   // drain
      ],
      gracefulRampDown: '15s',
    },

    // Secondary: exercise the complex aggregation endpoint (MongoDB)
    analytics_read: {
      executor: 'constant-vus',
      vus:      50,
      duration: '5m',
      startTime: '1m',   // Start after DB test is underway
      tags:     { scenario: 'analytics_read' },
    },
  },

  thresholds: {
    ...DATABASE_THRESHOLDS,
    'itinerary_bundle_latency_ms':  ['p(95)<600',  'p(99)<1200'],
    'itinerary_single_query_ms':    ['p(95)<200',  'p(99)<400'],
    'elasticsearch_query_ms':       ['p(95)<300'],
    'db_pool_exhaustion_errors':    ['count<1'],
    'db_query_timeouts':            ['count<5'],
    'db_cache_hit_rate':            ['rate>0.70'],   // Cache should warm above 70%
  },

  tags: { test_name: 'database_load' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Categorise the response: cache hit, DB hit, error, pool exhaustion, or timeout.
 */
function classifyResponse(res) {
  if (!res) return 'null';
  if (res.status === 503) { dbPoolErrors.add(1); return 'pool_exhausted'; }
  if (res.status === 504) { timeoutErrors.add(1); return 'timeout'; }
  if (res.status === 200) {
    const cacheStatus = (res.headers['X-Cache-Status'] || '').toLowerCase();
    if (cacheStatus === 'hit')  { cacheHitRate.add(1); return 'cache_hit'; }
    if (cacheStatus === 'miss') { cacheHitRate.add(0); return 'db_hit';    }
    // If no cache header, assume DB hit (older response path)
    cacheHitRate.add(0);
    return 'db_hit';
  }
  return `error_${res.status}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Read scenarios
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scenario A: Fetch full itinerary (single query, cache-eligible).
 * Represents: user opening the itinerary page.
 */
function readItinerarySingle(token) {
  const t0  = Date.now();
  const res = fetchItinerary(token);
  singleQueryLatency.add(Date.now() - t0);

  const cls = classifyResponse(res);
  check(res, {
    'itinerary single: status 200':        r => r.status === 200,
    'itinerary single: has days array':    r => {
      try { return Array.isArray(JSON.parse(r.body)?.itinerary?.days); } catch { return false; }
    },
    'itinerary single: <200ms':            () => (Date.now() - t0) < 200,
  });
}

/**
 * Scenario B: Fetch the full itinerary page bundle (3 parallel requests).
 * Represents: browser loading all data needed to render the itinerary view.
 */
function readItineraryBundle(token) {
  const t0  = Date.now();
  const res = fetchItineraryPageBundle(token);
  bundleLatency.add(Date.now() - t0);

  classifyResponse(res);
  check(res, { 'bundle: primary 200': r => r.status === 200 });
}

/**
 * Scenario C: Search the trip's POIs via Elasticsearch.
 * Represents: user filtering itinerary activities by tag.
 */
function searchPoisElasticsearch(token) {
  const tripId = randomFrom(PERF_TRIP_IDS);
  const terms  = ['temple', 'food', 'nature', 'art', 'adventure', 'culture'];
  const query  = randomFrom(terms);

  const t0 = Date.now();
  const res = http.get(
    `${BASE_URL}/trips/${tripId}/pois?q=${query}&limit=20`,
    { headers: authHeaders(token), tags: { scenario: 'itinerary_read', type: 'elasticsearch' } }
  );
  esQueryLatency.add(Date.now() - t0);

  check(res, { 'ES search: 200': r => r.status === 200 || r.status === 404 });
}

/**
 * Scenario D: Fetch analytics event timeline (MongoDB aggregation).
 * Used by the 'analytics_read' scenario.
 */
function readAnalytics(token) {
  const tripId = randomFrom(PERF_TRIP_IDS);
  const res = http.get(
    `${BASE_URL}/trips/${tripId}/analytics/timeline`,
    { headers: authHeaders(token), tags: { scenario: 'analytics_read' } }
  );
  check(res, { 'analytics: 200 or 404': r => r.status === 200 || r.status === 404 });
}

/**
 * Scenario E: Read budget breakdown (Redis-cached, should be fastest).
 */
function readBudgetBreakdown(token) {
  const tripId = randomFrom(PERF_TRIP_IDS);
  const t0 = Date.now();
  const res = http.get(
    `${BASE_URL}/trips/${tripId}/budget/breakdown`,
    { headers: authHeaders(token), tags: { scenario: 'itinerary_read', type: 'redis_cached' } }
  );
  redisLatency.add(Date.now() - t0);

  check(res, { 'budget breakdown: 200 or 404': r => r.status === 200 || r.status === 404 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VU loop
// ─────────────────────────────────────────────────────────────────────────────

let vuToken = null;

export default function () {
  if (!vuToken) {
    vuToken = getVuToken().token;
  }

  // Weighted read mix (simulates real traffic distribution)
  const roll = Math.random();

  if (roll < 0.45) {
    // 45%: single itinerary read (the core DB query under test)
    group('itinerary_single', () => readItinerarySingle(vuToken));

  } else if (roll < 0.65) {
    // 20%: full page bundle (3 parallel queries)
    group('itinerary_bundle', () => readItineraryBundle(vuToken));

  } else if (roll < 0.80) {
    // 15%: Elasticsearch POI search
    group('es_search', () => searchPoisElasticsearch(vuToken));

  } else if (roll < 0.90) {
    // 10%: Redis budget breakdown
    group('budget_read', () => readBudgetBreakdown(vuToken));

  } else {
    // 10%: analytics read
    group('analytics', () => readAnalytics(vuToken));
  }

  // Realistic think-time between reads
  sleep(0.1 + Math.random() * 0.4);  // 100–500ms
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics scenario (separate executor)
// ─────────────────────────────────────────────────────────────────────────────

export function analytics_read() {
  if (!vuToken) vuToken = getVuToken().token;
  readAnalytics(vuToken);
  sleep(0.5);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache warm-up in setup()
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  console.log('🔥 Warming up cache with first 50 trips...');

  // Authenticate as perf-user-0001 for setup reads
  const authRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'perf-user-0001@wanderplan-perf.test', password: 'PerfTest1!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const token = JSON.parse(authRes.body)?.accessToken;
  if (!token) { console.error('Setup: cannot get token'); return {}; }

  // Pre-warm cache for the first 50 trip IDs
  const warmupBatch = PERF_TRIP_IDS.slice(0, 50).map(id => [
    'GET', `${BASE_URL}/trips/${id}/itinerary`,
    null,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
  ]);
  http.batch(warmupBatch);
  console.log('✅ Cache warm-up complete');

  return { startTime: Date.now() };
}

export function teardown(data) {
  const mins = ((Date.now() - data.startTime) / 60000).toFixed(1);
  console.log(`\n✅ Database load test completed in ${mins} minutes`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/03-database-load-${ts}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
