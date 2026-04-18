/**
 * Tests for useApplyDiscount hook.
 *
 * Verifies that:
 * 1. It calls db.orders.applyDiscount with correct params
 * 2. On success, it invalidates ORDER, ORDERS, AND remaining balance queries
 *    (missing remaining-balance invalidation was a bug that caused stale payment data)
 */

import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import { useApplyDiscount } from '@/hooks/use-discount-safe';
import { apiRoutes } from '@/lib/api-routes';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useApplyDiscount', () => {
  it('calls apiRoutes.discounts.apply with correct params', async () => {
    const { result } = renderHookWithProviders(() => useApplyDiscount());
    const params = {
      orderId: 'order-1',
      discount_type: 'percentage' as const,
      discount_value: 10,
      discount_reason: 'loyal customer',
      discount_applied_by: 'staff-1',
    };

    await result.current.mutateAsync(params);

    expect(apiRoutes.discounts.apply).toHaveBeenCalledWith('order-1', {
      discount_type: 'percentage',
      discount_value: 10,
      discount_reason: 'loyal customer',
      discount_applied_by: 'staff-1',
    });
  });

  it('invalidates orders, order, AND remaining balance queries on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useApplyDiscount());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({
      orderId: 'order-1',
      discount_type: 'fixed' as const,
      discount_value: 5,
      discount_applied_by: 'staff-1',
    });

    await waitFor(() => {
      const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);

      // Must invalidate general orders list
      expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDERS]);

      // Must invalidate specific order
      expect(invalidatedKeys).toContainEqual([QUERY_KEYS.ORDER, 'order-1']);

      // CRITICAL: Must invalidate remaining balance so payment modal gets fresh data
      // This was a bug — missing this invalidation caused "fully paid" false positives
      expect(invalidatedKeys).toContainEqual([QUERY_KEYS.PAYMENTS, 'remaining_balance', 'order-1']);
    });
  });

  it('removes discount when type is none', async () => {
    const { result } = renderHookWithProviders(() => useApplyDiscount());

    await result.current.mutateAsync({
      orderId: 'order-1',
      discount_type: 'none' as const,
      discount_value: 0,
      discount_applied_by: 'staff-1',
    });

    expect(apiRoutes.discounts.apply).toHaveBeenCalledWith('order-1', {
      discount_type: 'none',
      discount_value: 0,
      discount_reason: undefined,
      discount_applied_by: 'staff-1',
    });
  });
});
