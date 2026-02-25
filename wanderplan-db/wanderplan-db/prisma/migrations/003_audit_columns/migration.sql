-- Migration 003: Audit Columns — Soft Delete + User Tracking
-- Adds created_by, updated_by, deleted_at to all trip-related tables
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- ADD AUDIT COLUMNS TO ALL TRIP-RELATED TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- List of trip-related tables getting audit columns:
--   trips, trip_members, bucket_list_items, interest_profiles,
--   health_requirements, points_of_interest, trip_budget,
--   flight_searches, flight_options, accommodations,
--   dining_suggestions, itinerary_days, itinerary_items,
--   storyboard_posts

DO $$
DECLARE
    tbl TEXT;
    tables_to_audit TEXT[] := ARRAY[
        'trips', 'bucket_list_items', 'interest_profiles',
        'health_requirements', 'points_of_interest', 'trip_budget',
        'flight_searches', 'flight_options', 'accommodations',
        'dining_suggestions', 'itinerary_days', 'itinerary_items',
        'storyboard_posts'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_audit
    LOOP
        -- created_by: who created this record (skip if column already exists)
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "created_by_user" UUID REFERENCES "users"("id") ON DELETE SET NULL',
            tbl
        );

        -- updated_by: who last modified this record
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "updated_by_user" UUID REFERENCES "users"("id") ON DELETE SET NULL',
            tbl
        );

        -- deleted_at: soft delete timestamp (NULL = active, non-NULL = deleted)
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL',
            tbl
        );

        -- Partial index for efficient filtering of non-deleted rows
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS "idx_%s_not_deleted" ON %I ("deleted_at") WHERE "deleted_at" IS NULL',
            tbl, tbl
        );

        RAISE NOTICE 'Audit columns added to: %', tbl;
    END LOOP;
END;
$$;

-- trip_members uses composite PK, handle separately
ALTER TABLE "trip_members" ADD COLUMN IF NOT EXISTS "created_by_user" UUID REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "trip_members" ADD COLUMN IF NOT EXISTS "updated_by_user" UUID REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "trip_members" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS "idx_trip_members_not_deleted" ON "trip_members" ("deleted_at") WHERE "deleted_at" IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- AUTO-SET updated_by_user TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════
-- Relies on app setting: SET LOCAL app.current_user_id = '<uuid>';

CREATE OR REPLACE FUNCTION fn_set_audit_fields()
RETURNS TRIGGER AS $$
DECLARE
    current_uid UUID;
BEGIN
    BEGIN
        current_uid := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        current_uid := NULL;
    END;

    IF TG_OP = 'INSERT' THEN
        -- Set created_by if not already set
        IF NEW."created_by_user" IS NULL THEN
            NEW."created_by_user" := current_uid;
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        NEW."updated_by_user" := current_uid;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to all audited tables
DO $$
DECLARE
    tbl TEXT;
    tables_to_audit TEXT[] := ARRAY[
        'trips', 'trip_members', 'bucket_list_items', 'interest_profiles',
        'health_requirements', 'points_of_interest', 'trip_budget',
        'flight_searches', 'flight_options', 'accommodations',
        'dining_suggestions', 'itinerary_days', 'itinerary_items',
        'storyboard_posts'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_audit
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_audit
             BEFORE INSERT OR UPDATE ON %I
             FOR EACH ROW EXECUTE FUNCTION fn_set_audit_fields()',
            tbl, tbl
        );
    END LOOP;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SOFT-DELETE HELPER FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

-- Soft-delete: sets deleted_at instead of actually deleting
CREATE OR REPLACE FUNCTION soft_delete(
    p_table     TEXT,
    p_id_column TEXT,
    p_id_value  UUID
)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET "deleted_at" = NOW() WHERE %I = $1 AND "deleted_at" IS NULL',
        p_table, p_id_column
    ) USING p_id_value;
END;
$$ LANGUAGE plpgsql;

-- Restore: un-deletes a soft-deleted record
CREATE OR REPLACE FUNCTION soft_restore(
    p_table     TEXT,
    p_id_column TEXT,
    p_id_value  UUID
)
RETURNS VOID AS $$
BEGIN
    EXECUTE format(
        'UPDATE %I SET "deleted_at" = NULL WHERE %I = $1 AND "deleted_at" IS NOT NULL',
        p_table, p_id_column
    ) USING p_id_value;
END;
$$ LANGUAGE plpgsql;

-- Hard-delete: permanently removes soft-deleted records older than N days
CREATE OR REPLACE FUNCTION purge_soft_deleted(
    p_table       TEXT,
    p_older_than  INTERVAL DEFAULT '90 days'
)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    EXECUTE format(
        'DELETE FROM %I WHERE "deleted_at" IS NOT NULL AND "deleted_at" < NOW() - $1',
        p_table
    ) USING p_older_than;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════
-- VIEW: Exclude soft-deleted rows for common query patterns
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW "active_trips" AS
    SELECT * FROM "trips" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "active_bucket_list_items" AS
    SELECT * FROM "bucket_list_items" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "active_points_of_interest" AS
    SELECT * FROM "points_of_interest" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "active_itinerary_days" AS
    SELECT * FROM "itinerary_days" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "active_accommodations" AS
    SELECT * FROM "accommodations" WHERE "deleted_at" IS NULL;

CREATE OR REPLACE VIEW "active_flight_options" AS
    SELECT * FROM "flight_options" WHERE "deleted_at" IS NULL;


-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT LOG TABLE (optional — full change history)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "audit_log" (
    "id"         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "table_name" VARCHAR(100) NOT NULL,
    "record_id"  UUID         NOT NULL,
    "action"     VARCHAR(10)  NOT NULL CHECK ("action" IN ('INSERT', 'UPDATE', 'DELETE')),
    "old_data"   JSONB,
    "new_data"   JSONB,
    "changed_by" UUID REFERENCES "users"("id") ON DELETE SET NULL,
    "changed_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_audit_log_table_record" ON "audit_log" ("table_name", "record_id");
CREATE INDEX "idx_audit_log_changed_at"   ON "audit_log" ("changed_at" DESC);
CREATE INDEX "idx_audit_log_changed_by"   ON "audit_log" ("changed_by");

-- Generic audit log trigger (attach to tables needing full history)
CREATE OR REPLACE FUNCTION fn_audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
    current_uid UUID;
    rec_id UUID;
BEGIN
    BEGIN
        current_uid := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        current_uid := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        rec_id := OLD."id";
        INSERT INTO "audit_log" ("table_name", "record_id", "action", "old_data", "changed_by")
        VALUES (TG_TABLE_NAME, rec_id, 'DELETE', to_jsonb(OLD), current_uid);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        rec_id := NEW."id";
        INSERT INTO "audit_log" ("table_name", "record_id", "action", "old_data", "new_data", "changed_by")
        VALUES (TG_TABLE_NAME, rec_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_uid);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        rec_id := NEW."id";
        INSERT INTO "audit_log" ("table_name", "record_id", "action", "new_data", "changed_by")
        VALUES (TG_TABLE_NAME, rec_id, 'INSERT', to_jsonb(NEW), current_uid);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Enable full audit logging on critical tables
CREATE TRIGGER trg_trips_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON "trips"
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();

CREATE TRIGGER trg_itinerary_days_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON "itinerary_days"
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();

CREATE TRIGGER trg_trip_budget_audit_log
    AFTER INSERT OR UPDATE OR DELETE ON "trip_budget"
    FOR EACH ROW EXECUTE FUNCTION fn_audit_log_trigger();
