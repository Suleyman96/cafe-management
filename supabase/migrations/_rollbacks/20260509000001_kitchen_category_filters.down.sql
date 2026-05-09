-- Rollback for 20260509000001_kitchen_category_filters.sql.
--
-- Drops the per-staff kitchen filter table, its validation
-- trigger, and the trigger function. Cascade isn't strictly
-- needed since no other object references staff_kitchen_filters,
-- but is included defensively.

DROP TRIGGER IF EXISTS staff_kitchen_filters_validate_trg
  ON public.staff_kitchen_filters;

DROP FUNCTION IF EXISTS public.staff_kitchen_filters_validate();

DROP TABLE IF EXISTS public.staff_kitchen_filters CASCADE;
