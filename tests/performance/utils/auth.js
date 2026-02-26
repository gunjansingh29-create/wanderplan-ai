/**
 * Authentication helpers for performance tests.
 *
 * Provides token acquisition with a per-VU cache so each virtual user
 * authenticates once and reuses the token for subsequent requests.
 * Also provides a shared token pool for high-concurrency scenarios where
 * we want to reuse pre-seeded accounts rather than registering fresh users
 * in the hot path.
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter, Gauge } from 'k6/metrics';
import { BASE_URL, DEFAULT_HEADERS, PERF_USERS } from './env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

export const authSuccessCounter  = new Counter('auth_success_total');
export const authFailureCounter  = new Counter('auth_failure_total');
export const tokenPoolGauge      = new Gauge('token_pool_size');

// ─────────────────────────────────────────────────────────────────────────────
// Per-VU token cache (lives in VU context, NOT shared across VUs)
// ─────────────────────────────────────────────────────────────────────────────

let _vuToken = null;
let _vuUserId = null;

/**
 * Get (or acquire) an access token for the current VU.
 * On first call this performs a real login; subsequent calls return cached token.
 *
 * @param {string} [email]    - Override email (default: rotates through PERF_USERS pool)
 * @param {string} [password] - Override password
 * @returns {{ token: string, userId: string }}
 */
export function getVuToken(email, password) {
  if (_vuToken) return { token: _vuToken, userId: _vuUserId };

  const idx = (__VU - 1) % PERF_USERS.length;
  const user = PERF_USERS[idx];
  const creds = {
    email:    email    ?? user.email,
    password: password ?? user.password,
  };

  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify(creds),
    { headers: DEFAULT_HEADERS, tags: { endpoint: 'login' } }
  );

  const ok = check(res, {
    'auth: status 200':       r => r.status === 200,
    'auth: has accessToken':  r => {
      try { return !!JSON.parse(r.body).accessToken; } catch { return false; }
    },
  });

  if (!ok) {
    authFailureCounter.add(1);
    // Attempt registration if login failed (user may not exist yet)
    const regRes = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({ ...creds, name: `Perf User ${__VU}` }),
      { headers: DEFAULT_HEADERS, tags: { endpoint: 'register' } }
    );
    check(regRes, { 'auth: registration succeeded': r => r.status === 201 || r.status === 409 });
    if (regRes.status !== 201 && regRes.status !== 409) {
      fail(`VU ${__VU}: cannot authenticate. Status: ${res.status}`);
    }
    // Retry login
    const retry = http.post(`${BASE_URL}/auth/login`, JSON.stringify(creds), { headers: DEFAULT_HEADERS });
    try {
      const body = JSON.parse(retry.body);
      _vuToken  = body.accessToken;
      _vuUserId = body.user?.id ?? body.userId ?? `vu-${__VU}`;
    } catch { fail(`VU ${__VU}: login retry parse failed`); }
  } else {
    try {
      const body = JSON.parse(res.body);
      _vuToken  = body.accessToken;
      _vuUserId = body.user?.id ?? body.userId ?? `vu-${__VU}`;
    } catch { fail(`VU ${__VU}: login parse failed`); }
  }

  authSuccessCounter.add(1);
  tokenPoolGauge.add(1);
  return { token: _vuToken, userId: _vuUserId };
}

/**
 * Build the Authorization header object for an authenticated request.
 */
export function authHeaders(token) {
  return {
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

/**
 * Reset per-VU token (force re-authentication on next call).
 * Call this if you receive a 401 to trigger a fresh login.
 */
export function resetVuToken() {
  _vuToken  = null;
  _vuUserId = null;
  tokenPoolGauge.add(-1);
}
