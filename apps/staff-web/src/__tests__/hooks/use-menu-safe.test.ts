import { QUERY_KEYS } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
import {
  useCategories,
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useMenuItem,
  useMenuItems,
  useToggleMenuItemAvailability,
  useUpdateCategory,
  useUpdateMenuItem,
} from '@/hooks/use-menu-safe';
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

// ─── Queries ─────────────────────────────────────────────────────────────────

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll without options', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItems());
    expect(mockDb.menuItems.findAll).toHaveBeenCalledWith(undefined);
  });

  it('passes filter options to findAll', () => {
    const options = { categoryId: 'c1', isAvailable: true };
    const { mockDb } = renderHookWithProviders(() => useMenuItems(options));
    expect(mockDb.menuItems.findAll).toHaveBeenCalledWith(options);
  });

  it('returns fetched menu items', async () => {
    const mockItems = [{ id: 'm1', name: 'Pizza', price: 10 }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.menuItems.findAll as any).mockResolvedValueOnce(mockItems);

    const { result } = renderHook(() => useMenuItems(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItems);
  });

  it('reports error when fetch fails', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.menuItems.findAll as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHook(() => useMenuItems(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMenuItem', () => {
  it('calls db.menuItems.findById with given id', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItem('m1'));
    expect(mockDb.menuItems.findById).toHaveBeenCalledWith('m1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItem(''));
    expect(mockDb.menuItems.findById).not.toHaveBeenCalled();
  });

  it('returns data on success', async () => {
    const mockItem = { id: 'm1', name: 'Pizza', price: 10 };
    const { wrapper, mockDb } = createWrapper();
    (mockDb.menuItems.findById as any).mockResolvedValueOnce(mockItem);

    const { result } = renderHook(() => useMenuItem('m1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItem);
  });

  it('reports error when findById rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.menuItems.findById as any).mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useMenuItem('m1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCategories', () => {
  it('calls db.categories.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useCategories());
    expect(mockDb.categories.findAll).toHaveBeenCalled();
  });

  it('returns fetched categories', async () => {
    const mockCategories = [
      { id: 'c1', name: 'Food' },
      { id: 'c2', name: 'Drinks' },
    ];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.categories.findAll as any).mockResolvedValueOnce(mockCategories);

    const { result } = renderHook(() => useCategories(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCategories);
  });

  it('reports error when fetch fails', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.categories.findAll as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHook(() => useCategories(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Menu Item Mutations ─────────────────────────────────────────────────────

describe('useUpdateMenuItem', () => {
  it('calls db.menuItems.update with id and updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateMenuItem());
    await result.current.mutateAsync({ id: 'm1', updates: { name: 'Pizza' } });
    expect(mockDb.menuItems.update).toHaveBeenCalledWith('m1', { name: 'Pizza' });
  });

  it('invalidates MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateMenuItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'm1', updates: {} });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

describe('useCreateMenuItem', () => {
  it('calls db.menuItems.create with data', async () => {
    const data = { name: 'Burger', price: 10, category_id: 'c1' };
    const { result, mockDb } = renderHookWithProviders(() => useCreateMenuItem());
    await result.current.mutateAsync(data as any);
    expect(mockDb.menuItems.create).toHaveBeenCalledWith(data);
  });

  it('invalidates MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateMenuItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Burger' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

describe('useToggleMenuItemAvailability', () => {
  it('calls db.menuItems.toggleAvailability with id and currentAvailable', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    await result.current.mutateAsync({ id: 'm1', currentAvailable: true });
    expect(mockDb.menuItems.toggleAvailability).toHaveBeenCalledWith('m1', true);
  });

  it('invalidates MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'm1', currentAvailable: true });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

describe('useDeleteMenuItem', () => {
  it('calls db.menuItems.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteMenuItem());
    await result.current.mutateAsync('m1');
    expect(mockDb.menuItems.delete).toHaveBeenCalledWith('m1');
  });

  it('invalidates MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteMenuItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('m1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

// ─── Category Mutations ─────────────────────────────────────────────────────

describe('useCreateCategory', () => {
  it('calls db.categories.create with data', async () => {
    const data = { name: 'Drinks' };
    const { result, mockDb } = renderHookWithProviders(() => useCreateCategory());
    await result.current.mutateAsync(data as any);
    expect(mockDb.categories.create).toHaveBeenCalledWith(data);
  });

  it('invalidates CATEGORIES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'Drinks' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.CATEGORIES]);
  });
});

describe('useUpdateCategory', () => {
  it('calls db.categories.update with id and updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateCategory());
    await result.current.mutateAsync({ id: 'c1', updates: { name: 'Beverages' } });
    expect(mockDb.categories.update).toHaveBeenCalledWith('c1', { name: 'Beverages' });
  });

  it('invalidates CATEGORIES and MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'c1', updates: {} });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.CATEGORIES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

describe('useDeleteCategory', () => {
  it('calls db.categories.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteCategory());
    await result.current.mutateAsync('c1');
    expect(mockDb.categories.delete).toHaveBeenCalledWith('c1');
  });

  it('invalidates CATEGORIES and MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('c1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.CATEGORIES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

// ─── Mutation Error Handling ─────────────────────────────────────────────────

describe('mutation error handling', () => {
  it('useCreateMenuItem rejects when db call fails', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useCreateMenuItem());
    (mockDb.menuItems.create as any).mockRejectedValueOnce(new Error('Create failed'));
    await expect(result.current.mutateAsync({ name: 'Burger' } as any)).rejects.toThrow(
      'Create failed',
    );
  });

  it('useDeleteCategory rejects when db call fails', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteCategory());
    (mockDb.categories.delete as any).mockRejectedValueOnce(new Error('Delete failed'));
    await expect(result.current.mutateAsync('c1')).rejects.toThrow('Delete failed');
  });
});
