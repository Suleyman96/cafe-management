import { QUERY_KEYS } from '@gustri/core';
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
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

// ─── Queries ─────────────────────────────────────────────────────────────────

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll without options', () => {
    renderHookWithProviders(() => useMenuItems());
    expect(db.menuItems.findAll).toHaveBeenCalledWith(undefined);
  });

  it('passes filter options to findAll', () => {
    const options = { categoryId: 'c1', isAvailable: true };
    renderHookWithProviders(() => useMenuItems(options));
    expect(db.menuItems.findAll).toHaveBeenCalledWith(options);
  });

  it('returns fetched menu items', async () => {
    const mockItems = [{ id: 'm1', name: 'Pizza', price: 10 }];
    (db.menuItems.findAll as any).mockResolvedValueOnce(mockItems);

    const { result } = renderHookWithProviders(() => useMenuItems());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItems);
  });

  it('reports error when fetch fails', async () => {
    (db.menuItems.findAll as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHookWithProviders(() => useMenuItems());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMenuItem', () => {
  it('calls db.menuItems.findById with given id', () => {
    renderHookWithProviders(() => useMenuItem('m1'));
    expect(db.menuItems.findById).toHaveBeenCalledWith('m1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useMenuItem(''));
    expect(db.menuItems.findById).not.toHaveBeenCalled();
  });

  it('returns data on success', async () => {
    const mockItem = { id: 'm1', name: 'Pizza', price: 10 };
    (db.menuItems.findById as any).mockResolvedValueOnce(mockItem);

    const { result } = renderHookWithProviders(() => useMenuItem('m1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItem);
  });

  it('reports error when findById rejects', async () => {
    (db.menuItems.findById as any).mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHookWithProviders(() => useMenuItem('m1'));

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCategories', () => {
  it('calls db.categories.findAll', () => {
    renderHookWithProviders(() => useCategories());
    expect(db.categories.findAll).toHaveBeenCalled();
  });

  it('returns fetched categories', async () => {
    const mockCategories = [
      { id: 'c1', name: 'Food' },
      { id: 'c2', name: 'Drinks' },
    ];
    (db.categories.findAll as any).mockResolvedValueOnce(mockCategories);

    const { result } = renderHookWithProviders(() => useCategories());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockCategories);
  });

  it('reports error when fetch fails', async () => {
    (db.categories.findAll as any).mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHookWithProviders(() => useCategories());

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ─── Menu Item Mutations ─────────────────────────────────────────────────────

describe('useUpdateMenuItem', () => {
  it('calls db.menuItems.update with id and updates', async () => {
    const { result } = renderHookWithProviders(() => useUpdateMenuItem());
    await result.current.mutateAsync({ id: 'm1', updates: { name: 'Pizza' } });
    expect(db.menuItems.update).toHaveBeenCalledWith('m1', { name: 'Pizza' });
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
    const { result } = renderHookWithProviders(() => useCreateMenuItem());
    await result.current.mutateAsync(data as any);
    expect(db.menuItems.create).toHaveBeenCalledWith(data);
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
    const { result } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    await result.current.mutateAsync({ id: 'm1', currentAvailable: true });
    expect(db.menuItems.toggleAvailability).toHaveBeenCalledWith('m1', true);
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
    const { result } = renderHookWithProviders(() => useDeleteMenuItem());
    await result.current.mutateAsync('m1');
    expect(db.menuItems.delete).toHaveBeenCalledWith('m1');
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
    const { result } = renderHookWithProviders(() => useCreateCategory());
    await result.current.mutateAsync(data as any);
    expect(db.categories.create).toHaveBeenCalledWith(data);
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
    const { result } = renderHookWithProviders(() => useUpdateCategory());
    await result.current.mutateAsync({ id: 'c1', updates: { name: 'Beverages' } });
    expect(db.categories.update).toHaveBeenCalledWith('c1', { name: 'Beverages' });
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
    const { result } = renderHookWithProviders(() => useDeleteCategory());
    await result.current.mutateAsync('c1');
    expect(db.categories.delete).toHaveBeenCalledWith('c1');
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
    (db.menuItems.create as any).mockRejectedValueOnce(new Error('Create failed'));
    const { result } = renderHookWithProviders(() => useCreateMenuItem());
    await expect(result.current.mutateAsync({ name: 'Burger' } as any)).rejects.toThrow(
      'Create failed',
    );
  });

  it('useDeleteCategory rejects when db call fails', async () => {
    (db.categories.delete as any).mockRejectedValueOnce(new Error('Delete failed'));
    const { result } = renderHookWithProviders(() => useDeleteCategory());
    await expect(result.current.mutateAsync('c1')).rejects.toThrow('Delete failed');
  });
});
