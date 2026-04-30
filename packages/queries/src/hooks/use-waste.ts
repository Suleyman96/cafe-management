import type { WasteLog } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '../keys';
import { useDb } from '../provider';

export function useWasteLogs(options?: Record<string, unknown> & { enabled?: boolean }) {
  const db = useDb();
  const { enabled, ...filters } = options ?? {};
  const filterKey = Object.keys(filters).length > 0 ? filters : undefined;
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOGS, filterKey],
    queryFn: () => db.waste.findAll(filterKey) as Promise<WasteLog[]>,
    enabled: enabled ?? true,
  });
}

export function useWasteLog(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_LOG, id],
    queryFn: () => db.waste.findById(id) as Promise<WasteLog>,
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useWasteMonthlySummary(
  year: number,
  month: number,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'monthly', year, month],
    queryFn: () => db.waste.getMonthlySummary(year, month),
    enabled: !!year && !!month && (options?.enabled ?? true),
  });
}

export function useWasteDailySummary(date: string, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'daily', date],
    queryFn: () => db.waste.getDailySummary(date),
    enabled: !!date && (options?.enabled ?? true),
  });
}

export function useTopWastedItems(limit?: number, options?: { enabled?: boolean }) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.WASTE_SUMMARY, 'top', limit],
    queryFn: () => db.waste.getTopWastedItems(limit) as Promise<WasteLog[]>,
    enabled: options?.enabled ?? true,
  });
}
