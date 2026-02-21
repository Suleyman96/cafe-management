import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
    queryKey: ['table', tableNumber],
    queryFn: async () => {
      // If it looks like a UUID, query by id directly
      if (isUUID(tableNumber)) {
        const { data, error } = await supabase
          .from('tables')
          .select('*')
          .eq('id', tableNumber)
          .single();

        if (error) throw error;
        return data as Table;
      }

      // First try to find by table_number (for friendly URLs)
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('table_number', tableNumber)
        .single();

      if (error) {
        // If not found by table_number, try by ID (for backwards compatibility)
        const { data: dataById, error: errorById } = await supabase
          .from('tables')
          .select('*')
          .eq('id', tableNumber)
          .single();

        if (errorById) throw errorById;
        return dataById as Table;
      }

      return data as Table;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}
