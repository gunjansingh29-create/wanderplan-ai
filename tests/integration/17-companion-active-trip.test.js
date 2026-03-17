'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  dbQuery,
} = require('./setup/helpers');

async function seedSimpleItinerary(tripId) {
  const dates = ['2026-06-01', '2026-06-02'];
  for (let i = 0; i < dates.length; i++) {
    const [dayRow] = await dbQuery(
      `INSERT INTO itinerary_days (trip_id, day_number, date, title, approved)
       VALUES ($1, $2, $3, $4, false)
       RETURNING id`,
      [tripId, i + 1, dates[i], i === 0 ? 'Arrival Day' : 'Culture Day']
    );
    await dbQuery(
      `INSERT INTO itinerary_activities
         (day_id, time_slot, title, description, category, location_name, lat, lng, cost_estimate)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        dayRow.id,
        i === 0 ? '09:00-10:00' : '10:00-11:30',
        i === 0 ? 'Land in Tokyo' : 'Senso-ji Temple',
        'Companion endpoint integration seed',
        i === 0 ? 'flight' : 'culture',
        i === 0 ? 'Haneda Airport' : 'Asakusa',
        35.67,
        139.65,
        0,
      ]
    );
    if (i === 0) {
      await dbQuery(
        `INSERT INTO itinerary_activities
           (day_id, time_slot, title, description, category, location_name, lat, lng, cost_estimate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          dayRow.id,
          '13:00-14:00',
          'Check in at hotel',
          'Companion endpoint integration seed',
          'checkin',
          'Shinjuku',
          35.69,
          139.70,
          0,
        ]
      );
    }
  }
}

describe('17 - active trip companion payload', () => {
  test('GET /trips/:id/companion returns active trip summary after itinerary approval', async () => {
    const ownerToken = await loginAs('alice');
    const trip = await createTrip(ownerToken, {
      name: 'Companion Activation Test',
      duration_days: 2,
    });

    await dbQuery(
      `INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (trip_id)
       DO UPDATE SET current_step = EXCLUDED.current_step,
                     state = EXCLUDED.state,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
      [
        trip.id,
        14,
        JSON.stringify({
          availability_locked_window: {
            start: '2026-06-01',
            end: '2026-06-02',
          },
          stay_options: [
            {
              name: 'Tokyo Central Hotel',
              destination: 'Tokyo',
              type: 'Hotel',
              ratePerNight: 190,
              totalNights: 1,
              bookingSource: 'WanderPlan Search',
              whyThisOne: 'Close to today\'s arrival.',
            },
          ],
          stay_final_choices: {
            Tokyo: 'stay:tokyo-central-hotel-tokyo-hotel',
          },
          meal_plan: [
            {
              day: 1,
              date: '2026-06-01',
              destination: 'Tokyo',
              meals: [
                {
                  type: 'Dinner',
                  time: '19:00',
                  name: 'Izakaya Hanabi',
                  cuisine: 'Japanese',
                  cost: 42,
                },
              ],
            },
          ],
          companion_checkins: {
            '00000000-0000-0000-0000-000000000000': {
              status: 'pending',
            },
          },
        }),
        '00000000-0000-0000-0000-000000000001',
      ]
    );
    await seedSimpleItinerary(trip.id);

    await request(API_V1)
      .post(`/trips/${trip.id}/itinerary/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approved: true })
      .expect(200);

    const res = await request(API_V1)
      .get(`/trips/${trip.id}/companion`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.companion.trip).toMatchObject({
      id: trip.id,
      name: 'Companion Activation Test',
      status: 'active',
      duration_days: 2,
    });
    expect(res.body.companion.is_ready).toBe(true);
    expect(res.body.companion.readiness_reason).toBeNull();
    expect(res.body.companion.locked_window).toEqual({
      start: '2026-06-01',
      end: '2026-06-02',
    });
    expect(res.body.companion.today).toMatchObject({
      day_number: 1,
      title: 'Arrival Day',
    });
    expect(res.body.companion.today.items[0]).toMatchObject({
      title: 'Land in Tokyo',
      location: 'Haneda Airport',
    });
    expect(res.body.companion.stats).toMatchObject({
      day_count: 2,
      approved_days: 2,
      item_count: 3,
    });
    expect(res.body.companion.current_item).toMatchObject({
      title: 'Land in Tokyo',
    });
    expect(res.body.companion.next_item).toMatchObject({
      title: 'Check in at hotel',
    });
    expect(res.body.companion.stays[0]).toMatchObject({
      destination: 'Tokyo',
      name: 'Tokyo Central Hotel',
    });
    expect(res.body.companion.today_meals[0]).toMatchObject({
      type: 'Dinner',
      name: 'Izakaya Hanabi',
    });
  });

  test('PUT /trips/:id/planning-state check-ins show up in companion progress', async () => {
    const ownerToken = await loginAs('alice');
    const trip = await createTrip(ownerToken, {
      name: 'Companion Live Check-in Test',
      duration_days: 2,
    });
    await seedSimpleItinerary(trip.id);

    await request(API_V1)
      .post(`/trips/${trip.id}/itinerary/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approved: true })
      .expect(200);

    await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        merge: true,
        state: {
          companion_checkins: {
            '00000000-0000-0000-0000-000000000000': { status: 'pending' },
            'not-a-real-id': { status: 'pending' },
            '': { status: 'pending' },
            'a-ignore': { status: 'pending' },
            act_seed_placeholder: { status: 'pending' },
          },
        },
      })
      .expect(200);

    const activityRows = await dbQuery(
      `SELECT id, title FROM itinerary_activities
       WHERE day_id IN (SELECT id FROM itinerary_days WHERE trip_id = $1 AND day_number = 1)
       ORDER BY time_slot ASC`,
      [trip.id]
    );
    const firstActivityId = activityRows[0].id;

    await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        merge: true,
        state: {
          companion_checkins: {
            [firstActivityId]: {
              status: 'done',
              updated_by: '00000000-0000-0000-0000-000000000001',
              updated_by_name: 'Alice Chen',
              updated_at: '2026-06-01T09:30:00Z',
              day_number: 1,
            },
          },
        },
      })
      .expect(200);

    const res = await request(API_V1)
      .get(`/trips/${trip.id}/companion`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.companion.day_progress).toMatchObject({
      total_items: 2,
      done: 1,
      completion_pct: 50,
    });
    expect(res.body.companion.today.items[0]).toMatchObject({
      title: 'Land in Tokyo',
      live_status: 'done',
      live_updated_by_name: 'Alice Chen',
    });
    expect(res.body.companion.today_checkins[0]).toMatchObject({
      activity_id: firstActivityId,
      status: 'done',
      updated_by_name: 'Alice Chen',
    });
  });

  test('GET /trips/:id/companion rejects pending invitees', async () => {
    const ownerToken = await loginAs('alice');
    const bobToken = await loginAs('bob');
    const trip = await createTrip(ownerToken, {
      name: 'Companion Access Control Test',
      duration_days: 2,
    });

    await inviteMember(ownerToken, trip.id, 'bob@test.com');
    await dbQuery(`UPDATE trips SET status = 'active' WHERE id = $1`, [trip.id]);

    const res = await request(API_V1)
      .get(`/trips/${trip.id}/companion`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);

    expect(String(res.body.detail || '')).toMatch(/accepted trip members/i);
  });

  test('GET /trips/:id/companion returns not-ready state for inconsistent active trips', async () => {
    const ownerToken = await loginAs('alice');
    const trip = await createTrip(ownerToken, {
      name: 'Companion Not Ready Test',
      duration_days: 4,
    });

    await dbQuery(`UPDATE trips SET status = 'active' WHERE id = $1`, [trip.id]);
    await dbQuery(
      `INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (trip_id)
       DO UPDATE SET current_step = EXCLUDED.current_step,
                     state = EXCLUDED.state,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
      [
        trip.id,
        4,
        JSON.stringify({ availability_locked_window: null }),
        '00000000-0000-0000-0000-000000000001',
      ]
    );

    const res = await request(API_V1)
      .get(`/trips/${trip.id}/companion`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.companion.trip.status).toBe('active');
    expect(res.body.companion.is_ready).toBe(false);
    expect(res.body.companion.readiness_reason).toBe('locked_dates_and_itinerary_required');
    expect(res.body.companion.locked_window).toEqual({ start: null, end: null });
    expect(res.body.companion.today).toBeNull();
    expect(res.body.companion.current_item).toBeNull();
    expect(res.body.companion.day_progress).toEqual({});
  });

  test('GET /trips/:id/companion builds fallback today plan for active trips with locked dates', async () => {
    const ownerToken = await loginAs('alice');
    const trip = await createTrip(ownerToken, {
      name: 'Companion Fallback Plan Test',
      duration_days: 3,
    });

    await dbQuery(`UPDATE trips SET status = 'active' WHERE id = $1`, [trip.id]);
    await dbQuery(
      `INSERT INTO trip_planning_states (trip_id, current_step, state, updated_by, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, NOW())
       ON CONFLICT (trip_id)
       DO UPDATE SET current_step = EXCLUDED.current_step,
                     state = EXCLUDED.state,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = NOW()`,
      [
        trip.id,
        14,
        JSON.stringify({
          availability_locked_window: {
            start: '2026-06-01',
            end: '2026-06-03',
          },
          meal_plan: [
            {
              day: 1,
              date: '2026-06-01',
              destination: 'Tokyo',
              meals: [
                {
                  type: 'Dinner',
                  time: '19:00',
                  name: 'Izakaya Hanabi',
                  cuisine: 'Japanese',
                  cost: 42,
                },
              ],
            },
          ],
          stay_options: [
            {
              name: 'Tokyo Central Hotel',
              destination: 'Tokyo',
              type: 'Hotel',
              ratePerNight: 190,
              totalNights: 2,
              bookingSource: 'WanderPlan Search',
              whyThisOne: 'Close to today\'s arrival.',
            },
          ],
          stay_final_choices: {
            Tokyo: 'stay:tokyo-central-hotel-tokyo-hotel',
          },
          duration_per_destination: {
            Tokyo: 2,
            Kyoto: 1,
          },
        }),
        '00000000-0000-0000-0000-000000000001',
      ]
    );
    await dbQuery(
      `INSERT INTO trip_destinations (trip_id, destination)
       VALUES ($1, $2), ($1, $3)`,
      [trip.id, 'Tokyo', 'Kyoto']
    );

    const res = await request(API_V1)
      .get(`/trips/${trip.id}/companion`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(res.body.companion.is_ready).toBe(true);
    expect(res.body.companion.readiness_reason).toBeNull();
    expect(res.body.companion.today).toMatchObject({
      day_number: 1,
      date: '2026-06-01',
      title: 'Arrival Day',
    });
    expect(res.body.companion.today.items.map((item) => item.title)).toEqual(
      expect.arrayContaining(['Arrive in Tokyo', 'Check in at Tokyo Central Hotel', 'Izakaya Hanabi'])
    );
    expect(res.body.companion.current_item).toMatchObject({
      title: 'Arrive in Tokyo',
    });
  });
});
