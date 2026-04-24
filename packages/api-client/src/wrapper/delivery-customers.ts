/**
 * Delivery Customers wrapper module
 */

import { handleSupabaseError } from '@gustri/core';
import type { DeliveryCustomerRow, PaginatedResult, WrapperContext } from './types';

export function createDeliveryCustomersWrapper(ctx: WrapperContext) {
  return {
    findAll: async () => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .select('*')
        .order('order_count', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findAllPaginated: async (options?: {
      page?: number;
      pageSize?: number;
      search?: string;
    }): Promise<PaginatedResult<DeliveryCustomerRow>> => {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      let query = ctx.anyClient
        .from('delivery_customers')
        .select('*', { count: 'exact' })
        .order('order_count', { ascending: false })
        .order('name', { ascending: true });

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw handleSupabaseError(error);
      return {
        data: (data || []) as DeliveryCustomerRow[],
        count: count ?? 0,
        hasMore: (count ?? 0) > offset + pageSize,
      };
    },

    search: async (query: string) => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .select('*')
        .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
        .order('order_count', { ascending: false })
        .limit(10);

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findByPhone: async (phone: string) => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .select('*')
        .eq('phone', phone)
        .maybeSingle();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    create: async (customerData: {
      name: string;
      phone: string;
      address: string;
      notes?: string | null;
    }) => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .insert(customerData)
        .select('*')
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    update: async (
      id: string,
      updates: {
        name?: string;
        phone?: string;
        address?: string;
        notes?: string | null;
      },
    ) => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    incrementOrderCount: async (id: string) => {
      const { data: current, error: fetchError } = await ctx.anyClient
        .from('delivery_customers')
        .select('order_count')
        .eq('id', id)
        .single();

      if (fetchError) throw handleSupabaseError(fetchError);

      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .update({
          order_count: (current?.order_count ?? 0) + 1,
          last_order_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw handleSupabaseError(error);
      return data;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('delivery_customers').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type DeliveryCustomersWrapper = ReturnType<typeof createDeliveryCustomersWrapper>;
