/**
 * Jest Global Teardown for WanderPlan AI Integration Tests
 */
'use strict';
const { execSync } = require('child_process');
const path = require('path');
const { closeDb } = require('./helpers');
const COMPOSE_FILE = path.resolve(__dirname, 'docker-compose.test.yml');
const COMPOSE_CMD = `docker compose -f "${COMPOSE_FILE}"`;
module.exports = async function globalTeardown() {
  await closeDb();
  if (process.env.SKIP_DOCKER_DOWN !== 'true') {
    console.log('\n🛑  Tearing down integration stack…');
    execSync(`${COMPOSE_CMD} down -v --remove-orphans`, {
      stdio: 'inherit',
      timeout: 60_000,
    });
  }
};