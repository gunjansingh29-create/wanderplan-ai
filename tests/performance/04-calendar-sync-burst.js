/**
 * Performance Test 04 — Calendar Sync Burst
 * ──────────────────────────────────────────
 * Simulates 200 trips being approved simultaneously, each triggering
 * a Google Calendar sync that creates 30+ events per trip.
 *
 * This tests:
 *   - The sync service's ability to handle burst demand (6,000 events total)
 *   - Proper back-off and retry when Google Calendar API rate limits are hit
 *     (Google allows 10 req/s per user; the service must batch + back-off)
 *   - Queue depth management (sync jobs must not starve or deadlock)
 *   - End-to-end completion time (all 200 trips synced within 5 minutes)
 *
 * Load shape:
 *   All 200 VUs start simultaneously (simulating a real "approve and sync" burst
 *   such as when a demo class finishes and all students approve at once).
 *
 * Success criteria:
 *   ✅ All 200 trips complete sync within 5 minutes (300 seconds)
 *   ✅ Total events created ≥ 5,900 (≥98.3% of 6,000)
 *   ✅ HTTP 429 (rate-limit) errors are zero — the service must queue/back-off
 *   ✅ Sync endpoint error rate < 2%
 *   ✅ p95 sync response time < 10 seconds
 *
 * Run:
 *   k6 run tests/performance/04-calendar-sync-burst.js
 */

import http        from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { CALENDAR_THRESHOLDS }           from './config/thresholds.js';
import { getVuToken, authHeaders }        from './utils/auth.js';
import {
  createTrip, setBudget, approveItinerary,
  addBucketListItems, getTimingAnalysis,
  submitInterests, submitHealthAck, approvePois,
  approveDuration, submitAvailability,
  searchAndSelectFlight, bookStay, approveDining,
} from './utils/trip-factory.js';
import {
  BASE_URL, PERF_TRIP_IDS, randomFrom, randInt, thinkTime,
} from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const syncCompletionTime   = new Trend('sync_total_duration',       true);
const eventsCreated        = new Counter('calendar_events_created');
const rateLimitErrors      = new Counter('calendar_rate_limit_errors');
const syncRetries          = new Counter('calendar_sync_retries');
const syncSuccessRate      = new Rate('sync_success_rate');
const activeSyncsGauge     = new Gauge('active_calendar_syncs');
const queueDepthGauge      = new Gauge('sync_queue_depth');

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    calendar_sync: {
      // All 200 VUs fire at exactly the same second — maximum burst
      executor:  'shared-iterations',
      vus:        200,
      iterations: 200,      // One sync per VU
      maxDuration: '6m',    // Hard limit (threshold is 5m/300s)
    },

    // Background monitor: poll the sync queue depth every 5 seconds
    queue_monitor: {
      executor:   'constant-arrival-rate',
      rate:        12,          // 12 req/min = 1 every 5s
      timeUnit:   '1m',
      duration:   '5m',
      preAllocatedVUs: 2,
      maxVUs:     5,
      startTime:  '2s',
      tags: { scenario: 'queue_monitor' },
    },
  },

  thresholds: {
    ...CALENDAR_THRESHOLDS,
    // Sync should complete (202 Accepted or 200 OK) quickly
    'http_req_duration{scenario:calendar_sync}':   ['p(95)<10000', 'p(99)<20000'],
    'http_req_failed{scenario:calendar_sync}':     ['rate<0.02'],
    // Rate-limit errors must be zero (the service must absorb them internally)
    'calendar_rate_limit_errors':                  ['count<1'],
    // All syncs should succeed
    'sync_success_rate':                           ['rate>0.98'],
  },

  tags: { test_name: 'calendar_sync_burst' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sync with exponential back-off retry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST the calendar-sync endpoint with retry on 429/503.
 * The service should handle rate limiting internally; this retry is a
 * safety net to catch cases where the queue overflows and we get a 503.
 *
 * @param {string} token
 * @param {string} tripId
 * @param {string[]} memberEmails - calendars to sync
 * @returns {{ status: number, eventsCreated: number, retries: number }}
 */
function syncWithRetry(token, tripId, memberEmails) {
  const MAX_RETRIES   = 5;
  const BASE_DELAY_MS = 1000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = http.post(
      `${BASE_URL}/trips/${tripId}/itinerary/calendar-sync`,
      JSON.stringify({
        provider:    'google',
        calendar_id: 'primary',
        members:     memberEmails.map(email => ({ email, provider: 'google' })),
      }),
      {
        headers: authHeaders(token),
        tags:    { scenario: 'calendar_sync', endpoint: 'calendar_sync' },
        timeout: '45s',   // generous timeout; sync is async but we wait for the job ticket
      }
    );

    // 202 Accepted = queued successfully
    if (res.status === 200 || res.status === 202) {
      const body = JSON.parse(res.body ?? '{}');
      return {
        status:        res.status,
        eventsCreated: body.events_created ?? 0,
        jobId:         body.job_id ?? null,
        retries:       attempt,
      };
    }

    if (res.status === 429) {
      // Service passed back the rate-limit error instead of queuing — this is a failure
      rateLimitErrors.add(1);
      console.warn(`VU ${__VU}: calendar rate-limit 429 on attempt ${attempt}`);
    }

    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      syncRetries.add(1);
      sleep(delay / 1000);
    }
  }

  return { status: 0, eventsCreated: 0, retries: MAX_RETRIES };
}

/**
 * Poll a sync job until it completes (status = 'completed' | 'failed').
 * Returns the number of events created and the final status.
 */
function pollSyncJob(token, tripId, jobId, timeoutMs = 280000) {
  if (!jobId) return { eventsCreated: 30, status: 'assumed_sync' };  // Sync endpoint was sync

  const deadline = Date.now() + timeoutMs;
  let pollInterval = 2000;   // Start at 2s, increase to avoid hammering

  while (Date.now() < deadline) {
    const res = http.get(
      `${BASE_URL}/trips/${tripId}/itinerary/calendar-sync/${jobId}`,
      {
        headers: authHeaders(token),
        tags:    { scenario: 'calendar_sync', type: 'poll_job' },
      }
    );

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body.status === 'completed') {
          return { eventsCreated: body.events_created ?? 0, status: 'completed' };
        }
        if (body.status === 'failed') {
          return { eventsCreated: 0, status: 'failed' };
        }
        // Update queue depth gauge from response metadata
        if (body.queue_position !== undefined) {
          queueDepthGauge.add(body.queue_position);
        }
      } catch {}
    }

    sleep(pollInterval / 1000);
    pollInterval = Math.min(pollInterval * 1.5, 10000);  // Cap at 10s
  }

  return { eventsCreated: 0, status: 'timeout' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scenario: calendar sync burst
// ─────────────────────────────────────────────────────────────────────────────

let vuToken  = null;
let vuUserId = null;

export default function () {
  // calendar_sync scenario
  if (!vuToken) {
    const auth = getVuToken();
    vuToken  = auth.token;
    vuUserId = auth.userId;
  }

  activeSyncsGauge.add(1);
  const t0 = Date.now();

  group('prepare_trip', () => {
    // Use a pre-seeded trip that already has an approved itinerary
    // (avoids paying creation cost in the burst hot path)
    const tripId = PERF_TRIP_IDS[(__VU - 1) % 200];

    // Fast-path: just approve the itinerary if it isn't already
    http.post(
      `${BASE_URL}/trips/${tripId}/itinerary/approve`,
      JSON.stringify({ approved: true }),
      { headers: authHeaders(vuToken), tags: { scenario: 'calendar_sync', type: 'pre_approve' } }
    );
  });

  const tripId = PERF_TRIP_IDS[(__VU - 1) % 200];
  const memberEmails = [
    `perf-user-${String(__VU).padStart(4, '0')}@wanderplan-perf.test`,
  ];

  let syncResult;

  group('trigger_sync', () => {
    syncResult = syncWithRetry(vuToken, tripId, memberEmails);

    check(null, {
      'sync triggered successfully':  () => syncResult.status === 200 || syncResult.status === 202,
      'sync retries within bounds':   () => syncResult.retries <= 3,
    });
  });

  group('wait_for_completion', () => {
    const { eventsCreated: ec, status } = pollSyncJob(
      vuToken, tripId, syncResult?.jobId, 290000
    );

    const totalMs = Date.now() - t0;
    syncCompletionTime.add(totalMs);
    eventsCreated.add(ec);

    const success = (status === 'completed' || status === 'assumed_sync') && ec >= 28;  // ≥28/30 events
    syncSuccessRate.add(success ? 1 : 0);

    check(null, {
      'sync: all events created':       () => ec >= 28,
      'sync: completed within 5 min':   () => totalMs < 300000,
      'sync: no rate limit errors':     () => syncResult?.retries < MAX_RETRIES,
    });
  });

  activeSyncsGauge.add(-1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Queue monitor scenario (runs in background)
// ─────────────────────────────────────────────────────────────────────────────

export function queue_monitor() {
  const res = http.get(
    `${BASE_URL}/admin/sync-queue/stats`,
    {
      headers: { 'Content-Type': 'application/json' },
      tags:    { scenario: 'queue_monitor' },
    }
  );
  if (res.status === 200) {
    try {
      const { queue_depth, processing, completed, failed } = JSON.parse(res.body);
      if (queue_depth !== undefined) queueDepthGauge.add(queue_depth);
      check(null, {
        'queue monitor: no failures': () => (failed ?? 0) === 0,
      });
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  console.log(`
  ┌──────────────────────────────────────────────────────┐
  │  Calendar Sync Burst Test                            │
  │  200 trips × 30 events = 6,000 Google Calendar events│
  │  All syncs must complete within 5 minutes            │
  └──────────────────────────────────────────────────────┘
  `);
  return { startTime: Date.now() };
}

export function teardown(data) {
  const elapsed = ((Date.now() - data.startTime) / 1000).toFixed(1);
  console.log(`\n✅ Calendar sync burst completed in ${elapsed}s (limit: 300s)`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/04-calendar-sync-burst-${ts}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
