import { QUERY_KEYS } from '@gustri/core';
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
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

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

  it('returns fetched waste logs', async () => {
    const mockLogs = [{ id: 'w1', stock_item_id: 's1', quantity: 5 }];
    (db.waste.findAll as any).mockResolvedValueOnce(mockLogs);
    const { result } = renderHookWithProviders(() => useWasteLogs());
    await waitFor(() => expect(result.current.data).toEqual(mockLogs));
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

  it('calls db.waste.create with data', async () => {
    const wasteData = { stock_item_id: 's1', quantity: 5, reason: 'spoiled' } as any;
    const { result } = renderHookWithProviders(() => useCreateWasteLog());
    await result.current.mutateAsync(wasteData);
    expect(db.waste.create).toHaveBeenCalledWith(wasteData);
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

  it('invalidates STOCK_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateWasteLog());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync({ id: 'w1', updates: { quantity: 10 } as any });
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
  });

  it('calls db.waste.update with id and updates', async () => {
    const { result } = renderHookWithProviders(() => useUpdateWasteLog());
    await result.current.mutateAsync({ id: 'w1', updates: { quantity: 10 } as any });
    expect(db.waste.update).toHaveBeenCalledWith('w1', { quantity: 10 });
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

  it('invalidates STOCK_ITEMS on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteWasteLog());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    await result.current.mutateAsync('w1');
    const keys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual([QUERY_KEYS.STOCK_ITEMS]);
  });

  it('calls db.waste.delete with id', async () => {
    const { result } = renderHookWithProviders(() => useDeleteWasteLog());
    await result.current.mutateAsync('w1');
    expect(db.waste.delete).toHaveBeenCalledWith('w1');
  });
});
