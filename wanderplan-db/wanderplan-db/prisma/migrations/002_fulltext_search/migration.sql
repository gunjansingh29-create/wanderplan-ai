-- Migration 002: Full-Text Search & Fuzzy Matching
-- tsvector columns on bucket_list_items + points_of_interest
-- pg_trgm extension for fuzzy name matching
-- ============================================================================

-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ═══════════════════════════════════════════════════════════════════════════
-- BUCKET LIST ITEMS — full-text search on destination_name + country
-- ═══════════════════════════════════════════════════════════════════════════

-- Add tsvector column
ALTER TABLE "bucket_list_items"
    ADD COLUMN "search_vector" TSVECTOR;

-- Populate existing rows
UPDATE "bucket_list_items"
SET "search_vector" = 
    setweight(to_tsvector('english', COALESCE("destination_name", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE("country", '')), 'B');

-- GIN index for full-text search
CREATE INDEX "idx_bl_search_vector"
    ON "bucket_list_items" USING GIN ("search_vector");

-- Trigram index for fuzzy matching on destination_name
CREATE INDEX "idx_bl_destination_trgm"
    ON "bucket_list_items" USING GIN ("destination_name" gin_trgm_ops);

-- Auto-update trigger for search_vector
CREATE OR REPLACE FUNCTION fn_bl_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', COALESCE(NEW."destination_name", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW."country", '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bl_search_vector
    BEFORE INSERT OR UPDATE OF "destination_name", "country"
    ON "bucket_list_items"
    FOR EACH ROW
    EXECUTE FUNCTION fn_bl_search_vector_update();


-- ═══════════════════════════════════════════════════════════════════════════
-- POINTS OF INTEREST — full-text search on name + destination + category
-- ═══════════════════════════════════════════════════════════════════════════

-- Add tsvector column
ALTER TABLE "points_of_interest"
    ADD COLUMN "search_vector" TSVECTOR;

-- Populate existing rows
UPDATE "points_of_interest"
SET "search_vector" =
    setweight(to_tsvector('english', COALESCE("name", '')), 'A') ||
    setweight(to_tsvector('english', COALESCE("destination", '')), 'B') ||
    setweight(to_tsvector('english', COALESCE("category"::TEXT, '')), 'C');

-- GIN index for full-text search
CREATE INDEX "idx_poi_search_vector"
    ON "points_of_interest" USING GIN ("search_vector");

-- Trigram index for fuzzy matching on POI name
CREATE INDEX "idx_poi_name_trgm"
    ON "points_of_interest" USING GIN ("name" gin_trgm_ops);

-- Trigram index on destination for autocomplete
CREATE INDEX "idx_poi_destination_trgm"
    ON "points_of_interest" USING GIN ("destination" gin_trgm_ops);

-- Auto-update trigger for search_vector
CREATE OR REPLACE FUNCTION fn_poi_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
    NEW."search_vector" :=
        setweight(to_tsvector('english', COALESCE(NEW."name", '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW."destination", '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW."category"::TEXT, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_poi_search_vector
    BEFORE INSERT OR UPDATE OF "name", "destination", "category"
    ON "points_of_interest"
    FOR EACH ROW
    EXECUTE FUNCTION fn_poi_search_vector_update();


-- ═══════════════════════════════════════════════════════════════════════════
-- UTILITY FUNCTIONS — reusable search helpers
-- ═══════════════════════════════════════════════════════════════════════════

-- Full-text search on bucket list items
CREATE OR REPLACE FUNCTION search_bucket_list(
    p_trip_id UUID,
    p_query   TEXT,
    p_limit   INT DEFAULT 20
)
RETURNS TABLE (
    id               UUID,
    destination_name VARCHAR,
    country          VARCHAR,
    rank_score       DECIMAL,
    search_rank      REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        b."id",
        b."destination_name",
        b."country",
        b."rank_score",
        ts_rank_cd(b."search_vector", websearch_to_tsquery('english', p_query)) AS search_rank
    FROM "bucket_list_items" b
    WHERE b."trip_id" = p_trip_id
      AND b."search_vector" @@ websearch_to_tsquery('english', p_query)
    ORDER BY search_rank DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fuzzy name search across POIs (typo-tolerant)
CREATE OR REPLACE FUNCTION fuzzy_search_pois(
    p_trip_id    UUID,
    p_query      TEXT,
    p_threshold  REAL DEFAULT 0.3,
    p_limit      INT  DEFAULT 20
)
RETURNS TABLE (
    id          UUID,
    name        VARCHAR,
    destination VARCHAR,
    category    "POICategory",
    similarity  REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p."id",
        p."name",
        p."destination",
        p."category",
        similarity(p."name", p_query) AS sim
    FROM "points_of_interest" p
    WHERE p."trip_id" = p_trip_id
      AND similarity(p."name", p_query) > p_threshold
    ORDER BY sim DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Combined: full-text + fuzzy fallback
CREATE OR REPLACE FUNCTION search_pois_smart(
    p_trip_id UUID,
    p_query   TEXT,
    p_limit   INT DEFAULT 20
)
RETURNS TABLE (
    id          UUID,
    name        VARCHAR,
    destination VARCHAR,
    category    "POICategory",
    score       REAL
) AS $$
BEGIN
    -- Try full-text first
    RETURN QUERY
    SELECT
        p."id", p."name", p."destination", p."category",
        ts_rank_cd(p."search_vector", websearch_to_tsquery('english', p_query))::REAL AS score
    FROM "points_of_interest" p
    WHERE p."trip_id" = p_trip_id
      AND p."search_vector" @@ websearch_to_tsquery('english', p_query)
    ORDER BY score DESC
    LIMIT p_limit;

    -- If no full-text results, fall back to fuzzy
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            p."id", p."name", p."destination", p."category",
            similarity(p."name", p_query) AS score
        FROM "points_of_interest" p
        WHERE p."trip_id" = p_trip_id
          AND similarity(p."name", p_query) > 0.2
        ORDER BY score DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;
