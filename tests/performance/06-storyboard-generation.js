/**
 * Performance Test 06 — Storyboard Generation (LLM API at Scale)
 * ───────────────────────────────────────────────────────────────
 * Simulates 100 concurrent storyboard generation requests, each invoking
 * the LLM (Claude) to produce platform-specific social-media content
 * (Instagram, Twitter, Blog, TikTok) from trip itinerary data.
 *
 * This is the most compute-intensive workflow in the system because:
 *   1. Each request calls the Anthropic API (high latency, rate-limited)
 *   2. The service must queue requests to avoid hitting API rate limits
 *   3. Failed/timed-out LLM calls must be retried transparently
 *   4. Generated content is cached in MongoDB to avoid duplicate LLM costs
 *
 * Load shape:
 *   All 100 VUs fire simultaneously (burst), then sustain for 5 minutes.
 *   The queue implementation must absorb the burst and process in order.
 *
 * Success criteria:
 *   ✅ All 100 requests complete within 30 seconds (p95 < 30s)
 *   ✅ Average retry count ≤ 2 per request
 *   ✅ Error rate < 5% (retries are handled, not counted as errors)
 *   ✅ At least 95 of 100 requests return generated content
 *   ✅ Queue depth stays ≤ 110 (slight overflow is OK, but not unbounded)
 *
 * Run:
 *   k6 run tests/performance/06-storyboard-generation.js
 */

import http        from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { STORYBOARD_THRESHOLDS } from './config/thresholds.js';
import { getVuToken, authHeaders } from './utils/auth.js';
import { PERF_TRIP_IDS, BASE_URL, randomFrom, randInt, thinkTime } from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const storyboardCompletionTime  = new Trend('storyboard_completion_time', true);
const storyboardRetryCount      = new Trend('storyboard_retry_count');
const storyboardCompleted       = new Counter('storyboard_completed');
const storyboardFailed          = new Counter('storyboard_failed');
const queueDepth                = new Gauge('storyboard_queue_depth');
const llmTimeoutCount           = new Counter('llm_timeout_count');
const cacheHitCount             = new Counter('storyboard_cache_hits');
const generationSuccessRate     = new Rate('storyboard_generation_success_rate');

// Per-platform latency breakdown
const platformLatency = {
  instagram: new Trend('storyboard_instagram_ms', true),
  twitter:   new Trend('storyboard_twitter_ms',   true),
  blog:      new Trend('storyboard_blog_ms',       true),
  tiktok:    new Trend('storyboard_tiktok_ms',     true),
};

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Primary: burst of 100 simultaneous generation requests
    storyboard_burst: {
      executor:    'shared-iterations',
      vus:         100,
      iterations:  100,
      maxDuration: '4m',     // Hard outer limit
      tags:        { scenario: 'storyboard' },
    },

    // Secondary: steady stream tests the queue drain behaviour
    storyboard_stream: {
      executor:  'constant-arrival-rate',
      rate:      5,           // 5 new requests/s
      timeUnit:  '1s',
      duration:  '2m',
      preAllocatedVUs: 20,
      maxVUs:    50,
      startTime: '35s',      // Start after burst window
      tags:      { scenario: 'storyboard_stream' },
    },
  },

  thresholds: {
    ...STORYBOARD_THRESHOLDS,
    'storyboard_completion_time':           ['p(95)<30000', 'max<60000'],
    'storyboard_instagram_ms':              ['p(95)<20000'],
    'storyboard_blog_ms':                   ['p(95)<25000'],
    'storyboard_generation_success_rate':   ['rate>0.95'],
    'http_req_failed{scenario:storyboard}': ['rate<0.05'],
  },

  tags: { test_name: 'storyboard_generation' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORMS  = ['instagram', 'twitter', 'blog', 'tiktok'];

const PLATFORM_VALIDATION = {
  instagram: body => body.content?.length >= 150 && body.content?.length <= 2200 &&
                     (body.content?.match(/#\w+/g) || []).length >= 3,
  twitter:   body => body.content?.length <= 280,
  blog:      body => body.content?.split(/\s+/).length >= 300,  // ≥300 words
  tiktok:    body => body.content?.length <= 300,
};

// ─────────────────────────────────────────────────────────────────────────────
// Generation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request storyboard generation for one platform.
 * The endpoint may:
 *   - Return 202 Accepted (queued)  → poll for result
 *   - Return 200 OK (synchronous)   → content is in the body
 *   - Return 503 (queue full)       → retry with back-off
 *   - Return 504 (LLM timeout)      → retry (LLM may be throttled)
 */
function generateForPlatform(token, tripId, platform, activities) {
  const t0 = Date.now();
  const MAX_RETRIES   = 4;
  const BASE_DELAY_MS = 2000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = http.post(
      `${BASE_URL}/trips/${tripId}/storyboard/generate`,
      JSON.stringify({
        platform:   platform,
        activities: activities,
        style:      'casual',
        language:   'en',
      }),
      {
        headers: authHeaders(token),
        tags:    { scenario: 'storyboard', platform, endpoint: 'generate' },
        timeout: '35s',    // Allow for LLM latency
      }
    );

    // ── 200 / 201: synchronous result ──────────────────────────────────────
    if (res.status === 200 || res.status === 201) {
      const elapsed = Date.now() - t0;
      platformLatency[platform]?.add(elapsed);
      storyboardRetryCount.add(attempt);

      // Check cache hit header
      if ((res.headers['X-Cache-Status'] || '').toLowerCase() === 'hit') {
        cacheHitCount.add(1);
      }

      try {
        const body = JSON.parse(res.body);
        const valid = PLATFORM_VALIDATION[platform]?.(body) ?? true;
        return { success: true, retries: attempt, content: body.content, cached: false };
      } catch {
        return { success: false, retries: attempt, content: null };
      }
    }

    // ── 202: queued — poll for result ──────────────────────────────────────
    if (res.status === 202) {
      const jobId = JSON.parse(res.body ?? '{}')?.job_id;
      const result = pollStoryboardJob(token, tripId, jobId, platform, 28000);
      storyboardRetryCount.add(attempt);
      platformLatency[platform]?.add(Date.now() - t0);
      return result;
    }

    // ── 504: LLM timeout ───────────────────────────────────────────────────
    if (res.status === 504) {
      llmTimeoutCount.add(1);
      console.warn(`VU ${__VU}: LLM timeout for ${platform} (attempt ${attempt})`);
    }

    // ── 429 / 503: back-off and retry ──────────────────────────────────────
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000;
      sleep(delay / 1000);
    }
  }

  return { success: false, retries: MAX_RETRIES, content: null };
}

/**
 * Poll a storyboard generation job until it completes.
 */
function pollStoryboardJob(token, tripId, jobId, platform, timeoutMs) {
  if (!jobId) return { success: false, retries: 0, content: null };

  const deadline = Date.now() + timeoutMs;
  let interval   = 1500;   // Start at 1.5s

  while (Date.now() < deadline) {
    const res = http.get(
      `${BASE_URL}/trips/${tripId}/storyboard/jobs/${jobId}`,
      {
        headers: authHeaders(token),
        tags:    { scenario: 'storyboard', platform, type: 'poll' },
      }
    );

    if (res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body.status === 'completed') {
          return { success: true, retries: 0, content: body.result?.content };
        }
        if (body.status === 'failed') {
          return { success: false, retries: 0, content: null };
        }
        // Update queue depth from job metadata
        if (body.queue_position !== undefined) {
          queueDepth.add(body.queue_position);
        }
      } catch {}
    }

    sleep(interval / 1000);
    interval = Math.min(interval * 1.3, 5000);  // Gradual back-off, cap at 5s
  }

  return { success: false, retries: 0, content: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip activity fixtures (avoid LLM generating from empty data)
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_ACTIVITIES = [
  { name: 'Senso-ji Temple',      duration_min: 90,  description: 'Ancient Buddhist temple in Asakusa' },
  { name: 'Tsukiji Outer Market', duration_min: 60,  description: 'Fresh seafood breakfast at the famous market' },
  { name: 'teamLab Borderless',   duration_min: 180, description: 'Immersive digital art museum' },
  { name: 'Fushimi Inari Taisha', duration_min: 120, description: 'Thousands of vermilion torii gates' },
  { name: 'Arashiyama Bamboo',    duration_min: 60,  description: 'Peaceful bamboo grove walk' },
  { name: 'Nishiki Food Market',  duration_min: 90,  description: 'Kyoto\'s Kitchen — street food and souvenirs' },
  { name: 'Kinkaku-ji (Golden Pavilion)', duration_min: 60, description: 'Zen Buddhist temple covered in gold leaf' },
];

function pickActivities(count = 4) {
  const shuffled = [...SAMPLE_ACTIVITIES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main VU loop
// ─────────────────────────────────────────────────────────────────────────────

let vuToken  = null;
let vuUserId = null;

export default function () {
  if (!vuToken) {
    const auth = getVuToken();
    vuToken  = auth.token;
    vuUserId = auth.userId;
  }

  const tripId    = PERF_TRIP_IDS[(__VU - 1) % 100];
  const activities = pickActivities(randInt(3, 6));
  const t0 = Date.now();

  let overallSuccess = true;
  let totalRetries   = 0;

  // Generate storyboard for all 4 platforms per VU
  // (In production each user generates for their preferred platforms)
  for (const platform of PLATFORMS) {
    group(`generate_${platform}`, () => {
      const result = generateForPlatform(vuToken, tripId, platform, activities);
      totalRetries += result.retries;

      check(null, {
        [`${platform}: generation succeeded`]: () => result.success,
        [`${platform}: has content`]:          () => !!result.content,
        [`${platform}: completed < 30s`]:      () => (Date.now() - t0) < 30000,
      });

      if (!result.success) overallSuccess = false;

      // Validate content quality per platform
      if (result.content) {
        if (platform === 'instagram') {
          const hashtags = (result.content.match(/#\w+/g) || []).length;
          check(null, { 'instagram: ≥3 hashtags': () => hashtags >= 3 });
        }
        if (platform === 'twitter') {
          check(null, { 'twitter: ≤280 chars': () => result.content.length <= 280 });
        }
        if (platform === 'blog') {
          const wordCount = result.content.split(/\s+/).length;
          check(null, { 'blog: ≥300 words': () => wordCount >= 300 });
        }
        if (platform === 'tiktok') {
          check(null, { 'tiktok: ≤300 chars': () => result.content.length <= 300 });
        }
      }
    });

    // Brief pause between platforms so we don't slam 4 LLM calls at once per VU
    sleep(0.2);
  }

  const totalMs = Date.now() - t0;
  storyboardCompletionTime.add(totalMs);
  storyboardRetryCount.add(totalRetries);
  generationSuccessRate.add(overallSuccess ? 1 : 0);

  if (overallSuccess) storyboardCompleted.add(1);
  else                storyboardFailed.add(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Steady-stream scenario (secondary)
// ─────────────────────────────────────────────────────────────────────────────

export function storyboard_stream() {
  if (!vuToken) vuToken = getVuToken().token;

  const tripId   = PERF_TRIP_IDS[(__VU - 1) % 100];
  const platform = randomFrom(PLATFORMS);
  const t0 = Date.now();

  const result = generateForPlatform(vuToken, tripId, platform, pickActivities(3));
  storyboardCompletionTime.add(Date.now() - t0);
  generationSuccessRate.add(result.success ? 1 : 0);
  if (result.success) storyboardCompleted.add(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  // Poll the queue stats endpoint to verify it's accessible
  const res = http.get(`${BASE_URL}/admin/storyboard-queue/stats`, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s',
  });

  if (res.status === 200) {
    try {
      const stats = JSON.parse(res.body);
      console.log(`Queue initial depth: ${stats.queue_depth ?? 'unknown'}`);
    } catch {}
  } else {
    console.warn(`⚠️  Queue stats endpoint returned ${res.status} — queue depth monitoring disabled`);
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const elapsed = ((Date.now() - data.startTime) / 1000).toFixed(1);
  console.log(`\n✅ Storyboard generation test completed in ${elapsed}s`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/06-storyboard-generation-${ts}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
