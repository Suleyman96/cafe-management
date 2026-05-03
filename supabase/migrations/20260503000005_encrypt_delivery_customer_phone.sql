-- Encrypt delivery_customers.phone at rest and remove waiter access to the
-- plaintext directory. Mirrors the orders PII encryption pattern
-- (20260421000001_encrypt_customer_pii.sql): the existing `phone` column
-- becomes the ciphertext-at-rest column (encrypted in place by the
-- BEFORE-INSERT/UPDATE trigger), and a `delivery_customers_decrypted`
-- view exposes plaintext only to admin/owner sessions.
--
-- Two extras on top of the orders pattern:
--
--   1. A keyed `phone_hash` column for exact-match lookup. Waiters need
--      to autofill saved customers when they're already on a call (i.e.
--      they already know the phone). Hashing lets them probe by exact
--      phone via a SECURITY-DEFINER RPC without ever reading the
--      plaintext directory or the hash itself.
--
--   2. Column-level SELECT grants on `delivery_customers` revoke direct
--      access to `phone` (now ciphertext) and `phone_hash` from
--      `authenticated`/`anon`. Reads must go through the gated view or
--      the lookup RPC.
--
-- Threat model: a compromised waiter session can no longer LIKE-search
-- the phone book. They can only confirm a phone they already have, and
-- the row they get back never contains the plaintext phone.

BEGIN;

-- 1. Hash function. HMAC-SHA256 keyed by the same encryption key used for
--    pgp_sym_encrypt. Returns NULL for blank input. In dev (empty key)
--    we fall back to a static dev key so local lookups still work — the
--    dev DB doesn't hold real customer phones.
CREATE OR REPLACE FUNCTION public.hash_phone(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  encryption_key TEXT;
  normalized TEXT;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;

  -- Normalize to digits only so '+1 (555) 123-4567' and '15551234567'
  -- collide. Empty after stripping → no hash.
  normalized := regexp_replace(plaintext, '[^0-9]', '', 'g');
  IF normalized = '' THEN
    RETURN NULL;
  END IF;

  encryption_key := current_setting('app.pii_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    encryption_key := 'dev-fallback-hash-key';
  END IF;

  RETURN encode(extensions.hmac(normalized, encryption_key, 'sha256'), 'base64');
END;
$$;

-- 2. Drop the NOT NULL on phone — the trigger writes NULL when the input
--    string is empty (matches orders.customer_phone behaviour), and we
--    don't want a write to the safe columns to fail just because the
--    caller forgot phone.
ALTER TABLE public.delivery_customers
  ALTER COLUMN phone DROP NOT NULL;

-- 3. Add the lookup-hash column.
ALTER TABLE public.delivery_customers
  ADD COLUMN IF NOT EXISTS phone_hash TEXT;

-- 4. BEFORE INSERT/UPDATE trigger. Encrypts the plaintext `phone` in
--    place and derives `phone_hash` from the same plaintext. Reads from
--    `current_setting('app.pii_encryption_key')` via the helpers — when
--    the key is empty (dev), encrypt_pii returns the plaintext but
--    phone_hash is still populated against the dev fallback key.
--    Re-running on already-encrypted data is a no-op for hashing
--    (decrypt_pii first, normalize, hash) — but the orders pattern just
--    re-encrypts in place; we follow the same idempotency model and
--    leave the row alone if the trigger sees a row that has not been
--    written through.
CREATE OR REPLACE FUNCTION public.encrypt_delivery_customer_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    -- Re-derive phone_hash from the (possibly already-encrypted) plaintext.
    -- decrypt_pii passes through if the value is not encrypted, so this
    -- works for fresh inserts (plaintext) and trigger-fires-on-self-update
    -- backfills (already encrypted).
    NEW.phone_hash := public.hash_phone(public.decrypt_pii(NEW.phone));
    NEW.phone := public.encrypt_pii(public.decrypt_pii(NEW.phone));
  ELSE
    NEW.phone_hash := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_encrypt_delivery_customer_phone
  BEFORE INSERT OR UPDATE OF phone
  ON public.delivery_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_delivery_customer_phone();

-- 5. Backfill: encrypt existing plaintext phones and populate phone_hash.
DO $$
BEGIN
  UPDATE public.delivery_customers
     SET phone = phone
   WHERE phone IS NOT NULL;
END;
$$;

-- 6. Indexes: drop the plaintext-phone index, add a phone_hash index.
DROP INDEX IF EXISTS public.idx_delivery_customers_phone;
CREATE INDEX IF NOT EXISTS idx_delivery_customers_phone_hash
  ON public.delivery_customers (phone_hash);

-- 7. Decrypted view. `decrypted_phone` is gated on staff role — waiters
--    and kitchen get NULL; admin/owner get plaintext. Other columns
--    flow through unchanged. `security_invoker = on` makes the view
--    inherit `tenant_isolation` RLS from the base table.
CREATE OR REPLACE VIEW public.delivery_customers_decrypted
WITH (security_invoker = on) AS
SELECT
  d.id,
  d.name,
  d.address,
  d.notes,
  d.order_count,
  d.last_order_at,
  d.created_at,
  d.updated_at,
  d.tenant_id,
  CASE
    WHEN public.get_my_staff_role() = ANY (ARRAY['admin', 'owner'])
      THEN public.decrypt_pii(d.phone)
    ELSE NULL
  END AS decrypted_phone
FROM public.delivery_customers d;

GRANT SELECT ON public.delivery_customers_decrypted TO authenticated;

-- 8. Lookup RPC — the waiter's only path to "is this phone in the
--    directory?". Hashes server-side, scopes by tenant, and never
--    returns the plaintext phone. Returns name/address/notes so the
--    delivery form can autofill once the waiter has typed the phone
--    they already know.
CREATE OR REPLACE FUNCTION public.find_delivery_customer_by_phone(p_phone TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  notes TEXT,
  order_count INTEGER,
  last_order_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash TEXT;
  v_tenant UUID;
BEGIN
  v_hash := public.hash_phone(p_phone);
  IF v_hash IS NULL THEN
    RETURN;
  END IF;

  v_tenant := public.current_tenant_id();
  IF v_tenant IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    d.address,
    d.notes,
    d.order_count,
    d.last_order_at
  FROM public.delivery_customers d
  WHERE d.phone_hash = v_hash
    AND d.tenant_id = v_tenant
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_delivery_customer_by_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_delivery_customer_by_phone(TEXT) TO authenticated;

-- 9. Column-level grants on the base table. Waiters can SELECT all the
--    safe columns but never `phone` (ciphertext) or `phone_hash`, so a
--    stray `select('*')` won't leak ciphertext or enable hash-grinding
--    against the directory. Mutations remain table-level (the trigger
--    populates phone_hash) so we grant INSERT/UPDATE/DELETE on the
--    whole table.
REVOKE SELECT ON public.delivery_customers FROM authenticated, anon;

GRANT SELECT (
  id,
  name,
  address,
  notes,
  order_count,
  last_order_at,
  created_at,
  updated_at,
  tenant_id
) ON public.delivery_customers TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.delivery_customers TO authenticated;

COMMIT;
