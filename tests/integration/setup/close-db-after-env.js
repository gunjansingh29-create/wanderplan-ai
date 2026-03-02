'use strict';

const { closeDb } = require('./helpers');

afterAll(async () => {
  await closeDb();
});
