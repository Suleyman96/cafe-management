/**
 * Tables wrapper module
 */

import { isTable, isTableArray } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type { TableInsert, TableRow, TableUpdate, WrapperContext } from './types';

export function createTablesWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { limit?: number }) => {
      // Per-tenant table count is small today (≈8–20) but a future feature
      // (table_history join, reservations) could blow up the row count.
      // Defensive cap is free here and prevents one bad query from stalling.
      const limit = options?.limit ?? 500;
      const { data, error } = await applyTenantScope(
        ctx.client.from('tables').select('*').order('table_number').limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      const tables = data || [];
      if (!isTableArray(tables)) throw new Error('Invalid tables data');
      return tables;
    },

    findById: async (id: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client.from('tables').select('*').eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    findByTableNumber: async (tableNumber: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client.from('tables').select('*').eq('table_number', tableNumber),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    findByQrCode: async (qrCode: string) => {
      // Anon QR scans hit this before set_table_context() binds the tenant.
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
