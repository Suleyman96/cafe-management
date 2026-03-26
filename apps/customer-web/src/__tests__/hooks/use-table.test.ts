import { useTable } from '@/hooks/use-table';
import { db } from '@/lib/supabase';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

const MOCK_TABLE = { id: 'uuid-1', table_number: 'T01', status: 'free' };

describe('useTable', () => {
  it('calls findById directly when passed a UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    renderHookWithProviders(() => useTable(uuid));
    expect(db.tables.findById).toHaveBeenCalledWith(uuid);
    expect(db.tables.findByTableNumber).not.toHaveBeenCalled();
  });

  it('calls findByTableNumber for non-UUID strings', () => {
    renderHookWithProviders(() => useTable('T01'));
    expect(db.tables.findByTableNumber).toHaveBeenCalledWith('T01');
  });

  it('falls back to findById when findByTableNumber throws', async () => {
    (db.tables.findByTableNumber as any).mockRejectedValueOnce(new Error('Not found'));
    (db.tables.findById as any).mockResolvedValueOnce(MOCK_TABLE);

    const { result } = renderHookWithProviders(() => useTable('T01'));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(db.tables.findByTableNumber).toHaveBeenCalledWith('T01');
    expect(db.tables.findById).toHaveBeenCalledWith('T01');
    expect(result.current.data).toEqual(MOCK_TABLE);
  });

  it('returns data for UUID lookup', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    (db.tables.findById as any).mockResolvedValueOnce(MOCK_TABLE);

    const { result } = renderHookWithProviders(() => useTable(uuid));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(MOCK_TABLE);
  });
});
