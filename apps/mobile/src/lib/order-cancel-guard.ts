import { ACTIVE_TAKEOUT_STATUSES } from '@gustri/core';

/**
 * Result of checking whether a takeout order can still be cancelled.
 * Returned by `checkTakeoutCancelEligibility`; consumers map the failure
 * `reason` to a localized message and a refresh of the list.
 */
export type CancelEligibility =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'no_longer_active' };

/**
 * H3: gate the takeout cancel mutation against fresh server state.
 *
 * Why this gate exists: `db.orders.cancelOrder` (in `@gustri/api-client`)
 * does NOT enforce a previous-status precondition at the DB layer — it
 * unconditionally writes `status: 'cancelled'`. A staff member who opens
 * the cancel dialog and then switches tabs (or another staff member
 * cancels/closes the order in parallel) can otherwise flip a `closed`
 * order back to `cancelled` on confirm — silent data corruption.
 *
 * The screen calls `refetch()` immediately before submitting, then passes
 * the resulting list here. We accept the list (rather than fetching here)
 * so this stays a pure function — easy to unit-test and trivial to reuse.
 */
export function checkTakeoutCancelEligibility<T extends { id: string; status: string }>(
  freshList: readonly T[] | undefined,
  orderId: string,
): CancelEligibility {
  const found = freshList?.find((o) => o.id === orderId);
  if (!found) return { ok: false, reason: 'not_found' };
  if (!(ACTIVE_TAKEOUT_STATUSES as readonly string[]).includes(found.status)) {
    return { ok: false, reason: 'no_longer_active' };
  }
  return { ok: true };
}
