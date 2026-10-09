-- H1 (defense-in-depth): tenant-scope the table-status trigger.
--
-- `update_table_status_on_order()` (baseline) updates `public.tables` using
-- only `WHERE id = NEW.table_id`. The orders insert path uses the service-role
-- client (RLS bypassed), so a crafted `table_id` pointing at ANOTHER tenant's
-- table would flip that row's status/current_session_id — cross-tenant state
-- corruption. The route/service now rejects cross-tenant `table_id` at the
-- boundary (primary fix); this migration adds the belt-and-suspenders DB guard
-- so the trigger can NEVER touch a table outside the order's tenant, regardless
-- of how the row was inserted.
--
-- Faithful CREATE OR REPLACE of the baseline body — identical behavior, with the
-- single addition of `AND tenant_id = NEW.tenant_id` on both UPDATE statements.
-- No table shapes change, so generated types are unaffected.

CREATE OR REPLACE FUNCTION "public"."update_table_status_on_order"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.tables
    SET
      status = 'occupied',
      occupied_at = NOW(),
      current_session_id = NEW.id
    WHERE id = NEW.table_id
      AND tenant_id = NEW.tenant_id
      AND status != 'closed';
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status != 'closed' THEN
    UPDATE public.tables
    SET
      status = 'free',
      current_session_id = NULL
    WHERE id = NEW.table_id
      AND tenant_id = NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;
