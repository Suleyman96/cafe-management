import { describe, expect, it } from 'vitest';
import { useTable, useTableByQrCode, useTables } from '../../hooks/use-tables';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useTables', () => {
  it('calls db.tables.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useTables());
    expect(mockDb.tables.findAll).toHaveBeenCalled();
  });
});

describe('useTable', () => {
  it('calls db.tables.findById with id', () => {
    const { mockDb } = renderHookWithProviders(() => useTable('t1'));
    expect(mockDb.tables.findById).toHaveBeenCalledWith('t1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useTable(''));
    expect(mockDb.tables.findById).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useTableByQrCode', () => {
  it('calls db.tables.findByQrCode with the QR code', () => {
    const { mockDb } = renderHookWithProviders(() => useTableByQrCode('QR-1'));
    expect(mockDb.tables.findByQrCode).toHaveBeenCalledWith('QR-1');
  });

  it('is disabled when qrCode is empty', () => {
    const { mockDb, result } = renderHookWithProviders(() => useTableByQrCode(''));
    expect(mockDb.tables.findByQrCode).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });
});
