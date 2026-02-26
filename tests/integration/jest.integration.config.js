/**
 * Jest configuration for WanderPlan AI integration tests.
 * Separate from the frontend jest.config.js in the project root.
 *
 * Usage:
 *   npx jest --config tests/integration/jest.integration.config.js
 *   npm run test:integration   (via package.json script)
 */

'use strict';

module.exports = {
  // ── Identity ──────────────────────────────────────────────────────────────
  displayName: 'integration',
  testEnvironment: 'node',

  // ── File discovery ────────────────────────────────────────────────────────
  rootDir: '../..',
  testMatch: [
    '<rootDir>/tests/integration/**/*.test.js',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/tests/integration/setup/',
  ],

  // ── Global setup / teardown ───────────────────────────────────────────────
  globalSetup:    '<rootDir>/tests/integration/setup/jest.globalSetup.js',
  globalTeardown: '<rootDir>/tests/integration/setup/jest.globalTeardown.js',

  // ── Per-file setup (import helpers) ───────────────────────────────────────
  setupFilesAfterFramework: [],

  // ── Timeouts — integration tests hit real HTTP + Docker services ──────────
  testTimeout: 60_000,         // 60 s per individual test
  // Each describe block gets its own isolated timeout budget

  // ── Concurrency — run files in parallel, tests within a file serially ─────
  maxWorkers: 4,
  maxConcurrency: 4,
  // Within a test file, tests run in order (the default for jest)

  // ── Reporter ──────────────────────────────────────────────────────────────
  verbose: true,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: '<rootDir>/tests/integration/reports',
        outputName:      'integration-results.xml',
        classname:       '{classname}',
        title:           '{title}',
      },
    ],
  ],

  // ── Coverage (opt-in via --coverage flag) ────────────────────────────────
  collectCoverageFrom: [],   // coverage not measured for integration tests

  // ── Module resolution ─────────────────────────────────────────────────────
  moduleFileExtensions: ['js', 'json'],
  transform: {},             // no transpilation — Node 20 supports modern JS natively

  // ── Environment variables injected into every test ────────────────────────
  testEnvironmentOptions: {
    env: {
      API_BASE_URL:       'http://localhost:18000',
      MOCK_API_URL:       'http://localhost:4000',
      POSTGRES_HOST:      'localhost',
      POSTGRES_PORT:      '15432',
      POSTGRES_DB:        'wanderplan_test',
      POSTGRES_USER:      'wanderplan',
      POSTGRES_PASSWORD:  'wanderplan_test',
    },
  },

  // ── Force test ordering (run in file-name order for easier debugging) ─────
  testSequencer: '<rootDir>/tests/integration/setup/sequencer.js',
};
