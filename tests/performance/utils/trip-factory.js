/**
 * Trip factory helpers for performance tests.
 *
 * Provides thin wrappers around the WanderPlan API to create trips,
 * advance them through each planning stage, and tear them down.
 * All methods accept a pre-acquired auth token and return the raw k6
 * Response object so callers can check/assert as needed.
 */

import http    from 'k6/http';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import {
  BASE_URL, PERF_TRIP_IDS,
  ORIGIN_AIRPORTS, DESTINATION_AIRPORTS,
  randomFrom, randInt, isoDatePlusDays,
} from './env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom Trend metrics
// ─────────────────────────────────────────────────────────────────────────────

export const agentResponseTime    = new Trend('agent_response_time',    true);
export const stageTransitionTime  = new Trend('stage_transition_time',  true);
export const kafkaMessageLatency  = new Trend('kafka_message_latency',  true);

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function headers(token) {
  return {
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

function postJson(url, body, token, tags = {}) {
  const start = Date.now();
  const res = http.post(url, JSON.stringify(body), { headers: headers(token), tags });
  agentResponseTime.add(Date.now() - start);
  return res;
}

function getJson(url, token, tags = {}) {
  return http.get(url, { headers: headers(token), tags });
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new trip and return its ID.
 * @returns {string|null} tripId or null on failure
 */
export function createTrip(token, overrides = {}) {
  const res = postJson(`${BASE_URL}/trips`, {
    name:          overrides.name         ?? `Perf Trip VU${__VU}`,
    travel_style:  overrides.travelStyle  ?? 'solo',
    destinations:  overrides.destinations ?? ['Tokyo', 'Bali'],
  }, token, { scenario: 'trip_create', endpoint: 'create_trip' });

  check(res, { 'createTrip: 201': r => r.status === 201 });

  try {
    return JSON.parse(res.body)?.trip?.id ?? null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage advancement helpers (Stage 0–13)
// ─────────────────────────────────────────────────────────────────────────────

/** Stage 1: Add bucket list items */
export function addBucketListItems(token, tripId, destinations = ['Tokyo', 'Bali', 'Santorini']) {
  const t0 = Date.now();
  for (const dest of destinations) {
    postJson(`${BASE_URL}/trips/${tripId}/bucket-list`,
      { destination: dest, country: 'auto-detect' },
      token, { scenario: 'agent_step', stage: 'bucket_list' }
    );
  }
  stageTransitionTime.add(Date.now() - t0);
}

/** Stage 2: Get timing analysis (read-heavy — triggers agent cascade) */
export function getTimingAnalysis(token, tripId) {
  const t0 = Date.now();
  const res = getJson(`${BASE_URL}/trips/${tripId}/timing-analysis`, token,
    { scenario: 'agent_step', stage: 'timing' });
  agentResponseTime.add(Date.now() - t0);
  check(res, { 'timing: 200': r => r.status === 200 });
  return res;
}

/** Stage 3: Submit interests for current user */
export function submitInterests(token, tripId, userId, categories = ['food', 'culture', 'adventure']) {
  const t0 = Date.now();
  const res = postJson(`${BASE_URL}/trips/${tripId}/members/${userId}/interests`,
    { categories, answers: categories.reduce((acc, c) => ({ ...acc, [c]: true }), {}) },
    token, { scenario: 'agent_step', stage: 'interests' }
  );
  agentResponseTime.add(Date.now() - t0);
  return res;
}

/** Stage 4: Submit health acknowledgment */
export function submitHealthAck(token, tripId, userId, flags = ['travel_insurance']) {
  return postJson(`${BASE_URL}/trips/${tripId}/members/${userId}/health-acknowledgment`,
    { acknowledged_flags: flags, has_required_certifications: true },
    token, { scenario: 'agent_step', stage: 'health' }
  );
}

/** Stage 5: Approve first N POIs */
export function approvePois(token, tripId, count = 5) {
  const poisRes = getJson(`${BASE_URL}/trips/${tripId}/pois`, token,
    { scenario: 'agent_step', stage: 'pois_list' });

  let pois = [];
  try { pois = JSON.parse(poisRes.body)?.pois ?? []; } catch {}

  for (const poi of pois.slice(0, count)) {
    postJson(`${BASE_URL}/trips/${tripId}/pois/${poi.poi_id}/approve`,
      { approved: true }, token, { scenario: 'agent_step', stage: 'pois' });
  }
}

/** Stage 6: Approve duration */
export function approveDuration(token, tripId, days = 7) {
  return postJson(`${BASE_URL}/trips/${tripId}/duration`,
    { days, approved: true }, token, { scenario: 'agent_step', stage: 'duration' });
}

/** Stage 7: Submit availability window */
export function submitAvailability(token, tripId, userId) {
  const start = isoDatePlusDays(randInt(30, 90));
  const end   = isoDatePlusDays(parseInt(start.slice(8, 10)) + randInt(5, 14));
  return postJson(`${BASE_URL}/trips/${tripId}/availability`,
    { user_id: userId, available_from: start, available_to: end },
    token, { scenario: 'agent_step', stage: 'availability' }
  );
}

/** Stage 8: Set budget */
export function setBudget(token, tripId, dailyBudget = 150) {
  return postJson(`${BASE_URL}/trips/${tripId}/budget`,
    { daily_target: dailyBudget, currency: 'USD', approved: true },
    token, { scenario: 'agent_step', stage: 'budget' }
  );
}

/** Stage 9: Search and select first flight */
export function searchAndSelectFlight(token, tripId) {
  const origin      = randomFrom(ORIGIN_AIRPORTS);
  const destination = randomFrom(DESTINATION_AIRPORTS.filter(d => d !== origin));

  const searchRes = postJson(`${BASE_URL}/trips/${tripId}/flights/search`, {
    origin_airport:      origin,
    destination_airport: destination,
    departure_date:      isoDatePlusDays(randInt(30, 120)),
    cabin_class:         'economy',
    passengers:          1,
  }, token, { scenario: 'flight_search', endpoint: 'flight_search' });

  check(searchRes, { 'flights search: 200': r => r.status === 200 });

  let flightId = null;
  try {
    flightId = JSON.parse(searchRes.body)?.flights?.[0]?.flight_id;
  } catch {}

  if (flightId) {
    postJson(`${BASE_URL}/trips/${tripId}/flights/select`,
      { flight_id: flightId }, token,
      { scenario: 'agent_step', stage: 'flights_select' }
    );
  }

  return searchRes;
}

/** Stage 10: Book first available stay */
export function bookStay(token, tripId) {
  const staysRes = getJson(`${BASE_URL}/trips/${tripId}/stays/search`, token,
    { scenario: 'agent_step', stage: 'stays_list' });

  let stayId = null;
  try { stayId = JSON.parse(staysRes.body)?.stays?.[0]?.stay_id; } catch {}

  if (stayId) {
    return postJson(`${BASE_URL}/trips/${tripId}/stays/select`,
      { stay_id: stayId }, token, { scenario: 'agent_step', stage: 'stays_book' });
  }
  return staysRes;
}

/** Stage 11: Approve all dining suggestions */
export function approveDining(token, tripId) {
  return postJson(`${BASE_URL}/trips/${tripId}/dining/approve-all`,
    { approved: true }, token, { scenario: 'agent_step', stage: 'dining' });
}

/** Stage 12: Approve itinerary */
export function approveItinerary(token, tripId) {
  return postJson(`${BASE_URL}/trips/${tripId}/itinerary/approve`,
    { approved: true }, token, { scenario: 'agent_step', stage: 'itinerary' });
}

/** Stage 13: Calendar sync */
export function triggerCalendarSync(token, tripId) {
  return postJson(`${BASE_URL}/trips/${tripId}/itinerary/calendar-sync`,
    { provider: 'google', calendar_id: 'primary' },
    token, { scenario: 'calendar_sync', stage: 'sync' }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline runner (for orchestration test)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Drive a trip from creation through all 14 stages.
 * Returns { tripId, stagesCompleted, totalMs }
 */
export function runFullPipeline(token, userId) {
  const t0 = Date.now();
  let stagesCompleted = 0;

  const tripId = createTrip(token);
  if (!tripId) return { tripId: null, stagesCompleted: 0, totalMs: Date.now() - t0 };
  stagesCompleted++;

  addBucketListItems(token, tripId);       stagesCompleted++;
  getTimingAnalysis(token, tripId);        stagesCompleted++;
  submitInterests(token, tripId, userId);  stagesCompleted++;
  submitHealthAck(token, tripId, userId);  stagesCompleted++;
  approvePois(token, tripId);              stagesCompleted++;
  approveDuration(token, tripId);          stagesCompleted++;
  submitAvailability(token, tripId, userId); stagesCompleted++;
  setBudget(token, tripId);               stagesCompleted++;
  searchAndSelectFlight(token, tripId);    stagesCompleted++;
  bookStay(token, tripId);                stagesCompleted++;
  approveDining(token, tripId);           stagesCompleted++;
  approveItinerary(token, tripId);        stagesCompleted++;
  triggerCalendarSync(token, tripId);     stagesCompleted++;

  return { tripId, stagesCompleted, totalMs: Date.now() - t0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Read-only: itinerary fetch (for DB load test)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a full itinerary (the most expensive DB query: joins 5 tables).
 * Rotates through PERF_TRIP_IDS pool.
 */
export function fetchItinerary(token) {
  const tripId = PERF_TRIP_IDS[(__VU - 1) % PERF_TRIP_IDS.length];
  return getJson(`${BASE_URL}/trips/${tripId}/itinerary`,
    token, { scenario: 'itinerary_read', endpoint: 'itinerary' });
}

/** Also read related data to simulate a full itinerary page load */
export function fetchItineraryPageBundle(token) {
  const tripId = PERF_TRIP_IDS[(__VU - 1) % PERF_TRIP_IDS.length];
  const h = { headers: headers(token), tags: { scenario: 'itinerary_read' } };

  // k6 parallel batch: all fired simultaneously, simulating browser resource load
  const responses = http.batch([
    ['GET', `${BASE_URL}/trips/${tripId}/itinerary`,       null, h],
    ['GET', `${BASE_URL}/trips/${tripId}/budget/breakdown`,null, h],
    ['GET', `${BASE_URL}/trips/${tripId}`,                 null, h],
  ]);

  responses.forEach((r, i) => {
    check(r, { [`itinerary bundle [${i}]: 200`]: res => res.status === 200 });
  });

  return responses[0];
}
