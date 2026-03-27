import { useCategories, useMenuItem, useMenuItems } from '@/hooks/use-menu';
import { db } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useCategories', () => {
  it('calls db.categories.findAll with isActive filter', () => {
    renderHookWithProviders(() => useCategories());
    expect(db.categories.findAll).toHaveBeenCalledWith({ isActive: true });
  });
});

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll with isAvailable filter', () => {
    renderHookWithProviders(() => useMenuItems());
    expect(db.menuItems.findAll).toHaveBeenCalledWith({
      categoryId: undefined,
      isAvailable: true,
    });
  });

  it('passes categoryId when provided', () => {
    renderHookWithProviders(() => useMenuItems('cat-1'));
    expect(db.menuItems.findAll).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      isAvailable: true,
    });
  });
});

describe('useMenuItem', () => {
  it('calls db.menuItems.findById with item id', () => {
    renderHookWithProviders(() => useMenuItem('item-1'));
    expect(db.menuItems.findById).toHaveBeenCalledWith('item-1');
  });

  it('returns data on success', async () => {
    const mockItem = { id: 'item-1', name_en: 'Coffee', price: 5 };
    (db.menuItems.findById as any).mockResolvedValueOnce(mockItem);

    const { result } = renderHookWithProviders(() => useMenuItem('item-1'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItem);
  });
});
