/**
 * API mock fixtures — intercept all WanderPlan API calls and return
 * deterministic stubs so E2E tests don't depend on a live backend.
 *
 * Usage:
 *   import { setupApiMocks } from '../fixtures/api-mock';
 *   test.beforeEach(async ({ page }) => { await setupApiMocks(page); });
 */

import { Page, Route } from '@playwright/test';

const API = process.env.API_BASE_URL || 'http://localhost:18000/v1';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id:    '00000000-0000-0000-0000-000000000001',
  name:  'Alice Test',
  email: 'alice@test.com',
};

const MOCK_TOKEN = 'e2e-mock-access-token';

const MOCK_TRIP = {
  id:            'aaaaaaaa-0000-0000-0000-000000000001',
  name:          'Japan & Greece Adventure',
  status:        'planning',
  duration_days: 7,
  owner_id:      MOCK_USER.id,
  members: [
    { user_id: MOCK_USER.id, role: 'owner', status: 'accepted' },
  ],
};

const MOCK_BUDGET = {
  currency:    'USD',
  daily_target: 150,
  total_budget: 1050,
  spent:        0,
  remaining:    1050,
  breakdown: {
    flights:       315,
    accommodation: 315,
    dining:        210,
    activities:    105,
    transport:     52.5,
    misc:          52.5,
  },
  warning_active: false,
};

const MOCK_FLIGHTS = [
  { flight_id: 'FL-001', airline: 'Japan Airlines',  departure_airport: 'LAX', arrival_airport: 'NRT',
    departure_time: '2025-06-15T10:30:00Z', arrival_time: '2025-06-16T14:45:00Z',
    price_usd: 248, stops: 0, duration_minutes: 660, selected: false },
  { flight_id: 'FL-002', airline: 'Emirates',         departure_airport: 'LAX', arrival_airport: 'NRT',
    departure_time: '2025-06-15T22:15:00Z', arrival_time: '2025-06-17T07:30:00Z',
    price_usd: 195, stops: 1, duration_minutes: 780, selected: false },
  { flight_id: 'FL-003', airline: 'ANA',              departure_airport: 'LAX', arrival_airport: 'NRT',
    departure_time: '2025-06-16T11:00:00Z', arrival_time: '2025-06-17T15:20:00Z',
    price_usd: 275, stops: 0, duration_minutes: 720, selected: false },
];

const MOCK_STAYS = [
  { stay_id: 'ST-001', name: 'Canaves Oia Suites', type: 'Boutique Hotel',
    price_per_night_usd: 245, rating: 4.9,
    amenities: ['Pool', 'WiFi', 'Breakfast'], selected: false },
  { stay_id: 'ST-002', name: 'Hotel Kanra Kyoto', type: 'Hotel',
    price_per_night_usd: 130, rating: 4.5,
    amenities: ['Onsen', 'WiFi', 'Restaurant'], selected: false },
];

const MOCK_POIS = Array.from({ length: 8 }, (_, i) => ({
  poi_id:   `POI-00${i+1}`,
  name:     ['Senso-ji Temple', 'Tsukiji Market', 'Kinkaku-ji', 'Fushimi Inari',
             'Arashiyama Bamboo', 'teamLab Borderless', 'Nishiki Food Tour', 'Caldera Trail'][i],
  category: ['culture','food','culture','culture','nature','art','food','nature'][i],
  city:     i < 4 ? 'Tokyo' : 'Kyoto',
  country:  'Japan',
  location: { lat: 35.67 + i*0.01, lng: 139.65 + i*0.01 },
  tags:     [['temple','history'], ['food','market'], ['history','photo'], ['hiking'],
             ['nature','bamboo'], ['art','tech'], ['food','culture'], ['hiking','photo']][i],
  rating:   4.5 + (i % 5) * 0.1,
  cost_estimate_usd: [0, 15, 5, 0, 0, 32, 45, 0][i],
  approved: false,
}));

const MOCK_TIMING = {
  timing_results: [
    { destination: 'Tokyo', month_scores: { Jan:5,Feb:6,Mar:9,Apr:10,May:8,Jun:7,Jul:5,Aug:4,Sep:7,Oct:9,Nov:8,Dec:6 },
      preferred_months: ['March','April','October'], avoid_months: ['July','August'],
      best_window: { start: '2025-06-15', end: '2025-06-28' } },
    { destination: 'Santorini', month_scores: { Jan:3,Feb:4,Mar:6,Apr:8,May:9,Jun:10,Jul:9,Aug:8,Sep:9,Oct:7,Nov:4,Dec:3 },
      preferred_months: ['May','June','September'], avoid_months: ['December','January'],
      best_window: { start: '2025-06-15', end: '2025-06-28' } },
  ],
};

const MOCK_CALENDAR_SYNC = {
  synced: true,
  events_created: 30,
  provider: 'google',
  calendar_id: 'primary',
};

// ─────────────────────────────────────────────────────────────────────────────
// Route installer
// ─────────────────────────────────────────────────────────────────────────────

/** Install all API route mocks on the given page. */
export async function setupApiMocks(page: Page): Promise<void> {
  const fulfill = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  // Auth
  await page.route(`${API}/auth/register`, r => fulfill(r, { accessToken: MOCK_TOKEN, refreshToken: 'refresh', expiresIn: 86400, user: MOCK_USER }, 201));
  await page.route(`${API}/auth/login`,    r => fulfill(r, { accessToken: MOCK_TOKEN, refreshToken: 'refresh', expiresIn: 86400, user: MOCK_USER }));

  // Trips
  await page.route(`${API}/trips`,                          r => r.request().method() === 'POST' ? fulfill(r, { trip: MOCK_TRIP }, 201) : r.continue());
  await page.route(`${API}/trips/${MOCK_TRIP.id}`,          r => fulfill(r, { trip: MOCK_TRIP }));
  await page.route(`${API}/trips/${MOCK_TRIP.id}/members`,  r => r.request().method() === 'POST' ? fulfill(r, { user_id: 'new-member', role: 'member', status: 'pending' }, 201) : r.continue());

  // Wildcard: member accept
  await page.route(`**/${MOCK_TRIP.id}/members/**`,         r => fulfill(r, { user_id: 'member', status: 'accepted' }));

  // Bucket list
  await page.route(`**/${MOCK_TRIP.id}/bucket-list`,        r => r.request().method() === 'POST' ? fulfill(r, { item: { id: 'BL-001', destination: 'Tokyo', country: 'Japan' } }, 201) : r.continue());
  await page.route(`**/${MOCK_TRIP.id}/bucket-list/ranked`, r => fulfill(r, { items: [{ destination: 'Tokyo', score: 92 }, { destination: 'Santorini', score: 87 }] }));

  // Timing
  await page.route(`**/${MOCK_TRIP.id}/timing-analysis`, r => fulfill(r, MOCK_TIMING));

  // Interests
  await page.route(`**/${MOCK_TRIP.id}/members/**/interests`, r => fulfill(r, { categories: ['culture', 'food', 'adventure'] }));
  await page.route(`**/${MOCK_TRIP.id}/group-interests`,      r => fulfill(r, { group_interests: { categories: ['food', 'culture', 'adventure'] } }));

  // Health
  await page.route(`**/${MOCK_TRIP.id}/health-requirements`,            r => fulfill(r, { requirements: [{ activity: 'travel', certification_required: null }] }));
  await page.route(`**/${MOCK_TRIP.id}/members/**/health-acknowledgment`, r => fulfill(r, { processed: true, alternatives_suggested: [] }));

  // POIs
  await page.route(`**/${MOCK_TRIP.id}/pois`,               r => fulfill(r, { pois: MOCK_POIS }));
  await page.route(`**/${MOCK_TRIP.id}/pois/**/approve`,    r => fulfill(r, { poi: { ...MOCK_POIS[0], approved: true } }));

  // Availability
  await page.route(`**/${MOCK_TRIP.id}/availability`,         r => r.request().method() === 'POST' ? fulfill(r, { user_id: MOCK_USER.id }, 201) : r.continue());
  await page.route(`**/${MOCK_TRIP.id}/availability/overlap`, r => fulfill(r, { overlap: { start: '2025-06-15', end: '2025-06-28' }, prompt_members_to_adjust: false }));

  // Budget
  await page.route(`**/${MOCK_TRIP.id}/budget`,             r => fulfill(r, { budget: MOCK_BUDGET }));
  await page.route(`**/${MOCK_TRIP.id}/budget/breakdown`,   r => fulfill(r, { budget: MOCK_BUDGET }));
  await page.route(`**/${MOCK_TRIP.id}/budget/increase`,    r => fulfill(r, { budget: { ...MOCK_BUDGET, daily_target: 200, total_budget: 1400, remaining: 1400, breakdown: { flights: 420, accommodation: 420, dining: 280, activities: 140, transport: 70, misc: 70 } } }));

  // Flights
  await page.route(`**/${MOCK_TRIP.id}/flights/search`, r => fulfill(r, { flights: MOCK_FLIGHTS, search_params: { max_price: 315 } }));
  await page.route(`**/${MOCK_TRIP.id}/flights/select`, r => fulfill(r, { selected: true, budget: { ...MOCK_BUDGET, spent: 248, remaining: 802 } }));

  // Stays
  await page.route(`**/${MOCK_TRIP.id}/stays/search`, r => fulfill(r, { stays: MOCK_STAYS }));
  await page.route(`**/${MOCK_TRIP.id}/stays/select`, r => fulfill(r, { selected: true, budget: { ...MOCK_BUDGET, spent: 558, remaining: 492 } }));

  // Dining
  await page.route(`**/${MOCK_TRIP.id}/dining/suggestions`, r => fulfill(r, { suggestions: [{ day: 1, meal: 'Breakfast', name: 'Karma', cuisine: 'Mediterranean', cost: 28 }] }));

  // Itinerary
  await page.route(`**/${MOCK_TRIP.id}/itinerary`,         r => fulfill(r, { itinerary: { days: [] } }));
  await page.route(`**/${MOCK_TRIP.id}/itinerary/approve`, r => fulfill(r, { approved: true }));

  // Calendar sync
  await page.route(`**/${MOCK_TRIP.id}/itinerary/calendar-sync`, r => fulfill(r, MOCK_CALENDAR_SYNC));

  // Analytics (accept silently)
  await page.route(`${API}/analytics/event`, r => fulfill(r, { accepted: true }, 202));

  // Storyboard
  await page.route(`**/${MOCK_TRIP.id}/storyboard/**`, r => fulfill(r, { storyboard: { platform: 'instagram', content: 'Amazing trip! #travel #japan #wanderplan' } }));
}

/** Install a variant mock where flight search returns no results first, then results on retry. */
export async function setupFlightRetryMock(page: Page, tripId: string): Promise<void> {
  let callCount = 0;
  await page.route(`**/${tripId}/flights/search`, async route => {
    callCount++;
    if (callCount <= 2) {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ flights: [], message: 'No flights found matching criteria' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ flights: MOCK_FLIGHTS, expanded_search: true }) });
    }
  });
}

/** Install a variant mock where a stay exceeds the budget allocation. */
export async function setupOverBudgetStayMock(page: Page, tripId: string): Promise<void> {
  await page.route(`**/${tripId}/stays/select`, route =>
    route.fulfill({ status: 422, contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'BUDGET_EXCEEDED', message: 'Stay exceeds accommodation allocation', status: 422 },
        budget_warning: { allocation: 315, requested: 560, category: 'accommodation' },
      }),
    })
  );
}

/**
 * Install mocks for a group trip context.
 * Returns group-aware responses including vote counts, merged interests,
 * group availability overlap, and multi-calendar sync.
 *
 * @param page         - Playwright Page
 * @param memberEmails - Array of member email addresses in the group
 */
export async function setupGroupApiMocks(page: Page, memberEmails: string[]): Promise<void> {
  const fulfill = (route: Parameters<Page['route']>[1] extends (r: infer R, ...a: unknown[]) => unknown ? R : never, body: unknown, status = 200) =>
    (route as { fulfill: (opts: { status: number; contentType: string; body: string }) => Promise<void> }).fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
    });

  const groupSize = memberEmails.length;

  const mockGroupMembers = memberEmails.map((email, i) => ({
    user_id: `group-member-${String(i + 1).padStart(4, '0')}`,
    email,
    name:    email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
    role:    i === 0 ? 'owner' : 'member',
    status:  'accepted',
  }));

  // Override trip response with group context
  await page.route('**/trips/*', async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        trip: {
          id:            MOCK_TRIP.id,
          name:          'Group Asia Adventure',
          status:        'planning',
          duration_days: 7,
          owner_id:      mockGroupMembers[0].user_id,
          group_size:    groupSize,
          members:       mockGroupMembers,
        },
      }),
    });
  });

  // Bucket list with group vote counts
  await page.route('**/bucket-list/ranked', async route => {
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          { destination: 'Tokyo',   country: 'Japan',   vote_count: groupSize, total_members: groupSize, score: 95 },
          { destination: 'Bali',    country: 'Indonesia', vote_count: Math.ceil(groupSize * 0.75), total_members: groupSize, score: 80 },
          { destination: 'Kyoto',   country: 'Japan',   vote_count: Math.ceil(groupSize * 0.75), total_members: groupSize, score: 78 },
        ],
      }),
    });
  });

  // Group timing — "compromise" between member preferences
  await page.route('**/timing-analysis', async route => {
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        group_compromise: true,
        timing_results: [
          {
            destination: 'Tokyo',
            month_scores: { Jan:4,Feb:5,Mar:8,Apr:9,May:7,Jun:6,Jul:4,Aug:3,Sep:6,Oct:8,Nov:7,Dec:5 },
            preferred_months: ['March', 'April', 'October'],
            avoid_months: ['July', 'August'],
            best_window: { start: '2025-10-10', end: '2025-10-24' },
          },
        ],
      }),
    });
  });

  // Group interests — merged from all members
  await page.route('**/group-interests', async route => {
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        group_interests: {
          categories: ['food', 'culture', 'adventure'],
          merged_from: groupSize,
          majority_overlap: ['food', 'culture'],
          full_overlap:     ['food'],
        },
      }),
    });
  });

  // Group availability — overlap found for all members
  await page.route('**/availability/overlap', async route => {
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        group_size:    groupSize,
        overlap_found: true,
        overlap_window: { start: '2025-10-10', end: '2025-10-24' },
        members_with_availability: memberEmails,
        prompt_members_to_adjust: false,
      }),
    });
  });

  // Group POIs — tagged with group_match score
  await page.route('**/pois', async route => {
    if (route.request().method() !== 'GET') { await route.continue(); return; }
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        pois: MOCK_POIS.map(p => ({ ...p, group_match: Math.round((65 + Math.random() * 35) / 5) * 5 })),
        group_size: groupSize,
      }),
    });
  });

  // Multi-calendar sync
  await page.route('**/itinerary/calendar-sync', async route => {
    await (route as unknown as { fulfill: (o: object) => Promise<void> }).fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        synced: true,
        events_created: 30,
        calendars_synced: memberEmails.map(email => ({
          user:     email,
          provider: 'google',
          status:   'synced',
        })),
      }),
    });
  });
}
