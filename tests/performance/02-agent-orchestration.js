/**
 * Performance Test 02 — Agent Orchestration (100 Concurrent Trips)
 * ────────────────────────────────────────────────────────────────
 * Simulates 100 concurrent trips each advancing through all 14 planning
 * stages. This stresses the Kafka message bus, the orchestrator routing
 * layer, and all 14 specialist agents simultaneously.
 *
 * Load shape:
 *   100 VUs start at the same time (arrival-rate executor mimics real traffic).
 *   Each VU creates a fresh trip and drives it through all 14 stages sequentially.
 *   Between stages, a realistic think-time is applied (0.5–2 seconds).
 *
 * Success criteria:
 *   ✅ Kafka message processing latency p95 < 500ms
 *      (measured via agent-response header X-Kafka-Latency if exposed,
 *       or estimated from the delta between POST and the agent's callback)
 *   ✅ Individual agent response time p95 < 2 seconds
 *   ✅ Full 14-stage pipeline completes per VU < 4 minutes
 *   ✅ Error rate across all stage transitions < 2%
 *
 * Run:
 *   k6 run tests/performance/02-agent-orchestration.js
 */

import http        from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { ORCHESTRATION_THRESHOLDS }        from './config/thresholds.js';
import { getVuToken, authHeaders }         from './utils/auth.js';
import {
  agentResponseTime, stageTransitionTime, kafkaMessageLatency,
  createTrip, addBucketListItems, getTimingAnalysis,
  submitInterests, submitHealthAck, approvePois,
  approveDuration, submitAvailability, setBudget,
  searchAndSelectFlight, bookStay, approveDining,
  approveItinerary, triggerCalendarSync,
} from './utils/trip-factory.js';
import { BASE_URL, thinkTime, randInt, randomFrom, isoDatePlusDays } from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const pipelineSuccessRate   = new Rate('pipeline_success_rate');
const pipelineDuration      = new Trend('pipeline_duration_ms', true);
const stageSuccessCounter   = new Counter('stage_successes');
const stageFailureCounter   = new Counter('stage_failures');
const activePipelinesGauge  = new Gauge('active_pipelines');
const completedPipelines    = new Counter('completed_pipelines');

// Per-stage latency breakdown
const stageLatency = {};
const STAGE_NAMES  = [
  'create', 'bucket_list', 'timing', 'interests', 'health',
  'pois', 'duration', 'availability', 'budget', 'flights',
  'stays', 'dining', 'itinerary', 'calendar_sync',
];
STAGE_NAMES.forEach(s => { stageLatency[s] = new Trend(`stage_latency_${s}_ms`, true); });

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    agent_orchestration: {
      executor:  'constant-vus',
      vus:       100,
      duration:  '8m',       // Each VU runs the full pipeline 1–2 times
      gracefulStop: '30s',
    },
  },

  thresholds: {
    ...ORCHESTRATION_THRESHOLDS,

    // Full pipeline must complete within 4 minutes (240s)
    'pipeline_duration_ms':     ['p(95)<240000', 'max<360000'],

    // Each stage individually must be fast
    'stage_latency_timing_ms':  ['p(95)<3000'],
    'stage_latency_flights_ms': ['p(95)<4000'],
    'stage_latency_budget_ms':  ['p(95)<1000'],

    // At least 95 of 100 pipelines must complete successfully
    'pipeline_success_rate':    ['rate>0.95'],
  },

  tags: { test_name: 'agent_orchestration' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Stage runner with latency tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a single stage fn, record its latency into the named Trend metric,
 * and return the result. Catches errors so one failed stage doesn't abort
 * the whole pipeline — instead we record a failure and continue.
 */
function runStage(stageName, fn) {
  const t0 = Date.now();
  let result;
  try {
    result = fn();
  } catch (e) {
    stageFailureCounter.add(1, { stage: stageName });
    console.warn(`VU ${__VU}: stage ${stageName} threw: ${e}`);
    return null;
  }
  const elapsed = Date.now() - t0;
  stageLatency[stageName]?.add(elapsed);

  // Extract Kafka latency from response headers if the agent exposes it
  if (result && result.headers) {
    const kafkaMs = parseInt(result.headers['X-Kafka-Latency-Ms'] || '0', 10);
    if (kafkaMs > 0) kafkaMessageLatency.add(kafkaMs);

    // Also capture agent processing time header
    const agentMs = parseInt(result.headers['X-Agent-Processing-Ms'] || '0', 10);
    if (agentMs > 0) agentResponseTime.add(agentMs);
  }

  const success = result ? (result.status >= 200 && result.status < 300) : false;
  if (success) { stageSuccessCounter.add(1, { stage: stageName }); }
  else         { stageFailureCounter.add(1, { stage: stageName }); }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling helper: wait for an async agent to finish processing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll a GET endpoint until it returns a non-empty response body matching
 * the readyKey, or until timeoutMs is exceeded.
 *
 * This simulates waiting for Kafka-driven agent processing to complete:
 * the client posts a command, the orchestrator publishes to Kafka, the
 * specialist agent consumes and updates state, and the client polls for
 * the result.
 */
function pollUntilReady(url, token, readyFn, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let pollCount = 0;
  while (Date.now() < deadline) {
    const res = http.get(url, {
      headers: authHeaders(token),
      tags: { scenario: 'agent_step', type: 'poll' },
    });
    pollCount++;
    if (res.status === 200) {
      try {
        if (readyFn(JSON.parse(res.body))) {
          // Record effective Kafka latency as time from command post to ready
          return { res, pollCount };
        }
      } catch {}
    }
    sleep(0.3);  // 300ms poll interval
  }
  return { res: null, pollCount };  // timed out
}

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline execution
// ─────────────────────────────────────────────────────────────────────────────

function executeFullPipeline(token, userId) {
  const t0 = Date.now();
  activePipelinesGauge.add(1);
  let success = true;
  let tripId = null;

  group('01_create_trip', () => {
    const t = Date.now();
    tripId = createTrip(token, { name: `Orchestration Test VU${__VU} T${__ITER}` });
    stageLatency['create'].add(Date.now() - t);
    if (!tripId) { success = false; stageFailureCounter.add(1, { stage: 'create' }); }
    else stageSuccessCounter.add(1, { stage: 'create' });
  });
  if (!tripId) { activePipelinesGauge.add(-1); pipelineSuccessRate.add(0); return; }
  thinkTime();

  group('02_bucket_list', () => {
    runStage('bucket_list', () => {
      addBucketListItems(token, tripId);
      // Poll for timing to become available (agent processes async)
      const { pollCount } = pollUntilReady(
        `${BASE_URL}/trips/${tripId}/timing-analysis`,
        token,
        body => body?.timing_results?.length > 0,
        8000
      );
      // Kafka latency estimate: each poll is 300ms × pollCount
      if (pollCount > 0) kafkaMessageLatency.add(pollCount * 300);
      return { status: 200, headers: {} };
    });
  });
  thinkTime();

  group('03_timing', () => {
    const res = runStage('timing', () => getTimingAnalysis(token, tripId));
    if (res && res.status !== 200) success = false;
  });
  thinkTime();

  group('04_interests', () => {
    runStage('interests', () => submitInterests(token, tripId, userId));
  });
  thinkTime();

  group('05_health', () => {
    runStage('health', () => submitHealthAck(token, tripId, userId));
  });
  thinkTime();

  group('06_pois', () => {
    runStage('pois', () => approvePois(token, tripId, 5));
  });
  thinkTime();

  group('07_duration', () => {
    runStage('duration', () => approveDuration(token, tripId, randInt(5, 14)));
  });
  thinkTime();

  group('08_availability', () => {
    runStage('availability', () => submitAvailability(token, tripId, userId));
  });
  thinkTime();

  group('09_budget', () => {
    runStage('budget', () => setBudget(token, tripId, randInt(100, 250)));
  });
  thinkTime();

  group('10_flights', () => {
    const res = runStage('flights', () => searchAndSelectFlight(token, tripId));
    if (res && res.status !== 200) success = false;
  });
  thinkTime();

  group('11_stays', () => {
    runStage('stays', () => bookStay(token, tripId));
  });
  thinkTime();

  group('12_dining', () => {
    runStage('dining', () => approveDining(token, tripId));
  });
  thinkTime();

  group('13_itinerary', () => {
    runStage('itinerary', () => approveItinerary(token, tripId));
  });
  thinkTime();

  group('14_calendar_sync', () => {
    const res = runStage('calendar_sync', () => triggerCalendarSync(token, tripId));
    if (!res || res.status !== 200) success = false;
  });

  // ── Record overall pipeline metrics ────────────────────────────────────
  const totalMs = Date.now() - t0;
  pipelineDuration.add(totalMs);
  pipelineSuccessRate.add(success ? 1 : 0);
  if (success) completedPipelines.add(1);
  activePipelinesGauge.add(-1);

  check(null, {
    [`VU ${__VU}: pipeline < 4 min`]:   () => totalMs < 240000,
    [`VU ${__VU}: pipeline successful`]: () => success,
  });
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

  executeFullPipeline(vuToken, vuUserId);

  // Brief rest between pipeline runs (if VU has time for a second iteration)
  sleep(randInt(2, 5));
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  // Verify all 14 agent health endpoints are up before starting
  const agentPorts = [8000, 8001, 8002, 8003, 8004, 8005, 8006,
                      8007, 8008, 8009, 8010, 8011, 8012, 8013];
  const baseHost   = (__ENV.API_BASE_URL || 'http://localhost:8080/v1')
    .replace('/v1', '').replace(':8080', '');

  let allHealthy = true;
  agentPorts.forEach(port => {
    const res = http.get(`${baseHost}:${port}/health`, { timeout: '5s' });
    if (res.status !== 200) {
      console.warn(`⚠️  Agent on port ${port} health check failed: ${res.status}`);
      allHealthy = false;
    }
  });

  if (!allHealthy) console.warn('Some agents not healthy — test may produce more errors than expected');
  return { startTime: Date.now() };
}

export function teardown(data) {
  const mins = ((Date.now() - data.startTime) / 60000).toFixed(1);
  console.log(`\n✅ Agent orchestration test completed in ${mins} minutes`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/02-agent-orchestration-${ts}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
