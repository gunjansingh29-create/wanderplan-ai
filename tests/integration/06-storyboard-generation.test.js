/**
 * Integration Test 06 — Storyboard Generation
 *
 * Scenario:
 *   A trip day has 4 completed activities. Each member has selected a social
 *   platform. Storyboard generation is triggered and the test verifies:
 *
 *   a. Content is generated for each member's chosen platform
 *   b. Platform-specific length constraints are respected:
 *        - twitter/x:    ≤ 280 characters
 *        - instagram:    ≤ 2200 characters, ≥ 150 characters
 *        - tiktok:       ≤ 300 characters (caption)
 *        - blog:         ≥ 300 words
 *   c. Content style markers are present:
 *        - instagram:    contains at least 3 hashtags (#word)
 *        - twitter:      may contain hashtags or none — just char limit
 *        - blog:         contains paragraphs (newlines) and no hashtags expected
 *   d. Content references at least one of the 4 activity titles or destinations
 *   e. Storyboard rows are persisted in the storyboards table
 *
 * Members & platforms:
 *   Alice  → instagram
 *   Bob    → twitter
 *   Carol  → blog
 *   Dave   → tiktok
 *
 * Services under test: orchestrator → storyboard-agent → postgres
 */

'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  createTrip,
  inviteMember,
  acceptInvitation,
  SEED_USERS,
  dbQuery,
  pollUntil,
} = require('./setup/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_PLATFORMS = {
  alice: 'instagram',
  bob:   'twitter',
  carol: 'blog',
  dave:  'tiktok',
};

const PLATFORM_CONSTRAINTS = {
  instagram: { minChars: 150, maxChars: 2200, minHashtags: 3 },
  twitter:   { maxChars: 280 },
  tiktok:    { maxChars: 300 },
  blog:      { minWords: 300, noHashtags: false },
};

const ACTIVITIES = [
  { title: 'Morning visit to Senso-ji Temple',  category: 'culture',  location: 'Asakusa, Tokyo' },
  { title: 'Tsukiji Market seafood breakfast',  category: 'food',     location: 'Tsukiji, Tokyo' },
  { title: 'teamLab Borderless digital art',    category: 'art',      location: 'Odaiba, Tokyo'  },
  { title: 'Sunset at Shinjuku Gyoen Garden',   category: 'nature',   location: 'Shinjuku, Tokyo'},
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countHashtags(text) {
  return (text.match(/#\w+/g) || []).length;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('06 — Storyboard Generation (4 activities × 4 platforms)', () => {
  let aliceToken, bobToken, carolToken, daveToken;
  let trip;
  let dayId;
  let storyboards = {};   // { alice: {...}, bob: {...}, carol: {...}, dave: {...} }

  beforeAll(async () => {
    [aliceToken, bobToken, carolToken, daveToken] = await Promise.all([
      loginAs('alice'),
      loginAs('bob'),
      loginAs('carol'),
      loginAs('dave'),
    ]);

    // Create trip
    trip = await createTrip(aliceToken, { name: 'Storyboard Test Trip', duration_days: 1 });

    // Invite members and accept
    for (const [key, user] of Object.entries({ bob: SEED_USERS.bob, carol: SEED_USERS.carol, dave: SEED_USERS.dave })) {
      const inviteeToken = { bob: bobToken, carol: carolToken, dave: daveToken }[key];
      await inviteMember(aliceToken, trip.id, user.email);
      await acceptInvitation(inviteeToken, trip.id, user.id);
    }

    // Seed itinerary day + 4 activities
    const [day] = await dbQuery(
      `INSERT INTO itinerary_days (trip_id, day_number, date, title, approved)
       VALUES ($1, 1, '2025-03-20', 'Tokyo Day 1', true)
       RETURNING id`,
      [trip.id]
    );
    dayId = day.id;

    const slots = ['08:00-10:00', '10:30-12:00', '13:00-15:00', '17:00-19:00'];
    for (let i = 0; i < ACTIVITIES.length; i++) {
      const act = ACTIVITIES[i];
      await dbQuery(
        `INSERT INTO itinerary_activities
           (day_id, time_slot, title, description, category, location_name, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [dayId, slots[i], act.title, `Description: ${act.title}`, act.category, act.location, 35.67, 139.65]
      );
    }

    // Set member platform preferences
    for (const [userKey, platform] of Object.entries(MEMBER_PLATFORMS)) {
      const userId = SEED_USERS[userKey].id;
      const tok    = { alice: aliceToken, bob: bobToken, carol: carolToken, dave: daveToken }[userKey];
      await request(API_V1)
        .put(`/trips/${trip.id}/members/${userId}/platform-preference`)
        .set('Authorization', `Bearer ${tok}`)
        .send({ platform })
        .expect(200);
    }
  });

  // ── Trigger storyboard generation ────────────────────────────────────────

  test('POST /trips/:id/storyboard/generate → 200 storyboard created', async () => {
    const res = await request(API_V1)
      .post(`/trips/${trip.id}/storyboard/generate`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ day_id: dayId })
      .expect(200);

    expect(res.body).toHaveProperty('storyboards');
    expect(Array.isArray(res.body.storyboards)).toBe(true);
    expect(res.body.storyboards.length).toBeGreaterThanOrEqual(
      Object.keys(MEMBER_PLATFORMS).length
    );
  });

  // ── Retrieve per-member storyboards ──────────────────────────────────────

  test.each(Object.entries(MEMBER_PLATFORMS))(
    'GET /trips/:id/storyboard/%s → 200 with content for %s platform',
    async (userKey, platform) => {
      const userId = SEED_USERS[userKey].id;
      const tok    = { alice: aliceToken, bob: bobToken, carol: carolToken, dave: daveToken }[userKey];

      const res = await request(API_V1)
        .get(`/trips/${trip.id}/storyboard/${userId}`)
        .set('Authorization', `Bearer ${tok}`)
        .expect(200);

      expect(res.body).toHaveProperty('storyboard');
      const sb = res.body.storyboard;
      expect(sb.platform).toBe(platform);
      expect(typeof sb.content).toBe('string');
      expect(sb.content.length).toBeGreaterThan(0);

      storyboards[userKey] = sb;
    }
  );

  // ── Step b: Platform length constraints ──────────────────────────────────

  test('Instagram content: 150–2200 characters', () => {
    const content = storyboards.alice?.content || '';
    expect(content.length).toBeGreaterThanOrEqual(PLATFORM_CONSTRAINTS.instagram.minChars);
    expect(content.length).toBeLessThanOrEqual(PLATFORM_CONSTRAINTS.instagram.maxChars);
  });

  test('Twitter/X content: ≤ 280 characters', () => {
    const content = storyboards.bob?.content || '';
    expect(content.length).toBeLessThanOrEqual(PLATFORM_CONSTRAINTS.twitter.maxChars);
  });

  test('TikTok caption: ≤ 300 characters', () => {
    const content = storyboards.dave?.content || '';
    expect(content.length).toBeLessThanOrEqual(PLATFORM_CONSTRAINTS.tiktok.maxChars);
  });

  test('Blog content: ≥ 300 words', () => {
    const content = storyboards.carol?.content || '';
    const wordCount = countWords(content);
    expect(wordCount).toBeGreaterThanOrEqual(PLATFORM_CONSTRAINTS.blog.minWords);
  });

  // ── Step c: Style markers ─────────────────────────────────────────────────

  test('Instagram content contains ≥ 3 hashtags', () => {
    const content = storyboards.alice?.content || '';
    const hashtagCount = countHashtags(content);
    expect(hashtagCount).toBeGreaterThanOrEqual(
      PLATFORM_CONSTRAINTS.instagram.minHashtags
    );
  });

  test('Blog content contains paragraph breaks (narrative style)', () => {
    const content = storyboards.carol?.content || '';
    // Blog posts should have at least 2 newline-separated paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
  });

  // ── Step d: Content references activity or destination ───────────────────

  test.each(Object.entries(MEMBER_PLATFORMS))(
    '%s storyboard content references at least 1 activity or location',
    (userKey) => {
      const content = (storyboards[userKey]?.content || '').toLowerCase();
      const keywords = [
        ...ACTIVITIES.map(a => a.title.toLowerCase()),
        ...ACTIVITIES.map(a => a.location.toLowerCase().split(',')[0]),
        'tokyo',
      ];
      const anyMatch = keywords.some(kw => content.includes(kw));
      expect(anyMatch).toBe(true);
    }
  );

  // ── Step e: Persistence ───────────────────────────────────────────────────

  test('storyboards table contains 4 rows after generation', async () => {
    const rows = await pollUntil(
      async () => {
        const r = await dbQuery(
          `SELECT user_id, platform, word_count FROM storyboards WHERE trip_id = $1`,
          [trip.id]
        );
        return r.length >= Object.keys(MEMBER_PLATFORMS).length ? r : null;
      },
      { timeout: 20_000 }
    );
    expect(rows.length).toBeGreaterThanOrEqual(Object.keys(MEMBER_PLATFORMS).length);
  });

  test('Each storyboard row has the correct platform for each member', async () => {
    const rows = await dbQuery(
      `SELECT user_id, platform FROM storyboards WHERE trip_id = $1`,
      [trip.id]
    );

    const platformByUser = Object.fromEntries(
      rows.map(r => [r.user_id, r.platform])
    );

    for (const [userKey, expectedPlatform] of Object.entries(MEMBER_PLATFORMS)) {
      const userId = SEED_USERS[userKey].id;
      expect(platformByUser[userId]).toBe(expectedPlatform);
    }
  });

  test('Blog storyboard row has word_count ≥ 300', async () => {
    const [row] = await dbQuery(
      `SELECT word_count FROM storyboards
        WHERE trip_id = $1 AND user_id = $2`,
      [trip.id, SEED_USERS.carol.id]
    );
    expect(row.word_count).toBeGreaterThanOrEqual(300);
  });

  test('Twitter storyboard row has word_count consistent with ≤ 280 chars', async () => {
    const [row] = await dbQuery(
      `SELECT word_count, content FROM storyboards
        WHERE trip_id = $1 AND user_id = $2`,
      [trip.id, SEED_USERS.bob.id]
    );
    // A 280-char tweet is at most ~50 words
    expect(row.word_count).toBeLessThanOrEqual(60);
  });
});
