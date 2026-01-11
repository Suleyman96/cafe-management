import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { WaiterCall } from "@/types";

export function useWaiterCalls(tableId: string) {
  return useQuery({
    queryKey: ["waiter_calls", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waiter_calls")
        .select("*")
        .eq("table_id", tableId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WaiterCall[];
    },
  });
}

export function useCallWaiter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      reason,
    }: {
      tableId: string;
      reason: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("waiter_calls")
        .insert({
          table_id: tableId,
          reason,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data as WaiterCall;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["waiter_calls", variables.tableId],
      });
    },
  });
}


