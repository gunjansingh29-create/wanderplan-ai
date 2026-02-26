/**
 * Performance Test 05 — WebSocket Group Chat Sessions
 * ────────────────────────────────────────────────────
 * Simulates 500 concurrent group chat sessions, each sending 10 messages
 * per second and receiving real-time updates (presence, typing indicators,
 * planning stage notifications) from other session members.
 *
 * Architecture under test:
 *   Client → Kong WebSocket proxy → Orchestrator WS handler → Redis Pub/Sub
 *   → each connected member's WebSocket connection
 *
 * Load shape:
 *   0 → 500 connections over 30s (ramp up)
 *   500 connections × 3 minutes sustained
 *   Drain over 30s
 *
 * Success criteria:
 *   ✅ Message delivery latency p95 < 100ms
 *   ✅ Message delivery latency p99 < 250ms
 *   ✅ Zero dropped connections during sustained phase
 *   ✅ < 5 failed connection attempts (out of 500)
 *   ✅ All sent messages arrive (< 10 dropped)
 *   ✅ Sessions remain open for full 3-minute duration
 *
 * Note on k6 WebSocket support:
 *   k6 uses the ws module for WebSocket connections. Message round-trip
 *   latency is measured by including a timestamp in the sent message and
 *   subtracting it when the echoed message is received back.
 *
 * Run:
 *   k6 run tests/performance/05-websocket-connections.js
 */

import ws          from 'k6/ws';
import http        from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

import { WEBSOCKET_THRESHOLDS } from './config/thresholds.js';
import { getVuToken }           from './utils/auth.js';
import {
  WS_BASE_URL, BASE_URL, PERF_TRIP_IDS,
  randomFrom, randInt, thinkTime,
} from './utils/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Custom metrics
// ─────────────────────────────────────────────────────────────────────────────

const deliveryLatency       = new Trend('ws_message_delivery_latency', true);
const connectErrors         = new Counter('ws_connect_errors');
const droppedConnections    = new Counter('ws_dropped_connections');
const droppedMessages       = new Counter('ws_messages_dropped');
const sessionDuration       = new Trend('ws_session_duration', true);
const messagesReceived      = new Counter('ws_messages_received');
const messagesSent          = new Counter('ws_messages_sent');
const activeConnectionsGauge = new Gauge('ws_active_connections');
const pingLatency           = new Trend('ws_ping_latency_ms', true);

// ─────────────────────────────────────────────────────────────────────────────
// k6 options
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    websocket_sessions: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 250 },   // ramp to 250
        { duration: '15s', target: 500 },   // ramp to 500
        { duration: '3m',  target: 500 },   // sustain
        { duration: '30s', target: 0   },   // drain
      ],
      gracefulRampDown: '10s',
    },
  },

  thresholds: {
    ...WEBSOCKET_THRESHOLDS,
    'ws_ping_latency_ms': ['p(95)<50', 'p(99)<100'],
  },

  tags: { test_name: 'websocket_connections' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Message type payloads
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a chat message with an embedded timestamp for round-trip latency measurement.
 */
function chatMessage(tripId, userId, text) {
  return JSON.stringify({
    type:      'chat',
    trip_id:   tripId,
    user_id:   userId,
    text:      text,
    timestamp: Date.now(),     // Used for latency measurement on receipt
    seq:       __ITER,
  });
}

function typingIndicator(tripId, userId) {
  return JSON.stringify({ type: 'typing', trip_id: tripId, user_id: userId });
}

function presenceUpdate(tripId, userId, status) {
  return JSON.stringify({ type: 'presence', trip_id: tripId, user_id: userId, status });
}

function pingMessage(tripId) {
  return JSON.stringify({ type: 'ping', trip_id: tripId, ts: Date.now() });
}

/** Rotating pool of realistic chat messages. */
const CHAT_MESSAGES = [
  'What about that temple in Kyoto?',
  'I like the hotel option 2 better',
  'Can we push the budget up a bit?',
  'The flight at 10am looks perfect',
  'I vote yes on the food tour!',
  'Should we add Bali to the bucket list?',
  'The timing analysis looks spot on',
  'My calendar is blocked that week — can we shift?',
  'How does everyone feel about the itinerary?',
  'I already have travel insurance',
  '👍 Approving the budget',
  'Let\'s skip the scuba — snorkeling works for me',
  'Has anyone checked the weather for those months?',
  'The restaurant on day 3 is amazing!',
  'Flight 2 is cheaper AND nonstop — easy choice',
];

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket session driver
// ─────────────────────────────────────────────────────────────────────────────

export default function () {
  const { token, userId } = getVuToken();
  const tripId = PERF_TRIP_IDS[(__VU - 1) % 200];

  // Build the WebSocket URL (passes auth token as query param — common pattern)
  const wsUrl = `${WS_BASE_URL}/trips/${tripId}/chat?token=${token}`;

  const sessionStart = Date.now();
  activeConnectionsGauge.add(1);

  const SESSION_DURATION_MS = 180000;    // 3 minutes
  let   lastMsgTimestamp    = {};        // seq → sent timestamp
  let   msgSentCount        = 0;
  let   msgRecvCount        = 0;
  let   pingTimestamp       = 0;

  const response = ws.connect(wsUrl, {
    tags: { scenario: 'websocket_sessions' },
  }, function (socket) {

    // ── Connection established ─────────────────────────────────────────────
    socket.on('open', () => {
      check(socket, { 'WS: connection opened': () => true });

      // Announce presence
      socket.send(presenceUpdate(tripId, userId, 'online'));

      // ── Heartbeat ping every 10 seconds ───────────────────────────────
      socket.setInterval(() => {
        pingTimestamp = Date.now();
        socket.send(pingMessage(tripId));
      }, 10000);

      // ── Send chat messages at ~10 msg/s ─────────────────────────────────
      // k6 setInterval fires every 100ms = 10 msg/s
      socket.setInterval(() => {
        const elapsed = Date.now() - sessionStart;
        if (elapsed >= SESSION_DURATION_MS) {
          socket.close(1000);
          return;
        }

        // Rotate through message types (90% chat, 8% typing, 2% presence)
        const roll = Math.random();
        let payload;

        if (roll < 0.90) {
          const text = randomFrom(CHAT_MESSAGES);
          const seq  = msgSentCount;
          lastMsgTimestamp[seq] = Date.now();
          payload = chatMessage(tripId, userId, text);
        } else if (roll < 0.98) {
          payload = typingIndicator(tripId, userId);
        } else {
          payload = presenceUpdate(tripId, userId, 'online');
        }

        socket.send(payload);
        messagesSent.add(1);
        msgSentCount++;
      }, 100);  // 100ms = 10 msg/s
    });

    // ── Incoming message handler ───────────────────────────────────────────
    socket.on('message', (data) => {
      msgRecvCount++;
      messagesReceived.add(1);

      try {
        const msg = JSON.parse(data);

        // Latency measurement: if this is an echo of our own message
        if (msg.type === 'chat' && msg.user_id === userId && msg.timestamp) {
          const latency = Date.now() - msg.timestamp;
          deliveryLatency.add(latency);

          check(null, {
            'WS: delivery < 100ms': () => latency < 100,
            'WS: delivery < 250ms': () => latency < 250,
          });
        }

        // Pong response
        if (msg.type === 'pong' && pingTimestamp > 0) {
          pingLatency.add(Date.now() - pingTimestamp);
          pingTimestamp = 0;
        }

      } catch {}
    });

    // ── Error handler ──────────────────────────────────────────────────────
    socket.on('error', (e) => {
      connectErrors.add(1);
      console.warn(`VU ${__VU}: WebSocket error: ${e.message || e}`);
    });

    // ── Close handler ──────────────────────────────────────────────────────
    socket.on('close', (code) => {
      const dur = Date.now() - sessionStart;
      sessionDuration.add(dur);
      activeConnectionsGauge.add(-1);

      // Code 1000 = normal close; anything else = unexpected drop
      if (code !== 1000 && dur < SESSION_DURATION_MS - 5000) {
        droppedConnections.add(1);
        console.warn(`VU ${__VU}: unexpected WS close code=${code} after ${dur}ms`);
      }

      // Count dropped messages: sent - received (with tolerance for in-flight)
      const dropped = Math.max(0, msgSentCount - msgRecvCount - 20);
      if (dropped > 0) droppedMessages.add(dropped);
    });

    // ── Session timeout ────────────────────────────────────────────────────
    socket.setTimeout(() => {
      socket.send(presenceUpdate(tripId, userId, 'offline'));
      socket.close(1000);
    }, SESSION_DURATION_MS);
  });

  // Verify that connect() itself succeeded
  check(response, {
    'WS: connect returned 101': r => r && r.status === 101,
  });

  if (!response || response.status !== 101) {
    connectErrors.add(1);
    activeConnectionsGauge.add(-1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle hooks
// ─────────────────────────────────────────────────────────────────────────────

export function setup() {
  // Verify WebSocket endpoint is reachable
  const authRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: 'perf-user-0001@wanderplan-perf.test', password: 'PerfTest1!' }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const token = JSON.parse(authRes.body)?.accessToken;
  const tripId = PERF_TRIP_IDS[0];

  // Quick WS handshake probe
  const probe = ws.connect(
    `${WS_BASE_URL}/trips/${tripId}/chat?token=${token}`,
    {},
    socket => {
      socket.setTimeout(() => socket.close(1000), 1000);
    }
  );

  if (!probe || probe.status !== 101) {
    console.error(`⚠️  WebSocket endpoint probe failed: status=${probe?.status || 'no response'}
     Is the server running? Is the WS_BASE_URL correct? (${WS_BASE_URL})`);
  } else {
    console.log('✅ WebSocket endpoint probe succeeded');
  }

  return { startTime: Date.now() };
}

export function teardown(data) {
  const mins = ((Date.now() - data.startTime) / 60000).toFixed(1);
  console.log(`\n✅ WebSocket test completed in ${mins} minutes`);
}

export function handleSummary(data) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    [`results/05-websocket-connections-${ts}.html`]: htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
