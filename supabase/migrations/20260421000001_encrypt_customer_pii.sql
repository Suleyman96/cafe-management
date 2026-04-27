-- Encrypt customer PII fields at rest using pgcrypto.
-- Fields: customer_name, customer_phone, delivery_address on orders table.
--
-- Strategy: Database-level transparent encryption via pgcrypto.
-- - BEFORE INSERT/UPDATE trigger auto-encrypts PII columns
-- - A view (orders_decrypted) auto-decrypts for reads
-- - The encryption key is set via database config: app.pii_encryption_key
-- - When key is empty/unset, data passes through unencrypted (dev fallback)
--
-- Setup:
--   Production: Set the key in Supabase Dashboard > Database > Settings
--     ALTER DATABASE postgres SET app.pii_encryption_key = 'your-strong-passphrase';
--   Local dev: Add to supabase/config.toml under [db.settings]
--     app.pii_encryption_key = ""   (empty = no encryption in dev)

BEGIN;

-- 1. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create a custom GUC for the encryption key (empty default = no encryption)
-- In production, set via: ALTER DATABASE postgres SET app.pii_encryption_key = 'your-key';
-- In local dev, this may fail due to permissions — that's OK (encryption is disabled when key is empty).
DO $$
BEGIN
  EXECUTE 'ALTER DATABASE postgres SET app.pii_encryption_key = ''''';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping app.pii_encryption_key setting (insufficient privileges in local dev)';
END;
$$;

-- 3. Encrypt function — returns base64-encoded ciphertext, or NULL/empty passthrough
CREATE OR REPLACE FUNCTION public.encrypt_pii(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN plaintext;
  END IF;

  encryption_key := current_setting('app.pii_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN plaintext;
  END IF;

  RETURN encode(pgp_sym_encrypt(plaintext, encryption_key), 'base64');
END;
$$;

-- 4. Decrypt function — returns plaintext, falls back to raw value if not encrypted
CREATE OR REPLACE FUNCTION public.decrypt_pii(ciphertext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN ciphertext;
  END IF;

  encryption_key := current_setting('app.pii_encryption_key', true);
  IF encryption_key IS NULL OR encryption_key = '' THEN
    RETURN ciphertext;
  END IF;

  BEGIN
    RETURN pgp_sym_decrypt(decode(ciphertext, 'base64'), encryption_key);
  EXCEPTION WHEN OTHERS THEN
    -- Data is not encrypted (pre-migration rows or dev environment)
    RETURN ciphertext;
  END;
END;
$$;

-- 5. Trigger to auto-encrypt PII on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.encrypt_order_pii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.customer_name := public.encrypt_pii(NEW.customer_name);
  NEW.customer_phone := public.encrypt_pii(NEW.customer_phone);
  NEW.delivery_address := public.encrypt_pii(NEW.delivery_address);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_encrypt_order_pii
  BEFORE INSERT OR UPDATE OF customer_name, customer_phone, delivery_address
  ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.encrypt_order_pii();

-- 6. Create a decrypting view for reads
--    Uses subquery to get all columns, then overrides the 3 PII fields.
--    This ensures new columns added to orders are automatically included.
CREATE OR REPLACE VIEW public.orders_decrypted AS
SELECT
  o.*,
  public.decrypt_pii(o.customer_name) AS decrypted_customer_name,
  public.decrypt_pii(o.customer_phone) AS decrypted_customer_phone,
  public.decrypt_pii(o.delivery_address) AS decrypted_delivery_address
FROM public.orders o;

-- Grant same access as orders table
GRANT SELECT ON public.orders_decrypted TO authenticated;
GRANT SELECT ON public.orders_decrypted TO anon;

-- 7. Encrypt existing data (only if key is configured)
DO $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := current_setting('app.pii_encryption_key', true);
  IF encryption_key IS NOT NULL AND encryption_key != '' THEN
    ALTER TABLE public.orders DISABLE TRIGGER trg_encrypt_order_pii;

    UPDATE public.orders
    SET
      customer_name = public.encrypt_pii(customer_name),
      customer_phone = public.encrypt_pii(customer_phone),
      delivery_address = public.encrypt_pii(delivery_address)
    WHERE customer_name IS NOT NULL
       OR customer_phone IS NOT NULL
       OR delivery_address IS NOT NULL;

    ALTER TABLE public.orders ENABLE TRIGGER trg_encrypt_order_pii;
  END IF;
END;
$$;

COMMIT;
