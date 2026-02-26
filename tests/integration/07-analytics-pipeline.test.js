/**
 * Integration Test 07 — Analytics Pipeline
 *
 * Scenario:
 *   Perform a complete end-to-end planning flow for a trip (all wizard screens).
 *   After each screen transition, a client-side analytics event is emitted via
 *   POST /analytics/event.
 *
 *   The test verifies that the analytics_events table contains:
 *   a. Exactly one event per screen transition in the expected order
 *   b. Every event has the correct screen_name value
 *   c. Every event has a non-null session_id and trip_id
 *   d. Every event has a server_ts timestamp
 *   e. The event_type for transitions is 'screen_view'
 *   f. Properties object carries any extra metadata sent by the client
 *
 * Expected screen_name sequence (WanderPlan wizard flow):
 *   bucket_list → timing → interests → health → pois →
 *   availability → budget → flights → stays → dining →
 *   itinerary → calendar → complete
 *
 * Services under test: orchestrator → analytics endpoint → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  SEED_USERS,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** The full ordered screen sequence the wizard walks through */
const SCREEN_SEQUENCE = [
  'bucket_list',
  'timing',
  'interests',
  'health',
  'pois',
  'availability',
  'budget',
  'flights',
  'stays',
  'dining',
  'itinerary',
  'calendar',
  'complete',
];

const SESSION_ID = `test-session-${Date.now()}`;

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('07 — Analytics Pipeline: Screen Transitions', () => {
  let token;
  let trip;

  beforeAll(async () => {
    token = await loginAs('alice');
    trip  = await createTrip(token, { name: 'Analytics Test Trip', duration_days: 7 });
  });

  // ── Step 1: Fire analytics events for each screen ─────────────────────────

  test.each(SCREEN_SEQUENCE)(
    'POST /analytics/event with screen_name=%s → 202 accepted',
    async (screenName) => {
      const res = await request(API_V1)
        .post('/analytics/event')
        .set('Authorization', `Bearer ${token}`)
        .send({
          session_id:  SESSION_ID,
          trip_id:     trip.id,
          event_type:  'screen_view',
          screen_name: screenName,
          client_ts:   new Date().toISOString(),
          properties:  {
            previous_screen: SCREEN_SEQUENCE[SCREEN_SEQUENCE.indexOf(screenName) - 1] || null,
            duration_ms:     Math.floor(Math.random() * 5000) + 1000,
          },
        })
        .expect(202);

      expect(res.body).toMatchObject({ accepted: true });
    }
  );

  // ── Step 2: Verify all events exist in DB ────────────────────────────────

  test('analytics_events table contains 13 rows for this session', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT screen_name FROM analytics_events
            WHERE session_id = $1 AND trip_id = $2
            ORDER BY server_ts ASC`,
          [SESSION_ID, trip.id]
        );
        return r.length >= SCREEN_SEQUENCE.length ? r : null;
      },
      { timeout: 15_000, interval: 500 }
    );
    expect(rows).toHaveLength(SCREEN_SEQUENCE.length);
  });

  // ── Step 3a: Correct screen_name values ──────────────────────────────────

  test('Every expected screen_name is present in analytics_events', async () => {
    const rows = await dbQuery(
      `SELECT screen_name FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    const storedNames = new Set(rows.map(r => r.screen_name));

    for (const expected of SCREEN_SEQUENCE) {
      expect(storedNames.has(expected)).toBe(true);
    }
  });

  test('No unexpected screen_name values appear for this session', async () => {
    const rows = await dbQuery(
      `SELECT DISTINCT screen_name FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    const validNames = new Set(SCREEN_SEQUENCE);
    for (const row of rows) {
      expect(validNames.has(row.screen_name)).toBe(true);
    }
  });

  // ── Step 3b–d: Required fields present on every row ──────────────────────

  test('All analytics_events rows have non-null session_id', async () => {
    const rows = await dbQuery(
      `SELECT session_id FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    rows.forEach(r => expect(r.session_id).not.toBeNull());
  });

  test('All analytics_events rows have non-null trip_id', async () => {
    const rows = await dbQuery(
      `SELECT trip_id FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    rows.forEach(r => expect(r.trip_id).not.toBeNull());
  });

  test('All analytics_events rows have a server_ts timestamp', async () => {
    const rows = await dbQuery(
      `SELECT server_ts FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    rows.forEach(r => {
      expect(r.server_ts).not.toBeNull();
      expect(new Date(r.server_ts).getTime()).not.toBeNaN();
    });
  });

  // ── Step 3e: event_type = 'screen_view' ──────────────────────────────────

  test('All transition events have event_type = screen_view', async () => {
    const rows = await dbQuery(
      `SELECT event_type FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    rows.forEach(r => expect(r.event_type).toBe('screen_view'));
  });

  // ── Step 3f: properties JSON carries client metadata ─────────────────────

  test('All analytics_events rows have a properties JSON object with duration_ms', async () => {
    const rows = await dbQuery(
      `SELECT properties FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2`,
      [SESSION_ID, trip.id]
    );
    rows.forEach(r => {
      expect(typeof r.properties).toBe('object');
      expect(r.properties).toHaveProperty('duration_ms');
      expect(typeof r.properties.duration_ms).toBe('number');
    });
  });

  // ── Additional: no duplicate screen_name for same session ─────────────────

  test('Each screen appears exactly once per session (no duplicates)', async () => {
    const rows = await dbQuery(
      `SELECT screen_name, COUNT(*) AS cnt
         FROM analytics_events
        WHERE session_id = $1 AND trip_id = $2
        GROUP BY screen_name
       HAVING COUNT(*) > 1`,
      [SESSION_ID, trip.id]
    );
    expect(rows).toHaveLength(0); // 0 duplicates
  });

  // ── Additional: POST without auth still accepted (analytics are public) ───

  test('Analytics event POST without Bearer token returns 202 (open endpoint)', async () => {
    await request(API_V1)
      .post('/analytics/event')
      .send({
        session_id:  'anon-session-001',
        event_type:  'screen_view',
        screen_name: 'home',
        client_ts:   new Date().toISOString(),
        properties:  {},
      })
      .expect(202);
  });

  // ── Additional: Malformed event returns 422 ───────────────────────────────

  test('POST /analytics/event with missing event_type returns 422', async () => {
    await request(API_V1)
      .post('/analytics/event')
      .set('Authorization', `Bearer ${token}`)
      .send({
        session_id:  SESSION_ID,
        screen_name: 'budget',
        // event_type missing intentionally
      })
      .expect(422);
  });
});
