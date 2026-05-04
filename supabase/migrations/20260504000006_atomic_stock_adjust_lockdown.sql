-- Migration: lock down EXECUTE on adjust_stock_atomic to service_role only.
--
-- Why this is a separate migration:
--   Supabase's `pg_default_acl` grants EXECUTE to anon, authenticated,
--   service_role, and postgres on every newly-created function. The
--   REVOKE FROM PUBLIC in 20260504000004 does NOT strip those explicit
--   per-role grants — it only affects the implicit PUBLIC grant. Without
--   stripping anon/authenticated, a user-context client could call the
--   function directly and pass a forged `p_tenant_id`, bypassing the
--   route handler's tenant verification. The function does check
--   `tenant_id` against the row inside the body — but only after the
--   `FOR UPDATE` lock is taken and the lookup happens, so there is still
--   a fingerprintable error path. Locking access at the GRANT level is
--   the cleaner contract.
--
-- Why a DO block:
--   The Supabase CLI's migration splitter treats multi-statement files
--   as multiple-commands-in-one-prepared-statement and rejects them with
--   SQLSTATE 42601. Wrapping multiple REVOKEs in a single `DO $$ … $$`
--   block keeps the file at one top-level statement.

DO $lockdown$
BEGIN
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) FROM authenticated';
  EXECUTE 'REVOKE EXECUTE ON FUNCTION public.adjust_stock_atomic(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID) FROM anon';
END
$lockdown$;
