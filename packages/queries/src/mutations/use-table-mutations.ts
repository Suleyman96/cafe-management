import type { Table, TablesInsert, TablesUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

export function useUpdateTableStatus(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Table['status'] }) =>
      db.tables.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
    },
    onError: options?.onError,
  });
}

export function useCreateTable(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TablesInsert) => db.tables.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
    },
    onError: options?.onError,
  });
}

export function useUpdateTable(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TablesUpdate }) =>
      db.tables.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
    },
    onError: options?.onError,
  });
}

export function useDeleteTable(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.tables.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
    },
    onError: options?.onError,
  });
}

interface TransferTableData {
  orderId: string;
  fromTableId: string;
  toTableId: string;
  staffId: string;
  reason?: string;
}

/**
 * Transfers a single order between tables via the `transfer_table` RPC and
 * fans out invalidations to every cache slice that observes either table or
 * the order — the source/target table rows, the tenant-wide tables list,
 * the order detail + list, and the transfers audit table (the staff-web
 * order detail surface reads it back to render the transfer history strip).
 *
 * The RPC handles authorization + audit-log insert + status flips
 * atomically; the client only needs to invalidate.
 */
export function useTransferTable(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: TransferTableData) => db.rpc.transferTable(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.TABLES) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.TABLE, variables.fromTableId),
      });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.TABLE, variables.toTableId),
      });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, QUERY_KEYS.ORDERS) });
      queryClient.invalidateQueries({
        queryKey: tenantKey(tenantId, QUERY_KEYS.ORDER, variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: tenantKey(tenantId, 'table_transfers') });
    },
    onError: options?.onError,
  });
}
