/**
 * Delivery Customers wrapper module.
 *
 * Phone numbers on this table are encrypted at rest. The wrapper enforces
 * three rules on top of the schema-level controls
 * (see migrations/20260503000005_encrypt_delivery_customer_phone.sql):
 *
 *  - List endpoints (`findAll`, `findAllPaginated`) return a minimal
 *    projection — id/name/order_count/last_order_at — so a waiter session
 *    cannot scrape the phone book.
 *  - Phone lookup goes through the `find_delivery_customer_by_phone` RPC,
 *    which hashes server-side and returns at most one row without phone.
 *  - `findById` reads the role-gated `delivery_customers_decrypted` view.
 *    Admin/owner sessions get the decrypted phone; anyone else gets NULL.
 */

import { isDeliveryCustomer } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope } from './_tenant-scope';
import type {
  DeliveryCustomerInsert,
  DeliveryCustomerRow,
  DeliveryCustomerUpdate,
  PaginatedResult,
  WrapperContext,
} from './types';

const LIST_PROJECTION = 'id, name, order_count, last_order_at';
const SEARCH_PROJECTION = 'id, name, address, notes, order_count, last_order_at';

function looksLikePhone(query: string): boolean {
  // ≥4 digits in the input → treat as a phone probe.
  const digits = query.replace(/\D/g, '');
  return digits.length >= 4;
}

function mapDecryptedPhone<T extends Record<string, unknown>>(row: T | null): T | null {
  if (!row) return row;
  if ('decrypted_phone' in row) {
    const mapped = { ...row } as Record<string, unknown>;
    mapped.phone = mapped.decrypted_phone;
    delete mapped.decrypted_phone;
    return mapped as T;
  }
  return row;
}

export function createDeliveryCustomersWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { limit?: number }) => {
      const limit = options?.limit ?? 500;
      const { data, error } = await applyTenantScope(
        ctx.anyClient
          .from('delivery_customers')
          .select(LIST_PROJECTION)
          .order('order_count', { ascending: false })
          .order('name', { ascending: true })
          .limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findAllPaginated: async (options?: {
      page?: number;
      pageSize?: number;
      search?: string;
    }): Promise<
      PaginatedResult<Pick<DeliveryCustomerRow, 'id' | 'name' | 'order_count' | 'last_order_at'>>
    > => {
      const page = options?.page ?? 1;
      const pageSize = options?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      let query = applyTenantScope(
        ctx.anyClient
          .from('delivery_customers')
          .select(LIST_PROJECTION, { count: 'exact' })
          .order('order_count', { ascending: false })
          .order('name', { ascending: true }),
        ctx,
      );

      // Name-only ilike for browsing. Phone search must go through the RPC
      // — exposing phone on a list endpoint would defeat the directory
      // protection the migration adds.
      if (options?.search) {
        query = query.ilike('name', `%${options.search}%`);
      }

      query = query.range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) throw handleSupabaseError(error);
      return {
        data: (data || []) as Pick<
          DeliveryCustomerRow,
          'id' | 'name' | 'order_count' | 'last_order_at'
        >[],
        count: count ?? 0,
        hasMore: (count ?? 0) > offset + pageSize,
      };
    },

    /**
     * Search for saved customers by name (fuzzy) and phone (exact match
     * via the hashed-phone RPC). The waiter typically already knows the
     * phone — they're on a call — so an exact probe is enough; we never
     * return the plaintext phone in either branch.
     */
    search: async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const namePromise = applyTenantScope(
        ctx.anyClient
          .from('delivery_customers')
          .select(SEARCH_PROJECTION)
          .ilike('name', `%${trimmed}%`)
          .order('order_count', { ascending: false })
          .limit(10),
        ctx,
      );

      const phonePromise = looksLikePhone(trimmed)
        ? ctx.anyClient.rpc('find_delivery_customer_by_phone', { p_phone: trimmed })
        : Promise.resolve({ data: null, error: null });

      const [nameResult, phoneResult] = await Promise.all([namePromise, phonePromise]);

      if (nameResult.error) throw handleSupabaseError(nameResult.error);
      if (phoneResult.error) throw handleSupabaseError(phoneResult.error);

      const byId = new Map<string, any>();
      for (const row of nameResult.data ?? []) byId.set(row.id, row);
      // RPC returns a TABLE — Supabase delivers it as an array.
      for (const row of (phoneResult.data ?? []) as any[]) {
        if (row?.id) byId.set(row.id, row);
      }
      return Array.from(byId.values());
    },

    findByPhone: async (phone: string) => {
      if (!phone?.trim()) return null;
      const { data, error } = await ctx.anyClient.rpc('find_delivery_customer_by_phone', {
        p_phone: phone,
      });
      if (error) throw handleSupabaseError(error);
      const rows = (data ?? []) as any[];
      return rows[0] ?? null;
    },

    findById: async (id: string) => {
      const { data, error } = await applyTenantScope(
        ctx.anyClient.from('delivery_customers_decrypted').select('*').eq('id', id),
        ctx,
      ).maybeSingle();

      if (error) throw handleSupabaseError(error);
      return mapDecryptedPhone(data as Record<string, unknown> | null);
    },

    create: async (
      customerData: Omit<DeliveryCustomerInsert, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>,
    ) => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .insert(customerData)
        .select(SEARCH_PROJECTION)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isDeliveryCustomer(data)) throw new Error('Invalid delivery customer data');
      return data;
    },

    update: async (id: string, updates: Partial<DeliveryCustomerUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('delivery_customers')
        .update(updates)
        .eq('id', id)
        .select(SEARCH_PROJECTION)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isDeliveryCustomer(data)) throw new Error('Invalid delivery customer data');
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
        .select(SEARCH_PROJECTION)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isDeliveryCustomer(data)) throw new Error('Invalid delivery customer data');
      return data;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('delivery_customers').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type DeliveryCustomersWrapper = ReturnType<typeof createDeliveryCustomersWrapper>;
