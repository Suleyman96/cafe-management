/**
 * Tests for useApplyDiscount hook.
 *
 * Verifies that:
 * 1. It calls db.orders.applyDiscount with correct params
 * 2. On success, it invalidates ORDER, ORDERS, AND remaining balance queries
 *    (missing remaining-balance invalidation was a bug that caused stale payment data)
 */

import { QUERY_KEYS, tenantKey } from '@gustri/queries';
import { describe, expect, it, vi } from 'vitest';
import { useApplyDiscount } from '@/hooks/use-discount-safe';
import { apiRoutes } from '@/lib/api-routes';
import { renderHookWithProviders, TEST_TENANT_ID, waitFor } from '../helpers/test-utils';

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

    expect(apiRoutes.discounts.apply).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        discount_type: 'percentage',
        discount_value: 10,
        discount_reason: 'loyal customer',
        discount_applied_by: 'staff-1',
        // Hook stamps a UUID v4 on the variables (Blocker 1).
        client_request_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
      }),
    );
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
      expect(invalidatedKeys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDERS));

      // Must invalidate specific order
      expect(invalidatedKeys).toContainEqual(
        tenantKey(TEST_TENANT_ID, QUERY_KEYS.ORDER, 'order-1'),
      );

      // CRITICAL: must invalidate the remaining-balance query so the payment
      // modal gets fresh data after a discount changes the total. The real key
      // is [PAYMENTS, tenant, orderId, 'balance'] — the old 'remaining_balance'
      // variant matched nothing, so the invalidation never actually fired.
      expect(invalidatedKeys).toContainEqual(
        tenantKey(TEST_TENANT_ID, QUERY_KEYS.PAYMENTS, 'order-1', 'balance'),
      );
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

    expect(apiRoutes.discounts.apply).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        discount_type: 'none',
        discount_value: 0,
        discount_reason: undefined,
        discount_applied_by: 'staff-1',
        client_request_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
        ),
      }),
    );
  });
});
