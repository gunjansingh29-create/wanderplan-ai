/**
 * WanderPlan AI — Integration Test Helpers
 * Shared utilities: auth tokens, trip factory, assertion helpers, retry logic.
 */

'use strict';

const request = require('supertest');

// ─────────────────────────────────────────────────────────────────────────────
// Base configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:18000';
const API_V1   = BASE_URL;

/** Pre-seeded user credentials (must match seed.sql) */
const SEED_USERS = {
  alice: { email: 'alice@test.com', password: 'Password1!', id: '00000000-0000-0000-0000-000000000001' },
  bob:   { email: 'bob@test.com',   password: 'Password1!', id: '00000000-0000-0000-0000-000000000002' },
  carol: { email: 'carol@test.com', password: 'Password1!', id: '00000000-0000-0000-0000-000000000003' },
  dave:  { email: 'dave@test.com',  password: 'Password1!', id: '00000000-0000-0000-0000-000000000004' },
  eve:   { email: 'eve@test.com',   password: 'Password1!', id: '00000000-0000-0000-0000-000000000005' },
  frank: { email: 'frank@test.com', password: 'Password1!', id: '00000000-0000-0000-0000-000000000006' },
};

const SEEDED_TRIP_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Token cache so each test file doesn't re-authenticate on every call. */
const _tokenCache = new Map();

/**
 * Login as a seed user and return a Bearer token.
 * Results are cached per user key for the test process lifetime.
 */
async function loginAs(userKey) {
  if (_tokenCache.has(userKey)) return _tokenCache.get(userKey);

  const creds = SEED_USERS[userKey];
  if (!creds) throw new Error(`Unknown seed user: ${userKey}`);

  const res = await request(API_V1)
    .post('/auth/login')
    .send({ email: creds.email, password: creds.password })
    .expect(200);

  const token = res.body.accessToken;
  _tokenCache.set(userKey, token);
  return token;
}

/** Return supertest agent pre-authorized as `userKey`. */
function authed(agent, token) {
  return agent.set('Authorization', `Bearer ${token}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip factory helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a fresh trip as `userKey` and return the trip object.
 * Each call creates a unique trip to avoid cross-test contamination.
 */
async function createTrip(token, overrides = {}) {
  const payload = {
    name: `Test Trip ${Date.now()}`,
    destination_hint: 'Japan',
    duration_days: 7,
    ...overrides,
  };

  const res = await request(API_V1)
    .post('/trips')
    .set('Authorization', `Bearer ${token}`)
    .send(payload)
    .expect(201);

  return res.body.trip;
}

/**
 * Invite `inviteeId` to `tripId` as role 'member'.
 * Returns the invitation response.
 */
async function inviteMember(token, tripId, inviteeEmail) {
  const res = await request(API_V1)
    .post(`/trips/${tripId}/members`)
    .set('Authorization', `Bearer ${token}`)
    .send({ email: inviteeEmail, role: 'member' })
    .expect(201);

  return res.body;
}

/**
 * Accept a trip invitation as `inviteeToken`.
 * (PUT /trips/:tripId/members/:userId with status=accepted)
 */
async function acceptInvitation(token, tripId, userId) {
  const res = await request(API_V1)
    .put(`/trips/${tripId}/members/${userId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'accepted' })
    .expect(200);

  return res.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain-specific helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add a bucket list item and return the item object.
 */
async function addBucketListItem(token, tripId, destination, country = 'Japan', category = 'city') {
  const res = await request(API_V1)
    .post(`/trips/${tripId}/bucket-list`)
    .set('Authorization', `Bearer ${token}`)
    .send({ destination, country, category, notes: `Auto-added by test: ${destination}` })
    .expect(201);

  return res.body.item;
}

/**
 * Submit an interest profile for a user in a trip.
 */
async function submitInterests(token, tripId, userId, categories, intensity = 'moderate') {
  const res = await request(API_V1)
    .put(`/trips/${tripId}/members/${userId}/interests`)
    .set('Authorization', `Bearer ${token}`)
    .send({ categories, intensity, must_do: [], avoid: [] })
    .expect(200);

  return res.body;
}

/**
 * Set the trip budget (daily budget approach).
 * Returns the full budget breakdown object.
 */
async function setBudget(token, tripId, dailyBudget) {
  const res = await request(API_V1)
    .post(`/trips/${tripId}/budget`)
    .set('Authorization', `Bearer ${token}`)
    .send({ daily_budget: dailyBudget, currency: 'USD' })
    .expect(200);

  return res.body.budget;
}

/**
 * Submit availability for a user. `ranges` is an array of {start, end} strings.
 */
async function submitAvailability(token, tripId, ranges) {
  const res = await request(API_V1)
    .post(`/trips/${tripId}/availability`)
    .set('Authorization', `Bearer ${token}`)
    .send({ date_ranges: ranges })
    .expect(201);

  return res.body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Assertion utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assert that every score in a month_scores map is a number in [0, 10].
 */
function assertValidMonthScores(monthScores) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  expect(typeof monthScores).toBe('object');
  for (const m of MONTHS) {
    if (monthScores[m] !== undefined) {
      expect(typeof monthScores[m]).toBe('number');
      expect(monthScores[m]).toBeGreaterThanOrEqual(0);
      expect(monthScores[m]).toBeLessThanOrEqual(10);
    }
  }
}

/**
 * Assert an ISO 8601 datetime string is structurally valid.
 */
function assertIsoDatetime(value) {
  expect(typeof value).toBe('string');
  expect(() => new Date(value).toISOString()).not.toThrow();
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry / poll helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll `fn` (an async function returning a value) until it resolves truthy
 * or `timeout` ms elapses.  Useful for async agent pipelines.
 *
 * @param {() => Promise<any>} fn
 * @param {{ timeout?: number, interval?: number }} opts
 */
async function pollUntil(fn, { timeout = 15000, interval = 500 } = {}) {
  const deadline = Date.now() + timeout;
  let lastErr;

  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      lastErr = err;
    }
    await new Promise(r => setTimeout(r, interval));
  }

  throw lastErr || new Error(`pollUntil timed out after ${timeout}ms`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Database helpers (direct Postgres queries for verification)
// ─────────────────────────────────────────────────────────────────────────────

const { Pool } = require('pg');

let _pool;

function getPool() {
  if (!_pool) {
    _pool = new Pool({
      host:     process.env.POSTGRES_HOST     || 'localhost',
      port:     parseInt(process.env.POSTGRES_PORT || '15432', 10),
      database: process.env.POSTGRES_DB       || 'wanderplan_test',
      user:     process.env.POSTGRES_USER     || 'wanderplan',
      password: process.env.POSTGRES_PASSWORD || 'wanderplan_test',
    });
  }
  return _pool;
}

/**
 * Run a raw SQL query against the test database and return rows.
 * @param {string} sql
 * @param {any[]} [params]
 */
async function dbQuery(sql, params = []) {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Close the db pool (call in globalTeardown).
 */
async function closeDb() {
  if (_pool) {
    await _pool.end();
    _pool = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  API_V1,
  BASE_URL,
  SEED_USERS,
  SEEDED_TRIP_ID,

  // Auth
  loginAs,
  authed,

  // Trip factory
  createTrip,
  inviteMember,
  acceptInvitation,

  // Domain helpers
  addBucketListItem,
  submitInterests,
  setBudget,
  submitAvailability,

  // Assertions
  assertValidMonthScores,
  assertIsoDatetime,

  // Async
  pollUntil,

  // DB
  dbQuery,
  closeDb,
};
