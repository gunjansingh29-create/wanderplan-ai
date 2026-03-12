/**
 * Integration Test 04 - Budget and Flight Integration (personal-flight model)
 *
 * Validates the updated design:
 * - Shared budget excludes flights.
 * - Flight search returns options per leg.
 * - Selecting flights does not mutate shared budget spent/remaining.
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  addBucketListItem,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

const DAILY_BUDGET = 150;
const TRIP_DAYS = 7;
const TOTAL_BUDGET = DAILY_BUDGET * TRIP_DAYS;

describe('04 - Budget and Flight Integration (personal-flight model)', () => {
  let token;
  let trip;
  let budget;
  let flightResults;

  beforeAll(async () => {
    token = await loginAs('alice');
    trip = await createTrip(token, {
      name: 'Budget Flight Test',
      duration_days: TRIP_DAYS,
      origin_airport: 'LAX',
    });
    await addBucketListItem(token, trip.id, 'Tokyo', 'Japan', 'city');
  });

  test('POST /trips/:id/budget stores shared budget without flights bucket', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${token}`)
      .send({ daily_budget: DAILY_BUDGET, currency: 'USD' })
      .expect(200);

    budget = res.body.budget;
    expect(budget.daily_target).toBeCloseTo(DAILY_BUDGET, 2);
    expect(budget.total_budget).toBeCloseTo(TOTAL_BUDGET, 2);
    expect(budget.currency).toBe('USD');
    expect(budget.breakdown).not.toHaveProperty('flights');
    expect(budget.breakdown).toEqual(
      expect.objectContaining({
        accommodation: expect.any(Number),
        dining: expect.any(Number),
        activities: expect.any(Number),
        transport: expect.any(Number),
        misc: expect.any(Number),
      })
    );
  });

  test('budget breakdown sums to total budget', () => {
    const sum = Object.values(budget.breakdown).reduce((acc, value) => acc + Number(value || 0), 0);
    expect(sum).toBeCloseTo(TOTAL_BUDGET, 1);
  });

  test('GET /trips/:id/budget/breakdown returns shared model without flights key', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/budget/breakdown`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.budget.total_budget).toBeCloseTo(TOTAL_BUDGET, 2);
    expect(res.body.budget.breakdown).not.toHaveProperty('flights');
  });

  test('POST /trips/:id/flights/search returns leg options', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/flights/search`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        origin: 'LAX',
        destination: 'NRT',
        depart_date: '2025-03-20',
        return_date: '2025-03-27',
        round_trip: true,
      })
      .expect(200);

    flightResults = res.body;
    expect(Array.isArray(flightResults.flights)).toBe(true);
    expect(flightResults.flights.length).toBeGreaterThan(0);
    expect(Array.isArray(flightResults.legs)).toBe(true);
    expect(flightResults.legs.length).toBeGreaterThanOrEqual(1);
    for (const leg of flightResults.legs) {
      expect(Array.isArray(leg.options)).toBe(true);
      expect(leg.options.length).toBeGreaterThan(0);
    }
  });

  test('flight options are valid and follow expected route legs', () => {
    for (const flight of flightResults.flights) {
      expect(typeof flight.price_usd).toBe('number');
      expect(flight.price_usd).toBeGreaterThan(0);
      const route = `${flight.departure_airport}->${flight.arrival_airport}`;
      expect(['LAX->NRT', 'NRT->LAX']).toContain(route);
      const dep = new Date(flight.departure_time);
      const arr = new Date(flight.arrival_time);
      expect(dep.getTime()).not.toBeNaN();
      expect(arr.getTime()).not.toBeNaN();
      expect(arr.getTime()).toBeGreaterThan(dep.getTime());
    }
  });

  test('POST /trips/:id/flights/select marks choices but does not change shared budget', async () => {
    const firstLeg = flightResults.legs[0];
    const picked = [...firstLeg.options].sort((a, b) => a.price_usd - b.price_usd)[0];

    const beforeBudget = await request(API_V1)
      .get(`/trips/${trip.id}/budget/breakdown`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const beforeSpent = Number(beforeBudget.body.budget.spent || 0);
    const beforeRemaining = Number(beforeBudget.body.budget.remaining || 0);

    const selRes = await request(API_V1)
      .post(`/trips/${trip.id}/flights/select`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        leg_selections: [
          {
            leg_id: firstLeg.leg_id,
            flight_id: picked.flight_id || picked.id,
          },
        ],
      })
      .expect(200);

    expect(selRes.body.selected).toBe(true);
    expect(selRes.body.selected_count).toBe(1);
    expect(Number(selRes.body.budget.spent || 0)).toBeCloseTo(beforeSpent, 2);
    expect(Number(selRes.body.budget.remaining || 0)).toBeCloseTo(beforeRemaining, 2);
  });

  test('selected flight row is persisted as selected=true', async () => {
    const rows = await pollUntil(
      async () => {
        const result = await dbQuery(
          `SELECT id, selected
             FROM flight_options
            WHERE trip_id = $1 AND selected = true`,
          [trip.id]
        );
        return result.length > 0 ? result : null;
      },
      { timeout: 10_000 }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].selected).toBe(true);
  });

  test('flight search without auth returns 401', async () => {
    await request(API_V1)
      .post(`/trips/${trip.id}/flights/search`)
      .send({ origin: 'LAX', destination: 'NRT', depart_date: '2025-03-20' })
      .expect(401);
  });
});

