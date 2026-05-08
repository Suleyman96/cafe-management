import * as Sentry from '@sentry/react-native';
import { redactPii } from './sentry-redaction';

/**
 * Minimal structural type for a Zod schema's `safeParse`. Avoids a direct
 * dependency on `zod` from this app — the schemas come from `@gustri/database`
 * which already pulls zod transitively.
 */
type SafeParseable<T> = {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: unknown };
};

/**
 * Validates a realtime payload against a Zod schema. Returns the parsed value
 * on success, or `null` and reports a Sentry event on failure.
 *
 * Why bother for UPDATE handlers that only invalidate? — Schema drift in
 * postgres-changes payloads is silent today: a column rename, an enum
 * widening, or a malformed row corrupts downstream consumers without warning.
 * Validating gives us a "first sign of drift" alert via Sentry without
 * blocking the invalidation that the handler already does.
 *
 * The reported `payload` is run through `redactPii` first. Supabase Realtime
 * delivers the full row (not just the schema's narrow subset), so an `orders`
 * INSERT carries `customer_name`, `customer_phone`, `delivery_address`, and
 * the free-text notes columns. Sentry's beforeSend redactor only walks
 * breadcrumbs + request bodies, NOT `extra`, so we redact at the source.
 */
export function validateRealtimePayload<T>(
  schema: SafeParseable<T>,
  payload: unknown,
  meta: { table: string; event: string },
): T | null {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    Sentry.captureException(parsed.error, {
      tags: { area: 'realtime-validation', ...meta },
      extra: { payload: redactPii(payload) },
    });
    return null;
  }
  return parsed.data;
}
