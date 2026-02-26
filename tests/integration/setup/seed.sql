-- =============================================================================
-- WanderPlan AI — Integration Test Seed Data
-- Applied to wanderplan_test DB before every test run.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        UNIQUE NOT NULL,
  name          TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trips -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trips (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID        REFERENCES users(id),
  name          TEXT        NOT NULL,
  status        TEXT        DEFAULT 'planning',
  duration_days INT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Trip Members ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trip_members (
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT        DEFAULT 'member',   -- owner | member
  status        TEXT        DEFAULT 'pending',  -- pending | accepted | declined
  joined_at     TIMESTAMPTZ,
  PRIMARY KEY (trip_id, user_id)
);

-- Bucket List Items -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS bucket_list_items (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  destination   TEXT        NOT NULL,
  country       TEXT,
  category      TEXT,
  added_by      UUID        REFERENCES users(id),
  vote_score    INT         DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Timing Results --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timing_results (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id          UUID        REFERENCES trips(id) ON DELETE CASCADE,
  destination      TEXT        NOT NULL,
  month_scores     JSONB       NOT NULL DEFAULT '{}',  -- {"Jan":7,"Feb":8,...}
  preferred_months TEXT[]      DEFAULT '{}',
  avoid_months     TEXT[]      DEFAULT '{}',
  best_window      JSONB,
  computed_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Interest Profiles -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS interest_profiles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id),
  categories    TEXT[]      DEFAULT '{}',
  intensity     TEXT        DEFAULT 'moderate',
  must_do       TEXT[]      DEFAULT '{}',
  avoid         TEXT[]      DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);

-- POIs ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pois (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID        REFERENCES trips(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  category              TEXT,
  city                  TEXT,
  country               TEXT,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  tags                  TEXT[]      DEFAULT '{}',
  rating                NUMERIC(3,1),
  cost_estimate_usd     NUMERIC(10,2) DEFAULT 0,
  accessibility_score   NUMERIC(3,2) DEFAULT 1.0,
  approved              BOOLEAN     DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Budget ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID        REFERENCES trips(id) ON DELETE CASCADE UNIQUE,
  currency        TEXT        DEFAULT 'USD',
  daily_target    NUMERIC(12,2),
  total_budget    NUMERIC(12,2),
  spent           NUMERIC(12,2) DEFAULT 0,
  remaining       NUMERIC(12,2),
  breakdown       JSONB       DEFAULT '{}',
  warning_active  BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Flights ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flight_options (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID        REFERENCES trips(id) ON DELETE CASCADE,
  airline         TEXT,
  departure_airport TEXT,
  arrival_airport TEXT,
  departure_time  TIMESTAMPTZ,
  arrival_time    TIMESTAMPTZ,
  price_usd       NUMERIC(10,2),
  stops           INT         DEFAULT 0,
  duration_min    INT,
  selected        BOOLEAN     DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Itinerary Days --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS itinerary_days (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID        REFERENCES trips(id) ON DELETE CASCADE,
  day_number  INT         NOT NULL,
  date        DATE,
  title       TEXT,
  approved    BOOLEAN     DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Itinerary Activities --------------------------------------------------------
CREATE TABLE IF NOT EXISTS itinerary_activities (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id        UUID        REFERENCES itinerary_days(id) ON DELETE CASCADE,
  time_slot     TEXT,
  title         TEXT        NOT NULL,
  description   TEXT,
  category      TEXT,
  location_name TEXT,
  lat           DOUBLE PRECISION,
  lng           DOUBLE PRECISION,
  cost_estimate NUMERIC(10,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Calendar Events (mock — stores what was sent to Calendar API) ---------------
CREATE TABLE IF NOT EXISTS calendar_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  activity_id   UUID        REFERENCES itinerary_activities(id),
  calendar_id   TEXT,
  event_title   TEXT,
  start_time    TIMESTAMPTZ,
  end_time      TIMESTAMPTZ,
  location      TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Storyboards -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storyboards (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id),
  platform      TEXT        NOT NULL,  -- instagram | twitter | blog | tiktok
  content       TEXT,
  word_count    INT,
  generated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    TEXT,
  trip_id       UUID,
  user_id       UUID,
  event_type    TEXT        NOT NULL,
  screen_name   TEXT,
  properties    JSONB       DEFAULT '{}',
  client_ts     TIMESTAMPTZ,
  server_ts     TIMESTAMPTZ DEFAULT NOW()
);

-- Health Acknowledgments ------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_acknowledgments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id),
  activity_id   UUID,
  certification_required TEXT,
  user_has_cert BOOLEAN,
  alternative_suggested TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Availability Windows --------------------------------------------------------
CREATE TABLE IF NOT EXISTS availability_windows (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID        REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID        REFERENCES users(id),
  start_date    DATE        NOT NULL,
  end_date      DATE        NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────────────────────

-- Well-known UUIDs for deterministic tests ------------------------------------
-- Users
INSERT INTO users (id, email, name, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001', 'alice@test.com',   'Alice Chen',    crypt('Password1!', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000002', 'bob@test.com',     'Bob Smith',     crypt('Password1!', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000003', 'carol@test.com',   'Carol Park',    crypt('Password1!', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000004', 'dave@test.com',    'Dave Jones',    crypt('Password1!', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000005', 'eve@test.com',     'Eve Martinez',  crypt('Password1!', gen_salt('bf'))),
  ('00000000-0000-0000-0000-000000000006', 'frank@test.com',   'Frank Lee',     crypt('Password1!', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

-- Pre-seeded trip for tests that skip creation --------------------------------
INSERT INTO trips (id, owner_id, name, duration_days, status) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Pre-seeded Tokyo Trip', 7, 'planning')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_members (trip_id, user_id, role, status, joined_at) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner',  'accepted', NOW()),
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member', 'accepted', NOW())
ON CONFLICT DO NOTHING;

-- Pre-seeded bucket list items ------------------------------------------------
INSERT INTO bucket_list_items (id, trip_id, destination, country, category, added_by, vote_score) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tokyo',  'Japan', 'city',  '00000000-0000-0000-0000-000000000001', 5),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Kyoto',  'Japan', 'city',  '00000000-0000-0000-0000-000000000001', 4),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Hakone', 'Japan', 'nature','00000000-0000-0000-0000-000000000002', 3)
ON CONFLICT (id) DO NOTHING;

-- Pre-seeded timing results (with month scores) --------------------------------
INSERT INTO timing_results (id, trip_id, destination, month_scores, preferred_months, avoid_months, best_window) VALUES
  ('cccccccc-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'Tokyo',
   '{"Jan":5,"Feb":6,"Mar":9,"Apr":10,"May":8,"Jun":6,"Jul":5,"Aug":4,"Sep":7,"Oct":9,"Nov":8,"Dec":6}',
   ARRAY['March','April','October'],
   ARRAY['July','August'],
   '{"start":"2025-03-20","end":"2025-04-10"}')
ON CONFLICT (id) DO NOTHING;

-- Pre-seeded budget -----------------------------------------------------------
INSERT INTO budgets (id, trip_id, currency, daily_target, total_budget, spent, remaining, breakdown) VALUES
  ('dddddddd-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   'USD', 150, 1050, 0, 1050,
   '{"flights":315,"accommodation":315,"dining":210,"activities":105,"transport":52.5,"misc":52.5}')
ON CONFLICT DO NOTHING;

-- Pre-seeded POIs -------------------------------------------------------------
INSERT INTO pois (id, trip_id, name, category, city, country, lat, lng, tags, rating, cost_estimate_usd) VALUES
  ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Senso-ji Temple',    'culture',    'Tokyo', 'Japan', 35.7148, 139.7967, ARRAY['temple','history','culture'],   4.7, 0),
  ('eeeeeeee-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Tsukiji Outer Market','food',       'Tokyo', 'Japan', 35.6654, 139.7707, ARRAY['food','market','seafood'],       4.5, 15),
  ('eeeeeeee-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Shinjuku Gyoen',      'nature',     'Tokyo', 'Japan', 35.6851, 139.7100, ARRAY['park','nature','garden'],        4.6, 5),
  ('eeeeeeee-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'teamLab Borderless',  'art',        'Tokyo', 'Japan', 35.6254, 139.7753, ARRAY['art','tech','adventure'],        4.8, 32),
  ('eeeeeeee-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Arashiyama Bamboo',   'nature',     'Kyoto', 'Japan', 35.0170, 135.6717, ARRAY['nature','bamboo','walk'],        4.5, 0)
ON CONFLICT (id) DO NOTHING;
