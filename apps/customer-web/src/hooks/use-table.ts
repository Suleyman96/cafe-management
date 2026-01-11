import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Table } from "@/types";

export function useTable(tableId: string) {
  return useQuery({
    queryKey: ["table", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("id", tableId)
        .single();

      if (error) throw error;
      return data as Table;
    },
    staleTime: 1000 * 60, // 1 minute
  });
}


