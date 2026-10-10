-- ============================================================
-- DR hardening follow-up (MED-3): data-retention kill-switch flag
-- ============================================================
--
-- run_data_retention() permanently deletes financial + PII rows across EVERY
-- tenant. Per CLAUDE.md's Feature Flag Rule, an irreversible, platform-wide,
-- "kill without a deploy" operation must sit behind a flag whose ABSENT/default
-- state is the SAFE path (retention OFF). The POST /api/v1/admin/retention route
-- reads this flag server-side and NO-OPs unless it is explicitly enabled.
--
-- WHY A DEDICATED TABLE IN A NON-PUBLIC SCHEMA (not cafe_settings.feature_flags):
--   * cafe_settings.feature_flags is a PER-TENANT JSONB column; retention is a
--     single platform-wide RPC, so a per-tenant toggle has no coherent meaning
--     for it. This switch is global → one global row.
--   * It must NOT live in `public`: generate-types.sh introspects `--schema
--     public` only, so a new public table would force a generated.ts regen that
--     the DB-types drift gate blocks (and which can't be produced without a
--     local DB). A table in the `ops` schema never appears in the public type
--     surface, so generated.ts is untouched. The route reads it via the
--     service-role admin client with `.schema('ops')` (ops is exposed to
--     PostgREST in supabase/config.toml), and RLS keeps every other role out.
--
-- Default is OFF: the seed row is `enabled = false`, and the route also treats
-- an ABSENT row (or any read error) as disabled — fail-safe toward NOT deleting.

BEGIN;

CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE IF NOT EXISTS ops.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE ops.feature_flags IS
  'Platform-wide (NOT per-tenant) operational kill-switches, read server-side by service_role only. Per-tenant product flags live in cafe_settings.feature_flags.';

-- RLS: deny every client role. service_role (the route's admin client) has
-- BYPASSRLS, so it still reads the flag; authenticated/anon get nothing even
-- though `ops` is API-exposed. Restrictive + USING(false) = hard deny.
ALTER TABLE ops.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS feature_flags_deny_all ON ops.feature_flags;
CREATE POLICY feature_flags_deny_all ON ops.feature_flags
  AS RESTRICTIVE FOR ALL TO authenticated, anon
  USING (false) WITH CHECK (false);

-- service_role needs schema USAGE + table access to read the flag via PostgREST.
GRANT USAGE ON SCHEMA ops TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ops.feature_flags TO service_role;

-- Seed the kill-switch OFF. Idempotent: never clobber an operator who has
-- already flipped it on.
INSERT INTO ops.feature_flags (key, enabled, description)
VALUES (
  'data_retention_enabled',
  false,
  'Master switch for POST /api/v1/admin/retention. OFF until a restore drill '
  || 'has passed (see docs/backup-restore-runbook.md §5).'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
