/**
 * RPC functions wrapper module
 */

import { handleSupabaseError } from '../errors';
import type { WrapperContext } from './types';

export function createRpcWrapper(ctx: WrapperContext) {
  return {
    getRemainingBalance: async (orderId: string): Promise<number> => {
      const { data, error } = await ctx.anyClient.rpc('get_order_remaining_balance', {
        order_uuid: orderId,
      });

      if (error) throw handleSupabaseError(error);
      return (data as number) ?? 0;
    },

    transferTable: async (params: {
      orderId: string;
      fromTableId: string;
      toTableId: string;
      /** @deprecated server derives the actor from auth.uid() since 20260428000001. */
      staffId: string;
      reason?: string;
    }): Promise<boolean> => {
      const { data, error } = await ctx.anyClient.rpc('transfer_table', {
        p_order_id: params.orderId,
        p_from_table_id: params.fromTableId,
        p_to_table_id: params.toTableId,
        p_staff_id: params.staffId,
        p_reason: params.reason,
      });

      if (error) throw handleSupabaseError(error);
      return (data as boolean) || false;
    },

    generateOrderNumber: async (): Promise<string> => {
      const { data, error } = await ctx.anyClient.rpc('generate_order_number');

      if (error) throw handleSupabaseError(error);
      return (data as string) || '';
    },

    transferOrderItems: async (params: {
      sourceOrderId: string;
      destinationTableId: string;
      items: Array<{ item_id: string; quantity: number }>;
      /** @deprecated server derives the actor from auth.uid() since 20260428000001. */
      staffId: string;
      reason?: string;
    }): Promise<string> => {
      const { data, error } = await ctx.anyClient.rpc('transfer_order_items', {
        p_source_order_id: params.sourceOrderId,
        p_destination_table_id: params.destinationTableId,
        p_items: params.items,
        p_staff_id: params.staffId,
        p_reason: params.reason || null,
      });

      if (error) throw handleSupabaseError(error);
      return (data as string) || '';
    },
  };
}

export type RpcWrapper = ReturnType<typeof createRpcWrapper>;
