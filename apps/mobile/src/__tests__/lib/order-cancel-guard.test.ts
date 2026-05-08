import { describe, expect, it } from 'vitest';
import { checkTakeoutCancelEligibility } from '@/lib/order-cancel-guard';

const sample = (id: string, status: string) => ({ id, status });

describe('checkTakeoutCancelEligibility (H3)', () => {
  it('allows cancellation while the order is in an active takeout status', () => {
    const list = [
      sample('o1', 'pending_approval'),
      sample('o2', 'new'),
      sample('o3', 'preparing'),
      sample('o4', 'ready'),
    ];
    for (const o of list) {
      expect(checkTakeoutCancelEligibility(list, o.id)).toEqual({ ok: true });
    }
  });

  it('rejects cancellation when the order has moved to a terminal status', () => {
    const list = [sample('o1', 'cancelled'), sample('o2', 'closed')];
    expect(checkTakeoutCancelEligibility(list, 'o1')).toEqual({
      ok: false,
      reason: 'no_longer_active',
    });
    expect(checkTakeoutCancelEligibility(list, 'o2')).toEqual({
      ok: false,
      reason: 'no_longer_active',
    });
  });

  it('rejects when the order is no longer present in the refetched list', () => {
    const list = [sample('o1', 'preparing')];
    expect(checkTakeoutCancelEligibility(list, 'missing')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('rejects when the refetched list is undefined (e.g. fetch error)', () => {
    expect(checkTakeoutCancelEligibility(undefined, 'o1')).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('treats `served` as no-longer-active for takeout (not in ACTIVE_TAKEOUT_STATUSES)', () => {
    // Defensive: takeout flow doesn't normally reach `served`, but if it
    // does (legacy data, stuck transition) the guard must NOT cancel — the
    // cancel mutation has no DB precondition, so an unguarded cancel from
    // here would silently rewrite a served order's status.
    const list = [sample('o1', 'served')];
    expect(checkTakeoutCancelEligibility(list, 'o1')).toEqual({
      ok: false,
      reason: 'no_longer_active',
    });
  });
});
