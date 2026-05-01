'use strict';

const request = require('supertest');
const {
  API_V1,
  loginAs,
  dbQuery,
} = require('./setup/helpers');

describe('11 — LLM Gateway + Wizard Session Flow', () => {
  let aliceToken;
  let sessionId;
  let tripId;

  beforeAll(async () => {
    aliceToken = await loginAs('alice');
  });

  test('POST /llm/messages -> 200 with normalized Anthropic-like payload', async () => {
    const res = await request(API_V1)
      .post('/llm/messages')
      .send({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: 'Return short JSON' }],
      })
      .expect(200);

    expect(Array.isArray(res.body.content)).toBe(true);
    expect(res.body._meta).toBeDefined();
    expect(res.body._meta.provider).toBe('anthropic');
    expect(typeof res.body._meta.model_used).toBe('string');
  });

  test('POST /nlp/extract-destinations keeps one primary destination for long-form essay input', async () => {
    const essay = 'Prague was the center of my weeklong journey, from dawn walks along the Vltava River to evenings in Old Town Square. I crossed Charles Bridge multiple times, explored Prague Castle, and kept returning to the same neighborhoods for cafés and live music. The architecture had Gothic and Art Nouveau details everywhere, and each day made me want to revisit Prague first. Even with nearby side trips, Prague remained the clear destination anchor for the whole experience.';
    const res = await request(API_V1)
      .post('/nlp/extract-destinations')
      .send({ text: essay })
      .expect(200);

    expect(Array.isArray(res.body.destinations)).toBe(true);
    expect(res.body.destinations).toHaveLength(1);
    expect(res.body.destinations[0].name.toLowerCase()).toBe('prague');
  });

  test('POST /wizard/sessions creates a persisted session and trip', async () => {
    const res = await request(API_V1)
      .post('/wizard/sessions')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        trip_name: `LLM First Session ${Date.now()}`,
        duration_days: 9,
        initial_state: { source: 'integration-test' },
      })
      .expect(201);

    expect(res.body.session).toBeDefined();
    expect(res.body.session.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.body.session.trip_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(res.body.session.current_step).toBe(0);

    sessionId = res.body.session.id;
    tripId = res.body.session.trip_id;
  });

  test('POST /wizard/sessions/:id/actions supports step progression', async () => {
    const approve = await request(API_V1)
      .post(`/wizard/sessions/${sessionId}/actions`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ action_type: 'approve_step', payload: {} })
      .expect(200);

    expect(approve.body.ok).toBe(true);
    expect(approve.body.session.current_step).toBe(1);

    const revise = await request(API_V1)
      .post(`/wizard/sessions/${sessionId}/actions`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ action_type: 'revise_step', payload: {} })
      .expect(200);

    expect(revise.body.session.current_step).toBe(0);
  });

  test('POST /wizard/sessions/:id/actions add_bucket_item writes through to trip data', async () => {
    const destination = `Integration City ${Date.now()}`;
    const res = await request(API_V1)
      .post(`/wizard/sessions/${sessionId}/actions`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        action_type: 'add_bucket_item',
        payload: { destination, country: 'Japan', category: 'city' },
      })
      .expect(200);

    expect(res.body.result.item.destination).toBe(destination);

    const rows = await dbQuery(
      `SELECT destination, country, category
         FROM bucket_list_items
        WHERE trip_id = $1
          AND destination = $2`,
      [tripId, destination]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].country).toBe('Japan');
    expect(rows[0].category).toBe('city');
  });

  test('wizard session events are persisted for auditability', async () => {
    const rows = await dbQuery(
      `SELECT action_type, resulting_step
         FROM wizard_session_events
        WHERE session_id = $1
        ORDER BY created_at ASC`,
      [sessionId]
    );
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const types = rows.map(r => r.action_type);
    expect(types).toContain('approve_step');
    expect(types).toContain('revise_step');
    expect(types).toContain('add_bucket_item');
  });
});
