'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  dbQuery,
} = require('./setup/helpers');

describe('21 - receipts and budget comparison', () => {
  let token;
  let trip;

  beforeAll(async () => {
    token = await loginAs('alice');
    trip = await createTrip(token, {
      name: 'Receipts Test Trip',
      duration_days: 5,
    });
    await request(API_V1)
      .post(`/trips/${trip.id}/budget`)
      .set('Authorization', `Bearer ${token}`)
      .send({ daily_budget: 100, currency: 'USD' })
      .expect(200);
  });

  test('POST /trips/:id/expenses/parse heuristically categorizes pasted receipt text', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/expenses/parse`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        receipt_text: 'Harbor Cafe\n03/15/2026\nLatte 6.50\nBreakfast Bowl 12.50\nTotal 19.00',
        currency: 'USD',
      })
      .expect(200);

    expect(res.body.parsed).toEqual(
      expect.objectContaining({
        merchant: 'Harbor Cafe',
        currency: 'USD',
      })
    );
    expect(Array.isArray(res.body.parsed.items)).toBe(true);
    expect(res.body.parsed.items[0]).toEqual(
      expect.objectContaining({
        category: 'dining',
        amount: 19,
      })
    );
  });

  test('POST /trips/:id/expenses saves expenses and updates budget spend', async () => {
    const saveRes = await request(API_V1)
      .post(`/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            expense_date: '2026-03-15',
            merchant: 'Harbor Cafe',
            amount: 19,
            currency: 'USD',
            category: 'dining',
            note: 'Breakfast receipts',
          },
          {
            expense_date: '2026-03-15',
            merchant: 'City Museum',
            amount: 24,
            currency: 'USD',
            category: 'activities',
            note: 'Entry tickets',
          },
        ],
      })
      .expect(200);

    expect(saveRes.body.saved).toBe(2);
    expect(saveRes.body.summary.spent).toBeCloseTo(43, 2);
    expect(saveRes.body.summary.remaining).toBeCloseTo(457, 2);
    expect(saveRes.body.summary.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'dining', spent: 19 }),
        expect.objectContaining({ category: 'activities', spent: 24 }),
      ])
    );

    const expenseRows = await dbQuery(
      `SELECT merchant, amount, category
         FROM trip_expenses
        WHERE trip_id = $1
        ORDER BY merchant ASC`,
      [trip.id]
    );
    expect(expenseRows).toHaveLength(2);
    expect(expenseRows[0]).toEqual(
      expect.objectContaining({
        merchant: expect.any(String),
        amount: expect.any(String),
        category: expect.any(String),
      })
    );
  });

  test('GET /trips/:id/expenses returns recent expenses with budget comparison summary', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.expenses)).toBe(true);
    expect(res.body.expenses.length).toBeGreaterThanOrEqual(2);
    expect(res.body.summary).toEqual(
      expect.objectContaining({
        currency: 'USD',
        spent: 43,
        total_budget: 500,
      })
    );
  });
});
