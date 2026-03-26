import { QUERY_KEYS } from '@cafe-idare/core';
import {
  useCategories,
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useMenuItem,
  useMenuItems,
  useMenuItemsByCategory,
  useToggleMenuItemAvailability,
  useUpdateCategory,
  useUpdateMenuItem,
} from '@/hooks/use-menu-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

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
});

describe('useCategories', () => {
  it('calls db.categories.findAll', () => {
    renderHookWithProviders(() => useCategories());
    expect(db.categories.findAll).toHaveBeenCalled();
  });
});

// ─── Menu Item Mutations ─────────────────────────────────────────────────────

describe('useUpdateMenuItem', () => {
  it('calls db.menuItems.update with id and updates', async () => {
    const { result } = renderHookWithProviders(() => useUpdateMenuItem());
    await result.current.mutateAsync({ id: 'm1', updates: { name_en: 'Pizza' } });
    expect(db.menuItems.update).toHaveBeenCalledWith('m1', { name_en: 'Pizza' });
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
    const data = { name_en: 'Burger', price: 10, category_id: 'c1' };
    const { result } = renderHookWithProviders(() => useCreateMenuItem());
    await result.current.mutateAsync(data as any);
    expect(db.menuItems.create).toHaveBeenCalledWith(data);
  });

  it('invalidates MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateMenuItem());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name_en: 'Burger' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.MENU_ITEMS]);
  });
});

describe('useToggleMenuItemAvailability', () => {
  it('calls db.menuItems.toggleAvailability with id', async () => {
    const { result } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    await result.current.mutateAsync('m1');
    expect(db.menuItems.toggleAvailability).toHaveBeenCalledWith('m1');
  });

  it('invalidates MENU_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useToggleMenuItemAvailability());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('m1');

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
    const data = { name_en: 'Drinks' };
    const { result } = renderHookWithProviders(() => useCreateCategory());
    await result.current.mutateAsync(data as any);
    expect(db.categories.create).toHaveBeenCalledWith(data);
  });

  it('invalidates CATEGORIES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name_en: 'Drinks' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.CATEGORIES]);
  });
});

describe('useUpdateCategory', () => {
  it('calls db.categories.update with id and updates', async () => {
    const { result } = renderHookWithProviders(() => useUpdateCategory());
    await result.current.mutateAsync({ id: 'c1', updates: { name_en: 'Beverages' } });
    expect(db.categories.update).toHaveBeenCalledWith('c1', { name_en: 'Beverages' });
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

// ─── Composite Hook ─────────────────────────────────────────────────────────

describe('useMenuItemsByCategory', () => {
  it('groups menu items by category_id', async () => {
    const items = [
      { id: 'm1', category_id: 'c1', name_en: 'Pizza' },
      { id: 'm2', category_id: 'c1', name_en: 'Pasta' },
      { id: 'm3', category_id: 'c2', name_en: 'Coke' },
      { id: 'm4', category_id: null, name_en: 'Special' },
    ];
    (db.menuItems.findAll as any).mockResolvedValueOnce(items);
    (db.categories.findAll as any).mockResolvedValueOnce([
      { id: 'c1', name_en: 'Food' },
      { id: 'c2', name_en: 'Drinks' },
    ]);

    const { result } = renderHookWithProviders(() => useMenuItemsByCategory());

    await vi.waitFor(() => {
      expect(result.current.data.groupedItems.c1).toHaveLength(2);
    });

    expect(result.current.data.groupedItems.c2).toHaveLength(1);
    expect(result.current.data.groupedItems.uncategorized).toHaveLength(1);
    expect(result.current.data.categories).toHaveLength(2);
  });
});
