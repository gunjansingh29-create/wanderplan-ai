/**
 * Integration Test 09 — Availability Edge Cases: No Overlapping Dates
 *
 * Scenario:
 *   5 members each submit availability windows that have ZERO overlap:
 *     - Alice:  2025-03-01 → 2025-03-07   (early March)
 *     - Bob:    2025-03-15 → 2025-03-21   (mid-March)
 *     - Carol:  2025-04-01 → 2025-04-07   (early April)
 *     - Dave:   2025-04-20 → 2025-04-26   (late April)
 *     - Eve:    2025-05-10 → 2025-05-16   (mid-May)
 *
 *   The availability agent should:
 *   a. Return { overlap: null } or an empty windows array from /availability/overlap
 *   b. Instead provide "closest_windows" — ranked suggestions of the narrowest
 *      gap windows where fewest members need to adjust
 *   c. Include a prompt_members_to_adjust flag = true
 *   d. Each closest_window suggestion must include:
 *        - window: { start, end }
 *        - members_available: list of user_ids who CAN make this window
 *        - members_to_adjust: list of user_ids who would need to move dates
 *        - overlap_days: integer > 0
 *   e. The suggestion with the most members_available should rank first
 *   f. All windows span ≥ 3 days (minimum viable trip window)
 *
 * Services under test: orchestrator → availability-agent → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  acceptInvitation,
  submitAvailability,
  SEED_USERS,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures — non-overlapping windows
// ─────────────────────────────────────────────────────────────────────────────

const AVAILABILITY_MAP = {
  alice: [{ start: '2025-03-01', end: '2025-03-07' }],
  bob:   [{ start: '2025-03-15', end: '2025-03-21' }],
  carol: [{ start: '2025-04-01', end: '2025-04-07' }],
  dave:  [{ start: '2025-04-20', end: '2025-04-26' }],
  eve:   [{ start: '2025-05-10', end: '2025-05-16' }],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function daysBetween(startStr, endStr) {
  const msPerDay = 86_400_000;
  return (new Date(endStr) - new Date(startStr)) / msPerDay;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('09 — Availability Edge Cases: No Overlapping Dates (5 Members)', () => {
  let tokens = {};
  let trip;
  let overlapResponse;

  beforeAll(async () => {
    // Login all 5 members
    const keys = ['alice', 'bob', 'carol', 'dave', 'eve'];
    const results = await Promise.all(keys.map(k => loginAs(k)));
    keys.forEach((k, i) => { tokens[k] = results[i]; });

    // Alice creates the trip
    trip = await createTrip(tokens.alice, { name: 'No-Overlap Availability Test', duration_days: 5 });

    // Invite all others
    for (const [key, user] of Object.entries({
      bob:   SEED_USERS.bob,
      carol: SEED_USERS.carol,
      dave:  SEED_USERS.dave,
      eve:   SEED_USERS.eve,
    })) {
      await inviteMember(tokens.alice, trip.id, user.email);
      await acceptInvitation(tokens[key], trip.id, user.id);
    }
  });

  // ── Step 1: Submit non-overlapping availability ───────────────────────────

  test.each(Object.entries(AVAILABILITY_MAP))(
    '%s submits availability → 201',
    async (userKey, ranges) => {
      const res = await request(API_V1)
        .post(`/trips/${trip.id}/availability`)
        .set('Authorization', `Bearer ${tokens[userKey]}`)
        .send({ date_ranges: ranges })
        .expect(201);

      expect(res.body).toMatchObject({ user_id: SEED_USERS[userKey].id });
    }
  );

  test('All 5 availability windows stored in DB', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT user_id, start_date, end_date FROM availability_windows
            WHERE trip_id = $1`,
          [trip.id]
        );
        return r.length >= 5 ? r : null;
      },
      { timeout: 10_000 }
    );
    expect(rows).toHaveLength(5);
  });

  // ── Step 2: Request overlap ───────────────────────────────────────────────

  test('GET /trips/:id/availability/overlap → 200 response', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/availability/overlap`)
      .set('Authorization', `Bearer ${tokens.alice}`)
      .expect(200);

    overlapResponse = res.body;
    expect(overlapResponse).toBeDefined();
  });

  // ── Step 3a: No overlap found ─────────────────────────────────────────────

  test('overlap field is null or empty when no common dates exist', () => {
    const overlap = overlapResponse.overlap;
    // Should be null, undefined, or an empty array — NOT a populated window
    const hasNoOverlap =
      overlap === null ||
      overlap === undefined ||
      (Array.isArray(overlap) && overlap.length === 0);
    expect(hasNoOverlap).toBe(true);
  });

  // ── Step 3b: Closest-window suggestions provided ─────────────────────────

  test('Response includes closest_windows array with ≥ 1 suggestion', () => {
    expect(overlapResponse).toHaveProperty('closest_windows');
    expect(Array.isArray(overlapResponse.closest_windows)).toBe(true);
    expect(overlapResponse.closest_windows.length).toBeGreaterThan(0);
  });

  test('Each closest_window suggestion has required fields', () => {
    for (const suggestion of overlapResponse.closest_windows) {
      expect(suggestion).toHaveProperty('window');
      expect(suggestion.window).toHaveProperty('start');
      expect(suggestion.window).toHaveProperty('end');
      expect(suggestion).toHaveProperty('members_available');
      expect(suggestion).toHaveProperty('members_to_adjust');
      expect(suggestion).toHaveProperty('overlap_days');

      expect(Array.isArray(suggestion.members_available)).toBe(true);
      expect(Array.isArray(suggestion.members_to_adjust)).toBe(true);
      expect(typeof suggestion.overlap_days).toBe('number');
    }
  });

  test('All suggested windows span ≥ 3 days (minimum viable trip)', () => {
    for (const suggestion of overlapResponse.closest_windows) {
      const days = daysBetween(suggestion.window.start, suggestion.window.end);
      expect(days).toBeGreaterThanOrEqual(3);
    }
  });

  test('members_available + members_to_adjust = 5 for each suggestion', () => {
    const TOTAL_MEMBERS = 5;
    for (const suggestion of overlapResponse.closest_windows) {
      const total = suggestion.members_available.length + suggestion.members_to_adjust.length;
      expect(total).toBe(TOTAL_MEMBERS);
    }
  });

  test('overlap_days is positive for every suggestion', () => {
    for (const suggestion of overlapResponse.closest_windows) {
      expect(suggestion.overlap_days).toBeGreaterThan(0);
    }
  });

  // ── Step 3c: prompt_members_to_adjust flag ────────────────────────────────

  test('Response has prompt_members_to_adjust = true', () => {
    expect(overlapResponse.prompt_members_to_adjust).toBe(true);
  });

  test('Response includes a human-readable message about adjusting dates', () => {
    expect(typeof overlapResponse.message).toBe('string');
    expect(overlapResponse.message.length).toBeGreaterThan(0);
    // Should mention adjusting or no overlap
    const lower = overlapResponse.message.toLowerCase();
    const mentionsConflict =
      lower.includes('overlap') ||
      lower.includes('conflict') ||
      lower.includes('adjust') ||
      lower.includes('no common');
    expect(mentionsConflict).toBe(true);
  });

  // ── Step 3e: Best suggestion ranks first ─────────────────────────────────

  test('Suggestions are ranked by members_available (descending — most available first)', () => {
    const suggestions = overlapResponse.closest_windows;
    for (let i = 0; i < suggestions.length - 1; i++) {
      expect(suggestions[i].members_available.length).toBeGreaterThanOrEqual(
        suggestions[i + 1].members_available.length
      );
    }
  });

  // ── Edge: Partial overlap scenario (control test) ─────────────────────────

  test('Adding overlapping availability for all members resolves to a valid window', async () => {
    const sharedTrip = await createTrip(tokens.alice, { name: 'Shared Dates Test', duration_days: 5 });

    // All 5 members submit the same window
    const sharedRange = [{ start: '2025-06-01', end: '2025-06-10' }];
    for (const [key, user] of Object.entries(SEED_USERS).slice(0, 5)) {
      if (key === 'alice') {
        await submitAvailability(tokens.alice, sharedTrip.id, sharedRange);
      } else {
        // Invite and accept first
        try {
          await inviteMember(tokens.alice, sharedTrip.id, user.email);
          await acceptInvitation(tokens[key], sharedTrip.id, user.id);
        } catch { /* member might already exist */ }
        await submitAvailability(tokens[key], sharedTrip.id, sharedRange);
      }
    }

    const res = await request(API_V1)
      .get(`/trips/${sharedTrip.id}/availability/overlap`)
      .set('Authorization', `Bearer ${tokens.alice}`)
      .expect(200);

    // Should find a real overlap
    const overlap = res.body.overlap;
    expect(overlap).not.toBeNull();
    expect(new Date(overlap.start).getTime()).not.toBeNaN();
    expect(new Date(overlap.end).getTime()).not.toBeNaN();
  });
});
