-- ============================================================================
-- WanderPlan AI — 10 Critical Queries with EXPLAIN ANALYZE
-- Each query includes: purpose, SQL, expected plan, optimization notes
-- ============================================================================


-- ═══════════════════════════════════════════════════════════════════════════
-- Q1: Find overlapping availability dates across N trip members
-- Used by: Scheduling Agent to find common windows
-- ═══════════════════════════════════════════════════════════════════════════

-- Find the intersection of all members' availability for a given trip
EXPLAIN ANALYZE
WITH member_ranges AS (
    SELECT
        user_id,
        availability_start,
        availability_end
    FROM trip_members
    WHERE trip_id = '{{trip_id}}'
      AND invitation_status = 'accepted'
      AND availability_start IS NOT NULL
      AND availability_end IS NOT NULL
      AND deleted_at IS NULL
)
SELECT
    GREATEST(MAX(availability_start), MIN(availability_start)) AS overlap_start,
    LEAST(MIN(availability_end), MAX(availability_end))        AS overlap_end,
    COUNT(*)                                                    AS member_count,
    LEAST(MIN(availability_end), MAX(availability_end))
      - GREATEST(MAX(availability_start), MIN(availability_start)) AS overlap_days
FROM member_ranges
HAVING LEAST(MIN(availability_end)) >= GREATEST(MAX(availability_start));

/*
EXPECTED PLAN:
  Aggregate (cost=8.30..8.32)
    -> Index Scan using pk_trip_members on trip_members (cost=0.28..8.20 rows=4)
         Index Cond: (trip_id = '...')
         Filter: (invitation_status = 'accepted' AND availability_start IS NOT NULL ...)

OPTIMIZATION:
  ✓ Uses PK composite index (trip_id, user_id)
  ✓ Inline filter on status — no additional index needed for small N members
  ✓ Single-pass aggregate — O(N) where N = member count (typically 2-10)
*/


-- Q1b: Pairwise overlap matrix (for N > 2 groups finding partial overlaps)
EXPLAIN ANALYZE
SELECT
    a.user_id  AS user_a,
    b.user_id  AS user_b,
    GREATEST(a.availability_start, b.availability_start) AS overlap_start,
    LEAST(a.availability_end, b.availability_end)        AS overlap_end,
    LEAST(a.availability_end, b.availability_end)
      - GREATEST(a.availability_start, b.availability_start) AS overlap_days
FROM trip_members a
JOIN trip_members b
    ON a.trip_id = b.trip_id
   AND a.user_id < b.user_id
WHERE a.trip_id = '{{trip_id}}'
  AND a.invitation_status = 'accepted'
  AND b.invitation_status = 'accepted'
  AND a.availability_start IS NOT NULL
  AND b.availability_start IS NOT NULL
  AND a.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND a.availability_start <= b.availability_end
  AND b.availability_start <= a.availability_end
ORDER BY overlap_days DESC;

/*
EXPECTED PLAN:
  Sort (cost=12..12 rows=6)
    -> Nested Loop (cost=0.56..11 rows=6)
         -> Index Scan on trip_members a (cost=0.28..4 rows=4)
         -> Index Scan on trip_members b (cost=0.28..2 rows=2)
              Filter: (a.user_id < b.user_id AND ranges overlap)

OPTIMIZATION:
  ✓ Self-join on PK — both sides use the same composite index
  ✓ a.user_id < b.user_id eliminates duplicate pairs
  ✓ For large groups (>20), consider a range_agg() approach or daterange && operator
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q2: Search POIs matching group interests sorted by relevance score
-- Used by: POI Discovery Agent
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
WITH group_hobbies AS (
    -- Aggregate unique hobbies from all accepted trip members
    SELECT DISTINCT unnest(up.hobbies) AS hobby
    FROM trip_members tm
    JOIN user_profiles up ON up.user_id = tm.user_id
    WHERE tm.trip_id = '{{trip_id}}'
      AND tm.invitation_status = 'accepted'
      AND tm.deleted_at IS NULL
)
SELECT
    poi.id,
    poi.name,
    poi.category,
    poi.rating,
    poi.cost_estimate,
    poi.estimated_duration_hours,
    -- Relevance: (matched hobby count / total group hobbies) * rating * log(review_count)
    (
        CARDINALITY(
            ARRAY(SELECT unnest(poi.matched_hobbies) INTERSECT SELECT hobby FROM group_hobbies)
        )::FLOAT
        / GREATEST(1, (SELECT COUNT(*) FROM group_hobbies))
    ) * COALESCE(poi.rating, 3.0) * LN(GREATEST(poi.review_count, 2)) AS relevance_score
FROM points_of_interest poi
WHERE poi.trip_id = '{{trip_id}}'
  AND poi.approved = true
  AND poi.deleted_at IS NULL
  AND poi.matched_hobbies && ARRAY(SELECT hobby FROM group_hobbies)  -- GIN overlap
ORDER BY relevance_score DESC
LIMIT 50;

/*
EXPECTED PLAN:
  Limit (cost=45..46 rows=50)
    -> Sort (cost=45..46)
      -> Bitmap Heap Scan on points_of_interest (cost=20..40 rows=200)
           Recheck Cond: (matched_hobbies && '{hiking,photography,...}')
           Filter: (trip_id = '...' AND approved AND deleted_at IS NULL)
           -> Bitmap Index Scan on idx_poi_hobbies_gin (cost=0..20)

OPTIMIZATION:
  ✓ GIN index on matched_hobbies enables fast && (overlap) operator
  ✓ Pre-aggregated group hobbies via CTE (computed once)
  ✓ Relevance scoring done in-database to avoid transferring unranked rows
  ✓ LIMIT 50 terminates sort early (top-N heap sort)
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q3: Get full itinerary with all items for a trip
-- Used by: Itinerary display, export, calendar sync
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    id_day.id          AS day_id,
    id_day.day_number,
    id_day.date,
    id_day.theme,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'item_id',    ii.id,
                'start_time', ii.start_time,
                'end_time',   ii.end_time,
                'type',       ii.item_type,
                'title',      ii.title,
                'location',   ii.location,
                'cost',       ii.cost_estimate,
                'notes',      ii.notes
            ) ORDER BY ii.sort_order
        ) FILTER (WHERE ii.id IS NOT NULL),
        '[]'::jsonb
    ) AS items,
    COALESCE(SUM(ii.cost_estimate), 0) AS day_total_cost,
    COUNT(ii.id)                        AS item_count
FROM itinerary_days id_day
LEFT JOIN itinerary_items ii ON ii.day_id = id_day.id
WHERE id_day.trip_id = '{{trip_id}}'
  AND id_day.deleted_at IS NULL
GROUP BY id_day.id, id_day.day_number, id_day.date, id_day.theme
ORDER BY id_day.day_number;

/*
EXPECTED PLAN:
  Sort (cost=50..51 rows=10)
    -> HashAggregate (cost=40..48 rows=10)
      -> Nested Loop Left Join (cost=1..35 rows=60)
           -> Index Scan on itinerary_days (cost=0.28..8 rows=10)
                Index Cond: (trip_id = '...')
                Filter: (deleted_at IS NULL)
           -> Index Scan on itinerary_items (cost=0.28..3 rows=6)
                Index Cond: (day_id = id_day.id)

OPTIMIZATION:
  ✓ Uses idx_id_trip_day for ordered day scan
  ✓ Nested loop with inner index scan on itinerary_items(day_id, sort_order)
  ✓ JSON aggregation in DB avoids N+1 queries from ORM
  ✓ FILTER clause handles empty days gracefully
  ✓ For trips with 30+ days: consider adding LIMIT with cursor pagination
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q4: Budget breakdown — actual vs. allocated per category
-- Used by: Budget Agent, dashboard
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    tb.trip_id,
    tb.total_budget_computed   AS total_budget,
    tb.currency,

    -- Allocated
    tb.flights_allocated,
    tb.stays_allocated,
    tb.food_allocated,
    tb.activities_allocated,
    tb.buffer_allocated,

    -- Actual spend per category
    COALESCE(flights_actual.total, 0)     AS flights_actual,
    COALESCE(stays_actual.total, 0)       AS stays_actual,
    COALESCE(dining_actual.total, 0)      AS dining_actual,
    COALESCE(activities_actual.total, 0)  AS activities_actual,

    -- Variance (positive = under budget)
    tb.flights_allocated    - COALESCE(flights_actual.total, 0)    AS flights_variance,
    tb.stays_allocated      - COALESCE(stays_actual.total, 0)      AS stays_variance,
    tb.food_allocated       - COALESCE(dining_actual.total, 0)     AS food_variance,
    tb.activities_allocated - COALESCE(activities_actual.total, 0) AS activities_variance,

    -- Overall
    tb.total_budget_computed - (
        COALESCE(flights_actual.total, 0) +
        COALESCE(stays_actual.total, 0) +
        COALESCE(dining_actual.total, 0) +
        COALESCE(activities_actual.total, 0)
    ) AS remaining_budget

FROM trip_budget tb

LEFT JOIN LATERAL (
    SELECT SUM(fo.price) AS total
    FROM flight_searches fs
    JOIN flight_options fo ON fo.search_id = fs.id AND fo.is_selected = true
    WHERE fs.trip_id = tb.trip_id AND fs.deleted_at IS NULL
) flights_actual ON true

LEFT JOIN LATERAL (
    SELECT SUM(a.total_cost) AS total
    FROM accommodations a
    WHERE a.trip_id = tb.trip_id AND a.is_selected = true AND a.deleted_at IS NULL
) stays_actual ON true

LEFT JOIN LATERAL (
    SELECT SUM(ii.cost_estimate) AS total
    FROM itinerary_items ii
    JOIN itinerary_days id ON id.id = ii.day_id
    WHERE id.trip_id = tb.trip_id AND ii.item_type = 'meal' AND id.deleted_at IS NULL
) dining_actual ON true

LEFT JOIN LATERAL (
    SELECT SUM(ii.cost_estimate) AS total
    FROM itinerary_items ii
    JOIN itinerary_days id ON id.id = ii.day_id
    WHERE id.trip_id = tb.trip_id AND ii.item_type = 'activity' AND id.deleted_at IS NULL
) activities_actual ON true

WHERE tb.trip_id = '{{trip_id}}';

/*
EXPECTED PLAN:
  Nested Loop Left Join (cost=2..30)
    -> Index Scan on trip_budget (cost=0.15..2 rows=1)
         Index Cond: (trip_id = '...')
    -> Aggregate (flights_actual via lateral)
         -> Nested Loop -> idx_fo_selected + idx_fs_trip
    -> Aggregate (stays_actual via lateral)
         -> Index Scan on idx_accom_selected
    -> Aggregate (dining_actual via lateral)
    -> Aggregate (activities_actual via lateral)

OPTIMIZATION:
  ✓ LATERAL subqueries compute each category independently — parallelizable
  ✓ Partial indexes (is_selected = true) on flight_options + accommodations
  ✓ Generated column total_budget_computed avoids runtime multiplication
  ✓ Single-row result (PK lookup on trip_budget) — extremely fast
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q5: Analytics — screen engagement metrics aggregation
-- Used by: Product analytics dashboard
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    screen_name,
    event_type,
    COUNT(*)                                     AS event_count,
    COUNT(DISTINCT user_id)                      AS unique_users,
    AVG((event_data->>'duration_ms')::NUMERIC)   AS avg_duration_ms,
    PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY (event_data->>'duration_ms')::NUMERIC
    )                                            AS median_duration_ms,
    date_trunc('day', created_at)                AS day
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND screen_name IN ('home', 'trip_planner', 'search', 'itinerary', 'budget')
GROUP BY screen_name, event_type, date_trunc('day', created_at)
ORDER BY day DESC, event_count DESC;

/*
EXPECTED PLAN:
  Sort (cost=800..810)
    -> HashAggregate (cost=500..700 rows=150)
      -> Index Scan on idx_ae_screen_event_time (cost=0.42..400 rows=5000)
           Index Cond: (screen_name = ANY (...) AND created_at >= ...)

OPTIMIZATION:
  ✓ Composite index (screen_name, event_type, created_at DESC) enables range scan
  ✓ JSONB field extraction with ->> is index-free but acceptable for aggregation
  ✓ For high-volume (>10M events): partition analytics_events by month
  ✓ Consider materialized view refreshed hourly for dashboard
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q6: Full-text search on POIs with fuzzy fallback
-- Used by: Search API endpoint
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    id, name, destination, category, rating, review_count,
    ts_rank_cd(search_vector, websearch_to_tsquery('english', '{{query}}')) AS rank
FROM points_of_interest
WHERE trip_id = '{{trip_id}}'
  AND search_vector @@ websearch_to_tsquery('english', '{{query}}')
  AND deleted_at IS NULL
ORDER BY rank DESC
LIMIT 20;

/*
EXPECTED PLAN:
  Limit (cost=20..22 rows=20)
    -> Sort (cost=20..21)
      -> Bitmap Heap Scan (cost=8..18 rows=50)
           Recheck Cond: (search_vector @@ ...)
           Filter: (trip_id = '...' AND deleted_at IS NULL)
           -> Bitmap Index Scan on idx_poi_search_vector (cost=0..8)

OPTIMIZATION:
  ✓ GIN index on search_vector for fast tsquery matching
  ✓ websearch_to_tsquery() handles natural language input safely
  ✓ Fallback to fuzzy_search_pois() if 0 results (handled in app layer)
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q7: User's active trips with member count and progress
-- Used by: Home dashboard
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    t.id,
    t.name,
    t.status,
    t.updated_at,
    tm.role AS my_role,
    member_stats.member_count,
    member_stats.accepted_count,
    COALESCE(tb.total_budget_computed, 0)  AS budget,
    COALESCE(tb.currency, 'USD')           AS currency,
    COALESCE(day_stats.total_days, 0)      AS itinerary_days
FROM trips t
JOIN trip_members tm ON tm.trip_id = t.id AND tm.user_id = '{{user_id}}'
LEFT JOIN trip_budget tb ON tb.trip_id = t.id
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS member_count,
        COUNT(*) FILTER (WHERE invitation_status = 'accepted') AS accepted_count
    FROM trip_members WHERE trip_id = t.id AND deleted_at IS NULL
) member_stats ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total_days
    FROM itinerary_days WHERE trip_id = t.id AND deleted_at IS NULL
) day_stats ON true
WHERE t.deleted_at IS NULL
  AND tm.invitation_status = 'accepted'
  AND tm.deleted_at IS NULL
ORDER BY t.updated_at DESC NULLS LAST
LIMIT 20;

/*
OPTIMIZATION:
  ✓ Starts from trip_members filtered by user_id (idx_trip_members_user_id)
  ✓ LATERAL aggregates scoped per-trip — avoids large GROUP BY
  ✓ LIMIT 20 for pagination — add cursor on t.updated_at for next page
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q8: Dining suggestions filtered by dietary requirements
-- Used by: Dining Agent
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    ds.id,
    ds.restaurant_name,
    ds.cuisine_type,
    ds.price_range,
    ds.rating,
    ds.local_favorite,
    ds.dietary_friendly,
    ds.itinerary_day,
    ds.meal_type
FROM dining_suggestions ds
WHERE ds.trip_id = '{{trip_id}}'
  AND ds.dietary_friendly @> ARRAY['{{dietary_tag}}']   -- must support this dietary need
  AND ds.deleted_at IS NULL
ORDER BY ds.itinerary_day, ds.meal_type, ds.rating DESC;

/*
EXPECTED PLAN:
  Sort (cost=15..16)
    -> Bitmap Heap Scan (cost=4..12 rows=20)
         Recheck Cond: (dietary_friendly @> '{vegan}')
         Filter: (trip_id = '...' AND deleted_at IS NULL)
         -> Bitmap Index Scan on idx_ds_dietary_gin

OPTIMIZATION:
  ✓ GIN index on dietary_friendly enables @> (contains) filtering
  ✓ Combined with trip_id filter for selectivity
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q9: Flight search — best options by price with stop preference
-- Used by: Flight Agent
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    fo.id,
    fo.airline,
    fo.flight_numbers,
    fo.departure_time,
    fo.arrival_time,
    fo.duration_minutes,
    fo.stops,
    fo.price,
    fo.currency,
    fo.booking_url,
    -- Score: normalize price and stops into 0-100
    (100 - (fo.price / NULLIF(MAX(fo.price) OVER (), 0)) * 70
         - fo.stops * 10) AS value_score
FROM flight_options fo
JOIN flight_searches fs ON fs.id = fo.search_id
WHERE fs.trip_id = '{{trip_id}}'
  AND fo.deleted_at IS NULL
  AND fs.deleted_at IS NULL
ORDER BY value_score DESC, fo.price ASC
LIMIT 10;

/*
OPTIMIZATION:
  ✓ Index on flight_options(search_id, price ASC)
  ✓ Window function for relative scoring avoids subquery
  ✓ LIMIT 10 for top results only
*/


-- ═══════════════════════════════════════════════════════════════════════════
-- Q10: Audit trail — recent changes to a trip
-- Used by: Activity feed, conflict resolution
-- ═══════════════════════════════════════════════════════════════════════════

EXPLAIN ANALYZE
SELECT
    al.id,
    al.table_name,
    al.record_id,
    al.action,
    al.changed_at,
    u.first_name || ' ' || u.last_name AS changed_by_name,
    CASE
        WHEN al.action = 'UPDATE' THEN
            jsonb_diff(al.old_data, al.new_data)
        ELSE al.new_data
    END AS changes
FROM audit_log al
LEFT JOIN users u ON u.id = al.changed_by
WHERE al.record_id IN (
    -- All record IDs related to this trip
    SELECT id FROM itinerary_days WHERE trip_id = '{{trip_id}}'
    UNION ALL
    SELECT trip_id FROM trip_budget WHERE trip_id = '{{trip_id}}'
)
   OR (al.table_name = 'trips' AND al.record_id = '{{trip_id}}')
ORDER BY al.changed_at DESC
LIMIT 50;

/*
NOTE: jsonb_diff is a custom function — create if needed:

CREATE OR REPLACE FUNCTION jsonb_diff(old_data JSONB, new_data JSONB)
RETURNS JSONB AS $$
    SELECT jsonb_object_agg(key, value)
    FROM jsonb_each(new_data)
    WHERE NOT old_data @> jsonb_build_object(key, value);
$$ LANGUAGE sql IMMUTABLE;

OPTIMIZATION:
  ✓ Index on audit_log(table_name, record_id) + (changed_at DESC)
  ✓ LIMIT 50 for pagination — use cursor on changed_at for next page
*/
