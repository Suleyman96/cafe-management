-- SCALE-7: Change staff email uniqueness from global to per-tenant
-- This allows the same email to be used by different tenants (e.g., same person works at two cafes)

-- Drop the global unique constraint
ALTER TABLE public.staff
DROP CONSTRAINT IF EXISTS staff_email_key;

-- Add tenant-scoped unique index (case-insensitive)
CREATE UNIQUE INDEX idx_staff_email_tenant
ON public.staff (LOWER(email), tenant_id);
