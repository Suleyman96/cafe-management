// Next.js instrumentation hook — runs once per Node server boot.
// https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.SKIP_PII_ENCRYPTION_PROBE === '1') return;

  // Lazy import so edge/build steps don't pull supabase-js into their bundle.
  const { createClient } = await import('@supabase/supabase-js');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'PII encryption probe: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production.',
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.rpc('pii_encryption_status');

  if (error) {
    throw new Error(`PII encryption probe failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.configured || !row?.round_trip_ok) {
    throw new Error(
      'PII encryption is not configured in production. ' +
        'Set app.pii_encryption_key on the database before deploying. ' +
        '(Set SKIP_PII_ENCRYPTION_PROBE=1 to bypass — only for dev/staging.)',
    );
  }

  // Lazy import keeps Sentry out of the bundle when the probe is skipped.
  const Sentry = await import('@sentry/nextjs');
  Sentry.addBreadcrumb({
    category: 'startup',
    level: 'info',
    message: 'pii_encryption_probe: ok',
  });
}
