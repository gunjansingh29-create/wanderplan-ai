/**
 * Integration Test 01 — Trip Creation & Member Invitation Flow
 *
 * Scenario:
 *   1. Owner (Alice) creates a new trip
 *   2. Alice invites Bob by email
 *   3. Bob accepts the invitation via PUT /trips/:id/members/:userId
 *   4. Query trip_members in the DB — both users appear with correct roles
 *      (Alice = 'owner', Bob = 'member', both status = 'accepted')
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
  acceptInvitation,
  dbQuery,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────

describe('01 — Trip Creation & Member Invitation Flow', () => {
  let aliceToken;
  let bobToken;
  let trip;

  beforeAll(async () => {
    [aliceToken, bobToken] = await Promise.all([
      loginAs('alice'),
      loginAs('bob'),
    ]);
  });

  // ── Step 1: Create trip ──────────────────────────────────────────────────

  test('POST /trips → 201 with trip object owned by Alice', async () => {
    const res = await request(API_V1)
      .post('/trips')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        name:             'Tokyo Adventure 2025',
        destination_hint: 'Japan',
        duration_days:    7,
      })
      .expect(201);

    trip = res.body.trip;

    expect(trip).toMatchObject({
      name:         'Tokyo Adventure 2025',
      duration_days: 7,
      status:       'planning',
    });
    expect(trip.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  test('Trip owner appears in trip_members immediately with role=owner', async () => {
    const rows = await dbQuery(
      `SELECT tm.user_id, tm.role, tm.status
         FROM trip_members tm
        WHERE tm.trip_id = $1`,
      [trip.id]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: SEED_USERS.alice.id,
      role:    'owner',
      status:  'accepted',
    });
  });

  // ── Step 2: Invite member ────────────────────────────────────────────────

  test('POST /trips/:id/members → 201 invitation record for Bob', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/members`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ email: SEED_USERS.bob.email, role: 'member' })
      .expect(201);

    expect(res.body).toMatchObject({
      user_id: SEED_USERS.bob.id,
      role:    'member',
      status:  'pending',
    });
  });

  test('Bob appears in trip_members as pending before acceptance', async () => {
    const rows = await dbQuery(
      `SELECT user_id, role, status FROM trip_members
        WHERE trip_id = $1 AND user_id = $2`,
      [trip.id, SEED_USERS.bob.id]
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });

  // ── Step 3: Bob accepts ──────────────────────────────────────────────────

  test('PUT /trips/:id/members/:userId → 200 Bob accepts invitation', async () => {
    const res = await request(API_V1)
      .put(`/trips/${trip.id}/members/${SEED_USERS.bob.id}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ status: 'accepted' })
      .expect(200);

    expect(res.body).toMatchObject({
      user_id: SEED_USERS.bob.id,
      status:  'accepted',
    });
  });

  // ── Step 4: Verify DB state ──────────────────────────────────────────────

  test('trip_members has exactly 2 rows after acceptance', async () => {
    const rows = await dbQuery(
      `SELECT user_id, role, status FROM trip_members
        WHERE trip_id = $1
        ORDER BY role`,
      [trip.id]
    );

    expect(rows).toHaveLength(2);
  });

  test('Alice has role=owner and status=accepted', async () => {
    const [row] = await dbQuery(
      `SELECT role, status FROM trip_members
        WHERE trip_id = $1 AND user_id = $2`,
      [trip.id, SEED_USERS.alice.id]
    );

    expect(row).toMatchObject({ role: 'owner', status: 'accepted' });
  });

  test('Bob has role=member and status=accepted', async () => {
    const [row] = await dbQuery(
      `SELECT role, status FROM trip_members
        WHERE trip_id = $1 AND user_id = $2`,
      [trip.id, SEED_USERS.bob.id]
    );

    expect(row).toMatchObject({ role: 'member', status: 'accepted' });
  });

  // ── Guard: non-member cannot view the trip ───────────────────────────────

  test('Carol (non-member) gets 403 when accessing the trip', async () => {
    const carolToken = await loginAs('carol');

    await request(API_V1)
      .get(`/trips/${trip.id}`)
      .set('Authorization', `Bearer ${carolToken}`)
      .expect(403);
  });

  // ── Guard: Bob cannot invite additional members (only owner can) ─────────

  test('Bob (member) gets 403 when trying to invite a third user', async () => {
    await request(API_V1)
      .post(`/trips/${trip.id}/members`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ email: SEED_USERS.carol.email, role: 'member' })
      .expect(403);
  });

  // ── GET /trips/:id returns members list ──────────────────────────────────

  test('GET /trips/:id → members array contains Alice and Bob with correct roles', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const members = res.body.trip.members;
    expect(Array.isArray(members)).toBe(true);
    expect(members).toHaveLength(2);

    const alice = members.find(m => m.user_id === SEED_USERS.alice.id);
    const bob   = members.find(m => m.user_id === SEED_USERS.bob.id);

    expect(alice).toBeDefined();
    expect(alice.role).toBe('owner');

    expect(bob).toBeDefined();
    expect(bob.role).toBe('member');
    expect(bob.status).toBe('accepted');
  });
});
