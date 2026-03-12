'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  SEED_USERS,
} = require('./setup/helpers');

describe('15 - Stage Consensus (organizer final say + solo flow)', () => {
  let aliceToken;
  let bobToken;

  beforeAll(async () => {
    aliceToken = await loginAs('alice');
    bobToken = await loginAs('bob');
  });

  test('group trip: member vote recorded, organizer can finalize with veto', async () => {
    const trip = await createTrip(aliceToken, { name: `Consensus Group ${Date.now()}` });

    await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
    await request(API_V1)
      .post(`/trips/${trip.id}/respond`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ action: 'accept' })
      .expect(200);

    const stageKey = 'vote_destinations';

    const getBefore = await request(API_V1)
      .get(`/trips/${trip.id}/consensus/stages/${stageKey}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(getBefore.body.consensus.member_count).toBeGreaterThanOrEqual(2);
    expect(getBefore.body.consensus.final_decision).toBeNull();

    const bobVote = await request(API_V1)
      .post(`/trips/${trip.id}/consensus/stages/${stageKey}/vote`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ vote: 'yes' })
      .expect(200);
    expect(bobVote.body.consensus.yes_count).toBeGreaterThanOrEqual(1);
    expect(bobVote.body.consensus.final_decision).toBeNull();

    const ownerFinalize = await request(API_V1)
      .post(`/trips/${trip.id}/consensus/stages/${stageKey}/finalize`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ action: 'revise' })
      .expect(200);
    expect(ownerFinalize.body.consensus.final_decision).toBe('revised');

    await request(API_V1)
      .post(`/trips/${trip.id}/consensus/stages/${stageKey}/vote`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ vote: 'yes' })
      .expect(409);
  });

  test('solo trip: organizer can finalize directly', async () => {
    const trip = await createTrip(aliceToken, { name: `Consensus Solo ${Date.now()}` });
    const stageKey = 'budget';

    const getSolo = await request(API_V1)
      .get(`/trips/${trip.id}/consensus/stages/${stageKey}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);
    expect(getSolo.body.consensus.is_solo).toBe(true);
    expect(getSolo.body.consensus.member_count).toBe(1);

    const finalizeSolo = await request(API_V1)
      .post(`/trips/${trip.id}/consensus/stages/${stageKey}/finalize`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ action: 'approve' })
      .expect(200);
    expect(finalizeSolo.body.consensus.final_decision).toBe('approved');
  });
});

