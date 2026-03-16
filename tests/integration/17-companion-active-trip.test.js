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
});
