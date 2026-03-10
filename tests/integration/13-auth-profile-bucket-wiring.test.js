'use strict';

const request = require('supertest');
const { API_V1 } = require('./setup/helpers');

describe('13 — Auth + Profile + Personal Bucket Wiring', () => {
  const email = `wp-it-${Date.now()}@example.com`;
  const password = 'Password1!';
  let token = '';

  test('POST /auth/register creates account and returns access token', async () => {
    const res = await request(API_V1)
      .post('/auth/register')
      .send({ email, password, name: 'Integration User' })
      .expect(201);

    expect(res.body.accessToken).toMatch(/^test-token:/);
    expect(res.body.user_id).toMatch(/^[0-9a-f-]{36}$/i);
    token = res.body.accessToken;
  });

  test('PUT/GET /me/profile round-trips profile data', async () => {
    await request(API_V1)
      .put('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        display_name: 'Integration User',
        travel_styles: ['solo', 'friends'],
        interests: { food: true, culture: true, hiking: false },
        budget_tier: 'moderate',
        dietary: ['vegetarian'],
      })
      .expect(200);

    const res = await request(API_V1)
      .get('/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.profile.display_name).toBe('Integration User');
    expect(res.body.profile.travel_styles).toEqual(expect.arrayContaining(['solo', 'friends']));
    expect(res.body.profile.interests.food).toBe(true);
    expect(res.body.profile.budget_tier).toBe('moderate');
  });

  test('POST/GET/DELETE /me/bucket-list supports CRUD', async () => {
    const created = await request(API_V1)
      .post('/me/bucket-list')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destination: 'Lisbon',
        country: 'Portugal',
        tags: ['food', 'culture'],
        best_months: [4, 5, 9],
        cost_per_day: 180,
        best_time_desc: 'Spring and early fall',
        cost_note: 'Moderate city budget',
      })
      .expect(201);

    expect(created.body.item.id).toMatch(/^[0-9a-f-]{36}$/i);
    const itemId = created.body.item.id;

    const listed = await request(API_V1)
      .get('/me/bucket-list')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const lisbon = (listed.body.items || []).find((x) => x.id === itemId);
    expect(lisbon).toBeDefined();
    expect(lisbon.destination).toBe('Lisbon');

    await request(API_V1)
      .delete(`/me/bucket-list/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});

