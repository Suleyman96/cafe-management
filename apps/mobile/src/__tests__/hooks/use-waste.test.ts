import { describe, expect, it, vi } from 'vitest';
import {
  useCreateWasteLog,
  useDeleteWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
} from '@/hooks/use-waste';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useWasteLogs', () => {
  it('calls db.waste.findAll', () => {
    renderHookWithProviders(() => useWasteLogs());
    expect(db.waste.findAll).toHaveBeenCalled();
  });

  it('passes options', () => {
    const opts = { reason: 'expired' };
    renderHookWithProviders(() => useWasteLogs(opts));
    expect(db.waste.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useWasteMonthlySummary', () => {
  it('calls getMonthlySummary with year and month', () => {
    renderHookWithProviders(() => useWasteMonthlySummary(2026, 3));
    expect(db.waste.getMonthlySummary).toHaveBeenCalledWith(2026, 3);
  });
});

describe('useCreateWasteLog', () => {
  it('invalidates waste-logs and waste-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateWasteLog());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ item_name: 'Milk', quantity: 2 });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['waste_logs']);
    expect(keys).toContainEqual(['waste_summary']);
  });
});

describe('useDeleteWasteLog', () => {
  it('invalidates waste-logs and waste-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteWasteLog());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('w1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['waste_logs']);
    expect(keys).toContainEqual(['waste_summary']);
  });
});
