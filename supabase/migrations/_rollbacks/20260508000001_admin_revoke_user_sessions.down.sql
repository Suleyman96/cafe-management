-- Rollback for 20260508000001 + 20260508000002.
-- The grants migration contains REVOKE/GRANT only, which are safe to
-- leave dangling if the function no longer exists, so a single down
-- file covers both.

DROP FUNCTION IF EXISTS public.admin_revoke_user_sessions(UUID);
