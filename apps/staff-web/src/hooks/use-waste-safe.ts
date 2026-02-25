/**
 * Type-Safe Waste Hooks
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase/wrapped-client';

type WasteLogInsert = Database['public']['Tables']['waste_logs']['Insert'];
type WasteLog = Database['public']['Tables']['waste_logs']['Row'];

export function useWasteLogs(options?: {
  startDate?: string;
  endDate?: string;
  reason?: string;
  stockItemId?: string;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOGS, options],
    queryFn: () => db.waste.findAll(options),
  });
}

export function useWasteLog(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOG, id],
    queryFn: () => db.waste.findById(id),
    enabled: !!id,
  });
}

export function useCreateWasteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WasteLogInsert) => db.waste.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.STOCK_ITEMS] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
    },
  });
}

export function useUpdateWasteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<WasteLog> }) =>
      db.waste.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
    },
  });
}

export function useDeleteWasteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.waste.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
    },
    onSettled: () => {
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.refetchQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
    },
  });
}

export function useWasteMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, year, month],
    queryFn: () => db.waste.getMonthlySummary(year, month),
  });
}

export function useWasteDailySummary(date: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'daily', date],
    queryFn: () => db.waste.getDailySummary(date),
    enabled: !!date,
  });
}

export function useTopWastedItems(limit = 5) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'top', limit],
    queryFn: () => db.waste.getTopWastedItems(limit),
  });
}
