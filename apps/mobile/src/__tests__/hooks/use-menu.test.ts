import { describe, expect, it } from 'vitest';
import { useCategories, useMenuItems } from '@/hooks/use-menu';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useMenuItems', () => {
  it('calls db.menuItems.findAll', () => {
    renderHookWithProviders(() => useMenuItems());
    expect(db.menuItems.findAll).toHaveBeenCalled();
  });
});

describe('useCategories', () => {
  it('calls db.categories.findAll', () => {
    renderHookWithProviders(() => useCategories());
    expect(db.categories.findAll).toHaveBeenCalledWith({ isActive: true });
  });
});
