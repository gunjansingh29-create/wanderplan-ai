
/**
 * WanderPlan AI — Mock External-API Server
 * Lightweight Express server that stubs Amadeus, Google Places, and Calendar APIs.
 * Runs inside the Docker test network on port 4000.
 *
 * Endpoints mirror the subset of real API surfaces used by the agents, returning
 * deterministic fixture data so tests are fast, free, and reproducible.
 */

'use strict';

const express = require('express');
const app     = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────────────────────────
// Health check (used by Docker healthcheck)
// ─────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─────────────────────────────────────────────────────────────────────────────
// AMADEUS  — Flight Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /amadeus/v2/shopping/flight-offers
 * Returns 3 deterministic flight options.
 * Price is driven by the `maxPrice` query param so budget tests can control it.
 */
app.post('/amadeus/v2/shopping/flight-offers', (req, res) => {
  const maxPrice = parseFloat(req.query.maxPrice || req.body?.maxPrice || 9999);

  const flights = [
    {
      id: 'FL-001',
      airline: 'Japan Airlines',
      departure_airport: 'LAX',
      arrival_airport: 'NRT',
      departure_time: '2025-03-20T10:00:00Z',
      arrival_time: '2025-03-21T14:00:00Z',
      price_usd: Math.min(maxPrice * 0.70, 480),   // 70% of cap or $480
      stops: 0,
      duration_minutes: 660,
      booking_url: 'https://mock.jal.com/book/FL-001',
    },
    {
      id: 'FL-002',
      airline: 'ANA',
      departure_airport: 'LAX',
      arrival_airport: 'NRT',
      departure_time: '2025-03-20T23:00:00Z',
      arrival_time: '2025-03-22T05:00:00Z',
      price_usd: Math.min(maxPrice * 0.55, 370),
      stops: 1,
      duration_minutes: 780,
      booking_url: 'https://mock.ana.co.jp/book/FL-002',
    },
    {
      id: 'FL-003',
      airline: 'United Airlines',
      departure_airport: 'LAX',
      arrival_airport: 'NRT',
      departure_time: '2025-03-21T08:00:00Z',
      arrival_time: '2025-03-22T16:00:00Z',
      price_usd: Math.min(maxPrice * 0.90, 610),
      stops: 0,
      duration_minutes: 720,
      booking_url: 'https://mock.united.com/book/FL-003',
    },
  ];

  res.json({ data: flights, meta: { count: flights.length } });
});

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE PLACES — POI Search
// ─────────────────────────────────────────────────────────────────────────────

const POI_FIXTURE_DB = {
  culture:   [
    { place_id: 'GP-C1', name: 'Senso-ji Temple',    tags: ['temple','history','culture'],    rating: 4.7, cost: 0  },
    { place_id: 'GP-C2', name: 'Tokyo National Museum', tags: ['museum','history','art'],       rating: 4.5, cost: 12 },
  ],
  food:      [
    { place_id: 'GP-F1', name: 'Tsukiji Outer Market', tags: ['food','market','seafood'],       rating: 4.5, cost: 15 },
    { place_id: 'GP-F2', name: 'Ramen Street',          tags: ['food','ramen','dining'],         rating: 4.6, cost: 10 },
  ],
  adventure: [
    { place_id: 'GP-A1', name: 'teamLab Borderless',   tags: ['art','tech','adventure'],        rating: 4.8, cost: 32 },
    { place_id: 'GP-A2', name: 'Mt Takao Hike',        tags: ['hiking','nature','adventure'],   rating: 4.4, cost: 5  },
  ],
  nature:    [
    { place_id: 'GP-N1', name: 'Shinjuku Gyoen',       tags: ['park','nature','garden'],        rating: 4.6, cost: 5  },
    { place_id: 'GP-N2', name: 'Yoyogi Park',           tags: ['park','nature'],                 rating: 4.4, cost: 0  },
  ],
  snorkeling:[
    { place_id: 'GP-S1', name: 'Okinawa Snorkeling Tour', tags: ['snorkeling','ocean','nature'], rating: 4.7, cost: 85 },
    { place_id: 'GP-S2', name: 'Blue Cave Snorkel',     tags: ['snorkeling','underwater'],       rating: 4.6, cost: 65 },
  ],
  scuba:     [
    { place_id: 'GP-D1', name: 'Kerama Islands Scuba',  tags: ['scuba','diving','ocean'],        rating: 4.9, cost: 120 },
  ],
};

app.get('/google-places/nearbysearch/json', (req, res) => {
  const categories = (req.query.keyword || 'culture').split(',');
  const results    = categories.flatMap(c => POI_FIXTURE_DB[c.trim()] || []);
  res.json({ status: 'OK', results });
});

// ─────────────────────────────────────────────────────────────────────────────
// CALENDAR API  (Google Calendar stub)
// ─────────────────────────────────────────────────────────────────────────────

/** In-memory store of created events, keyed by calendarId */
const calendarStore = new Map();

/**
 * POST /calendar/v3/calendars/:calendarId/events
 * Creates a calendar event and stores it for later assertion.
 */
app.post('/calendar/v3/calendars/:calendarId/events', (req, res) => {
  const { calendarId } = req.params;
  const event = {
    id:       `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    calendarId,
    summary:  req.body.summary  || 'Untitled',
    start:    req.body.start,
    end:      req.body.end,
    location: req.body.location || '',
    status:   'confirmed',
  };

  if (!calendarStore.has(calendarId)) calendarStore.set(calendarId, []);
  calendarStore.get(calendarId).push(event);

  res.status(201).json(event);
});

/**
 * GET /calendar/v3/calendars/:calendarId/events
 * Returns all events for assertion.
 */
app.get('/calendar/v3/calendars/:calendarId/events', (req, res) => {
  const events = calendarStore.get(req.params.calendarId) || [];
  res.json({ kind: 'calendar#events', items: events });
});

/**
 * DELETE /calendar/test-reset  — wipe all stored events (call between tests)
 */
app.delete('/calendar/test-reset', (_req, res) => {
  calendarStore.clear();
  res.sendStatus(204);
});

/**
 * GET /calendar/test-all-events  — return every event across all calendars
 * Used by test 05 to count all created events.
 */
app.get('/calendar/test-all-events', (_req, res) => {
  const all = [];
  for (const events of calendarStore.values()) all.push(...events);
  res.json({ items: all, count: all.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Mock API server listening on :${PORT}`));
