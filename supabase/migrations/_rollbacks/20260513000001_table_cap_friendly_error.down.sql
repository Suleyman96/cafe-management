-- Drop the friendly trigger + function added by 20260513000001.
DROP TRIGGER IF EXISTS enforce_table_cap_trigger ON public.tables;
DROP FUNCTION IF EXISTS public.enforce_table_cap();

-- Recreate the redundant baseline trigger that was dropped by the
-- forward migration. The function it points at (check_table_limit) was
-- intentionally not dropped by the forward migration so it still
-- exists at the version most recently installed (baseline /
-- 20260430000002 / 20260515000001, whichever last ran).
--
-- Rolling back to "two triggers fire on every insert" is a known
-- regression — only do this if the friendly trigger is causing
-- unexpected problems and you need the legacy behavior temporarily.
CREATE TRIGGER enforce_table_limit
  BEFORE INSERT ON public.tables
  FOR EACH ROW
  EXECUTE FUNCTION public.check_table_limit();
