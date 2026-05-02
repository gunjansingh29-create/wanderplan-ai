'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  SEED_USERS,
} = require('./setup/helpers');

describe('12 — Crew Visibility Isolation', () => {
  let bobToken;
  let carolToken;
  let eveToken;
  let frankToken;

  beforeAll(async () => {
    [bobToken, carolToken, eveToken, frankToken] = await Promise.all([
      loginAs('bob'),
      loginAs('carol'),
      loginAs('eve'),
      loginAs('frank'),
    ]);
  });

  test('inviter sees invitees, invitees see inviter, invitees cannot see each other', async () => {
    const inviteEve = await request(API_V1)
      .post('/crew/invite-email')
      .send({
        inviter_email: SEED_USERS.bob.email,
        inviter_name: 'Bob Smith',
        invitee_email: SEED_USERS.eve.email,
      })
      .expect(200);

    const inviteFrank = await request(API_V1)
      .post('/crew/invite-email')
      .send({
        inviter_email: SEED_USERS.bob.email,
        inviter_name: 'Bob Smith',
        invitee_email: SEED_USERS.frank.email,
      })
      .expect(200);

    expect(inviteEve.body.invite_token).toBeTruthy();
    expect(inviteFrank.body.invite_token).toBeTruthy();

    await request(API_V1)
      .post('/crew/invites/accept')
      .set('Authorization', `Bearer ${eveToken}`)
      .send({ invite_token: inviteEve.body.invite_token })
      .expect(200);

    await request(API_V1)
      .post('/crew/invites/accept')
      .set('Authorization', `Bearer ${frankToken}`)
      .send({ invite_token: inviteFrank.body.invite_token })
      .expect(200);

    const bobLinksRes = await request(API_V1)
      .get('/crew/links')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    const bobEmails = new Set((bobLinksRes.body.links || []).map(x => x.email));
    expect(bobEmails.has(SEED_USERS.eve.email)).toBe(true);
    expect(bobEmails.has(SEED_USERS.frank.email)).toBe(true);

    const eveLinksRes = await request(API_V1)
      .get('/crew/links')
      .set('Authorization', `Bearer ${eveToken}`)
      .expect(200);
    const eveEmails = new Set((eveLinksRes.body.links || []).map(x => x.email));
    expect(eveEmails.has(SEED_USERS.bob.email)).toBe(true);
    expect(eveEmails.has(SEED_USERS.frank.email)).toBe(false);

    const frankLinksRes = await request(API_V1)
      .get('/crew/links')
      .set('Authorization', `Bearer ${frankToken}`)
      .expect(200);
    const frankEmails = new Set((frankLinksRes.body.links || []).map(x => x.email));
    expect(frankEmails.has(SEED_USERS.bob.email)).toBe(true);
    expect(frankEmails.has(SEED_USERS.eve.email)).toBe(false);
  });

  test('peer profiles are scoped to crew links only', async () => {
    await request(API_V1)
      .put('/me/profile')
      .set('Authorization', `Bearer ${eveToken}`)
      .send({
        display_name: 'Eve P',
        travel_styles: ['solo'],
        interests: { food: true, culture: false },
        budget_tier: 'budget',
        dietary: ['vegan'],
      })
      .expect(200);

    const bobPeers = await request(API_V1)
      .get('/crew/peer-profiles')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    const bobPeerEmails = new Set((bobPeers.body.peers || []).map(p => p.email));
    expect(bobPeerEmails.has(SEED_USERS.eve.email)).toBe(true);

    const frankPeers = await request(API_V1)
      .get('/crew/peer-profiles')
      .set('Authorization', `Bearer ${frankToken}`)
      .expect(200);
    const frankPeerEmails = new Set((frankPeers.body.peers || []).map(p => p.email));
    expect(frankPeerEmails.has(SEED_USERS.eve.email)).toBe(false);
  });

  test('accepted crew invite flips inviter status and shows inviter in invitee crew', async () => {
    const inviteCarol = await request(API_V1)
      .post('/crew/invite-email')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        inviter_email: SEED_USERS.bob.email,
        inviter_name: 'Bob Smith',
        invitee_email: SEED_USERS.carol.email,
      })
      .expect(200);

    expect(inviteCarol.body.invite_token).toBeTruthy();

    const sentBefore = await request(API_V1)
      .get('/crew/invites/sent')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    const beforeRow = (sentBefore.body.invites || []).find(i => i.invitee_email === SEED_USERS.carol.email);
    expect(beforeRow).toBeTruthy();
    expect(beforeRow.status).toBe('pending');

    await request(API_V1)
      .post('/crew/invites/respond')
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ invite_token: inviteCarol.body.invite_token, action: 'accept' })
      .expect(200);

    const sentAfter = await request(API_V1)
      .get('/crew/invites/sent')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    const afterRow = (sentAfter.body.invites || []).find(i => i.invitee_email === SEED_USERS.carol.email);
    expect(afterRow).toBeTruthy();
    expect(afterRow.status).toBe('accepted');

    const carolPeers = await request(API_V1)
      .get('/crew/peer-profiles')
      .set('Authorization', `Bearer ${carolToken}`)
      .expect(200);

    const carolPeerEmails = new Set((carolPeers.body.peers || []).map(p => p.email));
    expect(carolPeerEmails.has(SEED_USERS.bob.email)).toBe(true);
  });

  test('removing a crew member unlinks both sides and allows re-invite', async () => {
    const inviteEve = await request(API_V1)
      .post('/crew/invite-email')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        inviter_email: SEED_USERS.bob.email,
        inviter_name: 'Bob Smith',
        invitee_email: SEED_USERS.eve.email,
      })
      .expect(200);

    await request(API_V1)
      .post('/crew/invites/accept')
      .set('Authorization', `Bearer ${eveToken}`)
      .send({ invite_token: inviteEve.body.invite_token })
      .expect(200);

    await request(API_V1)
      .delete('/crew/member')
      .query({ email: SEED_USERS.eve.email })
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    const bobLinksAfterRemove = await request(API_V1)
      .get('/crew/links')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    const bobEmailsAfterRemove = new Set((bobLinksAfterRemove.body.links || []).map(x => x.email));
    expect(bobEmailsAfterRemove.has(SEED_USERS.eve.email)).toBe(false);

    const eveLinksAfterRemove = await request(API_V1)
      .get('/crew/links')
      .set('Authorization', `Bearer ${eveToken}`)
      .expect(200);
    const eveEmailsAfterRemove = new Set((eveLinksAfterRemove.body.links || []).map(x => x.email));
    expect(eveEmailsAfterRemove.has(SEED_USERS.bob.email)).toBe(false);

    const reInvite = await request(API_V1)
      .post('/crew/invite-email')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({
        inviter_email: SEED_USERS.bob.email,
        inviter_name: 'Bob Smith',
        invitee_email: SEED_USERS.eve.email,
      })
      .expect(200);

    await request(API_V1)
      .post('/crew/invites/accept')
      .set('Authorization', `Bearer ${eveToken}`)
      .send({ invite_token: reInvite.body.invite_token })
      .expect(200);

    const bobLinksAfterReinvite = await request(API_V1)
      .get('/crew/links')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    const bobEmailsAfterReinvite = new Set((bobLinksAfterReinvite.body.links || []).map(x => x.email));
    expect(bobEmailsAfterReinvite.has(SEED_USERS.eve.email)).toBe(true);
  });
});

// CI trigger
