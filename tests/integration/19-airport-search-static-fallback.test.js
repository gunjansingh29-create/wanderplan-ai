/**
 * @fileoverview
 * Verifies static airport fallback covers destination cities used by the
 * multi-city flight flow even when live airport lookup is unavailable.
 */

'use strict';

const request = require('supertest');
const { API_V1, loginAs } = require('./setup/helpers');

describe('19 - airport search static fallback', () => {
  let token;

  beforeAll(async () => {
    token = await loginAs('alice');
  });

  test('GET /airports/search resolves Queenstown from static fallback', async () => {
    const res = await request(API_V1)
      .get('/airports/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Queenstown' })
      .expect(200);

    const airports = Array.isArray(res.body?.airports) ? res.body.airports : [];
    expect(airports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iata: 'ZQN',
          city: 'Queenstown',
        }),
      ])
    );
  });
});
