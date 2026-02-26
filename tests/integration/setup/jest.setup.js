/**
 * WanderPlan AI — Jest Global Setup / Teardown
 * Runs once per test suite process.
 */

'use strict';

const { execSync } = require('child_process');
const path         = require('path');
const { closeDb }  = require('./helpers');

const COMPOSE_FILE = path.resolve(__dirname, 'docker-compose.test.yml');
const COMPOSE_CMD  = `docker compose -f "${COMPOSE_FILE}"`;

// ─────────────────────────────────────────────────────────────────────────────
// Global Setup  (runs ONCE before all test suites)
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: globalSetup and globalTeardown have been moved to separate files for Jest compatibility.

// ─────────────────────────────────────────────────────────────────────────────
// Global Teardown  (runs ONCE after all test suites)
// ─────────────────────────────────────────────────────────────────────────────

module.exports.teardown = async function globalTeardown() {
  await closeDb();

  if (process.env.SKIP_DOCKER_DOWN !== 'true') {
    console.log('\n🛑  Tearing down integration stack…');
    execSync(`${COMPOSE_CMD} down -v --remove-orphans`, {
      stdio: 'inherit',
      timeout: 60_000,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Per-test-file setup/teardown  (exported for jest.config globalSetup fields)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Truncate mutable tables between tests to guarantee isolation.
 * Called via `beforeEach` in each test file.
 */
module.exports.resetMutableTables = async function resetMutableTables(db) {
  await db(
    `TRUNCATE
       trips, trip_members, bucket_list_items, timing_results,
       interest_profiles, pois, budgets, flight_options,
       itinerary_days, itinerary_activities, calendar_events,
       storyboards, analytics_events, health_acknowledgments,
       availability_windows
     RESTART IDENTITY CASCADE`
  );

  // Re-apply seed data so deterministic IDs are available
  const { execSync: exec } = require('child_process');
  const seedFile = require('path').resolve(__dirname, 'seed.sql');
  exec(
    `docker exec wp-test-postgres psql -U wanderplan -d wanderplan_test -f /dev/stdin < "${seedFile}"`,
    { stdio: 'pipe', timeout: 15_000 }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal utilities
// ─────────────────────────────────────────────────────────────────────────────

async function waitForHealth(url, timeout = 60_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`Service at ${url} did not become healthy within ${timeout}ms`);
}
