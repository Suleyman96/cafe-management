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

/**
 * M3: regex-based redaction for free-text strings (Sentry `event.message`,
 * `event.breadcrumb.message`, `event.contexts`, `event.extra`).
 *
 * `redactPii` redacts by *key name* — it works for structured payloads where
 * we know the field is `customer_phone`, etc. Free-text doesn't have field
 * names. This pass catches PII-shaped substrings inside arbitrary strings:
 *
 * - Email addresses → `[email-redacted]`
 * - Phone numbers in international format (`+1 (555) 123-4567`,
 *   `+15551234567`) → `[phone-redacted]`. Bare 10-digit phones without `+`
 *   are intentionally NOT matched — too high a false-positive rate against
 *   order ids, SKUs, etc., and the structured-field pass catches the
 *   common cases (`customer_phone`).
 * - `Order #...` → `Order #[redacted]` (preserves the "Order #" prefix so
 *   the line still reads as an order context, just without the id).
 * - `Table N` → `Table [redacted]` (same shape).
 *
 * Composes with `sanitizeBreadcrumbUrl` (H10) — that helper handles URLs;
 * this one handles message text. They run in different `beforeSend`
 * branches and don't overlap.
 */
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /\+\d[\d\s().-]{6,}\d/g;
const ORDER_NUMBER_RE = /(Order\s*#)([\w-]+)/gi;
const TABLE_NUMBER_RE = /(Table\s+)(\d+)/gi;

export function redactString(s: string): string {
  if (typeof s !== 'string') return s;
  // Order matters: order-number FIRST so `Order #ORD-2026-0001` doesn't
  // expose `2026-0001` to the phone regex's later pass. Email next (most
  // specific shape); phone after; finally the prefix-anchored
  // table/order patterns.
  return s
    .replace(ORDER_NUMBER_RE, '$1[redacted]')
    .replace(EMAIL_RE, '[email-redacted]')
    .replace(PHONE_RE, '[phone-redacted]')
    .replace(TABLE_NUMBER_RE, '$1[redacted]');
}

/**
 * Walks `event.contexts` / `event.extra` and applies `redactString` to every
 * string value. Non-string values pass through. Cycle-safe via the same
 * `WeakSet` trick `redactPii` uses.
 */
export function redactStringsDeep(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  if (Array.isArray(value)) {
    return value.map((item) => redactStringsDeep(item, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out[key] = redactStringsDeep(child, seen);
  }
  return out;
}
