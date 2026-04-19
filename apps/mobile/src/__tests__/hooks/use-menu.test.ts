import { describe, expect, it } from 'vitest';
import { useCategories, useMenuItems } from '@/hooks/use-menu';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useMenuItems());
    expect(mockDb.menuItems.findAll).toHaveBeenCalled();
  });
});

describe('useCategories', () => {
  it('calls db.categories.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useCategories());
    expect(mockDb.categories.findAll).toHaveBeenCalledWith({ isActive: true });
  });
});
