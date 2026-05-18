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

// Channel-filter regression guard:
//   The shared useMenuItems derives its queryKey from Object.keys(options).
//   Passing `isDeliverable: undefined` (a previously-shipped bug) silently
//   changed the cache key for every dine-in caller and busted their cache
//   on deploy. The wrapper must conditionally spread the key — only
//   include it when the caller explicitly wants the filter.
describe('useMenuItems channel-filter call shape', () => {
  it('omits isDeliverable from the wrapper call when not provided (dine-in default)', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItems());
    const arg = (mockDb.menuItems.findAll as any).mock.calls[0][0];
    // The KEY must be absent, not present-with-undefined-value.
    expect('isDeliverable' in arg).toBe(false);
  });

  it('omits isDeliverable when options object is passed but isDeliverable is not set', () => {
    // Edge case: a caller passes `{ initialData: [...] }` for SSR
    // hydration but is in dine-in mode. The wrapper must still omit
    // isDeliverable, not pass `undefined` through.
    const { mockDb } = renderHookWithProviders(() => useMenuItems('cat-1', {}));
    const arg = (mockDb.menuItems.findAll as any).mock.calls[0][0];
    expect('isDeliverable' in arg).toBe(false);
  });

  it('passes isDeliverable: true through when the delivery context opts in', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useMenuItems(undefined, { isDeliverable: true }),
    );
    const arg = (mockDb.menuItems.findAll as any).mock.calls[0][0];
    expect(arg.isDeliverable).toBe(true);
  });

  it('preserves an explicit isDeliverable: false (contract for future audit views)', () => {
    // No production caller passes false today, but the wrapper must not
    // silently coerce it — that would break any future "show only
    // non-deliverable" diagnostic view.
    const { mockDb } = renderHookWithProviders(() =>
      useMenuItems(undefined, { isDeliverable: false }),
    );
    const arg = (mockDb.menuItems.findAll as any).mock.calls[0][0];
    expect(arg.isDeliverable).toBe(false);
  });

  it('always sets isAvailable: true (customer-web never shows out-of-stock items)', () => {
    const { mockDb } = renderHookWithProviders(() =>
      useMenuItems('cat-1', { isDeliverable: true }),
    );
    const arg = (mockDb.menuItems.findAll as any).mock.calls[0][0];
    expect(arg.isAvailable).toBe(true);
  });
});
