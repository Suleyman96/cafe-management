-- Rollback for 20260503000005_encrypt_delivery_customer_phone.sql.
-- Restores plaintext phone storage and removes the encryption, hashing,
-- and gated-view scaffolding.

BEGIN;

-- 1. Drop the trigger first so the decrypt-and-write below doesn't
--    re-encrypt.
DROP TRIGGER IF EXISTS trg_encrypt_delivery_customer_phone
  ON public.delivery_customers;

-- 2. Decrypt the in-place ciphertext back to plaintext. decrypt_pii
--    returns the input unchanged when the encryption key is empty (dev),
--    so this is safe to run in any environment.
UPDATE public.delivery_customers
   SET phone = public.decrypt_pii(phone)
 WHERE phone IS NOT NULL;

-- 3. Restore base-table SELECT for authenticated/anon and drop the
--    column-level grants. Phone is plaintext again, so the original
--    table-wide grant is the right shape.
REVOKE SELECT (
  id,
  name,
  address,
  notes,
  order_count,
  last_order_at,
  created_at,
  updated_at,
  tenant_id
) ON public.delivery_customers FROM authenticated;

GRANT SELECT ON public.delivery_customers TO authenticated, anon;

-- 4. Restore the original NOT NULL constraint and plaintext index.
ALTER TABLE public.delivery_customers
  ALTER COLUMN phone SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_customers_phone
  ON public.delivery_customers (phone);

-- 5. Drop the new objects.
DROP INDEX IF EXISTS public.idx_delivery_customers_phone_hash;
DROP VIEW IF EXISTS public.delivery_customers_decrypted;
DROP FUNCTION IF EXISTS public.find_delivery_customer_by_phone(TEXT);
DROP FUNCTION IF EXISTS public.encrypt_delivery_customer_phone();
DROP FUNCTION IF EXISTS public.hash_phone(TEXT);

ALTER TABLE public.delivery_customers
  DROP COLUMN IF EXISTS phone_hash;

COMMIT;
