import { describe, expect, it, vi } from 'vitest';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks/use-cafe-settings';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useCafeSettings', () => {
  it('calls db.settings.get', () => {
    renderHookWithProviders(() => useCafeSettings());
    expect(db.settings.get).toHaveBeenCalled();
  });
});

describe('useUpdateCafeSettings', () => {
  it('invalidates cafe-settings on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateCafeSettings());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ restaurant_name: 'New Name' });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['cafe_settings']);
  });
});
