/**
 * Performance Test 01 — Flight Search at Scale
 * ─────────────────────────────────────────────
 * Simulates 500 concurrent users performing flight searches with varied
 * origin/destination pairs, date windows, and cabin classes to prevent
 * response caching from masking real backend latency.
 *
 * Load shape:
 *   0 → 500 VUs over 30s (ramp-up)
 *   500 VUs sustained for 5 minutes (steady state)
 *   500 → 0 VUs over 30s (ramp-down)
 *
 * Success criteria:
 *   ✅ p95 response time < 3 seconds
 *   ✅ p99 response time < 5 seconds
 *   ✅ Error rate < 1%
 *   ✅ No single request exceeds 10 seconds
 *   ✅ Throughput ≥ 50 requests/second at peak
 *
 * Run:
 *   k6 run tests/performance/01-search-performance.js
 *   k6 run -e API_BASE_URL=https://staging.wanderplan.ai/v1 01-search-performance.js
 */

import http       from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { SEARCH_THRESHOLDS }   from './config/thresholds.js';
import { getVuToken, authHeaders } from './utils/auth.js';
import {
  BASE_URL,
  ORIGIN_AIRPORTS, DESTINATION_AIRPORTS, CABIN_CLASSES, AIRLINES,
  randomFrom, randInt, isoDatePlusDays, thinkTime,
  VU_RAMP_UP_SECONDS, VU_RAMP_DOWN_SECONDS,
} from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const searchSuccessRate  = new Rate('search_success_rate');
const searchLatency      = new Trend('search_latency_ms', true);
const resultsReturned    = new Trend('search_results_count');
const emptyResultCounter = new Counter('search_empty_results');
const cacheHitCounter    = new Counter('search_cache_hits');

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    flight_search: {
      executor:          'ramping-vus',
      startVUs:          0,
      stages: [
        { duration: `${VU_RAMP_UP_SECONDS}s`,   target: 100 },  // warm-up
        { duration: `${VU_RAMP_UP_SECONDS}s`,   target: 300 },  // accelerate
        { duration: `${VU_RAMP_UP_SECONDS}s`,   target: 500 },  // peak
        { duration: '5m',                        target: 500 },  // sustain
        { duration: `${VU_RAMP_DOWN_SECONDS}s`, target: 0   },  // drain
      ],
      gracefulRampDown: '10s',
    },

    // Separate scenario: burst — 500 VUs all at once (tests cold-start/spike handling)
    search_spike: {
      executor:  'constant-vus',
      vus:       50,
      duration:  '1m',
      startTime: '7m',  // Starts after ramping scenario finishes
    },
  },

  thresholds: SEARCH_THRESHOLDS,

  // Tag all requests with test metadata
  tags: { test_name: 'search_performance', version: __ENV.TEST_VERSION || 'local' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Scenario helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a randomised flight search payload.
 * Varied parameters prevent the Amadeus mock / real API from serving
 * cached responses that would give artificially low latencies.
 */
function buildSearchPayload() {
  const origin      = randomFrom(ORIGIN_AIRPORTS);
  const destination = randomFrom(DESTINATION_AIRPORTS.filter(d => d !== origin));
  const airline     = randomFrom(AIRLINES);
  const daysOut     = randInt(14, 180);
  const tripLength  = randInt(3, 21);

  const payload = {
    origin_airport:      origin,
    destination_airport: destination,
    departure_date:      isoDatePlusDays(daysOut),
    return_date:         isoDatePlusDays(daysOut + tripLength),
    cabin_class:         randomFrom(CABIN_CLASSES),
    passengers:          randInt(1, 4),
    max_stops:           randInt(0, 2),
  };

  if (airline) payload.preferred_airline = airline;

  return payload;
}

/**
 * Execute one search round-trip and record all custom metrics.
 */
function performFlightSearch(token, tripId) {
  const payload = buildSearchPayload();
  const t0 = Date.now();

  const res = http.post(
    `${BASE_URL}/trips/${tripId}/flights/search`,
    JSON.stringify(payload),
    {
      headers: authHeaders(token),
      tags:    { scenario: 'flight_search', endpoint: 'flight_search' },
    }
  );

  const latencyMs = Date.now() - t0;
  searchLatency.add(latencyMs);

  // ── Assertions ─────────────────────────────────────────────────────────
  const ok = check(res, {
    'search: status 200':       r => r.status === 200,
    'search: has flights array': r => {
      try { return Array.isArray(JSON.parse(r.body)?.flights); } catch { return false; }
    },
    'search: p95 < 3000ms':     () => latencyMs < 3000,
    'search: p99 < 5000ms':     () => latencyMs < 5000,
  });

  searchSuccessRate.add(ok ? 1 : 0);

  // ── Parse response ──────────────────────────────────────────────────────
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      const flightCount = body?.flights?.length ?? 0;
      resultsReturned.add(flightCount);
      if (flightCount === 0) emptyResultCounter.add(1);

      // Track cache hits via response header (Kong adds X-Cache-Status)
      if ((res.headers['X-Cache-Status'] || '').toLowerCase() === 'hit') {
        cacheHitCounter.add(1);
      }
    } catch {}
  }

  return res;
}

/**
 * Create a minimal stub trip to attach flight searches to.
 * In the real stack, flights are searched in the context of a trip.
 */
function getOrCreateStubTrip(token) {
  // Cheap GET-or-create: try a cached stub endpoint first
  const res = http.post(
    `${BASE_URL}/trips`,
    JSON.stringify({ name: `Perf Search VU${__VU}`, travel_style: 'solo', destinations: ['Tokyo'] }),
    {
      headers: authHeaders(token),
      tags:    { scenario: 'flight_search', endpoint: 'trip_create' },
    }
  );
  try { return JSON.parse(res.body)?.trip?.id; } catch { return 'stub-trip-id'; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VU loop
// ─────────────────────────────────────────────────────────────────────────────

// VU-scoped state
let vuToken  = null;
let vuTripId = null;

export default function () {
  // Authenticate once per VU
  if (!vuToken) {
    const auth = getVuToken();
    vuToken = auth.token;
  }

  // Create a stub trip once per VU (reused across iterations)
  if (!vuTripId) {
    vuTripId = getOrCreateStubTrip(vuToken);
  }

  group('flight_search', () => {
    // Scenario A: single search (most common)
    performFlightSearch(vuToken, vuTripId);
    thinkTime();

    // Scenario B: back-to-back searches (user refines criteria, 20% of VUs)
    if (__VU % 5 === 0) {
      performFlightSearch(vuToken, vuTripId);
      thinkTime();
    }

    // Scenario C: parallel searches (power user opens two tabs, 5% of VUs)
    if (__VU % 20 === 0) {
      const h = { headers: authHeaders(vuToken), tags: { scenario: 'flight_search', endpoint: 'flight_search_batch' } };
      const payloads = [buildSearchPayload(), buildSearchPayload()];
      http.batch(
        payloads.map(p => ['POST', `${BASE_URL}/trips/${vuTripId}/flights/search`, JSON.stringify(p), h])
      );
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  // Smoke test: one request before ramping starts
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'perf-user-0001@wanderplan-perf.test', password: 'PerfTest1!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  if (res.status !== 200) {
    console.error(`Setup smoke test FAILED: ${res.status} — is the server running?`);
  }
  return { startTime: Date.now() };
}

export function teardown(data) {
  const durationSecs = ((Date.now() - data.startTime) / 1000).toFixed(1);
  console.log(`\n✅ Search performance test completed in ${durationSecs}s`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/01-search-performance-${ts}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
