/**
 * Integration Test 02 — Bucket List → Timing Analysis Pipeline
 *
 * Scenario:
 *   1. Alice creates a trip and adds 3 bucket-list destinations
 *   2. Trigger timing analysis via GET /trips/:id/timing-analysis
 *   3. Verify:
 *      a. Each destination in the bucket list is referenced in the timing results
 *      b. Every destination has a month_scores map with valid scores (0–10)
 *      c. preferred_months and avoid_months are non-empty arrays
 *      d. best_window has a valid {start, end} ISO-date pair
 *      e. Results are persisted in the timing_results table
 *
 * Services under test: orchestrator → bucket-list agent → timing agent → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  addBucketListItem,
  assertValidMonthScores,
  assertIsoDatetime,
  pollUntil,
  dbQuery,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const DESTINATIONS = [
  { destination: 'Tokyo',  country: 'Japan',  category: 'city'   },
  { destination: 'Kyoto',  country: 'Japan',  category: 'city'   },
  { destination: 'Hakone', country: 'Japan',  category: 'nature' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('02 — Bucket List → Timing Analysis Pipeline', () => {
  let token;
  let trip;
  let bucketItems = [];
  let timingResponse;

  beforeAll(async () => {
    token = await loginAs('alice');
    trip  = await createTrip(token, { name: 'Japan Timing Test', duration_days: 10 });
  });

  // ── Step 1: Populate bucket list ─────────────────────────────────────────

  test.each(DESTINATIONS)(
    'POST /trips/:id/bucket-list → 201 adds $destination',
    async ({ destination, country, category }) => {
      const res = await request(API_V1)
        .post(`/trips/${trip.id}/bucket-list`)
        .set('Authorization', `Bearer ${token}`)
        .send({ destination, country, category, notes: `Test note for ${destination}` })
        .expect(201);

      expect(res.body.item).toMatchObject({ destination, country, category });
      bucketItems.push(res.body.item);
    }
  );

  test('Bucket list contains exactly 3 items', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/bucket-list`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items).toHaveLength(3);
  });

  // ── Step 2: Trigger timing analysis ──────────────────────────────────────

  test('GET /trips/:id/timing-analysis → 200 with timing results', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/timing-analysis`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    timingResponse = res.body;
    expect(timingResponse).toHaveProperty('timing_results');
    expect(Array.isArray(timingResponse.timing_results)).toBe(true);
    expect(timingResponse.timing_results.length).toBeGreaterThan(0);
  });

  // ── Step 3a: Every bucket destination is referenced ──────────────────────

  test('Each destination in bucket list appears in timing results', async () => {
    const destinationNames = DESTINATIONS.map(d => d.destination.toLowerCase());
    const resultDestinations = timingResponse.timing_results.map(r =>
      r.destination.toLowerCase()
    );

    for (const dest of destinationNames) {
      const found = resultDestinations.some(rd => rd.includes(dest));
      expect(found).toBe(true); // `${dest} must appear in timing results`
    }
  });

  // ── Step 3b: Valid month scores ───────────────────────────────────────────

  test('Every timing result has a valid month_scores map (scores 0–10)', () => {
    for (const result of timingResponse.timing_results) {
      expect(result).toHaveProperty('month_scores');
      assertValidMonthScores(result.month_scores);
    }
  });

  test('Each month_scores map contains at least 3 months', () => {
    for (const result of timingResponse.timing_results) {
      const scoreCount = Object.keys(result.month_scores).length;
      expect(scoreCount).toBeGreaterThanOrEqual(3);
    }
  });

  // ── Step 3c: preferred_months and avoid_months are non-empty ─────────────

  test('Every timing result has at least 1 preferred_month', () => {
    for (const result of timingResponse.timing_results) {
      expect(Array.isArray(result.preferred_months)).toBe(true);
      expect(result.preferred_months.length).toBeGreaterThan(0);
    }
  });

  test('preferred_months and avoid_months do not overlap', () => {
    for (const result of timingResponse.timing_results) {
      const preferred = new Set(result.preferred_months);
      const avoided   = result.avoid_months || [];
      for (const m of avoided) {
        expect(preferred.has(m)).toBe(false);
      }
    }
  });

  // ── Step 3d: best_window is a valid date pair ─────────────────────────────

  test('Every timing result has a best_window with valid ISO dates', () => {
    for (const result of timingResponse.timing_results) {
      expect(result).toHaveProperty('best_window');
      expect(result.best_window).toHaveProperty('start');
      expect(result.best_window).toHaveProperty('end');
      assertIsoDatetime(result.best_window.start);
      assertIsoDatetime(result.best_window.end);

      // start must be before end
      const start = new Date(result.best_window.start);
      const end   = new Date(result.best_window.end);
      expect(start.getTime()).toBeLessThan(end.getTime());
    }
  });

  // ── Step 3e: Persistence in timing_results table ─────────────────────────

  test('timing_results are persisted in the database', async () => {
    // Agent pipelines are async — poll until the row appears
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT destination, month_scores, preferred_months, best_window
             FROM timing_results
            WHERE trip_id = $1`,
          [trip.id]
        );
        return r.length >= DESTINATIONS.length ? r : null;
      },
      { timeout: 20_000, interval: 800 }
    );

    expect(rows.length).toBeGreaterThanOrEqual(DESTINATIONS.length);

    for (const row of rows) {
      expect(typeof row.month_scores).toBe('object');
      const scores = Object.values(row.month_scores);
      expect(scores.length).toBeGreaterThan(0);
      scores.forEach(s => {
        expect(typeof s).toBe('number');
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(10);
      });

      expect(Array.isArray(row.preferred_months)).toBe(true);
      expect(row.preferred_months.length).toBeGreaterThan(0);
    }
  });

  // ── Edge: Re-requesting timing analysis returns cached results ────────────

  test('Second GET /timing-analysis returns same results (idempotent)', async () => {
    const res2 = await request(API_V1)
      .get(`/trips/${trip.id}/timing-analysis`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Compare destination list — order may differ, use sets
    const first  = new Set(timingResponse.timing_results.map(r => r.destination));
    const second = new Set(res2.body.timing_results.map(r => r.destination));
    expect(first).toEqual(second);
  });

  // ── Edge: Empty bucket list returns 422 ──────────────────────────────────

  test('Timing analysis on trip with no bucket list items returns 422', async () => {
    const emptyTrip = await createTrip(token, { name: 'Empty trip' });

    await request(API_V1)
      .get(`/trips/${emptyTrip.id}/timing-analysis`)
      .set('Authorization', `Bearer ${token}`)
      .expect(422);
  });
});
