-- Rollback for C4 (20260429000001_staff_push_tokens.sql).
--
-- Re-adds the denormalized staff.push_token column, copies the
-- most-recently-seen token per staff back into it, then drops
-- the staff_push_tokens table. Multi-device staff lose all but
-- one token by definition — the denormalized layout can't
-- represent more than one.

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS push_token text;

UPDATE public.staff s
SET push_token = t.expo_token
FROM (
  SELECT DISTINCT ON (staff_id) staff_id, expo_token
  FROM public.staff_push_tokens
  ORDER BY staff_id, last_seen_at DESC
) t
WHERE s.id = t.staff_id;

DROP TABLE IF EXISTS public.staff_push_tokens;
