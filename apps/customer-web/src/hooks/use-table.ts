import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, STALE_TIMES } from '@/lib/query-keys';
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
    queryFn: async () => {
      // If it looks like a UUID, query by id directly
      if (isUUID(tableNumber)) {
        const data = await db.tables.findById(tableNumber);
        return data as Table;
      }

      // Try to find by table_number (for friendly URLs)
      try {
        const data = await db.tables.findByTableNumber(tableNumber);
        return data as Table;
      } catch {
        // If not found by table_number, try by ID (for backwards compatibility)
        const data = await db.tables.findById(tableNumber);
        return data as Table;
      }
    },
    staleTime: STALE_TIMES.SHORT,
  });
}
