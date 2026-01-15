/**
 * Tables wrapper module
 */

import { handleSupabaseError, isTable, isTableArray } from '@cafe-idare/core';
import type { WrapperContext, TableRow, TableInsert, TableUpdate } from './types';

export function createTablesWrapper(ctx: WrapperContext) {
  return {
    findAll: async () => {
      const { data, error } = await ctx.client
        .from('tables')
        .select('*')
        .order('table_number');

      if (error) throw handleSupabaseError(error);
      const tables = data || [];
      if (!isTableArray(tables)) throw new Error('Invalid tables data');
      return tables;
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('tables')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isTable(data)) throw new Error('Invalid table data');
      return data;
    },

    findByQrCode: async (qrCode: string) => {
      const { data, error } = await ctx.client
        .from('tables')
        .select('*')
        .eq('qr_code', qrCode)
        .single();

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
      const { error } = await ctx.anyClient
        .from('tables')
        .delete()
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export type TablesWrapper = ReturnType<typeof createTablesWrapper>;
