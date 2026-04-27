-- ============================================================
-- SCALE-26: Database monitoring functions
-- Surfaces pg_stat_statements, connection stats, and table sizes
-- via SECURITY DEFINER functions granted only to service_role.
-- ============================================================

-- Top slow queries by average execution time
CREATE OR REPLACE FUNCTION public.get_slow_queries(p_limit INT DEFAULT 10)
RETURNS TABLE(
  query_preview TEXT,
  calls BIGINT,
  avg_ms NUMERIC,
  max_ms NUMERIC,
  total_ms NUMERIC,
  rows_per_call NUMERIC
) AS $$
  SELECT
    LEFT(query, 120) AS query_preview,
    calls,
    ROUND(mean_exec_time::NUMERIC, 2) AS avg_ms,
    ROUND(max_exec_time::NUMERIC, 2) AS max_ms,
    ROUND(total_exec_time::NUMERIC, 2) AS total_ms,
    ROUND(rows::NUMERIC / NULLIF(calls, 0), 1) AS rows_per_call
  FROM extensions.pg_stat_statements
  WHERE calls > 5
    AND query NOT LIKE '%pg_stat%'
  ORDER BY mean_exec_time DESC
  LIMIT p_limit;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

-- Active connection summary
CREATE OR REPLACE FUNCTION public.get_connection_stats()
RETURNS TABLE(
  state TEXT,
  connection_count BIGINT,
  oldest_query_seconds NUMERIC
) AS $$
  SELECT
    COALESCE(state, 'unknown') AS state,
    COUNT(*) AS connection_count,
    ROUND(EXTRACT(EPOCH FROM MAX(NOW() - query_start))::NUMERIC, 1) AS oldest_query_seconds
  FROM pg_stat_activity
  WHERE pid != pg_backend_pid()
  GROUP BY state;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

-- Table size and row estimates
CREATE OR REPLACE FUNCTION public.get_table_stats()
RETURNS TABLE(
  table_name TEXT,
  estimated_rows BIGINT,
  total_size TEXT,
  index_size TEXT
) AS $$
  SELECT
    relname::TEXT AS table_name,
    reltuples::BIGINT AS estimated_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS index_size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND reltuples > 0
  ORDER BY pg_total_relation_size(c.oid) DESC
  LIMIT 20;
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '';

-- Grant to service_role only
GRANT EXECUTE ON FUNCTION public.get_slow_queries(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_connection_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_table_stats() TO service_role;
