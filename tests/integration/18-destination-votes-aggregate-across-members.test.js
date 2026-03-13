'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  SEED_USERS,
} = require('./setup/helpers');

describe('18 - Destination Votes Aggregate Across Members', () => {
  let aliceToken;
  let bobToken;

  beforeAll(async () => {
    aliceToken = await loginAs('alice');
    bobToken = await loginAs('bob');
  });

  test('accepted members can save destinations without overwriting each other', async () => {
    const trip = await createTrip(aliceToken, { name: `Destination Votes ${Date.now()}` });

    await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
    await request(API_V1)
      .post(`/trips/${trip.id}/respond`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ action: 'accept' })
      .expect(200);

    await request(API_V1)
      .put(`/trips/${trip.id}/destinations`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        destinations: ['Auckland', 'Sydney'],
        votes: { Auckland: 1, Sydney: 1 },
      })
      .expect(200);

    await request(API_V1)
      .put(`/trips/${trip.id}/destinations`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        destinations: ['Auckland', 'Sydney'],
        votes: { Auckland: 1, Sydney: 1 },
      })
      .expect(200);

    const res = await request(API_V1)
      .get(`/trips/${trip.id}/destinations`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const byName = Object.fromEntries((res.body?.destinations || []).map((row) => [row.name, row.votes]));
    expect(byName.Auckland).toBe(2);
    expect(byName.Sydney).toBe(2);
  });
});
