import type { Table } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useTables(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES),
    queryFn: () => db.tables.findAll() as Promise<Table[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useTable(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.TABLE, id),
    queryFn: () => db.tables.findById(id) as Promise<Table>,
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useTableByQrCode(qrCode: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.TABLE_QR, qrCode),
    queryFn: () => db.tables.findByQrCode(qrCode) as Promise<Table>,
    enabled: !!qrCode && (options?.enabled ?? true),
  });
}
