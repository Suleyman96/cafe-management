-- Add push_token column to staff for remote push notifications (SCALE-28)
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS push_token TEXT;
