import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useEffect } from "react";
import type { Order, OrderItem, OrderWithItems } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function useOrder(tableId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["order", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          table:tables(table_number, location),
          order_items(*)
        `)
        .eq("table_id", tableId)
        .in("status", ["pending_approval", "new", "preparing", "ready", "served"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as OrderWithItems | null;
    },
    staleTime: 0, // Always fetch fresh data
  });

  // Real-time subscription
  useEffect(() => {
    let channel: RealtimeChannel;

    const setupSubscription = async () => {
      channel = supabase
        .channel(`orders:table_${tableId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            filter: `table_id=eq.${tableId}`,
          },
          () => {
            // Refetch order data on any change
            queryClient.invalidateQueries({ queryKey: ["order", tableId] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_items",
          },
          () => {
            // Refetch when order items change
            queryClient.invalidateQueries({ queryKey: ["order", tableId] });
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
  }, [tableId, queryClient]);

  return query;
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tableId,
      notes,
    }: {
      tableId: string;
      notes?: string;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("orders")
        .insert({
          table_id: tableId,
          customer_notes: notes,
          status: "pending_approval", // Customer QR orders require staff approval
          source: "customer", // Track that this is from QR code scan
          subtotal: 0,
          tax: 0,
          total: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Order;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["order", variables.tableId] });
    },
  });
}

export function useAddOrderItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      items,
    }: {
      orderId: string;
      items: Array<{
        menu_item_id: string;
        item_name: string;
        item_price: number;
        quantity: number;
        notes?: string;
      }>;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("order_items")
        .insert(
          items.map((item) => ({
            order_id: orderId,
            ...item,
            status: "pending",
          }))
        )
        .select();

      if (error) throw error;
      return data as OrderItem[];
    },
    onSuccess: () => {
      // Refetch all orders (will trigger real-time update)
      queryClient.invalidateQueries({ queryKey: ["order"] });
    },
  });
}


