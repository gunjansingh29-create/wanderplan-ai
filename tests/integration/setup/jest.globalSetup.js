/**
 * Jest Global Setup for WanderPlan AI Integration Tests
 */
'use strict';
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const COMPOSE_FILE = path.resolve(__dirname, 'docker-compose.test.yml');
const COMPOSE_CMD = `docker compose -f "${COMPOSE_FILE}"`;
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
module.exports = async function globalSetup() {
  console.log('\n🚀  Starting WanderPlan integration stack…');
  if (process.env.SKIP_DOCKER_UP !== 'true') {
    execSync(`${COMPOSE_CMD} up -d --build --wait`, {
      stdio: 'inherit',
      timeout: 300_000,
    });
  }
  const seedFile = path.resolve(__dirname, 'seed.sql');
  const seedSql = fs.readFileSync(seedFile, 'utf8');
  execSync(
    'docker exec -i wp-test-postgres psql -U wanderplan -d wanderplan_test -f -',
    {
      input: seedSql,
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: 300_000,
    }
  );
  await waitForHealth('http://localhost:18000/health', 60_000);
  console.log('✅  Integration stack ready.\n');
};
