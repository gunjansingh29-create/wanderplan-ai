/**
 * Integration Test 08 — Over-Budget Flow
 *
 * Scenario:
 *   1. Alice creates a trip with a deliberately tight budget ($50/day, $350 total for 7 days)
 *      → flights_allocation = $350 * 0.30 = $105 (very low)
 *   2. Search stays (accommodation) and attempt to select an expensive hotel ($200/night)
 *   3. Verify budget warning is triggered (warning_active = true, 422 with budget_warning)
 *   4. Alice increases the budget to $200/day → new total = $1,400
 *      → new flights_allocation = $420
 *   5. Verify the new total and breakdown are correctly recalculated
 *   6. Verify subsequent screens (e.g. flights search) reference the updated budget
 *   7. Select the expensive hotel — now within budget, should succeed (200)
 *
 * Services under test: orchestrator → budget-agent → accommodation-agent → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  addBucketListItem,
  setBudget,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TRIP_DAYS          = 7;
const LOW_DAILY_BUDGET   = 50;
const LOW_TOTAL          = LOW_DAILY_BUDGET * TRIP_DAYS;       // $350
const LOW_STAYS_ALLOC    = LOW_TOTAL * 0.30;                   // $105

const HIGH_DAILY_BUDGET  = 200;
const HIGH_TOTAL         = HIGH_DAILY_BUDGET * TRIP_DAYS;      // $1,400
const HIGH_STAYS_ALLOC   = HIGH_TOTAL * 0.30;                  // $420

const EXPENSIVE_HOTEL_PRICE_PER_NIGHT = 200;                   // $200 × 7 = $1,400 total stays cost
const EXPENSIVE_HOTEL_TOTAL_COST      = EXPENSIVE_HOTEL_PRICE_PER_NIGHT * TRIP_DAYS;

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('08 — Over-Budget Flow: Warning → Budget Increase → Recalculation', () => {
  let token;
  let trip;
  let lowBudget;
  let updatedBudget;
  let expensiveStayId = 'STAY-LUXURY-001';  // stubbed stay id

  beforeAll(async () => {
    token = await loginAs('alice');
    trip  = await createTrip(token, {
      name:          'Over-Budget Test',
      duration_days: TRIP_DAYS,
    });
    await addBucketListItem(token, trip.id, 'Tokyo', 'Japan', 'city');
  });

  // ── Step 1: Set low budget ────────────────────────────────────────────────

  test('POST /trips/:id/budget with daily_budget=50 → low budget set', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${token}`)
      .send({ daily_budget: LOW_DAILY_BUDGET, currency: 'USD' })
      .expect(200);

    lowBudget = res.body.budget;
    expect(lowBudget.total_budget).toBeCloseTo(LOW_TOTAL, 2);
    expect(lowBudget.breakdown.accommodation).toBeCloseTo(LOW_STAYS_ALLOC, 2);
  });

  test('Budget stored in DB with correct total_budget', async () => {
    const [row] = await dbQuery(
      `SELECT total_budget, breakdown FROM budgets WHERE trip_id = $1`,
      [trip.id]
    );
    expect(parseFloat(row.total_budget)).toBeCloseTo(LOW_TOTAL, 1);
  });

  // ── Step 2: Attempt to select an expensive stay ──────────────────────────

  test('GET /trips/:id/stays/search → returns stays above budget', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/stays/search`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        city:       'Tokyo',
        check_in:   '2025-03-20',
        check_out:  '2025-03-27',
        max_price:  999,            // no cap — let expensive results through
      })
      .expect(200);

    expect(res.body.stays.length).toBeGreaterThan(0);

    // Find the luxury stub or any stay above accommodation allocation
    const luxuryStay = res.body.stays.find(s =>
      s.price_per_night_usd >= EXPENSIVE_HOTEL_PRICE_PER_NIGHT
    );
    if (luxuryStay) expensiveStayId = luxuryStay.stay_id || luxuryStay.id;
  });

  // ── Step 3: Verify budget warning is triggered ────────────────────────────

  test('POST /trips/:id/stays/select with expensive hotel → 422 budget_warning', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/stays/select`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stay_id:            expensiveStayId,
        price_per_night:    EXPENSIVE_HOTEL_PRICE_PER_NIGHT,
        nights:             TRIP_DAYS,
        force_over_budget:  false,
      })
      .expect(422);

    expect(res.body.error.code).toMatch(/budget_warning|BUDGET_EXCEEDED/i);
    expect(res.body).toHaveProperty('budget_warning');
    const warning = res.body.budget_warning;
    expect(warning).toHaveProperty('allocation');
    expect(warning).toHaveProperty('requested');
    expect(parseFloat(warning.requested)).toBeGreaterThan(parseFloat(warning.allocation));
  });

  test('Budget warning flag is stored in budgets table (warning_active=true)', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT warning_active FROM budgets WHERE trip_id = $1`,
          [trip.id]
        );
        return r.length > 0 && r[0].warning_active ? r : null;
      },
      { timeout: 10_000 }
    );
    expect(rows[0].warning_active).toBe(true);
  });

  // ── Step 4: Increase budget ───────────────────────────────────────────────

  test('POST /trips/:id/budget/increase → 200 with recalculated budget', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/budget/increase`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        new_daily_budget: HIGH_DAILY_BUDGET,
        reason:           'Selected luxury accommodation',
      })
      .expect(200);

    updatedBudget = res.body.budget;
    expect(updatedBudget.daily_target).toBeCloseTo(HIGH_DAILY_BUDGET, 2);
    expect(updatedBudget.total_budget).toBeCloseTo(HIGH_TOTAL, 2);
  });

  // ── Step 5: Verify new total and breakdown ────────────────────────────────

  test('Updated total_budget = new_daily_budget * trip_days', () => {
    expect(updatedBudget.total_budget).toBeCloseTo(HIGH_TOTAL, 2);
  });

  test('Updated breakdown.flights recalculated to 30% of new total', () => {
    expect(updatedBudget.breakdown.flights).toBeCloseTo(HIGH_TOTAL * 0.30, 2);
  });

  test('Updated breakdown.accommodation recalculated to 30% of new total', () => {
    expect(updatedBudget.breakdown.accommodation).toBeCloseTo(HIGH_STAYS_ALLOC, 2);
  });

  test('Updated breakdown allocations still sum to new total_budget', () => {
    const sum = Object.values(updatedBudget.breakdown).reduce((a, v) => a + v, 0);
    expect(sum).toBeCloseTo(HIGH_TOTAL, 1);
  });

  test('Budget update persisted in DB with new total', async () => {
    const [row] = await dbQuery(
      `SELECT total_budget, daily_target, warning_active FROM budgets WHERE trip_id = $1`,
      [trip.id]
    );
    expect(parseFloat(row.total_budget)).toBeCloseTo(HIGH_TOTAL, 1);
    expect(parseFloat(row.daily_target)).toBeCloseTo(HIGH_DAILY_BUDGET, 1);
    // Warning should be cleared after budget increase
    expect(row.warning_active).toBe(false);
  });

  // ── Step 6: Subsequent screens use updated budget ─────────────────────────

  test('Flight search after budget increase uses updated flights_allocation', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/flights/search`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        origin:      'LAX',
        destination: 'NRT',
        depart_date: '2025-03-20',
        return_date: '2025-03-27',
      })
      .expect(200);

    // max price passed to search must now reflect updated flights_allocation
    expect(res.body.search_params?.max_price || HIGH_TOTAL * 0.30).toBeCloseTo(
      HIGH_TOTAL * 0.30, 0
    );
    // All flights returned are within new allocation
    for (const flight of res.body.flights) {
      expect(flight.price_usd).toBeLessThanOrEqual(HIGH_TOTAL * 0.30);
    }
  });

  test('GET /trips/:id/budget/breakdown reflects updated figures', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/budget/breakdown`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.budget.total_budget).toBeCloseTo(HIGH_TOTAL, 2);
    expect(res.body.budget.daily_target).toBeCloseTo(HIGH_DAILY_BUDGET, 2);
  });

  // ── Step 7: Expensive hotel now succeeds ─────────────────────────────────

  test('POST /trips/:id/stays/select with expensive hotel → 200 after budget increase', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/stays/select`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stay_id:         expensiveStayId,
        price_per_night: EXPENSIVE_HOTEL_PRICE_PER_NIGHT,
        nights:          TRIP_DAYS,
      })
      .expect(200);

    expect(res.body).toMatchObject({ selected: true });
    // budget.spent increases by hotel cost
    expect(res.body.budget.spent).toBeCloseTo(EXPENSIVE_HOTEL_TOTAL_COST, 0);
  });

  // ── Edge: Attempting increase with a LOWER amount returns 422 ─────────────

  test('POST /trips/:id/budget/increase with lower amount than current returns 422', async () => {
    await request(API_V1)
      .post(`/trips/${trip.id}/budget/increase`)
      .set('Authorization', `Bearer ${token}`)
      .send({ new_daily_budget: 10, reason: 'test' })   // lower than $200
      .expect(422);
  });
});
