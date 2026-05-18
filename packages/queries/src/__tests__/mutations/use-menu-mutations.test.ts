import type { QueryClient } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS, tenantKey } from '../../keys';
import {
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useToggleMenuItemDeliverable,
  useToggleMenuItemTakeoutable,
  useUpdateCategory,
  useUpdateMenuItem,
} from '../../mutations/use-menu-mutations';
import { createWrapper, renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

function getInvalidatedKeys(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.map((c: any) => (c[0] as any).queryKey);
}

describe('useCreateMenuItem', () => {
  it('calls db.menuItems.create with the data', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateMenuItem());
    const data = { name: 'Pizza', price: 12 } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.menuItems.create).toHaveBeenCalledWith(data);
  });

  it('invalidates menu items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateMenuItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    expect(getInvalidatedKeys(spy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS),
    );
  });

  it('propagates errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateMenuItem());
    (mockDb.menuItems.create as any).mockRejectedValueOnce(new Error('bad'));
    await expect(result.current.mutateAsync({} as any)).rejects.toThrow('bad');
  });
});

describe('useUpdateMenuItem', () => {
  it('calls db.menuItems.update with id + updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateMenuItem());
    const updates = { price: 14 };
    await result.current.mutateAsync({ id: 'm1', updates });
    expect(mockDb.menuItems.update).toHaveBeenCalledWith('m1', updates);
  });

  it('invalidates menu items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateMenuItem());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'm1', updates: {} });
    expect(getInvalidatedKeys(spy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS),
    );
  });
});

describe('useDeleteMenuItem', () => {
  it('calls db.menuItems.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteMenuItem());
    await result.current.mutateAsync('m1');
    expect(mockDb.menuItems.delete).toHaveBeenCalledWith('m1');
  });
});

describe('useToggleMenuItemAvailability', () => {
  it('passes id and currentAvailable', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    await result.current.mutateAsync({ id: 'm1', currentAvailable: true });
    expect(mockDb.menuItems.toggleAvailability).toHaveBeenCalledWith('m1', true);
  });
});

describe('useToggleMenuItemTakeoutable', () => {
  it('passes id and currentTakeoutable to the wrapper', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useToggleMenuItemTakeoutable());
    await result.current.mutateAsync({ id: 'm1', currentTakeoutable: true });
    expect(mockDb.menuItems.toggleTakeoutable).toHaveBeenCalledWith('m1', true);
  });

  it('forwards the current value verbatim so the wrapper negates it (not the mutation)', async () => {
    // Important: the hook must NOT pre-negate. The wrapper owns the
    // "flip" logic so behaviour stays identical across web/mobile/scripts
    // that bypass the hook layer.
    const { result, mockDb } = renderHookWithProviders(() => useToggleMenuItemTakeoutable());
    await result.current.mutateAsync({ id: 'm2', currentTakeoutable: false });
    expect(mockDb.menuItems.toggleTakeoutable).toHaveBeenCalledWith('m2', false);
  });

  it('invalidates menu items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useToggleMenuItemTakeoutable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'm1', currentTakeoutable: true });
    expect(getInvalidatedKeys(spy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS),
    );
  });

  it('propagates wrapper errors', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useToggleMenuItemTakeoutable());
    (mockDb.menuItems.toggleTakeoutable as any).mockRejectedValueOnce(new Error('rls denied'));
    await expect(
      result.current.mutateAsync({ id: 'm1', currentTakeoutable: true }),
    ).rejects.toThrow('rls denied');
  });
});

describe('useToggleMenuItemDeliverable', () => {
  it('passes id and currentDeliverable to the wrapper', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useToggleMenuItemDeliverable());
    await result.current.mutateAsync({ id: 'm1', currentDeliverable: true });
    expect(mockDb.menuItems.toggleDeliverable).toHaveBeenCalledWith('m1', true);
  });

  it('invalidates menu items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useToggleMenuItemDeliverable());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'm1', currentDeliverable: false });
    expect(getInvalidatedKeys(spy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS),
    );
  });
});

// Optimistic-update regression guards. All three toggles share the same
// onMutate / onError / onSettled plumbing, so one detailed suite per
// concern is enough — duplicating across the three would be noise.

describe('toggle optimistic updates', () => {
  function seedMenuList(queryClient: QueryClient) {
    // Seed two cached lists at different filter combinations so we can
    // verify the optimistic write reaches both — a regression where
    // setQueriesData was scoped to one filter would let this catch.
    const baseKey = tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS);
    const filteredKey = tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS, {
      isTakeoutable: true,
    });
    const items = [
      { id: 'm1', name: 'A', is_available: true, is_takeoutable: true, is_deliverable: true },
      { id: 'm2', name: 'B', is_available: true, is_takeoutable: true, is_deliverable: true },
    ];
    queryClient.setQueryData(baseKey, items);
    queryClient.setQueryData(filteredKey, items);
    return { baseKey, filteredKey };
  }

  it('flips the cached value before mutationFn fires (no waiting for network)', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    const { baseKey } = seedMenuList(queryClient);

    // TanStack Query awaits onMutate before invoking mutationFn, so by
    // the time the wrapper is called the optimistic update must already
    // be in the cache. Capturing the cache from inside the mock avoids
    // microtask-yield timing hacks that flake under parallel test runs.
    let cachedDuringWrapper: any[] | undefined;
    (mockDb.menuItems.toggleTakeoutable as any).mockImplementationOnce(async () => {
      cachedDuringWrapper = queryClient.getQueryData<any[]>(baseKey);
      return { id: 'm1', is_takeoutable: false };
    });

    const { result } = renderHook(() => useToggleMenuItemTakeoutable(), { wrapper });
    await result.current.mutateAsync({ id: 'm1', currentTakeoutable: true });

    // The flipped value must have landed in the cache *before* the
    // wrapper executed — i.e., the user saw the switch flip without
    // waiting for the network round-trip.
    expect(cachedDuringWrapper?.find((i) => i.id === 'm1')?.is_takeoutable).toBe(false);
  });

  it('writes the optimistic update across ALL cached menu-list query keys', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    const { baseKey, filteredKey } = seedMenuList(queryClient);

    (mockDb.menuItems.toggleDeliverable as any).mockResolvedValueOnce({
      id: 'm1',
      is_deliverable: false,
    });

    const { result } = renderHook(() => useToggleMenuItemDeliverable(), { wrapper });
    await result.current.mutateAsync({ id: 'm1', currentDeliverable: true });

    // Both lists must reflect the flip — a future regression that scopes
    // setQueriesData to a single matched key (instead of using the
    // matching predicate) would surface here.
    expect(
      queryClient.getQueryData<any[]>(baseKey)?.find((i) => i.id === 'm1')?.is_deliverable,
    ).toBe(false);
    expect(
      queryClient.getQueryData<any[]>(filteredKey)?.find((i) => i.id === 'm1')?.is_deliverable,
    ).toBe(false);
  });

  it('rolls back every cached list when the mutation rejects', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    const { baseKey, filteredKey } = seedMenuList(queryClient);

    (mockDb.menuItems.toggleAvailability as any).mockRejectedValueOnce(new Error('rls denied'));

    const { result } = renderHook(() => useToggleMenuItemAvailability(), { wrapper });
    await expect(result.current.mutateAsync({ id: 'm1', currentAvailable: true })).rejects.toThrow(
      'rls denied',
    );

    // After rollback, the value should be back to TRUE on every list —
    // otherwise a user who toggled then saw a server error would be
    // looking at a stale "off" switch while the DB still has it on.
    expect(queryClient.getQueryData<any[]>(baseKey)?.find((i) => i.id === 'm1')?.is_available).toBe(
      true,
    );
    expect(
      queryClient.getQueryData<any[]>(filteredKey)?.find((i) => i.id === 'm1')?.is_available,
    ).toBe(true);
  });

  it('still invalidates the list on settled (server-side truth wins after refetch)', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    seedMenuList(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    (mockDb.menuItems.toggleTakeoutable as any).mockResolvedValueOnce({
      id: 'm1',
      is_takeoutable: false,
    });

    const { result } = renderHook(() => useToggleMenuItemTakeoutable(), { wrapper });
    await result.current.mutateAsync({ id: 'm1', currentTakeoutable: true });

    // onSettled fires on both success AND error; both paths must
    // invalidate so the cache eventually reconciles with the server.
    expect(getInvalidatedKeys(invalidateSpy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS),
    );
  });

  it('still invalidates on settled when the mutation rejects', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    seedMenuList(queryClient);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    (mockDb.menuItems.toggleDeliverable as any).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useToggleMenuItemDeliverable(), { wrapper });
    await expect(
      result.current.mutateAsync({ id: 'm1', currentDeliverable: true }),
    ).rejects.toThrow('boom');

    expect(getInvalidatedKeys(invalidateSpy)).toContainEqual(
      tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS),
    );
  });

  it('leaves unrelated items in the cache untouched', async () => {
    const { wrapper, queryClient, mockDb } = createWrapper();
    const { baseKey } = seedMenuList(queryClient);

    (mockDb.menuItems.toggleAvailability as any).mockResolvedValueOnce({
      id: 'm1',
      is_available: false,
    });

    const { result } = renderHook(() => useToggleMenuItemAvailability(), { wrapper });
    await result.current.mutateAsync({ id: 'm1', currentAvailable: true });

    // m2 was not the toggle target — its flags must be unchanged.
    expect(queryClient.getQueryData<any[]>(baseKey)?.find((i) => i.id === 'm2')?.is_available).toBe(
      true,
    );
  });
});

describe('useCreateCategory', () => {
  it('calls db.categories.create', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateCategory());
    const data = { name: 'Drinks' } as any;
    await result.current.mutateAsync(data);
    expect(mockDb.categories.create).toHaveBeenCalledWith(data);
  });

  it('invalidates both categories and menu items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateCategory());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({} as any);
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.CATEGORIES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS));
  });
});

describe('useUpdateCategory', () => {
  it('forwards id and updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateCategory());
    await result.current.mutateAsync({ id: 'c1', updates: { name: 'New' } });
    expect(mockDb.categories.update).toHaveBeenCalledWith('c1', { name: 'New' });
  });
});

describe('useDeleteCategory', () => {
  it('forwards id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteCategory());
    await result.current.mutateAsync('c1');
    expect(mockDb.categories.delete).toHaveBeenCalledWith('c1');
  });

  it('invalidates both categories and menu items on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteCategory());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync('c1');
    const keys = getInvalidatedKeys(spy);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.CATEGORIES));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, QUERY_KEYS.MENU_ITEMS));
  });
});
