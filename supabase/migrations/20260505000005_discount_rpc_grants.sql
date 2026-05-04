-- Grants for apply_discount_with_audit. See 20260505000004 for context.
-- Split from the function body for the same migration-splitter reason as
-- 20260505000003 / 20260504000004.

REVOKE ALL ON FUNCTION public.apply_discount_with_audit(
  UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.apply_discount_with_audit(
  UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID
) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_discount_with_audit(
  UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID
) TO service_role;

COMMENT ON FUNCTION public.apply_discount_with_audit(
  UUID, UUID, TEXT, NUMERIC, TEXT, UUID, UUID
) IS 'Atomic discount UPDATE + audit insert. Replaces the JS-side UPDATE-then-INSERT pair so a discount row and its discount_applied audit row commit together. Service-role only.';
