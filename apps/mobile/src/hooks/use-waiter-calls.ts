import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import type { WaiterCallWithTable } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { notifyWaiterCall } from "@/lib/notifications";
import { playWaiterCallSound } from "@/lib/sound";

export function useWaiterCalls(status: string = "pending") {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["waiter_calls", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waiter_calls")
        .select("*, table:tables(table_number, location)")
        .eq("status", status)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as WaiterCallWithTable[];
    },
  });

  // Real-time subscription
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel("waiter_calls")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "waiter_calls",
          },
          async (payload) => {
            // Play sound and show notification
            await playWaiterCallSound();
            
            // Fetch table info
            const { data: tableData } = await supabase
              .from("tables")
              .select("table_number")
              .eq("id", (payload.new as any).table_id)
              .single();

            if (tableData) {
              await notifyWaiterCall(
                tableData.table_number,
                (payload.new as any).reason
              );
            }

            queryClient.invalidateQueries({ queryKey: ["waiter_calls"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "waiter_calls",
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["waiter_calls"] });
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [queryClient]);

  return query;
}

export function useUpdateWaiterCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      callId,
      status,
      staffId,
    }: {
      callId: string;
      status: string;
      staffId?: string;
    }) => {
      const updateData: any = { status };
      
      if (status === "acknowledged") {
        updateData.acknowledged_at = new Date().toISOString();
        updateData.responded_by = staffId;
      } else if (status === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("waiter_calls")
        .update(updateData)
        .eq("id", callId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiter_calls"] });
    },
  });
}


