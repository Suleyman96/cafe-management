import { QUERY_KEYS } from '@gustri/core';
import type { Table } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useTables() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TABLES],
    queryFn: () => db.tables.findAll() as Promise<Table[]>,
  });
}

export function useTable(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE, id],
    queryFn: () => db.tables.findById(id) as Promise<Table>,
    enabled: !!id,
  });
}

export function useTableByQrCode(qrCode: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE_QR, qrCode],
    queryFn: () => db.tables.findByQrCode(qrCode) as Promise<Table>,
    enabled: !!qrCode,
  });
}
