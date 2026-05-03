import { tenantKey } from '@gustri/queries';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateWasteLog,
  useDeleteWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
} from '@/hooks/use-waste';
import { renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

describe('useWasteLogs', () => {
  it('calls db.waste.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteLogs());
    expect(mockDb.waste.findAll).toHaveBeenCalled();
  });

  it('passes options', () => {
    const opts = { reason: 'expired' };
    const { mockDb } = renderHookWithProviders(() => useWasteLogs(opts));
    expect(mockDb.waste.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useWasteMonthlySummary', () => {
  it('calls getMonthlySummary with year and month', () => {
    const { mockDb } = renderHookWithProviders(() => useWasteMonthlySummary(2026, 3));
    expect(mockDb.waste.getMonthlySummary).toHaveBeenCalledWith(2026, 3);
  });
});

describe('useCreateWasteLog', () => {
  it('invalidates waste-logs and waste-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateWasteLog());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ item_name: 'Milk', quantity: 2 });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'waste_logs'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'waste_summary'));
  });
});

describe('useDeleteWasteLog', () => {
  it('invalidates waste-logs and waste-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteWasteLog());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('w1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'waste_logs'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'waste_summary'));
  });
});
