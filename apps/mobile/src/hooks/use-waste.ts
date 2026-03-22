import { QUERY_KEYS } from '@cafe-idare/core';
import type { WasteLogInsert } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { WasteLog } from '@/types';

type WasteMonthlySummary = {
  totalCost: number;
  count: number;
  byReason: { reason: string; total: number; count: number }[];
  byCategory: { category: string; total: number; count: number }[];
};

export function useWasteLogs(options?: { startDate?: string; endDate?: string; reason?: string }) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOGS, options],
    queryFn: async (): Promise<WasteLog[]> => db.waste.findAll(options),
  });
}

export function useWasteMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, year, month],
    queryFn: async (): Promise<WasteMonthlySummary> => db.waste.getMonthlySummary(year, month),
  });
}

export function useCreateWasteLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WasteLogInsert) => db.waste.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_LOGS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.WASTE_SUMMARY] });
    },
    onError: (error: Error) => {
      console.error('Failed to create waste log:', error.message);
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
    onError: (error: Error) => {
      console.error('Failed to delete waste log:', error.message);
    },
  });
}
