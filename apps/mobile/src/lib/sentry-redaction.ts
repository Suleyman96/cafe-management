/**
 * PII redaction for Sentry events. App.tsx beforeSend strips Authorization
 * headers and `token` query params, but request *bodies* are sent as-is —
 * a failed order-creation breadcrumb otherwise leaks customer_name,
 * customer_phone, delivery_address, and any free-text notes.
 *
 * `redactPii` walks objects/arrays recursively and replaces values whose
 * key matches PII_FIELDS with the string `[redacted]`. Strings, numbers,
 * booleans, null, undefined, and other primitives are returned unchanged
 * (replacement happens at the property level on the parent).
 */

export const PII_FIELDS: ReadonlySet<string> = new Set([
  'customer_name',
  'customer_phone',
  'phone',
  'email',
  'delivery_address',
  'address',
  'notes',
  'note',
  'customer_notes',
  'internal_notes',
]);

const REDACTED = '[redacted]';

export function redactPii(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (PII_FIELDS.has(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactPii(child, seen);
    }
  }
  return out;
}

/**
 * Convenience: parse a JSON string body, redact, and re-serialize. If the
 * input isn't valid JSON, returns it untouched (Sentry stores it as-is and
 * the user gets a less-redacted breadcrumb than ideal — losing visibility
 * is preferable to dropping the event entirely).
 */
export function redactJsonBody(body: unknown): unknown {
  if (typeof body !== 'string') return redactPii(body);
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(redactPii(parsed));
  } catch {
    return body;
  }
}
