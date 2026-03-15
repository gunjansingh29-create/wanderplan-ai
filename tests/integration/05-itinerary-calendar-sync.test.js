/**
 * Integration Test 05 — Itinerary Approval → Calendar Sync
 *
 * Scenario:
 *   1. Build a fully-seeded 5-day trip with 30 itinerary activities (6/day)
 *   2. Approve the itinerary via POST /trips/:id/itinerary/approve
 *   3. Trigger calendar sync via POST /trips/:id/itinerary/calendar-sync
 *      (provider: google, calendar_id: 'test-calendar-id')
 *   4. Query mock Calendar API and verify:
 *      a. Exactly 30 calendar events were created
 *      b. Every event has a non-empty summary (title)
 *      c. Every event has start.dateTime and end.dateTime in ISO-8601
 *      d. Every event has a non-empty location string
 *      e. No two events in the same day have overlapping time slots
 *   5. Verify calendar_events table mirrors what was sent to the mock API
 *
 * Services under test:
 *   orchestrator → itinerary-agent → calendar-agent → mock Calendar API → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  addBucketListItem,
  assertIsoDatetime,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CALENDAR_API = process.env.MOCK_API_URL || 'http://localhost:4000';
const CALENDAR_ID       = 'test-calendar-id';
const TRIP_DAYS         = 5;
const ACTIVITIES_PER_DAY = 6;
const TOTAL_ACTIVITIES  = TRIP_DAYS * ACTIVITIES_PER_DAY; // 30

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the itinerary by directly seeding activities into the DB.
 * This simulates an already-generated itinerary so the test focuses
 * on the approval + sync pipeline, not itinerary generation.
 */
async function seedItinerary(tripId) {
  const startDate = new Date('2025-03-20');

  for (let day = 1; day <= TRIP_DAYS; day++) {
    const dayDate = new Date(startDate);
    dayDate.setDate(startDate.getDate() + day - 1);
    const dateStr = dayDate.toISOString().slice(0, 10);

    const [dayRow] = await dbQuery(
      `INSERT INTO itinerary_days (trip_id, day_number, date, title, approved)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id`,
      [tripId, day, dateStr, `Day ${day} — Tokyo Highlights`]
    );

    const DAILY_SLOTS = [
      '08:00', '10:00', '12:00', '14:00', '16:30', '19:00',
    ];

    for (let slot = 0; slot < ACTIVITIES_PER_DAY; slot++) {
      const startHour  = DAILY_SLOTS[slot];
      const endHour    = DAILY_SLOTS[slot + 1] || '21:00';
      const timeSlot   = `${startHour}-${endHour}`;
      const actTitle   = `Day${day} Activity${slot + 1}`;
      const locationName = `Location_D${day}A${slot + 1}, Tokyo, Japan`;

      await dbQuery(
        `INSERT INTO itinerary_activities
           (day_id, time_slot, title, description, category, location_name, lat, lng, cost_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          dayRow.id,
          timeSlot,
          actTitle,
          `Auto-seeded activity for integration test. Day ${day}, slot ${slot + 1}.`,
          slot % 2 === 0 ? 'sightseeing' : 'dining',
          locationName,
          35.6762 + slot * 0.01,
          139.6503 + slot * 0.01,
          slot * 10,
        ]
      );
    }
  }
}

/**
 * Fetch all events from the mock Calendar API.
 */
async function getMockCalendarEvents() {
  const res = await request(MOCK_CALENDAR_API)
    .get('/calendar/test-all-events')
    .expect(200);
  return res.body.items;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('05 — Itinerary Approval → Calendar Sync (30 events)', () => {
  let token;
  let trip;
  let calendarEvents = [];

  beforeAll(async () => {
    token = await loginAs('alice');
    trip  = await createTrip(token, {
      name:          'Calendar Sync Test',
      duration_days: TRIP_DAYS,
    });
    await addBucketListItem(token, trip.id, 'Tokyo', 'Japan', 'city');

    // Seed the itinerary directly into the DB
    await seedItinerary(trip.id);

    // Reset mock Calendar API event store
    await request(MOCK_CALENDAR_API)
      .delete('/calendar/test-reset')
      .expect(204);
  });

  // ── Step 2: Approve itinerary ─────────────────────────────────────────────

  test('POST /trips/:id/itinerary/approve → 200 approval confirmation', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/itinerary/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true })
      .expect(200);

    expect(res.body).toMatchObject({
      approved: true,
      trip: expect.objectContaining({
        id: trip.id,
        status: 'active',
      }),
    });
  });

  test('All itinerary_days are marked approved=true after approval', async () => {
    const rows = await dbQuery(
      `SELECT approved FROM itinerary_days WHERE trip_id = $1`,
      [trip.id]
    );
    expect(rows).toHaveLength(TRIP_DAYS);
    rows.forEach(r => expect(r.approved).toBe(true));
  });

  test('Trip status becomes active after itinerary approval', async () => {
    const rows = await dbQuery(
      `SELECT status FROM trips WHERE id = $1`,
      [trip.id]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('active');
  });

  // ── Step 3: Trigger calendar sync ────────────────────────────────────────

  test('POST /trips/:id/itinerary/calendar-sync → 200 sync initiated', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/itinerary/calendar-sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        provider:    'google',
        calendar_id: CALENDAR_ID,
        access_token: 'mock-google-oauth-token',
      })
      .expect(200);

    expect(res.body).toMatchObject({ synced: true });
    expect(res.body.events_created).toBe(TOTAL_ACTIVITIES);
  });

  // ── Step 4a: Exactly 30 events created ───────────────────────────────────

  test(`Mock Calendar API received exactly ${TOTAL_ACTIVITIES} events`, async () => {
    calendarEvents = await pollUntil(
      async () => {
        const events = await getMockCalendarEvents();
        return events.length >= TOTAL_ACTIVITIES ? events : null;
      },
      { timeout: 20_000, interval: 1000 }
    );

    expect(calendarEvents).toHaveLength(TOTAL_ACTIVITIES);
  });

  // ── Step 4b: Every event has a non-empty title ────────────────────────────

  test('Every calendar event has a non-empty summary (title)', () => {
    for (const evt of calendarEvents) {
      expect(typeof evt.summary).toBe('string');
      expect(evt.summary.trim().length).toBeGreaterThan(0);
    }
  });

  // ── Step 4c: Valid ISO-8601 start and end times ───────────────────────────

  test('Every calendar event has valid ISO-8601 start.dateTime and end.dateTime', () => {
    for (const evt of calendarEvents) {
      expect(evt.start).toBeDefined();
      expect(evt.end).toBeDefined();

      assertIsoDatetime(evt.start.dateTime || evt.start.date);
      assertIsoDatetime(evt.end.dateTime   || evt.end.date);

      const startMs = new Date(evt.start.dateTime || evt.start.date).getTime();
      const endMs   = new Date(evt.end.dateTime   || evt.end.date).getTime();
      expect(endMs).toBeGreaterThan(startMs);
    }
  });

  // ── Step 4d: Every event has a location ──────────────────────────────────

  test('Every calendar event has a non-empty location string', () => {
    for (const evt of calendarEvents) {
      expect(typeof evt.location).toBe('string');
      expect(evt.location.trim().length).toBeGreaterThan(0);
    }
  });

  // ── Step 4e: No overlapping events within the same day ───────────────────

  test('No two events in the same day have overlapping time windows', () => {
    // Group events by calendar date
    const byDate = new Map();
    for (const evt of calendarEvents) {
      const dateKey = (evt.start.dateTime || evt.start.date).slice(0, 10);
      if (!byDate.has(dateKey)) byDate.set(dateKey, []);
      byDate.get(dateKey).push(evt);
    }

    for (const [date, events] of byDate) {
      // Sort by start time
      const sorted = [...events].sort((a, b) => {
        const aMs = new Date(a.start.dateTime || a.start.date).getTime();
        const bMs = new Date(b.start.dateTime || b.start.date).getTime();
        return aMs - bMs;
      });

      for (let i = 0; i < sorted.length - 1; i++) {
        const thisEnd   = new Date(sorted[i].end.dateTime   || sorted[i].end.date).getTime();
        const nextStart = new Date(sorted[i+1].start.dateTime || sorted[i+1].start.date).getTime();
        expect(thisEnd).toBeLessThanOrEqual(nextStart);
        // `Overlap detected on ${date} between events ${i} and ${i+1}`
      }
    }
  });

  // ── Step 5: DB mirror ─────────────────────────────────────────────────────

  test(`calendar_events table contains ${TOTAL_ACTIVITIES} rows for this trip`, async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT id FROM calendar_events WHERE trip_id = $1`,
          [trip.id]
        );
        return r.length >= TOTAL_ACTIVITIES ? r : null;
      },
      { timeout: 20_000 }
    );
    expect(rows).toHaveLength(TOTAL_ACTIVITIES);
  });

  test('Each calendar_events row has a synced_at timestamp', async () => {
    const rows = await dbQuery(
      `SELECT synced_at, event_title FROM calendar_events WHERE trip_id = $1`,
      [trip.id]
    );
    for (const row of rows) {
      expect(row.synced_at).not.toBeNull();
      assertIsoDatetime(row.synced_at.toISOString());
    }
  });

  test('calendar_events titles match itinerary activity titles', async () => {
    const activityTitles = await dbQuery(
      `SELECT ia.title
         FROM itinerary_activities ia
         JOIN itinerary_days id2 ON ia.day_id = id2.id
        WHERE id2.trip_id = $1`,
      [trip.id]
    );
    const titleSet = new Set(activityTitles.map(r => r.title));

    const calendarTitles = await dbQuery(
      `SELECT event_title FROM calendar_events WHERE trip_id = $1`,
      [trip.id]
    );

    for (const row of calendarTitles) {
      expect(titleSet.has(row.event_title)).toBe(true);
    }
  });
});
