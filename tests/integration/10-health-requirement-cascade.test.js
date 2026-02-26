/**
 * Integration Test 10 — Health Requirement Cascade
 *
 * Scenario:
 *   Full health → POI cascade when a user declines a certification requirement:
 *
 *   1. Scuba diving is added as an approved POI for the trip
 *   2. Health agent is invoked for the user — it detects that scuba diving
 *      requires an Open Water certification
 *   3. The user is prompted: "Do you have an Open Water scuba certification?"
 *      User replies: NO
 *   4. Health agent flags the POI and sends a cascade message to the POI agent
 *   5. POI agent replaces or supplements the scuba POI with a snorkeling alternative
 *   6. Verify:
 *      a. The health_acknowledgments table records: activity=scuba, has_cert=false,
 *         alternative_suggested=snorkeling
 *      b. The scuba POI is no longer in the trip's approved POI list
 *         (or is marked unavailable/replaced)
 *      c. A snorkeling-category POI is now present in the trip's POI list
 *      d. The snorkeling POI has a tag matching 'snorkeling' and does not
 *         require any certification
 *      e. The original scuba POI's approved flag = false in the pois table
 *
 * Services under test:
 *   orchestrator → health-agent → poi-discovery-agent → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  addBucketListItem,
  SEED_USERS,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SCUBA_POI = {
  name:     'Kerama Islands Scuba Diving',
  category: 'scuba',
  city:     'Okinawa',
  country:  'Japan',
  tags:     ['scuba', 'diving', 'ocean', 'adventure'],
  lat:      26.2124,
  lng:      127.7919,
  cost_estimate_usd: 120,
  requires_certification: 'open_water_scuba',
};

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('10 — Health Requirement Cascade: Scuba → Snorkeling Alternative', () => {
  let token;
  let trip;
  let scubaPoiId;

  beforeAll(async () => {
    token = await loginAs('alice');
    trip  = await createTrip(token, { name: 'Health Cascade Test', duration_days: 5 });
    await addBucketListItem(token, trip.id, 'Okinawa', 'Japan', 'beach');
  });

  // ── Step 1: Add and approve scuba POI ─────────────────────────────────────

  test('Seed scuba POI directly into pois table as approved', async () => {
    const [row] = await dbQuery(
      `INSERT INTO pois
         (trip_id, name, category, city, country, lat, lng, tags, cost_estimate_usd, approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING id`,
      [
        trip.id,
        SCUBA_POI.name,
        SCUBA_POI.category,
        SCUBA_POI.city,
        SCUBA_POI.country,
        SCUBA_POI.lat,
        SCUBA_POI.lng,
        SCUBA_POI.tags,
        SCUBA_POI.cost_estimate_usd,
      ]
    );
    scubaPoiId = row.id;
    expect(scubaPoiId).toBeTruthy();
  });

  test('POST /trips/:id/pois/:poiId/approve confirms scuba POI is approved', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/pois/${scubaPoiId}/approve`)
      .set('Authorization', `Bearer ${token}`)
      .send({ approved: true })
      .expect(200);

    expect(res.body.poi.approved).toBe(true);
  });

  // ── Step 2: Health agent flags scuba certification ────────────────────────

  test('GET /trips/:id/health-requirements → includes scuba certification requirement', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/health-requirements`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const requirements = res.body.requirements || [];
    const scubaReq = requirements.find(r =>
      (r.activity || '').toLowerCase().includes('scuba') ||
      (r.certification_required || '').toLowerCase().includes('open_water')
    );

    expect(scubaReq).toBeDefined();
    expect(scubaReq.certification_required).toMatch(/open_water/i);
  });

  // ── Step 3: User acknowledges health requirements — says NO to certification

  test('POST /trips/:id/members/:userId/health-acknowledgment with has_cert=false → 200', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/members/${SEED_USERS.alice.id}/health-acknowledgment`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        acknowledgments: [
          {
            activity_id:            scubaPoiId,
            certification_required: 'open_water_scuba',
            user_has_cert:          false,
          },
        ],
        dietary_restrictions: [],
        mobility_level:       'full',
      })
      .expect(200);

    expect(res.body).toMatchObject({ processed: true });
    expect(res.body).toHaveProperty('alternatives_suggested');
    expect(res.body.alternatives_suggested.length).toBeGreaterThan(0);
  });

  // ── Step 4: Cascade to POI agent ─────────────────────────────────────────

  test('Health cascade triggers: response includes snorkeling as alternative', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/members/${SEED_USERS.alice.id}/health-acknowledgment`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        acknowledgments: [{
          activity_id:            scubaPoiId,
          certification_required: 'open_water_scuba',
          user_has_cert:          false,
        }],
        dietary_restrictions: [],
        mobility_level:       'full',
      })
      .expect(200);

    const alternatives = res.body.alternatives_suggested;
    const snorkelAlt   = alternatives.find(a =>
      (a.category || a.poi_category || '').toLowerCase().includes('snorkel') ||
      (a.name || '').toLowerCase().includes('snorkel') ||
      (a.tags || []).some(t => t.toLowerCase().includes('snorkel'))
    );

    expect(snorkelAlt).toBeDefined();
  });

  // ── Step 6a: health_acknowledgments table ────────────────────────────────

  test('health_acknowledgments table has a record with has_cert=false', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT certification_required, user_has_cert, alternative_suggested
             FROM health_acknowledgments
            WHERE trip_id = $1 AND user_id = $2 AND activity_id = $3`,
          [trip.id, SEED_USERS.alice.id, scubaPoiId]
        );
        return r.length > 0 ? r : null;
      },
      { timeout: 15_000 }
    );

    expect(rows[0].certification_required).toMatch(/open_water/i);
    expect(rows[0].user_has_cert).toBe(false);
    expect(rows[0].alternative_suggested).toMatch(/snorkel/i);
  });

  // ── Step 6b: Scuba POI no longer in approved list ────────────────────────

  test('GET /trips/:id/pois → scuba POI is not in approved results', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/pois`)
      .set('Authorization', `Bearer ${token}`)
      .query({ approved: true })
      .expect(200);

    const approvedPois = res.body.pois;
    const scubaStillApproved = approvedPois.some(p =>
      (p.category || '').toLowerCase() === 'scuba' ||
      (p.poi_id === scubaPoiId)
    );
    expect(scubaStillApproved).toBe(false);
  });

  test('pois table has scuba POI with approved=false after cascade', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT approved FROM pois WHERE id = $1`,
          [scubaPoiId]
        );
        return r.length > 0 && r[0].approved === false ? r : null;
      },
      { timeout: 15_000 }
    );
    expect(rows[0].approved).toBe(false);
  });

  // ── Step 6c: Snorkeling POI is now in the trip's POI list ────────────────

  test('GET /trips/:id/pois → at least one snorkeling POI present', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/pois`)
      .set('Authorization', `Bearer ${token}`)
      .query({ destination: 'Okinawa', limit: 20 })
      .expect(200);

    const snorkelPoi = res.body.pois.find(p =>
      (p.category || '').toLowerCase().includes('snorkel') ||
      (p.tags || []).some(t => t.toLowerCase().includes('snorkel'))
    );
    expect(snorkelPoi).toBeDefined();
  });

  // ── Step 6d: Snorkeling POI has correct tags, no cert requirement ─────────

  test('Snorkeling POI has "snorkeling" tag', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/pois`)
      .set('Authorization', `Bearer ${token}`)
      .query({ destination: 'Okinawa' })
      .expect(200);

    const snorkelPoi = res.body.pois.find(p =>
      (p.tags || []).some(t => t.toLowerCase().includes('snorkel'))
    );
    expect(snorkelPoi).toBeDefined();
    expect(snorkelPoi.tags).toEqual(
      expect.arrayContaining([expect.stringMatching(/snorkel/i)])
    );
  });

  test('Snorkeling POI does not have requires_certification field set', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/pois`)
      .set('Authorization', `Bearer ${token}`)
      .query({ destination: 'Okinawa' })
      .expect(200);

    const snorkelPoi = res.body.pois.find(p =>
      (p.tags || []).some(t => t.toLowerCase().includes('snorkel'))
    );
    expect(snorkelPoi).toBeDefined();
    // Either field is absent or explicitly null/empty
    const cert = snorkelPoi.requires_certification;
    expect(!cert || cert === '' || cert === null).toBe(true);
  });

  // ── Inverse test: user WITH certification keeps scuba ────────────────────

  test('User who HAS scuba cert keeps scuba POI approved', async () => {
    const certTrip   = await createTrip(token, { name: 'Cert User Test', duration_days: 3 });
    await addBucketListItem(token, certTrip.id, 'Okinawa', 'Japan', 'beach');

    const [certScuba] = await dbQuery(
      `INSERT INTO pois (trip_id, name, category, city, country, lat, lng, tags, approved)
       VALUES ($1, 'Scuba for Certified', 'scuba', 'Okinawa', 'Japan', 26.21, 127.79, ARRAY['scuba','diving'], true)
       RETURNING id`,
      [certTrip.id]
    );

    const res = await request(API_V1)
      .post(`/trips/${certTrip.id}/members/${SEED_USERS.alice.id}/health-acknowledgment`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        acknowledgments: [{
          activity_id:            certScuba.id,
          certification_required: 'open_water_scuba',
          user_has_cert:          true,            // YES — certified
        }],
        dietary_restrictions: [],
        mobility_level:       'full',
      })
      .expect(200);

    // No alternatives should be suggested
    expect(res.body.alternatives_suggested).toHaveLength(0);

    // Scuba POI should remain approved
    const [row] = await dbQuery(
      `SELECT approved FROM pois WHERE id = $1`,
      [certScuba.id]
    );
    expect(row.approved).toBe(true);
  });
});
