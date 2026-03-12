'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  SEED_USERS,
} = require('./setup/helpers');

describe('17 - Profile Interests Feed POI Fallback', () => {
  let aliceToken;
  let bobToken;

  beforeAll(async () => {
    aliceToken = await loginAs('alice');
    bobToken = await loginAs('bob');
  });

  test('accepted member user_profiles interests influence group interests + POIs when trip interests are missing', async () => {
    // Seed global user profile interests (not trip-scoped interest_profiles).
    await request(API_V1)
      .put('/me/profile')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        display_name: 'Alice',
        travel_styles: ['group'],
        interests: { culture: false, food: false, hiking: false },
        budget_tier: 'moderate',
        dietary: [],
      })
      .expect(200);

    await request(API_V1)
      .put('/me/profile')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        display_name: 'Bob',
        travel_styles: ['group'],
        interests: { hiking: true, food: false, culture: false },
        budget_tier: 'moderate',
        dietary: [],
      })
      .expect(200);

    const trip = await createTrip(aliceToken, { name: `Profile POI ${Date.now()}` });

    await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
    await request(API_V1)
      .post(`/trips/${trip.id}/respond`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ action: 'accept' })
      .expect(200);

    // Do NOT submit /members/{id}/interests for this trip.
    const group = await request(API_V1)
      .get(`/trips/${trip.id}/group-interests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const categories = group.body?.group_interests?.categories || [];
    expect(categories).toEqual(expect.arrayContaining(['nature', 'adventure']));

    const pois = await request(API_V1)
      .get(`/trips/${trip.id}/pois`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const rows = Array.isArray(pois.body?.pois) ? pois.body.pois : [];
    expect(rows.length).toBeGreaterThan(0);
    const poiCats = rows.map((p) => String(p.category || '').toLowerCase());
    expect(poiCats).toEqual(expect.arrayContaining(['adventure']));
  });
});

