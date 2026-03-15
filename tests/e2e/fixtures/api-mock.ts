/**
 * API mock fixtures — intercept all WanderPlan API calls and return
 * deterministic stubs so E2E tests don't depend on a live backend.
 *
 * Usage:
 *   import { setupApiMocks } from '../fixtures/api-mock';
 *   test.beforeEach(async ({ page }) => { await setupApiMocks(page); });
 */

import { Page, Route } from '@playwright/test';

const API = process.env.API_BASE_URL || 'http://localhost:8000';

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
  { flight_id: 'FL-001', leg_id: 'leg-1-LAX-NRT-2025-06-15', airline: 'Japan Airlines',  departure_airport: 'LAX', arrival_airport: 'NRT',
    departure_time: '2025-06-15T10:30:00Z', arrival_time: '2025-06-16T14:45:00Z',
    price_usd: 248, stops: 0, duration_minutes: 660, selected: false },
  { flight_id: 'FL-002', leg_id: 'leg-1-LAX-NRT-2025-06-15', airline: 'Emirates',         departure_airport: 'LAX', arrival_airport: 'NRT',
    departure_time: '2025-06-15T22:15:00Z', arrival_time: '2025-06-17T07:30:00Z',
    price_usd: 195, stops: 1, duration_minutes: 780, selected: false },
  { flight_id: 'FL-003', leg_id: 'leg-1-LAX-NRT-2025-06-15', airline: 'ANA',              departure_airport: 'LAX', arrival_airport: 'NRT',
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
  const mockTrip = JSON.parse(JSON.stringify(MOCK_TRIP));
  const companionPayload = () => ({
    companion: {
      trip: {
        id: mockTrip.id,
        owner_id: mockTrip.owner_id,
        name: mockTrip.name,
        status: mockTrip.status,
        duration_days: mockTrip.duration_days,
      },
      locked_window: { start: '2025-06-15', end: '2025-06-21' },
      current_step: 14,
      members: [
        {
          user_id: MOCK_USER.id,
          role: 'owner',
          status: 'accepted',
          display_name: MOCK_USER.name,
          email: MOCK_USER.email,
        },
      ],
      today: {
        day_number: 1,
        date: '2025-06-15',
        title: 'Arrival Day',
        approved: true,
        items: [
          { activity_id: 'act-1', time_slot: '09:00-10:00', title: 'Land in Tokyo', category: 'flight', location: 'Haneda Airport' },
          { activity_id: 'act-2', time_slot: '13:00-14:00', title: 'Check in at hotel', category: 'checkin', location: 'Shinjuku' },
        ],
      },
      upcoming: [
        {
          day_number: 2,
          date: '2025-06-16',
          title: 'Culture Day',
          approved: true,
          items: [
            { activity_id: 'act-3', time_slot: '10:00-11:00', title: 'Senso-ji Temple', category: 'culture', location: 'Asakusa' },
          ],
        },
      ],
      days: [],
      stats: { day_count: 7, approved_days: 7, item_count: 14 },
    },
  });

  // Auth
  await page.route(`${API}/auth/register`, r => fulfill(r, { accessToken: MOCK_TOKEN, refreshToken: 'refresh', expiresIn: 86400, user: MOCK_USER }, 201));
  await page.route(`${API}/auth/login`,    r => fulfill(r, { accessToken: MOCK_TOKEN, refreshToken: 'refresh', expiresIn: 86400, user: MOCK_USER }));
  await page.route(`${API}/me/profile`,    r => fulfill(r, { profile: { display_name: MOCK_USER.name, travel_styles: ['solo'], interests: { culture: true, food: true }, budget_tier: 'moderate', dietary: [] } }));
  await page.route(`${API}/me/bucket-list`, r => fulfill(r, { items: [] }));
  await page.route(`${API}/crew/peer-profiles`, r => fulfill(r, { peers: [] }));
  await page.route(`${API}/crew/invites/sent`, r => fulfill(r, { invites: [] }));
  await page.route(`${API}/me/trips`, r => fulfill(r, { trips: [mockTrip] }));

  // Trips
  await page.route(`${API}/trips`,                          r => r.request().method() === 'POST' ? fulfill(r, { trip: mockTrip }, 201) : r.continue());
  await page.route(`${API}/trips/${MOCK_TRIP.id}`,          r => fulfill(r, { trip: mockTrip }));
  await page.route(`${API}/trips/${MOCK_TRIP.id}/members`,  r => r.request().method() === 'POST' ? fulfill(r, { user_id: 'new-member', role: 'member', status: 'pending' }, 201) : r.continue());
  await page.route(`${API}/trips/${MOCK_TRIP.id}/companion`, r => {
    if (mockTrip.status !== 'active' && mockTrip.status !== 'completed') {
      return fulfill(r, { detail: 'Trip is not active yet' }, 409);
    }
    return fulfill(r, companionPayload());
  });

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

  // Airport search (city-to-IATA typeahead)
  await page.route(`${API}/airports/search**`, async route => {
    const url = new URL(route.request().url());
    const q = (url.searchParams.get('q') ?? '').toLowerCase().trim();
    const AIRPORTS_DB = [
      { iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'US' },
      { iata: 'ONT', name: 'Ontario International', city: 'Ontario / Los Angeles', country: 'US' },
      { iata: 'BUR', name: 'Hollywood Burbank Airport', city: 'Burbank', country: 'US' },
      { iata: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'JP' },
      { iata: 'HND', name: 'Haneda Airport', city: 'Tokyo', country: 'JP' },
      { iata: 'KIX', name: 'Kansai International Airport', city: 'Osaka / Kyoto', country: 'JP' },
      { iata: 'JTR', name: 'Santorini National Airport', city: 'Santorini', country: 'GR' },
      { iata: 'ATH', name: 'Athens International Airport', city: 'Athens', country: 'GR' },
      { iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'US' },
      { iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'US' },
      { iata: 'LHR', name: 'Heathrow Airport', city: 'London', country: 'GB' },
      { iata: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'FR' },
      { iata: 'DPS', name: 'Ngurah Rai International Airport', city: 'Bali / Denpasar', country: 'ID' },
      { iata: 'LIM', name: 'Jorge Chávez International Airport', city: 'Lima', country: 'PE' },
    ];
    const matches = q.length >= 2
      ? AIRPORTS_DB.filter(a =>
          a.city.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.iata.toLowerCase() === q
        ).slice(0, 5)
      : [];
    await fulfill(route, { airports: matches, source: 'mock' });
  });

  // Flights
  await page.route(`**/${MOCK_TRIP.id}/flights/search`, r => fulfill(r, {
    flights: MOCK_FLIGHTS,
    legs: [
      {
        leg_id: 'leg-1-LAX-NRT-2025-06-15',
        from_airport: 'LAX',
        to_airport: 'NRT',
        depart_date: '2025-06-15',
        options: MOCK_FLIGHTS,
      },
    ],
    search_params: { max_price: 315, source: 'amadeus', total_options: MOCK_FLIGHTS.length, segments: 1 },
  }));
  await page.route(`**/${MOCK_TRIP.id}/flights/select`, r => fulfill(r, { selected: true, budget: { ...MOCK_BUDGET, spent: 248, remaining: 802 } }));

  // Stays
  await page.route(`**/${MOCK_TRIP.id}/stays/search`, r => fulfill(r, { stays: MOCK_STAYS }));
  await page.route(`**/${MOCK_TRIP.id}/stays/select`, r => fulfill(r, { selected: true, budget: { ...MOCK_BUDGET, spent: 558, remaining: 492 } }));

  // Dining
  await page.route(`**/${MOCK_TRIP.id}/dining/suggestions`, r => fulfill(r, { suggestions: [{ day: 1, meal: 'Breakfast', name: 'Karma', cuisine: 'Mediterranean', cost: 28 }] }));

  // Itinerary
  await page.route(`**/${MOCK_TRIP.id}/itinerary`,         r => fulfill(r, { itinerary: { days: [] } }));
  await page.route(`**/${MOCK_TRIP.id}/itinerary/approve`, r => {
    mockTrip.status = 'active';
    return fulfill(r, { approved: true, trip: mockTrip });
  });

  // Calendar sync
  await page.route(`**/${MOCK_TRIP.id}/itinerary/calendar-sync`, r => fulfill(r, MOCK_CALENDAR_SYNC));

  // Analytics (accept silently)
  await page.route(`${API}/analytics/event`, r => fulfill(r, { accepted: true }, 202));

  // Storyboard
  await page.route(`**/${MOCK_TRIP.id}/storyboard/**`, r => fulfill(r, { storyboard: { platform: 'instagram', content: 'Amazing trip! #travel #japan #wanderplan' } }));
}

/** Install a multi-city flight mock (two outbound legs + return). */
export async function setupMultiCityFlightMock(page: Page, tripId: string): Promise<void> {
  const MULTI_CITY_FLIGHTS = [
    // Leg 1: LAX → NRT
    { flight_id: 'MC-001', leg_id: 'leg-1-LAX-NRT-2025-06-15',
      airline: 'Japan Airlines', departure_airport: 'LAX', arrival_airport: 'NRT',
      departure_time: '2025-06-15T10:30:00Z', arrival_time: '2025-06-16T14:45:00Z',
      price_usd: 248, stops: 0, duration_minutes: 660, cabin_class: 'Economy', source: 'amadeus', selected: false },
    { flight_id: 'MC-002', leg_id: 'leg-1-LAX-NRT-2025-06-15',
      airline: 'ANA', departure_airport: 'LAX', arrival_airport: 'NRT',
      departure_time: '2025-06-15T23:00:00Z', arrival_time: '2025-06-17T04:15:00Z',
      price_usd: 220, stops: 0, duration_minutes: 720, cabin_class: 'Economy', source: 'amadeus', selected: false },
    // Leg 2: NRT → KIX
    { flight_id: 'MC-003', leg_id: 'leg-2-NRT-KIX-2025-06-20',
      airline: 'ANA', departure_airport: 'NRT', arrival_airport: 'KIX',
      departure_time: '2025-06-20T09:00:00Z', arrival_time: '2025-06-20T10:25:00Z',
      price_usd: 85, stops: 0, duration_minutes: 85, cabin_class: 'Economy', source: 'amadeus', selected: false },
    { flight_id: 'MC-004', leg_id: 'leg-2-NRT-KIX-2025-06-20',
      airline: 'Japan Airlines', departure_airport: 'NRT', arrival_airport: 'KIX',
      departure_time: '2025-06-20T14:30:00Z', arrival_time: '2025-06-20T15:55:00Z',
      price_usd: 92, stops: 0, duration_minutes: 85, cabin_class: 'Economy', source: 'amadeus', selected: false },
    // Return: KIX → LAX
    { flight_id: 'MC-005', leg_id: 'leg-3-KIX-LAX-2025-06-28',
      airline: 'Japan Airlines', departure_airport: 'KIX', arrival_airport: 'LAX',
      departure_time: '2025-06-28T11:00:00Z', arrival_time: '2025-06-28T06:30:00Z',
      price_usd: 265, stops: 0, duration_minutes: 600, cabin_class: 'Economy', source: 'amadeus', selected: false },
  ];
  await page.route(`**/${tripId}/flights/search`, route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({
        flights: MULTI_CITY_FLIGHTS,
        legs: [
          { leg_id: 'leg-1-LAX-NRT-2025-06-15', from_airport: 'LAX', to_airport: 'NRT',
            depart_date: '2025-06-15', options: MULTI_CITY_FLIGHTS.filter(f => f.leg_id === 'leg-1-LAX-NRT-2025-06-15') },
          { leg_id: 'leg-2-NRT-KIX-2025-06-20', from_airport: 'NRT', to_airport: 'KIX',
            depart_date: '2025-06-20', options: MULTI_CITY_FLIGHTS.filter(f => f.leg_id === 'leg-2-NRT-KIX-2025-06-20') },
          { leg_id: 'leg-3-KIX-LAX-2025-06-28', from_airport: 'KIX', to_airport: 'LAX',
            depart_date: '2025-06-28', options: MULTI_CITY_FLIGHTS.filter(f => f.leg_id === 'leg-3-KIX-LAX-2025-06-28') },
        ],
        search_params: { max_price: 315, source: 'amadeus', total_options: MULTI_CITY_FLIGHTS.length, segments: 3 },
      }),
    })
  );
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
