import { QUERY_KEYS } from '@gustri/queries';
import { useQuery } from '@tanstack/react-query';
import { STALE_TIMES } from '@/lib/stale-times';
import { db } from '@/lib/supabase';
import type { Table } from '@/types';

// Check if a string looks like a UUID
const isUUID = (str: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Fetch table by table_number (e.g., "T01", "T02")
 * This allows friendly URLs like /table/T01 instead of UUIDs
 * Also supports UUID lookup for backwards compatibility
 */
export function useTable(tableNumber: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TABLE, tableNumber],
    queryFn: async (): Promise<Table> => {
      // If it looks like a UUID, query by id directly
      if (isUUID(tableNumber)) {
        return db.tables.findById(tableNumber);
      }

      // Try to find by table_number (for friendly URLs)
      try {
        return await db.tables.findByTableNumber(tableNumber);
      } catch {
        // If not found by table_number, try by ID (for backwards compatibility)
        return db.tables.findById(tableNumber);
      }
    },
    staleTime: STALE_TIMES.SHORT,
  });
}
