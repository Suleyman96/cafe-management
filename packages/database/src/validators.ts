// Shared runtime validators that the Zod input schemas need but that must also
// be reusable from app code. They live in `@gustri/database` (not `@gustri/core`)
// because `@gustri/core` depends on `@gustri/database` — putting them here lets
// the input schemas (`./schemas/inputs.ts`) reuse them without a dependency
// cycle, and `@gustri/core` re-exports them so existing
// `import { isValidPhone } from '@gustri/core'` call sites keep working.

// ── Phone-number validation ─────────────────────────────────────────────────
//
// Customer-facing flows (delivery landing form, customer-web → staff-web
// `/api/v1/customer/orders`, and the order-create input schema) accept `+`,
// digits, spaces, dashes, and parens. Total length is bounded 7–20 chars by the
// character-set regex below, BUT that alone admits inputs like `+()()()()` —
// shape-valid, totally uncallable. `isValidPhone` adds the digit-count step so
// client and server reject the same set of garbage submissions.

/** Allowed character set + total-length bounds for customer-facing phones. */
export const PHONE_SHAPE_REGEX = /^[+\d\s\-()]{7,20}$/;

/** Minimum number of actual digits a phone must contain to be callable. */
export const MIN_PHONE_DIGITS = 7;

/**
 * Returns `true` when `value` is a plausible phone number under the shared
 * customer-flow contract: shape-allowed characters, 7–20 total length, and at
 * least `MIN_PHONE_DIGITS` real digits. Use this from client-side form
 * validation, the staff-web Zod route schemas, AND the shared order-create
 * input schema so a bypass-the-client attacker can't post `+()` and have it
 * stick.
 */
export function isValidPhone(value: string): boolean {
  if (!PHONE_SHAPE_REGEX.test(value)) return false;
  const digitCount = value.match(/\d/g)?.length ?? 0;
  return digitCount >= MIN_PHONE_DIGITS;
}
