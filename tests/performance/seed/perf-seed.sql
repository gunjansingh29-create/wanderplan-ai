-- =============================================================================
-- WanderPlan AI — Performance Test Seed Data
-- =============================================================================
-- Creates 200 perf test users and 500 pre-built trips with complete itinerary
-- data so read-heavy tests don't pay creation overhead in the hot path.
--
-- Run before performance tests:
--   psql $DATABASE_URL -f tests/performance/seed/perf-seed.sql
-- =============================================================================

BEGIN;

-- ── Performance test users ────────────────────────────────────────────────────
-- 200 users: perf-user-0001 through perf-user-0200
-- Password hash is bcrypt of 'PerfTest1!' (cost factor 10)

INSERT INTO users (id, email, name, password_hash, created_at)
SELECT
  gen_random_uuid(),
  'perf-user-' || LPAD(i::text, 4, '0') || '@wanderplan-perf.test',
  'Perf User ' || i,
  '$2b$10$rOzJqo.K6y6yiP1MbwJRKOEqI3ZCOG1YQIx5Gz3LKG0jA1ZMRq3Hy',  -- PerfTest1!
  NOW() - (random() * INTERVAL '365 days')
FROM generate_series(1, 200) AS i
ON CONFLICT (email) DO NOTHING;

-- ── Pre-seeded trips (500) ────────────────────────────────────────────────────
-- Trip IDs follow the pattern aaaaaaaa-aaaa-aaaa-aaaa-NNNNNNNNNNNN
-- so they're deterministic and can be referenced in test code by index.

INSERT INTO trips (id, name, status, duration_days, created_at, owner_id)
SELECT
  ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(i::text, 12, '0'))::uuid,
  'Perf Trip ' || i,
  'completed',
  7,
  NOW() - (random() * INTERVAL '180 days'),
  (SELECT id FROM users WHERE email = 'perf-user-0001@wanderplan-perf.test')
FROM generate_series(1, 500) AS i
ON CONFLICT (id) DO NOTHING;

-- ── Trip members ──────────────────────────────────────────────────────────────

INSERT INTO trip_members (trip_id, user_id, role, status)
SELECT
  ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(i::text, 12, '0'))::uuid,
  (SELECT id FROM users WHERE email = 'perf-user-0001@wanderplan-perf.test'),
  'owner',
  'accepted'
FROM generate_series(1, 500) AS i
ON CONFLICT DO NOTHING;

-- ── Budgets ───────────────────────────────────────────────────────────────────

INSERT INTO budgets (trip_id, currency, daily_target, total_budget, spent, remaining, warning_active)
SELECT
  ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(i::text, 12, '0'))::uuid,
  'USD',
  150.00,
  1050.00,
  850.00,
  200.00,
  false
FROM generate_series(1, 500) AS i
ON CONFLICT (trip_id) DO NOTHING;

-- ── Itinerary days (7 days × 500 trips = 3,500 rows) ─────────────────────────

INSERT INTO itinerary_days (id, trip_id, day_number, date)
SELECT
  gen_random_uuid(),
  ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(trip_i::text, 12, '0'))::uuid,
  day_n,
  CURRENT_DATE + (day_n - 1) * INTERVAL '1 day'
FROM
  generate_series(1, 500) AS trip_i,
  generate_series(1, 7)   AS day_n
ON CONFLICT DO NOTHING;

-- ── Itinerary activities (6 per day × 7 days × 500 trips = 21,000 rows) ──────
-- Activity names rotate through a fixed pool for determinism.

DO $$
DECLARE
  activity_names TEXT[] := ARRAY[
    'Senso-ji Temple Visit',       'Tsukiji Market Breakfast',
    'teamLab Borderless',          'Fushimi Inari Hike',
    'Arashiyama Bamboo Grove',     'Nishiki Food Market Tour',
    'Kinkaku-ji (Golden Pavilion)','Philosopher''s Path Walk',
    'Gion District Evening',       'Sake Brewery Tour',
    'Hiroshima Peace Memorial',    'Miyajima Island Day Trip',
    'Caldera Sunset View',         'Catamaran Snorkeling',
    'Oia Village Sunset Walk',     'Akrotiri Excavation',
    'Black Sand Beach',            'Local Winery Tasting'
  ];
  act_count INT := array_length(activity_names, 1);
  trip_i    INT;
  day_n     INT;
  slot_n    INT;
  day_id    UUID;
BEGIN
  FOR trip_i IN 1..500 LOOP
    FOR day_n IN 1..7 LOOP
      SELECT id INTO day_id FROM itinerary_days
       WHERE trip_id = ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(trip_i::text, 12, '0'))::uuid
         AND day_number = day_n
       LIMIT 1;

      IF day_id IS NOT NULL THEN
        FOR slot_n IN 1..6 LOOP
          INSERT INTO itinerary_activities (
            id, itinerary_day_id, trip_id, slot,
            name, start_time, end_time, location,
            category, cost_estimate_usd
          ) VALUES (
            gen_random_uuid(),
            day_id,
            ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(trip_i::text, 12, '0'))::uuid,
            slot_n,
            activity_names[((trip_i + day_n + slot_n) % act_count) + 1],
            (CURRENT_DATE + (day_n - 1) * INTERVAL '1 day' +
              (7 + slot_n * 2)::text::interval),
            (CURRENT_DATE + (day_n - 1) * INTERVAL '1 day' +
              (8 + slot_n * 2)::text::interval),
            CASE (slot_n % 3) WHEN 0 THEN 'Tokyo' WHEN 1 THEN 'Kyoto' ELSE 'Santorini' END,
            (ARRAY['culture','food','nature','art','adventure'])[(trip_i % 5) + 1],
            (random() * 80)::numeric(10,2)
          ) ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- ── Flight options ────────────────────────────────────────────────────────────

INSERT INTO flight_options (id, trip_id, airline, departure_airport, arrival_airport,
  departure_time, arrival_time, price_usd, stops, duration_minutes, selected)
SELECT
  gen_random_uuid(),
  ('aaaaaaaa-aaaa-aaaa-aaaa-' || LPAD(i::text, 12, '0'))::uuid,
  (ARRAY['Japan Airlines','Emirates','ANA','Singapore Airlines','Qantas'])[(i % 5) + 1],
  'LAX',
  'NRT',
  NOW() + (i || ' days')::interval,
  NOW() + (i || ' days')::interval + INTERVAL '11 hours',
  (200 + (i % 150))::numeric(10,2),
  0,
  660,
  true
FROM generate_series(1, 500) AS i
ON CONFLICT DO NOTHING;

COMMIT;

ANALYZE users, trips, trip_members, budgets, itinerary_days, itinerary_activities, flight_options;

\echo 'Performance seed complete.'
\echo 'Users:       200 (perf-user-0001 through perf-user-0200)'
\echo 'Trips:       500 (IDs aaaaaaaa-aaaa-aaaa-aaaa-000000000001 through ...000500)'
\echo 'Activities:  ~21,000'
