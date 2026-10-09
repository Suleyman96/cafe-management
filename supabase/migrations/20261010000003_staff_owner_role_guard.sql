-- L1 (defense-in-depth): only an `owner` may grant the `owner` role.
--
-- The POST /api/v1/staff route now rejects an `admin` creating an `owner`
-- (owner-grants-owner, checked in app code against the verified staff role).
-- But that guard only covers the service-role *create* route. Staff edits —
-- `db.staff.update(id, { role: 'owner' })` from the web/mobile edit modals, and
-- `db.staff.create(...)` — go through the AUTHENTICATED client under RLS, and
-- the staff RLS policies ("Admins can insert/update staff in tenant",
-- migration 20260501000002) permit admin OR owner with NO restriction on the
-- target row's `role`. So a plain admin could still mint/promote an `owner`
-- directly through the wrapper, bypassing the route guard entirely.
--
-- This closes that path at the database — the single chokepoint every write
-- (route, wrapper, raw PostgREST) passes through. A BEFORE INSERT OR UPDATE
-- trigger blocks any transition *to* `owner` performed by a caller whose own
-- staff role is not `owner`.
--
-- Scope: only AUTHENTICATED (session) callers are constrained. Service-role
-- server code (auth.uid() IS NULL) is the trusted boundary — the create route
-- already enforces owner-grants-owner there, and seed/admin tooling provisions
-- the first owner that way. Mirroring the app guard at the data layer rather
-- than duplicating it keeps the two in agreement.
--
-- Error contract: raises SQLSTATE 42501 (insufficient_privilege) with the
-- `owner_role_requires_owner` sentinel (SENTINEL_ERROR_CODES / errors.json), so
-- `handleSupabaseError` maps it to `AuthorizationError('owner_role_requires_owner')`
-- (403) and the client localizes it — identical to the route's thrown error.
--
-- No table shapes change, so generated types are unaffected.

CREATE OR REPLACE FUNCTION "public"."enforce_owner_grant_requires_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  -- Trusted server context (service-role / no session): the create route and
  -- seed tooling guard owner-grants-owner in app code. Let it through.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only constrain a transition INTO owner. An admin editing an existing
  -- owner's other fields (name/phone/is_active) leaves role unchanged and is
  -- unaffected; only promoting a non-owner to owner is gated.
  IF NEW.role = 'owner'
     AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM 'owner')
     AND public.get_my_staff_role() IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'owner_role_requires_owner'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."enforce_owner_grant_requires_owner"() OWNER TO "postgres";

DROP TRIGGER IF EXISTS "enforce_owner_grant_requires_owner" ON "public"."staff";
CREATE TRIGGER "enforce_owner_grant_requires_owner"
  BEFORE INSERT OR UPDATE OF "role" ON "public"."staff"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."enforce_owner_grant_requires_owner"();
