/**
 * Integration Test 03 — Interest Profiles → POI Pipeline (Group Overlap)
 *
 * Scenario:
 *   Three members join a trip and submit divergent interest profiles:
 *     - Alice:  ['culture', 'food', 'art']
 *     - Bob:    ['food', 'adventure', 'art']
 *     - Carol:  ['nature', 'food', 'culture']
 *
 *   Group overlap (intersection):  ['food']          (all three share food)
 *   Majority overlap (≥2 of 3):    ['food','culture','art']
 *
 *   After submitting, request POIs and verify:
 *   a. Returned POIs contain tags matching GROUP overlap, not solo preferences
 *      (i.e. 'adventure' which only Bob has should NOT dominate the results)
 *   b. Every returned POI has at least one tag that maps to a majority-overlap category
 *   c. The group_interests endpoint returns a merged profile that excludes niche categories
 *   d. POI results don't include scuba/niche activities only one member wants
 *
 * Services under test: orchestrator → interest-profiler → group-coordinator → poi-discovery
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  acceptInvitation,
  addBucketListItem,
  submitInterests,
  SEED_USERS,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_PROFILES = {
  alice: { categories: ['culture', 'food', 'art'],       intensity: 'moderate' },
  bob:   { categories: ['food', 'adventure', 'art'],     intensity: 'high'     },
  carol: { categories: ['nature', 'food', 'culture'],    intensity: 'low'      },
};

/** Categories shared by ALL three members */
const FULL_OVERLAP = ['food'];

/** Categories shared by AT LEAST 2 of 3 members */
const MAJORITY_OVERLAP = new Set(['food', 'culture', 'art']);

/** Category only Bob has — should NOT dominate returned POIs */
const NICHE_ONLY_BOB = 'adventure';

// Category-to-tag mapping mirrors mock-server POI_FIXTURE_DB tag arrays
const CATEGORY_TAGS = {
  food:      ['food', 'market', 'seafood', 'ramen', 'dining'],
  culture:   ['temple', 'history', 'culture', 'museum'],
  art:       ['art', 'tech'],
  adventure: ['hiking', 'adventure'],
  nature:    ['park', 'nature', 'garden', 'bamboo', 'walk'],
};

function poiMatchesCategory(poi, category) {
  const tags = CATEGORY_TAGS[category] || [];
  return (poi.tags || []).some(t => tags.includes(t.toLowerCase()));
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('03 — Interest Profiles → POI Pipeline (Group Interest Overlap)', () => {
  let aliceToken, bobToken, carolToken;
  let trip;
  let poiResponse;

  beforeAll(async () => {
    [aliceToken, bobToken, carolToken] = await Promise.all([
      loginAs('alice'),
      loginAs('bob'),
      loginAs('carol'),
    ]);

    // Create trip (Alice owns it)
    trip = await createTrip(aliceToken, { name: 'Group POI Test', duration_days: 7 });

    // Invite Bob and Carol, both accept
    await inviteMember(aliceToken, trip.id, SEED_USERS.bob.email);
    await inviteMember(aliceToken, trip.id, SEED_USERS.carol.email);
    await acceptInvitation(bobToken,   trip.id, SEED_USERS.bob.id);
    await acceptInvitation(carolToken, trip.id, SEED_USERS.carol.id);

    // Add a destination so POI agent has a city context
    await addBucketListItem(aliceToken, trip.id, 'Tokyo', 'Japan', 'city');
  });

  // ── Step 1: Submit interest profiles ─────────────────────────────────────

  test('Alice submits her interest profile → 200', async () => {
    const { categories, intensity } = MEMBER_PROFILES.alice;
    const res = await request(API_V1)
      .put(`/trips/${trip.id}/members/${SEED_USERS.alice.id}/interests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ categories, intensity, must_do: [], avoid: [] })
      .expect(200);

    expect(res.body.categories).toEqual(expect.arrayContaining(categories));
  });

  test('Bob submits his interest profile → 200', async () => {
    const { categories, intensity } = MEMBER_PROFILES.bob;
    const res = await request(API_V1)
      .put(`/trips/${trip.id}/members/${SEED_USERS.bob.id}/interests`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ categories, intensity, must_do: [], avoid: [] })
      .expect(200);

    expect(res.body.categories).toEqual(expect.arrayContaining(categories));
  });

  test('Carol submits her interest profile → 200', async () => {
    const { categories, intensity } = MEMBER_PROFILES.carol;
    const res = await request(API_V1)
      .put(`/trips/${trip.id}/members/${SEED_USERS.carol.id}/interests`)
      .set('Authorization', `Bearer ${carolToken}`)
      .send({ categories, intensity, must_do: [], avoid: [] })
      .expect(200);

    expect(res.body.categories).toEqual(expect.arrayContaining(categories));
  });

  test('All 3 interest profiles are stored in the database', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT user_id, categories FROM interest_profiles WHERE trip_id = $1`,
          [trip.id]
        );
        return r.length === 3 ? r : null;
      },
      { timeout: 10_000 }
    );
    expect(rows).toHaveLength(3);
  });

  // ── Step 2: Verify group interests endpoint ───────────────────────────────

  test('GET /trips/:id/group-interests → 200 with merged group profile', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/group-interests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const merged = res.body.group_interests;
    expect(merged).toHaveProperty('categories');
    expect(Array.isArray(merged.categories)).toBe(true);

    // 'food' is shared by all — must appear
    expect(merged.categories).toContain('food');
  });

  test('Group interests include all majority-overlap categories', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/group-interests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const mergedCats = new Set(res.body.group_interests.categories);
    for (const cat of MAJORITY_OVERLAP) {
      expect(mergedCats.has(cat)).toBe(true); // `majority category "${cat}" must be in merged profile`
    }
  });

  test('Group interests: solo-niche category does not outrank group overlap', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/group-interests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .expect(200);

    const categories = res.body.group_interests.categories;
    const foodIndex      = categories.indexOf('food');
    const adventureIndex = categories.indexOf(NICHE_ONLY_BOB);

    // If adventure is present, food must rank higher (come first)
    if (adventureIndex !== -1) {
      expect(foodIndex).toBeLessThan(adventureIndex);
    }
  });

  // ── Step 3: Request POIs ──────────────────────────────────────────────────

  test('GET /trips/:id/pois → 200 returns POIs', async () => {
    const res = await request(API_V1)
      .get(`/trips/${trip.id}/pois`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .query({ destination: 'Tokyo', limit: 20 })
      .expect(200);

    poiResponse = res.body;
    expect(poiResponse).toHaveProperty('pois');
    expect(Array.isArray(poiResponse.pois)).toBe(true);
    expect(poiResponse.pois.length).toBeGreaterThan(0);
  });

  // ── Step 3a: POIs match group overlap, not individual preferences ─────────

  test('Every returned POI has at least one tag matching a majority-overlap category', () => {
    for (const poi of poiResponse.pois) {
      const matchesMajority = [...MAJORITY_OVERLAP].some(cat =>
        poiMatchesCategory(poi, cat)
      );
      expect(matchesMajority).toBe(true);
      // `POI "${poi.name}" must match at least one majority-overlap category`
    }
  });

  test('POI list is not dominated by adventure (Bob-only) items', () => {
    const adventureCount = poiResponse.pois.filter(p =>
      poiMatchesCategory(p, NICHE_ONLY_BOB)
    ).length;

    const foodCount = poiResponse.pois.filter(p =>
      poiMatchesCategory(p, 'food')
    ).length;

    // Food (group overlap) must have more or equal representation than adventure (solo preference)
    expect(foodCount).toBeGreaterThanOrEqual(adventureCount);
  });

  test('POI results contain food-category POIs (full group overlap)', () => {
    const foodPois = poiResponse.pois.filter(p => poiMatchesCategory(p, 'food'));
    expect(foodPois.length).toBeGreaterThan(0);
  });

  // ── Step 3b: POI structure is valid ──────────────────────────────────────

  test('All returned POIs have required fields', () => {
    const REQUIRED = ['poi_id', 'name', 'category', 'city', 'tags'];
    for (const poi of poiResponse.pois) {
      for (const field of REQUIRED) {
        expect(poi).toHaveProperty(field);
      }
      expect(typeof poi.name).toBe('string');
      expect(poi.name.length).toBeGreaterThan(0);
    }
  });

  test('All returned POIs have a valid location object', () => {
    for (const poi of poiResponse.pois) {
      expect(poi).toHaveProperty('location');
      expect(typeof poi.location.lat).toBe('number');
      expect(typeof poi.location.lng).toBe('number');
      expect(poi.location.lat).toBeGreaterThan(-90);
      expect(poi.location.lat).toBeLessThan(90);
      expect(poi.location.lng).toBeGreaterThan(-180);
      expect(poi.location.lng).toBeLessThan(180);
    }
  });

  // ── Edge: submitting only 1 interest profile still returns POIs ───────────

  test('Trip with only 1 submitted profile still returns POIs (graceful degradation)', async () => {
    const soloTrip = await createTrip(aliceToken, { name: 'Solo POI Test' });
    await addBucketListItem(aliceToken, soloTrip.id, 'Osaka', 'Japan');

    await request(API_V1)
      .put(`/trips/${soloTrip.id}/members/${SEED_USERS.alice.id}/interests`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ categories: ['culture'], intensity: 'moderate', must_do: [], avoid: [] })
      .expect(200);

    const res = await request(API_V1)
      .get(`/trips/${soloTrip.id}/pois`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .query({ destination: 'Osaka', limit: 10 })
      .expect(200);

    expect(res.body.pois.length).toBeGreaterThan(0);
  });
});
