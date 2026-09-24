import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES_REQUIRING_CANCEL_TYPE_CONFIRM,
  orderCancellationRequiresTypeConfirm,
  PLAN_LIMITS,
} from '../constants';

describe('orderCancellationRequiresTypeConfirm', () => {
  it('requires confirm for in-flight statuses (kitchen has invested labor)', () => {
    expect(orderCancellationRequiresTypeConfirm('preparing')).toBe(true);
    expect(orderCancellationRequiresTypeConfirm('ready')).toBe(true);
    expect(orderCancellationRequiresTypeConfirm('served')).toBe(true);
    expect(orderCancellationRequiresTypeConfirm('out_for_delivery')).toBe(true);
  });

  it('does NOT require confirm for early statuses (no labor invested yet)', () => {
    expect(orderCancellationRequiresTypeConfirm('pending_approval')).toBe(false);
    expect(orderCancellationRequiresTypeConfirm('new')).toBe(false);
  });

  it('does NOT require confirm for terminal statuses (already settled)', () => {
    expect(orderCancellationRequiresTypeConfirm('closed')).toBe(false);
    expect(orderCancellationRequiresTypeConfirm('cancelled')).toBe(false);
    expect(orderCancellationRequiresTypeConfirm('delivered')).toBe(false);
  });

  it('returns false for unknown statuses (safe default — no false-positive friction)', () => {
    expect(orderCancellationRequiresTypeConfirm('totally_made_up')).toBe(false);
    expect(orderCancellationRequiresTypeConfirm('')).toBe(false);
  });

  it('the exported status set matches the helper (single source of truth)', () => {
    for (const status of ORDER_STATUSES_REQUIRING_CANCEL_TYPE_CONFIRM) {
      expect(orderCancellationRequiresTypeConfirm(status)).toBe(true);
    }
  });
});

describe('PLAN_LIMITS order caps', () => {
  it('caps the free tier at 300 orders/month', () => {
    expect(PLAN_LIMITS.free.maxOrdersPerMonth).toBe(300);
  });

  it('leaves paid tiers uncapped (-1 = unlimited)', () => {
    expect(PLAN_LIMITS.standard.maxOrdersPerMonth).toBe(-1);
    expect(PLAN_LIMITS.pro.maxOrdersPerMonth).toBe(-1);
    expect(PLAN_LIMITS.business.maxOrdersPerMonth).toBe(-1);
  });
});
