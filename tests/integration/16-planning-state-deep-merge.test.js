'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  SEED_USERS,
} = require('./setup/helpers');

describe('16 - Planning State Deep Merge', () => {
  let aliceToken;
  let bobToken;

  beforeAll(async () => {
    aliceToken = await loginAs('alice');
    bobToken = await loginAs('bob');
  });

  test('merge=true preserves nested votes from multiple members', async () => {
    const trip = await createTrip(aliceToken, { name: `Planning Merge ${Date.now()}` });

    await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
    await request(API_V1)
      .post(`/trips/${trip.id}/respond`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ action: 'accept' })
      .expect(200);

    const destinationId = 'trip-dest-0-tokyo';

    // Alice writes her vote row.
    await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        merge: true,
        state: {
          dest_member_votes: {
            [destinationId]: {
              [SEED_USERS.alice.id]: 'up',
            },
          },
        },
      })
      .expect(200);

    // Bob writes only his nested key; Alice's key must remain.
    const bobWrite = await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        merge: true,
        state: {
          dest_member_votes: {
            [destinationId]: {
              [SEED_USERS.bob.id]: 'down',
            },
          },
        },
      })
      .expect(200);

    const row = bobWrite.body?.state?.dest_member_votes?.[destinationId] || {};
    expect(row[SEED_USERS.alice.id]).toBe('up');
    expect(row[SEED_USERS.bob.id]).toBe('down');

    const readBack = await request(API_V1)
      .get(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const readRow = readBack.body?.state?.dest_member_votes?.[destinationId] || {};
    expect(readRow[SEED_USERS.alice.id]).toBe('up');
    expect(readRow[SEED_USERS.bob.id]).toBe('down');
  });

  test('merge=true preserves canonical and email alias votes from multiple members', async () => {
    const trip = await createTrip(aliceToken, { name: `Planning Merge Aliases ${Date.now()}` });

    await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
    await request(API_V1)
      .post(`/trips/${trip.id}/respond`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ action: 'accept' })
      .expect(200);

    const destinationId = 'dest:auckland';
    const aliceEmailAlias = `email:${SEED_USERS.alice.email}`;
    const bobEmailAlias = `email:${SEED_USERS.bob.email}`;

    await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        merge: true,
        state: {
          dest_member_votes: {
            [destinationId]: {
              [SEED_USERS.alice.id]: 'up',
              [aliceEmailAlias]: 'up',
            },
          },
        },
      })
      .expect(200);

    const bobWrite = await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        merge: true,
        state: {
          dest_member_votes: {
            [destinationId]: {
              [SEED_USERS.bob.id]: 'up',
              [bobEmailAlias]: 'up',
            },
          },
        },
      })
      .expect(200);

    const row = bobWrite.body?.state?.dest_member_votes?.[destinationId] || {};
    expect(row[SEED_USERS.alice.id]).toBe('up');
    expect(row[aliceEmailAlias]).toBe('up');
    expect(row[SEED_USERS.bob.id]).toBe('up');
    expect(row[bobEmailAlias]).toBe('up');

    const readBack = await request(API_V1)
      .get(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const readRow = readBack.body?.state?.dest_member_votes?.[destinationId] || {};
    expect(readRow[SEED_USERS.alice.id]).toBe('up');
    expect(readRow[aliceEmailAlias]).toBe('up');
    expect(readRow[SEED_USERS.bob.id]).toBe('up');
    expect(readRow[bobEmailAlias]).toBe('up');
  });

  test('shared trip budget tier override persists in planning state without changing profile budget tier', async () => {
    const trip = await createTrip(aliceToken, { name: `Planning Budget Override ${Date.now()}` });

    await request(API_V1)
      .put('/me/profile')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        display_name: 'Alice Owner',
        travel_styles: ['friends'],
        interests: { food: true },
        budget_tier: 'premium',
        dietary: [],
      })
      .expect(200);

    await request(API_V1)
      .put(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        merge: true,
        state: {
          shared_budget_tier: 'budget',
        },
      })
      .expect(200);

    const stateRes = await request(API_V1)
      .get(`/trips/${trip.id}/planning-state`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(stateRes.body?.state?.shared_budget_tier).toBe('budget');

    const profileRes = await request(API_V1)
      .get('/me/profile')
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    expect(profileRes.body?.profile?.budget_tier).toBe('premium');
  });
});
