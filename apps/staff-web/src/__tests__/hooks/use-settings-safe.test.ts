import { QUERY_KEYS } from '@gustri/core';
import { describe, expect, it, vi } from 'vitest';
import { useCafeSettings, useUpdateCafeSettings } from '@/hooks/use-settings-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useCafeSettings', () => {
  it('calls db.settings.get', () => {
    renderHookWithProviders(() => useCafeSettings());
    expect(db.settings.get).toHaveBeenCalled();
  });
});

describe('useUpdateCafeSettings', () => {
  it('invalidates CAFE_SETTINGS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateCafeSettings());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ cafe_name: 'Updated Cafe' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.CAFE_SETTINGS]);
  });
});
