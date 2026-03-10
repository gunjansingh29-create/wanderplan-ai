/**
 * Integration Test 14 — Trip Invite Step 2: Crew Selection & Invite Flow
 *
 * Scenario:
 *   Step 2 of the trip planning wizard lets the organiser pick crew members
 *   and send them a trip invite.  Only registered (accepted-crew) members
 *   can receive trip invites.  When SMTP is not configured the backend still
 *   stores the invite and returns accept/reject links for manual sharing.
 *
 * Test coverage:
 *   A. Prerequisite: only registered users can be trip-invited
 *        A1  — 404 when inviting an email that has no WanderPlan account
 *        A2  — 403 when a non-owner attempts to invite
 *        A3  — 201 happy-path invite for a registered crew member
 *
 *   B. Response shape: links always returned regardless of email delivery
 *        B1  — response always includes accept_link and reject_link
 *        B2  — email_sent field is a boolean
 *        B3  — status field in response is 'pending' (DB value)
 *
 *   C. Idempotency & status transitions
 *        C1  — re-inviting a 'pending' member returns 201 (idempotent upsert)
 *        C2  — re-inviting an 'accepted' member leaves them as accepted
 *
 *   D. Accept / reject flow (POST /trips/:id/respond)
 *        D1  — invitee accepts → status becomes 'accepted', trip → 'planning'
 *        D2  — invitee rejects → status becomes 'declined'
 *        D3  — non-invitee cannot respond → 403
 *        D4  — already-accepted member cannot reject → 409
 *
 *   E. Crew accept prerequisite: pending crew members are NOT in the DB user
 *      table, so attempting to trip-invite them returns 404 (backend guard)
 *        E1  — pending crew invite email → 404
 *
 * Services under test: orchestrator → trips service → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  SEED_USERS,
  createTrip,
  inviteMember,
  dbQuery,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers local to this suite
// ─────────────────────────────────────────────────────────────────────────────

/** POST /trips/:id/respond — accept or reject a trip invite */
async function respondToTripInvite(token, tripId, action) {
  return request(API_V1)
    .post(`/trips/${tripId}/respond`)
    .set('Authorization', `Bearer ${token}`)
    .send({ action });
}

/** Verify DB status for a specific trip member */
async function dbTripMemberStatus(tripId, userId) {
  const [row] = await dbQuery(
    `SELECT status FROM trip_members WHERE trip_id = $1 AND user_id = $2`,
    [tripId, userId]
  );
  return row ? row.status : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('14 — Trip Invite Step 2: Crew Selection & Invite Flow', () => {
  let aliceToken;   // organiser / trip owner
  let bobToken;     // registered crew member (will accept)
  let carolToken;   // registered crew member (will reject)
  let daveToken;    // registered but NOT invited to trip (guard tests)

  // Shared trip created once per describe block; each sub-section uses its own
  // trip to avoid cross-contamination between acceptance/rejection tests.
  let baseTrip;

  beforeAll(async () => {
    [aliceToken, bobToken, carolToken, daveToken] = await Promise.all([
      loginAs('alice'),
      loginAs('bob'),
      loginAs('carol'),
      loginAs('dave'),
    ]);

    // Base trip for sections A, B, C
    baseTrip = await createTrip(aliceToken, { name: 'Step2 Invite Test Base' });
  });

  // ── A. Prerequisite: only registered users can receive trip invites ────────

  describe('A — Registered-user prerequisite', () => {
    test('A1 — 404 when inviting an email that has no WanderPlan account', async () => {
      const res = await request(API_V1)
        .post(`/trips/${baseTrip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: 'nobody@unregistered-domain.test', role: 'member' })
        .expect(404);

      expect(res.body.detail || res.body.message).toMatch(/user not found/i);
    });

    test('A2 — 403 when a non-owner (Bob) tries to invite a member', async () => {
      // First invite Bob so he is a member, then let him try to invite Carol
      await inviteMember(aliceToken, baseTrip.id, SEED_USERS.bob.email);

      await request(API_V1)
        .post(`/trips/${baseTrip.id}/members`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ email: SEED_USERS.carol.email, role: 'member' })
        .expect(403);
    });

    test('A3 — 201 happy-path invite for a registered crew member (Carol)', async () => {
      const res = await request(API_V1)
        .post(`/trips/${baseTrip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: SEED_USERS.carol.email, role: 'member' })
        .expect(201);

      expect(res.body).toMatchObject({
        email:  SEED_USERS.carol.email,
        role:   'member',
        status: 'pending',
      });
    });
  });

  // ── B. Response shape ──────────────────────────────────────────────────────

  describe('B — Response shape: links always returned', () => {
    let inviteRes;

    beforeAll(async () => {
      const trip = await createTrip(aliceToken, { name: 'Shape Test Trip' });
      inviteRes = await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: SEED_USERS.bob.email, role: 'member' })
        .expect(201);
    });

    test('B1 — response includes accept_link and reject_link', () => {
      expect(typeof inviteRes.body.accept_link).toBe('string');
      expect(typeof inviteRes.body.reject_link).toBe('string');
      expect(inviteRes.body.accept_link).toMatch(/join_trip_id/);
      expect(inviteRes.body.reject_link).toMatch(/trip_invite_action=reject/);
    });

    test('B2 — email_sent field is a boolean', () => {
      expect(typeof inviteRes.body.email_sent).toBe('boolean');
    });

    test('B3 — status in response body is "pending" (raw DB value, not frontend-mapped)', () => {
      expect(inviteRes.body.status).toBe('pending');
    });

    test('B4 — accept_link contains the trip id', async () => {
      const trip = await createTrip(aliceToken, { name: 'Link Check Trip' });
      const res  = await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: SEED_USERS.dave.email, role: 'member' })
        .expect(201);

      expect(res.body.accept_link).toContain(trip.id);
      expect(res.body.reject_link).toContain(trip.id);
    });
  });

  // ── C. Idempotency & status transitions ───────────────────────────────────

  describe('C — Idempotency', () => {
    let trip;

    beforeAll(async () => {
      trip = await createTrip(aliceToken, { name: 'Idempotency Test Trip' });
      // First invite
      await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: SEED_USERS.bob.email, role: 'member' })
        .expect(201);
    });

    test('C1 — re-inviting a pending member returns 201 without error', async () => {
      const res = await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: SEED_USERS.bob.email, role: 'member' })
        .expect(201);

      // Status stays pending (not accepted yet)
      expect(res.body.status).toBe('pending');
    });

    test('C2 — re-inviting an accepted member leaves status as accepted', async () => {
      // Bob accepts first
      await respondToTripInvite(bobToken, trip.id, 'accept').expect(200);

      // Alice sends invite again
      const res = await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: SEED_USERS.bob.email, role: 'member' })
        .expect(201);

      expect(res.body.status).toBe('accepted');

      // Verify DB
      const dbStatus = await dbTripMemberStatus(trip.id, SEED_USERS.bob.id);
      expect(dbStatus).toBe('accepted');
    });
  });

  // ── D. Accept / reject flow ───────────────────────────────────────────────

  describe('D — Accept / reject flow', () => {
    describe('D1 — invitee accepts', () => {
      let trip;

      beforeAll(async () => {
        trip = await createTrip(aliceToken, { name: 'Accept Flow Trip' });
        await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
      });

      test('POST /trips/:id/respond action=accept → 200', async () => {
        const res = await respondToTripInvite(bobToken, trip.id, 'accept').expect(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.action).toBe('accept');
        expect(res.body.member.status).toBe('accepted');
      });

      test('trip status transitions to "planning" on first acceptance', async () => {
        const res = await respondToTripInvite(bobToken, trip.id, 'accept').expect(200);
        expect(['planning'].includes(res.body.trip.status)).toBe(true);
      });

      test('DB reflects accepted status', async () => {
        const dbStatus = await dbTripMemberStatus(trip.id, SEED_USERS.bob.id);
        expect(dbStatus).toBe('accepted');
      });
    });

    describe('D2 — invitee rejects', () => {
      let trip;

      beforeAll(async () => {
        trip = await createTrip(aliceToken, { name: 'Reject Flow Trip' });
        await inviteMember(aliceToken, trip.id, SEED_USERS.carol.email);
      });

      test('POST /trips/:id/respond action=reject → 200', async () => {
        const res = await respondToTripInvite(carolToken, trip.id, 'reject').expect(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.action).toBe('reject');
        expect(res.body.member.status).toBe('declined');
      });

      test('DB reflects declined status', async () => {
        const dbStatus = await dbTripMemberStatus(trip.id, SEED_USERS.carol.id);
        expect(dbStatus).toBe('declined');
      });
    });

    test('D3 — non-invitee (Dave) cannot respond to a trip they were not invited to → 403', async () => {
      const trip = await createTrip(aliceToken, { name: 'Guard Trip' });
      await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);

      await respondToTripInvite(daveToken, trip.id, 'accept').expect(403);
    });

    test('D4 — already-accepted member cannot reject → 409', async () => {
      const trip = await createTrip(aliceToken, { name: '409 Guard Trip' });
      await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
      await respondToTripInvite(bobToken, trip.id, 'accept').expect(200);

      // Now try to reject after already accepting
      await respondToTripInvite(bobToken, trip.id, 'reject').expect(409);
    });
  });

  // ── E. Crew accept prerequisite ───────────────────────────────────────────

  describe('E — Crew accept prerequisite (backend guard for unregistered emails)', () => {
    /**
     * The Step 2 pool only shows crew members with crew_status='accepted'.
     * This section validates the backend guard that enforces the same rule:
     * an email address that does not exist in the users table returns 404.
     * A crew member who received a crew invite but hasn't signed up yet
     * will not be in the users table, so this guard fires.
     */

    test('E1 — inviting a non-existent email returns 404 User not found', async () => {
      const trip = await createTrip(aliceToken, { name: 'Non-Registered Guard Trip' });

      const res = await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: 'pending-user-not-registered@example.test', role: 'member' })
        .expect(404);

      expect(res.body.detail || res.body.message).toMatch(/user not found/i);
    });

    test('E2 — trip_members table has no row for the failed invite', async () => {
      const trip = await createTrip(aliceToken, { name: 'No Phantom Row Trip' });

      await request(API_V1)
        .post(`/trips/${trip.id}/members`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ email: 'ghost@notregistered.test', role: 'member' })
        .expect(404);

      // Verify no phantom row was inserted
      const rows = await dbQuery(
        `SELECT COUNT(*)::int AS cnt FROM trip_members WHERE trip_id = $1`,
        [trip.id]
      );
      // Only the owner row should exist
      expect(rows[0].cnt).toBe(1);
    });
  });
});
