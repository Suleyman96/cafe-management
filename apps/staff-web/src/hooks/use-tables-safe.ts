/**
 * Type-Safe Tables Hooks
 * Uses the wrapped client for type safety without 'as any'
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';
import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';

type TableStatus = Database['public']['Tables']['tables']['Row']['status'];

export function useTables() {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLES],
    queryFn: () => db.tables.findAll(),
  });
}

export function useTable(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE, id],
    queryFn: () => db.tables.findById(id),
    enabled: !!id,
  });
}

export function useTableByQrCode(qrCode: string) {
  return useQuery({
    queryKey: ['table-qr', qrCode],
    queryFn: () => db.tables.findByQrCode(qrCode),
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

// Note: Table transfer functionality is in use-table-transfers-safe.ts