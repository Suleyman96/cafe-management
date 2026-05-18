/**
 * Sentinel-error localization.
 *
 * Server triggers (`RAISE EXCEPTION 'payment_exceeds_remaining'`, …) and
 * `@gustri/api-client` map snake_case sentinel codes to `AppError.message`.
 * Without translation those raw codes leak into toasts. This module is the
 * single source of truth for which codes are sentinels and how they map to
 * the `errors` i18n namespace.
 *
 * The `errors` namespace must be loaded by the consuming app (see each
 * app's `lib/i18n.ts`) before `localizeErrorMessage` will return anything
 * other than the fallback.
 */

import { i18n } from './config';

/**
 * Every sentinel currently raised by DB triggers, RPCs, or
 * `@gustri/api-client`. Adding a new sentinel? Add it here AND in every
 * locale's `errors.json` — CI's i18n coverage gate fails the PR otherwise.
 */
export const SENTINEL_ERROR_CODES = [
  'payment_exceeds_remaining',
  'payment_tenant_mismatch',
  'payment_on_terminal_order',
  'refund_exceeds_available',
  'refund_tenant_mismatch',
  'order_not_found',
  'order_not_found_in_tenant',
  'order_item_tenant_mismatch',
  'waiter_call_already_acknowledged',
  'waiter_call_already_resolved',
  'order_close_requires_payment_or_reason',
  'discount_type_invalid',
  'discount_value_invalid',
  'menu_item_not_found_in_tenant',
  'plan_required',
  'client_outdated',
  'version_conflict',
  'rate_limited',
  // H3 — kitchen-already-started cancel rejection. Distinct from
  // `order_not_cancellable` (terminal status) so the client can show
  // a "Call a waiter" recovery path rather than a generic error.
  'order_cancel_too_late',
  // S5 — customer-web sentinels. Pre-S5 these surfaced as raw codes in
  // toasts because `apiFetch` threw bare `Error('rate_limited')` rather
  // than `AppError`. Each is emitted by an `/api/v1/customer/*` route
  // and needs a localized message in every `errors.json`.
  'order_not_cancellable',
  'order_table_mismatch',
  'invalid_qr_token',
  'qr_token_revoked',
  'qr_token_expired',
  // Channel-policy enforcement on order_items (migration
  // 20260517000005). Surfaced when a takeout/delivery order tries
  // to include a menu_item that the admin flagged not-takeoutable
  // / not-deliverable. UI hides such items, so reaching this state
  // means a bypass attempt or a race between toggle + add-to-order.
  'menu_item_not_takeoutable',
  'menu_item_not_deliverable',
] as const;

export type SentinelErrorCode = (typeof SENTINEL_ERROR_CODES)[number];

const SENTINEL_SET = new Set<string>(SENTINEL_ERROR_CODES);

/**
 * Returns the i18n key for a sentinel error code. Keys live in the
 * `errors` namespace as flat snake_case entries, so the key returned here
 * equals the code itself; namespace is selected at the `t()` call site.
 */
export function errorMessageKey(code: string): string {
  return code;
}

export function isSentinelErrorCode(value: unknown): value is SentinelErrorCode {
  return typeof value === 'string' && SENTINEL_SET.has(value);
}

/**
 * Heuristic for "this looks like a snake_case sentinel" — used as a
 * second-line defense for codes that aren't yet in `SENTINEL_ERROR_CODES`
 * (e.g. a trigger added in a hotfix before the constant is updated). If
 * the message matches the shape we still try the lookup; on miss we fall
 * back to the raw message exactly as before.
 */
function looksLikeSentinel(message: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(message);
}

/**
 * Translate a raw `AppError.message` to a user-facing string.
 *
 * - If the message is a known sentinel code → return its translation.
 * - If the message looks like a sentinel (snake_case) but no translation
 *   exists → return the `fallback` (or the raw code if no fallback).
 * - Anything else (already-prose messages from older raise points, HTTP
 *   error bodies that aren't sentinels, etc.) is returned untouched.
 *
 * Safe to call from non-React code (mutationCache `onError`, mobile
 * snackbar helpers) because it reads the live `i18n` instance directly
 * rather than relying on `useTranslation`.
 */
export function localizeErrorMessage(rawMessage: string | undefined, fallback?: string): string {
  if (!rawMessage) return fallback ?? '';

  if (isSentinelErrorCode(rawMessage) || looksLikeSentinel(rawMessage)) {
    const translated = i18n.t(rawMessage, { ns: 'errors', defaultValue: '' });
    if (typeof translated === 'string' && translated && translated !== rawMessage) {
      return translated;
    }
    return fallback ?? rawMessage;
  }

  return rawMessage;
}
