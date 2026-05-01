import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOrdersHistory } from '@/hooks/use-orders-history';
import { createWrapper } from '../helpers/test-utils';

describe('useOrdersHistory', () => {
  it('calls db.orders.findAll with the page params and the supplied filters', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockResolvedValue([]);

    const filters = { status: 'closed', table_id: 't1' } as const;
    const { result } = renderHook(() => useOrdersHistory(filters), { wrapper });

    await waitFor(() => expect(mockDb.orders.findAll).toHaveBeenCalled());

    expect(mockDb.orders.findAll).toHaveBeenCalledWith({
      ...filters,
      limit: 50,
      offset: 0,
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('signals hasNextPage when the first page comes back full', async () => {
    const { wrapper, mockDb } = createWrapper();
    // First page comes back full (50 rows) → infinite query keeps going.
    const fullPage = Array.from({ length: 50 }, (_, i) => ({ id: `o${i}` }));
    (mockDb.orders.findAll as any).mockResolvedValue(fullPage);

    const { result } = renderHook(() => useOrdersHistory({}), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('marks hasNextPage false when the page is short', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockResolvedValue([{ id: 'o1' }]);

    const { result } = renderHook(() => useOrdersHistory({}), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  it('reports error when findAll rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.orders.findAll as any).mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useOrdersHistory({}), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
