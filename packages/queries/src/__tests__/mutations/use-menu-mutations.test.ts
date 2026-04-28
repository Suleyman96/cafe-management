import { describe, expect, it, vi } from 'vitest';
import { QUERY_KEYS } from '../../keys';
import {
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useUpdateCategory,
  useUpdateMenuItem,
} from '../../mutations/use-menu-mutations';
import { renderHookWithProviders } from '../helpers/test-utils';

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
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
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
    expect(getInvalidatedKeys(spy)).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
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
    expect(keys).toContainEqual([QUERY_KEYS.CATEGORIES]);
    expect(keys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
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
    expect(keys).toContainEqual([QUERY_KEYS.CATEGORIES]);
    expect(keys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});
