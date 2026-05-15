import type { TenantPublicProfile } from '@gustri/api-client';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTenant, useTenantPlan } from '../../hooks/use-tenant';
import { createWrapper, renderHookWithProviders } from '../helpers/test-utils';

describe('useTenant', () => {
  it('calls db.tenants.getCurrent', () => {
    const { mockDb } = renderHookWithProviders(() => useTenant());
    expect(mockDb.tenants.getCurrent).toHaveBeenCalled();
  });

  it('returns the resolved tenant row once the query settles', async () => {
    const { wrapper, mockDb } = createWrapper();
    vi.mocked(mockDb.tenants.getCurrent).mockResolvedValueOnce({
      id: 't1',
      plan: 'pro',
      name: 'X',
      slug: 'x',
      is_active: true,
    });
    const { result } = renderHook(() => useTenant(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.plan).toBe('pro');
  });
});

describe('useTenantPlan', () => {
  it('returns { plan: null, isLoading: true } while the query is pending', () => {
    const { result } = renderHookWithProviders(() => useTenantPlan());
    // Initial render — TanStack Query hasn't resolved yet.
    expect(result.current).toEqual({ plan: null, isLoading: true });
  });

  it('returns the plan name once the query resolves', async () => {
    const { wrapper, mockDb } = createWrapper();
    vi.mocked(mockDb.tenants.getCurrent).mockResolvedValueOnce({
      plan: 'business',
    } as TenantPublicProfile);
    const { result } = renderHook(() => useTenantPlan(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan).toBe('business');
  });

  it('returns { plan: null, isLoading: false } when the query errors — does not coerce to free', async () => {
    // This is the contract that makes the loading-window race fix work:
    // null means "unknown", consumers MUST treat that as hide-gated-UI,
    // never as "free". A regression that re-introduces `?? 'free'` would
    // ship paying-tenant-locked-out errors during the load window again.
    const { wrapper, mockDb } = createWrapper();
    vi.mocked(mockDb.tenants.getCurrent).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useTenantPlan(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan).toBeNull();
  });

  it('returns null plan when the tenant row has no plan column (defensive)', async () => {
    // Shouldn't happen — `tenants.plan` has NOT NULL + CHECK constraint —
    // but the hook's `(data?.plan as PlanName) ?? null` shape guarantees
    // null in this hypothetical case rather than `undefined` leaking out.
    const { wrapper, mockDb } = createWrapper();
    vi.mocked(mockDb.tenants.getCurrent).mockResolvedValueOnce({
      id: 't1',
    } as TenantPublicProfile);
    const { result } = renderHook(() => useTenantPlan(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan).toBeNull();
  });
});
