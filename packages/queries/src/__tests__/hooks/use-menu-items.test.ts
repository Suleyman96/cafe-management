import { describe, expect, it } from 'vitest';
import { useCategories } from '../../hooks/use-categories';
import { useMenuItem, useMenuItems, useMenuItemsPaginated } from '../../hooks/use-menu-items';
import { QUERY_KEYS } from '../../keys';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll with no filters by default', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItems());
    expect(mockDb.menuItems.findAll).toHaveBeenCalledWith(undefined);
  });

  it('strips initialData from the query key', () => {
    const initialData = [{ id: 'm1' } as any];
    const { queryClient } = renderHookWithProviders(() =>
      useMenuItems({ initialData, categoryId: 'c1' }),
    );
    // Query key should only contain the filter, not initialData
    const query = queryClient.getQueryCache().findAll({ queryKey: [QUERY_KEYS.MENU_ITEMS] })[0];
    expect(query?.queryKey).toEqual([QUERY_KEYS.MENU_ITEMS, { categoryId: 'c1' }]);
  });

  it('returns initialData immediately', () => {
    const initialData = [{ id: 'm1', name: 'Pizza' } as any];
    const { result } = renderHookWithProviders(() => useMenuItems({ initialData }));
    expect(result.current.data).toEqual(initialData);
  });
});

describe('useMenuItemsPaginated', () => {
  it('forwards page, pageSize, categoryId', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItemsPaginated(2, 20, 'c1'));
    expect(mockDb.menuItems.findAllPaginated).toHaveBeenCalledWith({
      page: 2,
      pageSize: 20,
      categoryId: 'c1',
    });
  });
});

describe('useMenuItem', () => {
  it('calls findById when id provided', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItem('m1'));
    expect(mockDb.menuItems.findById).toHaveBeenCalledWith('m1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useMenuItem(''));
    expect(mockDb.menuItems.findById).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCategories', () => {
  it('calls findAll without filter by default', () => {
    const { mockDb } = renderHookWithProviders(() => useCategories());
    expect(mockDb.categories.findAll).toHaveBeenCalledWith(undefined);
  });

  it('strips initialData from filter options', () => {
    const initialData = [{ id: 'c1' } as any];
    const { queryClient } = renderHookWithProviders(() =>
      useCategories({ initialData, isActive: true }),
    );
    const query = queryClient.getQueryCache().findAll({ queryKey: [QUERY_KEYS.CATEGORIES] })[0];
    expect(query?.queryKey).toEqual([QUERY_KEYS.CATEGORIES, { isActive: true }]);
  });

  it('returns initialData immediately', () => {
    const initialData = [{ id: 'c1', name: 'Drinks' } as any];
    const { result } = renderHookWithProviders(() => useCategories({ initialData }));
    expect(result.current.data).toEqual(initialData);
  });
});
