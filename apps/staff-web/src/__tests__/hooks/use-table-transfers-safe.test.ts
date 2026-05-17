import { describe, expect, it } from 'vitest';
import { useOrderTransferHistory } from '@/hooks/use-table-transfers-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders } from '../helpers/test-utils';

// `useTransferTable` itself was promoted to `@gustri/queries` in Phase 1.5
// and has its tests in `packages/queries/src/__tests__/mutations/use-table-mutations.test.ts`.
// This file only covers the web-local read hooks that still live in
// `use-table-transfers-safe.ts`.

describe('useOrderTransferHistory', () => {
  it('calls db.orders.findById to get transfer history', () => {
    (db.orders.findById as any).mockResolvedValueOnce({ table_transfers: [{ id: 't1' }] });
    renderHookWithProviders(() => useOrderTransferHistory('o1'));
    expect(db.orders.findById).toHaveBeenCalledWith('o1');
  });

  it('is disabled when orderId is empty', () => {
    renderHookWithProviders(() => useOrderTransferHistory(''));
    expect(db.orders.findById).not.toHaveBeenCalled();
  });
});
