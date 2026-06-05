import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { patchQueries, rollbackQueries } from '../optimistic';

describe('patchQueries (ADD-5)', () => {
  it('patches every cache entry matching the (partial) key', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['orders', 't1'], [{ id: 'a', status: 'new' }]);
    qc.setQueryData(['orders', 't1', { filter: 1 }], [{ id: 'a', status: 'new' }]);
    // different key — must NOT be touched
    qc.setQueryData(['tables', 't1'], [{ id: 'x' }]);

    await patchQueries<Array<{ id: string; status: string }>>(qc, ['orders'], (list) =>
      list.map((o) => (o.id === 'a' ? { ...o, status: 'preparing' } : o)),
    );

    expect(qc.getQueryData<any[]>(['orders', 't1'])?.[0].status).toBe('preparing');
    expect(qc.getQueryData<any[]>(['orders', 't1', { filter: 1 }])?.[0].status).toBe('preparing');
    expect(qc.getQueryData<any[]>(['tables', 't1'])?.[0]).toEqual({ id: 'x' });
  });

  it('skips empty cache entries (null/undefined) without throwing', async () => {
    const qc = new QueryClient();
    qc.setQueryData(['orders', 't1'], undefined);
    const snap = await patchQueries<any[]>(qc, ['orders'], (l) => l);
    expect(Array.isArray(snap)).toBe(true);
  });

  it('cancels in-flight refetches before writing', async () => {
    const qc = new QueryClient();
    const cancelSpy = vi.spyOn(qc, 'cancelQueries');
    await patchQueries(qc, ['orders'], (x) => x);
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: ['orders'] });
  });

  it('returns a snapshot that rollbackQueries restores exactly', async () => {
    const qc = new QueryClient();
    const original = [{ id: 'a', status: 'new' }];
    qc.setQueryData(['orders', 't1'], original);

    const snapshot = await patchQueries<typeof original>(qc, ['orders'], (list) =>
      list.map((o) => ({ ...o, status: 'preparing' })),
    );
    expect(qc.getQueryData<any[]>(['orders', 't1'])?.[0].status).toBe('preparing');

    rollbackQueries(qc, snapshot);
    expect(qc.getQueryData<any[]>(['orders', 't1'])?.[0].status).toBe('new');
  });
});
