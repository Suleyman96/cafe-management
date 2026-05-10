/**
 * Tables wrapper module
 */

import { isTable, isTableArray } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { TableInsert, TableRow, TableUpdate, WrapperContext } from './types';

// L4 — Public-safe column list. Mirrors the explicit per-column GRANT to
// `anon` in migration 20260507000006: `qr_code`, `qr_code_revoked_at`,
// `qr_code_expires_at`, `qr_code_rotated_at` are intentionally excluded.
// Without this narrowing, anon's `select('*')` against `public.tables`
// would error ("permission denied for column qr_code") after the migration
// because column-level GRANTs only succeed if every selected column is
// covered. Authenticated staff still have GRANT ALL via the baseline, so
// this list is a safe lower-bound for both client roles. Anything that
// genuinely needs `qr_code*` (admin rotation UI, server-side service-role
// reads) goes through dedicated paths that can opt into the full row.
const PUBLIC_TABLE_COLUMNS =
  'id, tenant_id, table_number, capacity, location, status, current_session_id, occupied_at, is_active, notes, created_at, updated_at';

export function createTablesWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { limit?: number }) => {
      // Per-tenant table count is small today (≈8–20) but a future feature
      // (table_history join, reservations) could blow up the row count.
      // Defensive cap is free here and prevents one bad query from stalling.
      const limit = options?.limit ?? 500;
      // Order by creation time (oldest first). `table_number` is text, so a
      // lexicographic sort placed "10" between "1" and "2"; creation order
      // matches how staff actually built out the floor plan and stays stable
      // across renames.
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('tables')
          .select(PUBLIC_TABLE_COLUMNS)
          .order('created_at', { ascending: true })
          .limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      const tables = data || [];
      if (!isTableArray(tables)) throw new Error('Invalid tables data');
      return tables;
    },

    findById: async (id: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client.from('tables').select(PUBLIC_TABLE_COLUMNS).eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    findByTableNumber: async (tableNumber: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client.from('tables').select(PUBLIC_TABLE_COLUMNS).eq('table_number', tableNumber),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    findByQrCode: async (qrCode: string) => {
      // L4 — pre-PR this was the customer-web tenant-resolution path; it now
      // exists only for authenticated staff (admin rotation UI etc.) since
      // anon no longer holds SELECT on the qr_code column and can't even
      // express the WHERE predicate. Customer-web binds tenant via the
      // RETURN value of `set_table_context()`, which runs SECURITY DEFINER
      // and reads the column on anon's behalf without exposing it.
      const { data, error } = await applyTenantScope(
        ctx.client.from('tables').select('*').eq('qr_code', qrCode),
        ctx,
        { allowNull: true },
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    updateStatus: async (id: string, status: TableRow['status']) => {
      const { data, error } = await ctx.anyClient
        .from('tables')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data as TableRow;
    },

    create: async (tableData: TableInsert) => {
      assertInsertTenantMatches(tableData, ctx);
      const { data, error } = await ctx.anyClient
        .from('tables')
        .insert(tableData)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data as TableRow;
    },

    update: async (id: string, updates: TableUpdate) => {
      const { data, error } = await ctx.anyClient
        .from('tables')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data as TableRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('tables').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type TablesWrapper = ReturnType<typeof createTablesWrapper>;
