/**
 * Shared performance thresholds for all WanderPlan AI load tests.
 *
 * Thresholds are defined per scenario and imported by individual test files.
 * They map directly to k6 threshold syntax so they can be spread into
 * the `options.thresholds` object without modification.
 *
 * Reference: https://k6.io/docs/using-k6/thresholds/
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Flight search
// ─────────────────────────────────────────────────────────────────────────────
export const SEARCH_THRESHOLDS = {
  // Response time targets
  'http_req_duration{scenario:flight_search}':          ['p(95)<3000',  'p(99)<5000'],
  // All search requests must succeed
  'http_req_failed{scenario:flight_search}':            ['rate<0.01'],   // <1% error rate
  // Throughput: 500 VUs should sustain reasonable RPS
  'http_reqs{scenario:flight_search}':                  ['rate>50'],     // ≥50 req/s
  // Custom: no request should take >10s (absolute ceiling)
  'http_req_duration{scenario:flight_search,expected_response:true}': ['max<10000'],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Agent orchestration
// ─────────────────────────────────────────────────────────────────────────────
export const ORCHESTRATION_THRESHOLDS = {
  'http_req_duration{scenario:agent_step}':    ['p(95)<2000', 'p(99)<4000'],
  'http_req_failed{scenario:agent_step}':      ['rate<0.02'],
  // Custom metrics (set via k6 Trend/Counter)
  'kafka_message_latency':                     ['p(95)<500'],
  'agent_response_time':                       ['p(95)<2000', 'max<8000'],
  'stage_transition_time':                     ['p(95)<3000'],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Database load (itinerary reads)
// ─────────────────────────────────────────────────────────────────────────────
export const DATABASE_THRESHOLDS = {
  'http_req_duration{scenario:itinerary_read}': ['p(95)<200', 'p(99)<400'],
  'http_req_failed{scenario:itinerary_read}':   ['rate<0.005'],  // <0.5% — reads must be stable
  'http_req_duration{scenario:itinerary_read,expected_response:true}': ['max<1000'],
  // Throughput: 1000 VUs × complex query → system must handle it
  'http_reqs{scenario:itinerary_read}':         ['rate>200'],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Calendar sync burst
// ─────────────────────────────────────────────────────────────────────────────
export const CALENDAR_THRESHOLDS = {
  'http_req_duration{scenario:calendar_sync}':   ['p(95)<10000', 'p(99)<20000'],
  'http_req_failed{scenario:calendar_sync}':     ['rate<0.02'],
  // Custom: all 200 trips must complete within 5 minutes (300s)
  'sync_total_duration':                         ['max<300000'],
  // Events created: 200 trips × 30 events = 6000 events minimum
  'calendar_events_created':                     ['count>5900'],
  // Rate-limit errors should be zero (we should back off gracefully)
  'calendar_rate_limit_errors':                  ['count<1'],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. WebSocket connections
// ─────────────────────────────────────────────────────────────────────────────
export const WEBSOCKET_THRESHOLDS = {
  // Message delivery latency (p95 < 100ms)
  'ws_message_delivery_latency':                 ['p(95)<100', 'p(99)<250'],
  // Connection success rate
  'ws_connect_errors':                           ['count<5'],      // <5 failed connects out of 500
  // No dropped connections during test
  'ws_dropped_connections':                      ['count<1'],
  // All sent messages should arrive
  'ws_messages_dropped':                         ['count<10'],
  // Session duration (sessions must stay alive)
  'ws_session_duration':                         ['p(95)>30000'],  // sessions stay open ≥30s
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Storyboard generation (LLM)
// ─────────────────────────────────────────────────────────────────────────────
export const STORYBOARD_THRESHOLDS = {
  // All 100 requests must complete within 30 seconds
  'storyboard_completion_time':                  ['p(95)<30000', 'max<60000'],
  // Queue should not overflow
  'storyboard_queue_depth':                      ['max<110'],       // slight headroom above 100
  // LLM timeout retries should be handled (not errors)
  'http_req_failed{scenario:storyboard}':        ['rate<0.05'],     // <5%: retries are OK
  // Retry count should stay bounded
  'storyboard_retry_count':                      ['avg<2'],
  // Throughput: 100 requests should all complete
  'storyboard_completed':                        ['count>=95'],     // ≥95% complete in window
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Soak test
// ─────────────────────────────────────────────────────────────────────────────
export const SOAK_THRESHOLDS = {
  // Response time should remain stable throughout 2 hours
  'http_req_duration':                           ['p(95)<3000', 'p(99)<8000'],
  'http_req_failed':                             ['rate<0.02'],
  // Memory: No leak indicator — response times must not drift upward
  'response_time_drift':                         ['max<500'],    // <500ms drift vs baseline
  // DB connection pool must not exhaust
  'db_pool_exhaustion_errors':                   ['count<1'],
  // Throughput must stay stable (no gradual degradation)
  'http_reqs':                                   ['rate>5'],     // minimum: 5 req/s throughout
  // New user registrations succeed
  'http_req_failed{endpoint:register}':          ['rate<0.02'],
  // Search endpoint stable
  'http_req_duration{endpoint:flight_search}':   ['p(95)<3000'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Global defaults (used if a scenario doesn't override)
// ─────────────────────────────────────────────────────────────────────────────
export const DEFAULT_THRESHOLDS = {
  http_req_duration: ['p(95)<3000'],
  http_req_failed:   ['rate<0.05'],
};

/**
 * Merge multiple threshold objects together.
 * Later entries take precedence on collision.
 */
export function mergeThresholds(...sets) {
  return Object.assign({}, ...sets);
}
