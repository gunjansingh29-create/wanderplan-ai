-- Migration 001: Initial Schema
-- All 17 PostgreSQL tables with constraints, indexes, and foreign keys
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ── Enum Types ───────────────────────────────────────────────────────────────

CREATE TYPE "AuthProvider"        AS ENUM ('local', 'google', 'apple', 'facebook');
CREATE TYPE "UserRole"            AS ENUM ('user', 'admin', 'premium');
CREATE TYPE "TravelStyle"         AS ENUM ('solo', 'couple', 'family', 'group', 'adventure', 'luxury');
CREATE TYPE "FitnessLevel"        AS ENUM ('low', 'moderate', 'high', 'athletic');
CREATE TYPE "BudgetPreference"    AS ENUM ('budget', 'moderate', 'premium', 'luxury');
CREATE TYPE "TripStatus"          AS ENUM ('planning', 'bucket_list', 'timing', 'interests', 'health', 'pois', 'scheduling', 'budgeting', 'flights', 'stays', 'dining', 'itinerary', 'confirmed', 'active', 'completed');
CREATE TYPE "TripMemberRole"      AS ENUM ('organizer', 'member');
CREATE TYPE "InvitationStatus"    AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE "RequirementType"     AS ENUM ('vaccination', 'fitness', 'certification', 'medication', 'insurance');
CREATE TYPE "Severity"            AS ENUM ('mandatory', 'recommended', 'optional');
CREATE TYPE "POICategory"         AS ENUM ('attraction', 'activity', 'nature', 'culture', 'food', 'nightlife', 'shopping', 'relaxation');
CREATE TYPE "CabinClass"          AS ENUM ('economy', 'premium_economy', 'business', 'first');
CREATE TYPE "AccommodationType"   AS ENUM ('hotel', 'hostel', 'airbnb', 'resort', 'boutique');
CREATE TYPE "MealType"            AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');
CREATE TYPE "PriceRange"          AS ENUM ('$', '$$', '$$$', '$$$$');
CREATE TYPE "ItineraryItemType"   AS ENUM ('flight', 'transfer', 'checkin', 'checkout', 'activity', 'meal', 'rest', 'travel');
CREATE TYPE "SocialPlatform"      AS ENUM ('instagram', 'twitter', 'tiktok', 'facebook');

-- ── 1. users ─────────────────────────────────────────────────────────────────

CREATE TABLE "users" (
    "id"              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "email"           VARCHAR(255)   UNIQUE NOT NULL,
    "password_hash"   VARCHAR(255),
    "first_name"      VARCHAR(100),
    "last_name"       VARCHAR(100),
    "phone"           VARCHAR(20),
    "avatar_url"      TEXT,
    "auth_provider"   "AuthProvider"  NOT NULL DEFAULT 'local',
    "role"            "UserRole"      NOT NULL DEFAULT 'user',
    "email_verified"  BOOLEAN         NOT NULL DEFAULT false,
    "mfa_enabled"     BOOLEAN         NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    "updated_at"      TIMESTAMPTZ
);

CREATE INDEX "idx_users_email"         ON "users" ("email");
CREATE INDEX "idx_users_auth_provider" ON "users" ("auth_provider");

-- ── 2. user_profiles ─────────────────────────────────────────────────────────

CREATE TABLE "user_profiles" (
    "user_id"              UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "travel_style"         "TravelStyle",
    "hobbies"              TEXT[]       DEFAULT '{}',
    "interests"            TEXT[]       DEFAULT '{}',
    "dietary_restrictions"  TEXT[]       DEFAULT '{}',
    "fitness_level"        "FitnessLevel",
    "budget_preference"    "BudgetPreference",
    "preferred_currency"   CHAR(3)      DEFAULT 'USD',
    "preferred_language"   VARCHAR(10)  DEFAULT 'en',
    "updated_at"           TIMESTAMPTZ
);

CREATE INDEX "idx_profiles_hobbies"   ON "user_profiles" USING GIN ("hobbies");
CREATE INDEX "idx_profiles_interests" ON "user_profiles" USING GIN ("interests");

-- ── 3. trips ─────────────────────────────────────────────────────────────────

CREATE TABLE "trips" (
    "id"          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "name"        VARCHAR(255)   NOT NULL,
    "status"      "TripStatus"   NOT NULL DEFAULT 'planning',
    "created_by"  UUID           NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
    "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    "updated_at"  TIMESTAMPTZ
);

CREATE INDEX "idx_trips_created_by" ON "trips" ("created_by");
CREATE INDEX "idx_trips_status"     ON "trips" ("status");

-- ── 4. trip_members ──────────────────────────────────────────────────────────

CREATE TABLE "trip_members" (
    "trip_id"            UUID NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "user_id"            UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "role"               "TripMemberRole"   NOT NULL DEFAULT 'member',
    "invitation_status"  "InvitationStatus" NOT NULL DEFAULT 'pending',
    "availability_start" DATE,
    "availability_end"   DATE,
    "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY ("trip_id", "user_id"),
    CONSTRAINT "chk_availability_range" CHECK ("availability_end" IS NULL OR "availability_end" >= "availability_start")
);

CREATE INDEX "idx_trip_members_user_id" ON "trip_members" ("user_id");

-- ── 5. bucket_list_items ─────────────────────────────────────────────────────

CREATE TABLE "bucket_list_items" (
    "id"                UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"           UUID           NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "destination_name"  VARCHAR(255)   NOT NULL,
    "country"           VARCHAR(100),
    "suggested_by"      UUID           REFERENCES "users"("id") ON DELETE SET NULL,
    "latitude"          DECIMAL(10,8),
    "longitude"         DECIMAL(11,8),
    "votes_up"          INT            NOT NULL DEFAULT 0 CHECK ("votes_up" >= 0),
    "votes_down"        INT            NOT NULL DEFAULT 0 CHECK ("votes_down" >= 0),
    "rank_score"        DECIMAL(5,2)   DEFAULT 0,
    "best_travel_months" INT[]         DEFAULT '{}',
    "created_at"        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT "chk_bl_latitude"  CHECK ("latitude"  IS NULL OR ("latitude"  BETWEEN -90 AND 90)),
    CONSTRAINT "chk_bl_longitude" CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180)),
    CONSTRAINT "chk_bl_months"    CHECK ("best_travel_months" <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12])
);

CREATE INDEX "idx_bl_trip"      ON "bucket_list_items" ("trip_id");
CREATE INDEX "idx_bl_trip_rank" ON "bucket_list_items" ("trip_id", "rank_score" DESC);

-- ── 6. interest_profiles ─────────────────────────────────────────────────────

CREATE TABLE "interest_profiles" (
    "id"                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"             UUID    NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "user_id"             UUID    NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "hobbies"             JSONB   DEFAULT '[]',
    "interests"           JSONB   DEFAULT '[]',
    "health_conditions"   JSONB   DEFAULT '[]',
    "fitness_assessment"  JSONB   DEFAULT '{}',
    "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMPTZ,

    CONSTRAINT "uq_interest_profile" UNIQUE ("trip_id", "user_id")
);

CREATE INDEX "idx_ip_trip"           ON "interest_profiles" ("trip_id");
CREATE INDEX "idx_ip_hobbies_gin"    ON "interest_profiles" USING GIN ("hobbies");
CREATE INDEX "idx_ip_interests_gin"  ON "interest_profiles" USING GIN ("interests");

-- ── 7. health_requirements ───────────────────────────────────────────────────

CREATE TABLE "health_requirements" (
    "id"               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"          UUID             NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "destination_name" VARCHAR(255)     NOT NULL,
    "requirement_type" "RequirementType" NOT NULL,
    "description"      TEXT,
    "severity"         "Severity"       NOT NULL DEFAULT 'recommended',
    "acknowledged_by"  UUID[]           DEFAULT '{}',
    "created_at"       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_hr_trip"          ON "health_requirements" ("trip_id");
CREATE INDEX "idx_hr_trip_severity" ON "health_requirements" ("trip_id", "severity");

-- ── 8. points_of_interest ────────────────────────────────────────────────────

CREATE TABLE "points_of_interest" (
    "id"                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"                  UUID          NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "name"                     VARCHAR(255)  NOT NULL,
    "destination"              VARCHAR(255),
    "category"                 "POICategory" NOT NULL,
    "matched_hobbies"          TEXT[]        DEFAULT '{}',
    "estimated_duration_hours" DECIMAL(4,2),
    "cost_estimate"            DECIMAL(10,2),
    "currency"                 CHAR(3)       DEFAULT 'USD',
    "rating"                   DECIMAL(3,2)  CHECK ("rating" IS NULL OR ("rating" BETWEEN 0 AND 5)),
    "review_count"             INT           DEFAULT 0 CHECK ("review_count" >= 0),
    "approved"                 BOOLEAN       NOT NULL DEFAULT false,
    "google_place_id"          VARCHAR(255),
    "created_at"               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_poi_trip"          ON "points_of_interest" ("trip_id");
CREATE INDEX "idx_poi_trip_cat"      ON "points_of_interest" ("trip_id", "category");
CREATE INDEX "idx_poi_hobbies_gin"   ON "points_of_interest" USING GIN ("matched_hobbies");
CREATE INDEX "idx_poi_google_place"  ON "points_of_interest" ("google_place_id") WHERE "google_place_id" IS NOT NULL;

-- ── 9. trip_budget ───────────────────────────────────────────────────────────

CREATE TABLE "trip_budget" (
    "trip_id"               UUID PRIMARY KEY REFERENCES "trips"("id") ON DELETE CASCADE,
    "daily_budget"          DECIMAL(10,2)  NOT NULL CHECK ("daily_budget" >= 0),
    "currency"              CHAR(3)        NOT NULL DEFAULT 'USD',
    "total_days"            INT            NOT NULL CHECK ("total_days" > 0),
    "total_budget_computed" DECIMAL(12,2)  GENERATED ALWAYS AS ("daily_budget" * "total_days") STORED,
    "flights_allocated"     DECIMAL(10,2)  DEFAULT 0 CHECK ("flights_allocated" >= 0),
    "stays_allocated"       DECIMAL(10,2)  DEFAULT 0 CHECK ("stays_allocated" >= 0),
    "food_allocated"        DECIMAL(10,2)  DEFAULT 0 CHECK ("food_allocated" >= 0),
    "activities_allocated"  DECIMAL(10,2)  DEFAULT 0 CHECK ("activities_allocated" >= 0),
    "buffer_allocated"      DECIMAL(10,2)  DEFAULT 0 CHECK ("buffer_allocated" >= 0),
    "needs_increase"        BOOLEAN        NOT NULL DEFAULT false,
    "suggested_increase"    DECIMAL(10,2)  DEFAULT 0,
    "created_at"            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    "updated_at"            TIMESTAMPTZ
);

-- ── 10. flight_searches ──────────────────────────────────────────────────────

CREATE TABLE "flight_searches" (
    "id"                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"              UUID         NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "origin_airport"       CHAR(3)      NOT NULL,
    "destination_airport"  CHAR(3)      NOT NULL,
    "departure_date"       DATE         NOT NULL,
    "return_date"          DATE,
    "cabin_class"          "CabinClass" NOT NULL DEFAULT 'economy',
    "preferred_airline"    VARCHAR(100),
    "best_price_only"      BOOLEAN      NOT NULL DEFAULT true,
    "price_range_min"      DECIMAL(10,2),
    "price_range_max"      DECIMAL(10,2),
    "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "chk_fs_dates" CHECK ("return_date" IS NULL OR "return_date" >= "departure_date"),
    CONSTRAINT "chk_fs_price" CHECK ("price_range_max" IS NULL OR "price_range_max" >= "price_range_min")
);

CREATE INDEX "idx_fs_trip" ON "flight_searches" ("trip_id");

-- ── 11. flight_options ───────────────────────────────────────────────────────

CREATE TABLE "flight_options" (
    "id"               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "search_id"        UUID         NOT NULL REFERENCES "flight_searches"("id") ON DELETE CASCADE,
    "airline"          VARCHAR(100) NOT NULL,
    "flight_numbers"   TEXT,
    "departure_time"   TIMESTAMPTZ  NOT NULL,
    "arrival_time"     TIMESTAMPTZ  NOT NULL,
    "duration_minutes" INT          NOT NULL CHECK ("duration_minutes" > 0),
    "stops"            INT          NOT NULL DEFAULT 0 CHECK ("stops" >= 0),
    "price"            DECIMAL(10,2) NOT NULL CHECK ("price" > 0),
    "currency"         CHAR(3)      NOT NULL DEFAULT 'USD',
    "booking_url"      TEXT,
    "is_selected"      BOOLEAN      NOT NULL DEFAULT false,
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "chk_fo_times" CHECK ("arrival_time" > "departure_time")
);

CREATE INDEX "idx_fo_search"    ON "flight_options" ("search_id");
CREATE INDEX "idx_fo_price"     ON "flight_options" ("search_id", "price" ASC);
CREATE INDEX "idx_fo_selected"  ON "flight_options" ("search_id") WHERE "is_selected" = true;

-- ── 12. accommodations ───────────────────────────────────────────────────────

CREATE TABLE "accommodations" (
    "id"              UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"         UUID                 NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "name"            VARCHAR(255)         NOT NULL,
    "type"            "AccommodationType"  NOT NULL,
    "check_in"        DATE                 NOT NULL,
    "check_out"       DATE                 NOT NULL,
    "nightly_rate"    DECIMAL(10,2)        NOT NULL CHECK ("nightly_rate" >= 0),
    "total_cost"      DECIMAL(10,2)        CHECK ("total_cost" >= 0),
    "currency"        CHAR(3)              NOT NULL DEFAULT 'USD',
    "rating"          DECIMAL(3,2)         CHECK ("rating" IS NULL OR ("rating" BETWEEN 0 AND 5)),
    "review_summary"  TEXT,
    "address"         TEXT,
    "latitude"        DECIMAL(10,8),
    "longitude"       DECIMAL(11,8),
    "amenities"       JSONB                DEFAULT '[]',
    "is_selected"     BOOLEAN              NOT NULL DEFAULT false,
    "created_at"      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

    CONSTRAINT "chk_accom_dates" CHECK ("check_out" > "check_in"),
    CONSTRAINT "chk_accom_lat"   CHECK ("latitude" IS NULL OR ("latitude" BETWEEN -90 AND 90)),
    CONSTRAINT "chk_accom_lng"   CHECK ("longitude" IS NULL OR ("longitude" BETWEEN -180 AND 180))
);

CREATE INDEX "idx_accom_trip"     ON "accommodations" ("trip_id");
CREATE INDEX "idx_accom_selected" ON "accommodations" ("trip_id") WHERE "is_selected" = true;

-- ── 13. dining_suggestions ───────────────────────────────────────────────────

CREATE TABLE "dining_suggestions" (
    "id"               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"          UUID          NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "itinerary_day"    INT           NOT NULL CHECK ("itinerary_day" > 0),
    "meal_type"        "MealType"    NOT NULL,
    "restaurant_name"  VARCHAR(255)  NOT NULL,
    "cuisine_type"     VARCHAR(100),
    "price_range"      "PriceRange",
    "rating"           DECIMAL(3,2)  CHECK ("rating" IS NULL OR ("rating" BETWEEN 0 AND 5)),
    "review_count"     INT           DEFAULT 0 CHECK ("review_count" >= 0),
    "local_favorite"   BOOLEAN       DEFAULT false,
    "dietary_friendly" TEXT[]        DEFAULT '{}',
    "address"          TEXT,
    "google_place_id"  VARCHAR(255),
    "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_ds_trip_day"      ON "dining_suggestions" ("trip_id", "itinerary_day");
CREATE INDEX "idx_ds_dietary_gin"   ON "dining_suggestions" USING GIN ("dietary_friendly");

-- ── 14. itinerary_days ───────────────────────────────────────────────────────

CREATE TABLE "itinerary_days" (
    "id"         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"    UUID          NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "day_number" INT           NOT NULL CHECK ("day_number" > 0),
    "date"       DATE          NOT NULL,
    "theme"      VARCHAR(255),

    CONSTRAINT "uq_itinerary_day" UNIQUE ("trip_id", "day_number")
);

CREATE INDEX "idx_id_trip_day" ON "itinerary_days" ("trip_id", "day_number");

-- ── 15. itinerary_items ──────────────────────────────────────────────────────

CREATE TABLE "itinerary_items" (
    "id"            UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    "day_id"        UUID                 NOT NULL REFERENCES "itinerary_days"("id") ON DELETE CASCADE,
    "start_time"    TIME,
    "end_time"      TIME,
    "item_type"     "ItineraryItemType"  NOT NULL,
    "title"         VARCHAR(255)         NOT NULL,
    "description"   TEXT,
    "location"      VARCHAR(255),
    "cost_estimate" DECIMAL(10,2)        DEFAULT 0 CHECK ("cost_estimate" >= 0),
    "notes"         TEXT,
    "sort_order"    INT                  NOT NULL DEFAULT 0,

    CONSTRAINT "chk_ii_times" CHECK ("end_time" IS NULL OR "end_time" > "start_time")
);

CREATE INDEX "idx_ii_day_sort" ON "itinerary_items" ("day_id", "sort_order");

-- ── 16. storyboard_posts ─────────────────────────────────────────────────────

CREATE TABLE "storyboard_posts" (
    "id"           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
    "trip_id"      UUID             NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
    "user_id"      UUID             NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "platform"     "SocialPlatform" NOT NULL,
    "caption"      TEXT,
    "media_urls"   TEXT[]           DEFAULT '{}',
    "hashtags"     TEXT[]           DEFAULT '{}',
    "style_preset" VARCHAR(50),
    "generated_at" TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    "posted"       BOOLEAN          NOT NULL DEFAULT false,
    "posted_at"    TIMESTAMPTZ
);

CREATE INDEX "idx_sp_trip" ON "storyboard_posts" ("trip_id");
CREATE INDEX "idx_sp_user" ON "storyboard_posts" ("user_id");
CREATE INDEX "idx_sp_posted" ON "storyboard_posts" ("trip_id", "platform") WHERE "posted" = true;

-- ── 17. analytics_events ─────────────────────────────────────────────────────

CREATE TABLE "analytics_events" (
    "id"          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id"     UUID         REFERENCES "users"("id") ON DELETE SET NULL,
    "trip_id"     UUID         REFERENCES "trips"("id") ON DELETE SET NULL,
    "screen_name" VARCHAR(100) NOT NULL,
    "event_type"  VARCHAR(50)  NOT NULL,
    "event_data"  JSONB        DEFAULT '{}',
    "created_at"  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_ae_screen_event_time" ON "analytics_events" ("screen_name", "event_type", "created_at" DESC);
CREATE INDEX "idx_ae_user"              ON "analytics_events" ("user_id", "created_at" DESC);
CREATE INDEX "idx_ae_trip"              ON "analytics_events" ("trip_id", "created_at" DESC);
CREATE INDEX "idx_ae_event_data_gin"    ON "analytics_events" USING GIN ("event_data");

-- ── Auto-update trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON "user_profiles" FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_trips_updated_at
    BEFORE UPDATE ON "trips" FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_interest_profiles_updated_at
    BEFORE UPDATE ON "interest_profiles" FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE TRIGGER trg_trip_budget_updated_at
    BEFORE UPDATE ON "trip_budget" FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
