/**
 * Type-Safe Tables Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type TableRow = Database['public']['Tables']['tables']['Row'];
type TableStatus = TableRow['status'];

export function useTables() {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLES],
    queryFn: async (): Promise<TableRow[]> => db.tables.findAll(),
  });
}

export function useTable(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE, id],
    queryFn: async (): Promise<TableRow> => db.tables.findById(id),
    enabled: !!id,
  });
}

export function useTableByQrCode(qrCode: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE_QR, qrCode],
    queryFn: async (): Promise<TableRow> => db.tables.findByQrCode(qrCode),
    enabled: !!qrCode,
  });
}

export function useUpdateTableStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tableId, status }: { tableId: string; status: TableStatus }) =>
      db.tables.updateStatus(tableId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ORDERS] });
    },
  });
}

export function useCreateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tableData: Database['public']['Tables']['tables']['Insert']) =>
      db.tables.create(tableData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Database['public']['Tables']['tables']['Update'];
    }) => db.tables.update(id, updates),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLE, data.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLE_QR] });
    },
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.tables.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TABLE_QR] });
    },
  });
}

// Note: Table transfer functionality is in use-table-transfers-safe.ts
