/**
 * Integration Test 04 — Budget → Flight Integration
 *
 * Scenario:
 *   1. Alice creates a 7-day trip and sets a daily budget of $150
 *      → total_budget = $150 * 7 = $1,050
 *      → flights_allocation = total_budget * flights_percentage (0.30) = $315
 *   2. Trigger flight search
 *   3. Verify:
 *      a. Every returned flight option has price_usd ≤ flights_allocation
 *      b. The breakdown.flights field on the budget matches the formula
 *      c. Flight results reference the correct departure/arrival airports
 *         derived from the trip's origin and bucket-list destination
 *      d. Selecting a flight updates budget.spent and budget.remaining
 *      e. Selecting a flight that exceeds flights_allocation returns 422
 *
 * Budget formula from seed / BudgetAgent:
 *   flights_allocation = total_budget * 0.30
 *   total_budget       = daily_target * duration_days
 *
 * Services under test: orchestrator → budget-agent → flight-agent → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  addBucketListItem,
  setBudget,
  SEED_USERS,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DAILY_BUDGET     = 150;     // USD / day
const TRIP_DAYS        = 7;
const TOTAL_BUDGET     = DAILY_BUDGET * TRIP_DAYS;        // $1,050
const FLIGHTS_PCT      = 0.30;
const FLIGHTS_ALLOC    = TOTAL_BUDGET * FLIGHTS_PCT;      // $315

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('04 — Budget → Flight Integration', () => {
  let token;
  let trip;
  let budget;
  let flightResults;

  beforeAll(async () => {
    token = await loginAs('alice');
    trip  = await createTrip(token, {
      name:             'Budget Flight Test',
      duration_days:    TRIP_DAYS,
      origin_airport:   'LAX',
    });
    await addBucketListItem(token, trip.id, 'Tokyo', 'Japan', 'city');
  });

  // ── Step 1: Set budget ───────────────────────────────────────────────────

  test('POST /trips/:id/budget with daily_budget=150 → 200 with budget object', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${token}`)
      .send({ daily_budget: DAILY_BUDGET, currency: 'USD' })
      .expect(200);

    budget = res.body.budget;

    expect(budget.daily_target).toBeCloseTo(DAILY_BUDGET, 2);
    expect(budget.total_budget).toBeCloseTo(TOTAL_BUDGET, 2);
    expect(budget.currency).toBe('USD');
  });

  test('Budget breakdown.flights matches formula: total_budget * 0.30', () => {
    expect(budget.breakdown).toHaveProperty('flights');
    expect(budget.breakdown.flights).toBeCloseTo(FLIGHTS_ALLOC, 2);
  });

  test('Budget breakdown allocations sum to total_budget', () => {
    const sum = Object.values(budget.breakdown).reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(TOTAL_BUDGET, 1);
  });

  test('GET /trips/:id/budget/breakdown matches POST response', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/budget/breakdown`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.budget.total_budget).toBeCloseTo(TOTAL_BUDGET, 2);
    expect(res.body.budget.breakdown.flights).toBeCloseTo(FLIGHTS_ALLOC, 2);
  });

  // ── Step 2: Search flights ───────────────────────────────────────────────

  test('POST /trips/:id/flights/search → 200 returns flight options', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/flights/search`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        origin:      'LAX',
        destination: 'NRT',
        depart_date: '2025-03-20',
        return_date: '2025-03-27',
        round_trip:  true,
      })
      .expect(200);

    flightResults = res.body;
    expect(flightResults).toHaveProperty('flights');
    expect(Array.isArray(flightResults.flights)).toBe(true);
    expect(flightResults.flights.length).toBeGreaterThan(0);
    expect(Array.isArray(flightResults.legs)).toBe(true);
    expect(flightResults.legs.length).toBeGreaterThanOrEqual(1);
    for (const leg of flightResults.legs) {
      expect(Array.isArray(leg.options)).toBe(true);
      expect(leg.options.length).toBeGreaterThan(0);
    }
  });

  // ── Step 3a: No flight exceeds flights_allocation ────────────────────────

  test('No flight option has price_usd > flights_allocation ($315)', () => {
    for (const flight of flightResults.flights) {
      expect(typeof flight.price_usd).toBe('number');
      expect(flight.price_usd).toBeLessThanOrEqual(FLIGHTS_ALLOC);
    }
  });

  test('All flights have price_usd > 0', () => {
    for (const flight of flightResults.flights) {
      expect(flight.price_usd).toBeGreaterThan(0);
    }
  });

  // ── Step 3b: flights_allocation matches formula ───────────────────────────

  test('budget.breakdown.flights equals daily_budget * flights_pct * trip_days', () => {
    const expected = DAILY_BUDGET * FLIGHTS_PCT * TRIP_DAYS;   // $315
    expect(budget.breakdown.flights).toBeCloseTo(expected, 1);
  });

  // ── Step 3c: Correct airports in results ─────────────────────────────────

  test('Flight results reference expected route legs (LAX↔NRT)', () => {
    for (const flight of flightResults.flights) {
      const route = `${flight.departure_airport}->${flight.arrival_airport}`;
      expect(['LAX->NRT', 'NRT->LAX']).toContain(route);
    }
  });

  test('All flights have valid departure and arrival timestamps', () => {
    for (const flight of flightResults.flights) {
      const dep = new Date(flight.departure_time);
      const arr = new Date(flight.arrival_time);
      expect(dep.getTime()).not.toBeNaN();
      expect(arr.getTime()).not.toBeNaN();
      // Arrival must be after departure
      expect(arr.getTime()).toBeGreaterThan(dep.getTime());
    }
  });

  // ── Step 3d: Selecting a flight updates budget ────────────────────────────

  test('POST /trips/:id/flights/select with leg_selections → 200 and budget.spent increases', async () => {
    const firstLeg = flightResults.legs[0];
    const cheapestLegOption = [...firstLeg.options].sort((a, b) => a.price_usd - b.price_usd)[0];
    const selectedPrice = cheapestLegOption.price_usd;

    const selRes = await request(API_V1)
      .post(`/trips/${trip.id}/flights/select`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        leg_selections: [
          {
            leg_id: firstLeg.leg_id,
            flight_id: cheapestLegOption.flight_id || cheapestLegOption.id,
          },
        ],
      })
      .expect(200);

    const updatedBudget = selRes.body.budget;
    expect(updatedBudget.spent).toBeCloseTo(selectedPrice, 2);
    expect(updatedBudget.remaining).toBeCloseTo(
      TOTAL_BUDGET - selectedPrice, 2
    );
    expect(selRes.body.selected_count).toBe(1);
  });

  test('Selected flight is marked selected=true in flight_options table', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT id, price_usd, selected FROM flight_options
            WHERE trip_id = $1 AND selected = true`,
          [trip.id]
        );
        return r.length > 0 ? r : null;
      },
      { timeout: 10_000 }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].selected).toBe(true);
  });

  // ── Step 3e: Over-allocation guard ───────────────────────────────────────

  test('Selecting a flight priced above flights_allocation returns 422', async () => {
    const overBudgetFlightId = 'FL-OVER-BUDGET-STUB';

    await request(API_V1)
      .post(`/trips/${trip.id}/flights/select`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        flight_id:  overBudgetFlightId,
        price_usd:  FLIGHTS_ALLOC + 500,   // clearly over budget
        force:      false,
      })
      .expect(422);
  });

  // ── Guard: Unauthenticated access is blocked ──────────────────────────────

  test('Flight search without auth token returns 401', async () => {
    await request(API_V1)
      .post(`/trips/${trip.id}/flights/search`)
      .send({ origin: 'LAX', destination: 'NRT', depart_date: '2025-03-20' })
      .expect(401);
  });
});
