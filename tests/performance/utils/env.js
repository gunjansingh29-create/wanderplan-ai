/**
 * Environment configuration for performance tests.
 *
 * All configurable values are read from k6 environment variables (__ENV)
 * so the same test scripts can target dev, staging, or production without
 * code changes.
 *
 * Usage:
 *   k6 run -e API_BASE_URL=https://staging.wanderplan.ai/v1 01-search-performance.js
 *
 * Defaults target the local Docker Compose stack (with Kong on :8080).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Target environment
// ─────────────────────────────────────────────────────────────────────────────

/** Base URL for all API calls. Kong proxy sits in front of all agents. */
export const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:8080/v1';

/** WebSocket base URL (ws:// for local, wss:// for TLS-terminated staging/prod). */
export const WS_BASE_URL = __ENV.WS_BASE_URL || 'ws://localhost:8080/v1';

/** Prometheus push gateway for real-time metrics streaming. */
export const PROM_PUSH = __ENV.PROM_PUSH_URL || 'http://localhost:9091';

// ─────────────────────────────────────────────────────────────────────────────
// Pre-seeded performance test accounts
// Seed these with: npm run db:perf-seed (runs seed/perf-users.sql)
// ─────────────────────────────────────────────────────────────────────────────

/** Round-robin pool of 200 pre-seeded user accounts. */
export const PERF_USERS = Array.from({ length: 200 }, (_, i) => ({
  email:    `perf-user-${String(i + 1).padStart(4, '0')}@wanderplan-perf.test`,
  password: 'PerfTest1!',
  name:     `Perf User ${i + 1}`,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Pre-seeded trip IDs for read-heavy tests (avoid creation overhead)
// IDs are in the format 'perf-trip-NNNN' — seeded by seed/perf-trips.sql
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pool of pre-seeded trip IDs that already have full itinerary data.
 * Used by the database load test so we don't pay for creation cost.
 */
export const PERF_TRIP_IDS = Array.from(
  { length: 500 },
  (_, i) => `aaaaaaaa-aaaa-aaaa-aaaa-${String(i + 1).padStart(12, '0')}`
);

// ─────────────────────────────────────────────────────────────────────────────
// Default HTTP headers
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept':       'application/json',
};

// ─────────────────────────────────────────────────────────────────────────────
// Search parameter pools (randomised to prevent caching skewing results)
// ─────────────────────────────────────────────────────────────────────────────

export const ORIGIN_AIRPORTS = [
  'LAX', 'JFK', 'ORD', 'DFW', 'SFO', 'MIA', 'SEA', 'BOS',
  'ATL', 'DEN', 'LHR', 'CDG', 'FRA', 'AMS', 'SIN', 'HKG',
];

export const DESTINATION_AIRPORTS = [
  'NRT', 'HND', 'ICN', 'BKK', 'SYD', 'DXB', 'FCO', 'BCN',
  'LIS', 'GRU', 'MEX', 'YYZ', 'CPT', 'NBO', 'DEL', 'BOM',
];

export const AIRLINES = [
  'Japan Airlines', 'Emirates', 'ANA', 'Singapore Airlines',
  'Qantas', 'British Airways', 'Lufthansa', 'Air France',
  'Turkish Airlines', 'Korean Air', null, null, null,  // nulls = "any airline"
];

export const CABIN_CLASSES = ['economy', 'premium_economy', 'business', 'first'];

// ─────────────────────────────────────────────────────────────────────────────
// k6 execution parameters (reasonable defaults, overridable via __ENV)
// ─────────────────────────────────────────────────────────────────────────────

export const VU_RAMP_UP_SECONDS  = parseInt(__ENV.RAMP_UP   || '30');
export const VU_RAMP_DOWN_SECONDS = parseInt(__ENV.RAMP_DOWN || '30');
export const SLEEP_MIN           = parseFloat(__ENV.SLEEP_MIN || '0.5');
export const SLEEP_MAX           = parseFloat(__ENV.SLEEP_MAX || '2.0');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Pick a random element from an array. */
export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Random integer between lo (inclusive) and hi (inclusive). */
export function randInt(lo, hi) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** ISO date string for N days from today. */
export function isoDatePlusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Sleep for a random duration between SLEEP_MIN and SLEEP_MAX seconds. */
import { sleep } from 'k6';
export function thinkTime() {
  sleep(SLEEP_MIN + Math.random() * (SLEEP_MAX - SLEEP_MIN));
}
