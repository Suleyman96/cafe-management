import { QUERY_KEYS } from '@gustri/core';
import type { WasteLog } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useWasteLogs(options?: Record<string, unknown>) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOGS, options],
    queryFn: () => db.waste.findAll(options) as Promise<WasteLog[]>,
  });
}

export function useWasteLog(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOG, id],
    queryFn: () => db.waste.findById(id) as Promise<WasteLog>,
    enabled: !!id,
  });
}

export function useWasteMonthlySummary(year: number, month: number) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'monthly', year, month],
    queryFn: () => db.waste.getMonthlySummary(year, month),
    enabled: !!year && !!month,
  });
}

export function useWasteDailySummary(date: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'daily', date],
    queryFn: () => db.waste.getDailySummary(date),
    enabled: !!date,
  });
}

export function useTopWastedItems(limit?: number) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'top', limit],
    queryFn: () => db.waste.getTopWastedItems(limit) as Promise<WasteLog[]>,
  });
}
