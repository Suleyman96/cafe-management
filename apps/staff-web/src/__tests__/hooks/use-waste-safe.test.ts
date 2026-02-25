import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateWasteLog,
  useDeleteWasteLog,
  useTopWastedItems,
  useUpdateWasteLog,
  useWasteDailySummary,
  useWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
} from '@/hooks/use-waste-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useWasteLogs', () => {
  it('calls db.waste.findAll', () => {
    renderHookWithProviders(() => useWasteLogs());
    expect(db.waste.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { startDate: '2026-01-01', reason: 'expired' };
    renderHookWithProviders(() => useWasteLogs(opts));
    expect(db.waste.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useWasteLog', () => {
  it('calls findById', () => {
    renderHookWithProviders(() => useWasteLog('w1'));
    expect(db.waste.findById).toHaveBeenCalledWith('w1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useWasteLog(''));
    expect(db.waste.findById).not.toHaveBeenCalled();
  });
});

describe('useWasteMonthlySummary', () => {
  it('calls getMonthlySummary with year and month', () => {
    renderHookWithProviders(() => useWasteMonthlySummary(2026, 2));
    expect(db.waste.getMonthlySummary).toHaveBeenCalledWith(2026, 2);
  });
});

describe('useWasteDailySummary', () => {
  it('calls getDailySummary with date', () => {
    renderHookWithProviders(() => useWasteDailySummary('2026-02-25'));
    expect(db.waste.getDailySummary).toHaveBeenCalledWith('2026-02-25');
  });

  it('is disabled when date is empty', () => {
    renderHookWithProviders(() => useWasteDailySummary(''));
    expect(db.waste.getDailySummary).not.toHaveBeenCalled();
  });
});

describe('useTopWastedItems', () => {
  it('calls getTopWastedItems with default limit', () => {
    renderHookWithProviders(() => useTopWastedItems());
    expect(db.waste.getTopWastedItems).toHaveBeenCalledWith(5);
  });

  it('passes custom limit', () => {
    renderHookWithProviders(() => useTopWastedItems(10));
    expect(db.waste.getTopWastedItems).toHaveBeenCalledWith(10);
  });
});

describe('useCreateWasteLog', () => {
  it('invalidates WASTE_LOGS, WASTE_SUMMARY, and STOCK_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateWasteLog());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ item_name: 'Tomatoes', quantity: 5 } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WASTE_LOGS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WASTE_SUMMARY]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
  });
});

describe('useUpdateWasteLog', () => {
  it('invalidates WASTE_LOGS and WASTE_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateWasteLog());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'w1', updates: { quantity: 10 } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WASTE_LOGS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WASTE_SUMMARY]);
  });
});

describe('useDeleteWasteLog', () => {
  it('invalidates WASTE_LOGS and WASTE_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteWasteLog());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('w1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WASTE_LOGS]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.WASTE_SUMMARY]);
  });
});
