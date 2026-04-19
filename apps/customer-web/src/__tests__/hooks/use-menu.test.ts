import { renderHook } from '@testing-library/react';
import { useCategories, useMenuItem, useMenuItems } from '@/hooks/use-menu';
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useCategories', () => {
  it('calls db.categories.findAll with isActive filter', () => {
    const { mockDb } = renderHookWithProviders(() => useCategories());
    expect(mockDb.categories.findAll).toHaveBeenCalledWith({ isActive: true });
  });

  it('returns fetched categories', async () => {
    const mockCategories = [
      { id: 'c1', name_en: 'Drinks', is_active: true },
      { id: 'c2', name_en: 'Food', is_active: true },
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
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll with isAvailable filter', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItems());
    expect(mockDb.menuItems.findAll).toHaveBeenCalledWith({
      categoryId: undefined,
      isAvailable: true,
    });
  });

  it('passes categoryId when provided', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItems('cat-1'));
    expect(mockDb.menuItems.findAll).toHaveBeenCalledWith({
      categoryId: 'cat-1',
      isAvailable: true,
    });
  });

  it('returns fetched menu items', async () => {
    const mockItems = [
      { id: 'm1', name_en: 'Coffee', price: 5 },
      { id: 'm2', name_en: 'Tea', price: 3 },
    ];
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
  it('calls db.menuItems.findById with item id', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItem('item-1'));
    expect(mockDb.menuItems.findById).toHaveBeenCalledWith('item-1');
  });

  it('returns data on success', async () => {
    const mockItem = { id: 'item-1', name_en: 'Coffee', price: 5 };
    const { wrapper, mockDb } = createWrapper();
    (mockDb.menuItems.findById as any).mockResolvedValueOnce(mockItem);

    const { result } = renderHook(() => useMenuItem('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockItem);
  });

  it('reports error when findById rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.menuItems.findById as any).mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useMenuItem('item-1'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
