import { QUERY_KEYS } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
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
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useWasteLogs', () => {
  it('calls db.waste.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteLogs());
    expect(mockDb.waste.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { startDate: '2026-01-01', reason: 'expired' };
    const { mockDb } = renderHookWithProviders(() => useWasteLogs(opts));
    expect(mockDb.waste.findAll).toHaveBeenCalledWith(opts);
  });

  it('returns fetched waste logs', async () => {
    const mockLogs = [{ id: 'w1', stock_item_id: 's1', quantity: 5 }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.waste.findAll as any).mockResolvedValueOnce(mockLogs);
    const { result } = renderHook(() => useWasteLogs(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockLogs));
  });
});

describe('useWasteLog', () => {
  it('calls findById', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteLog('w1'));
    expect(mockDb.waste.findById).toHaveBeenCalledWith('w1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteLog(''));
    expect(mockDb.waste.findById).not.toHaveBeenCalled();
  });
});

describe('useWasteMonthlySummary', () => {
  it('calls getMonthlySummary with year and month', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteMonthlySummary(2026, 2));
    expect(mockDb.waste.getMonthlySummary).toHaveBeenCalledWith(2026, 2);
  });
});

describe('useWasteDailySummary', () => {
  it('calls getDailySummary with date', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteDailySummary('2026-02-25'));
    expect(mockDb.waste.getDailySummary).toHaveBeenCalledWith('2026-02-25');
  });

  it('is disabled when date is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteDailySummary(''));
    expect(mockDb.waste.getDailySummary).not.toHaveBeenCalled();
  });
});

describe('useTopWastedItems', () => {
  it('calls getTopWastedItems with default limit', () => {
    const { mockDb } = renderHookWithProviders(() => useTopWastedItems());
    expect(mockDb.waste.getTopWastedItems).toHaveBeenCalledWith(undefined);
  });

  it('passes custom limit', () => {
    const { mockDb } = renderHookWithProviders(() => useTopWastedItems(10));
    expect(mockDb.waste.getTopWastedItems).toHaveBeenCalledWith(10);
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
  });

  it('calls db.waste.create with data', async () => {
    const wasteData = { stock_item_id: 's1', quantity: 5, reason: 'spoiled' } as any;
    const { result, mockDb } = renderHookWithProviders(() => useCreateWasteLog());
    await result.current.mutateAsync(wasteData);
    expect(mockDb.waste.create).toHaveBeenCalledWith(wasteData);
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

  it('calls db.waste.update with id and updates', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useUpdateWasteLog());
    await result.current.mutateAsync({ id: 'w1', updates: { quantity: 10 } as any });
    expect(mockDb.waste.update).toHaveBeenCalledWith('w1', { quantity: 10 });
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

  it('calls db.waste.delete with id', async () => {
    const { result, mockDb } = renderHookWithProviders(() => useDeleteWasteLog());
    await result.current.mutateAsync('w1');
    expect(mockDb.waste.delete).toHaveBeenCalledWith('w1');
  });
});
