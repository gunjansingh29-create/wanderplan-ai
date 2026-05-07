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

  test('GET /airports/search resolves Chengdu to nearby airports from static fallback', async () => {
    const res = await request(API_V1)
      .get('/airports/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Chengdu' })
      .expect(200);

    const airports = Array.isArray(res.body?.airports) ? res.body.airports : [];
    expect(airports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iata: 'TFU',
        }),
      ])
    );
  });

  test('GET /airports/search resolves Cyprus stops to nearby airports from static fallback', async () => {
    const ayiaNapa = await request(API_V1)
      .get('/airports/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Ayia Napa' })
      .expect(200);

    expect(Array.isArray(ayiaNapa.body?.airports) ? ayiaNapa.body.airports : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iata: 'LCA',
        }),
      ])
    );

    const paphos = await request(API_V1)
      .get('/airports/search')
      .set('Authorization', `Bearer ${token}`)
      .query({ q: 'Paphos' })
      .expect(200);

    expect(Array.isArray(paphos.body?.airports) ? paphos.body.airports : []).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          iata: 'PFO',
        }),
      ])
    );
  });
});
