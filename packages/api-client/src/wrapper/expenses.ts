/**
 * Expenses wrapper module
 */

import { isExpense, isExpenseCategory } from '@gustri/core';
import { handleSupabaseError } from '../errors';
import { dedupeInsert } from './_dedupe';
import { applyTenantScope, assertInsertTenantMatches } from './_tenant-scope';
import type {
  ExpenseCategoryInsert,
  ExpenseCategoryRow,
  ExpenseInsert,
  ExpenseRow,
  ExpenseUpdate,
  WrapperContext,
} from './types';

export function createExpenseCategoriesWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: { limit?: number }) => {
      const limit = options?.limit ?? 200;
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('expense_categories')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .limit(limit),
        ctx,
      );

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    create: async (data: ExpenseCategoryInsert) => {
      assertInsertTenantMatches(data, ctx);
      const { data: result, error } = await ctx.anyClient
        .from('expense_categories')
        .insert(data)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isExpenseCategory(result)) throw new Error('Invalid expense category data');
      return result as ExpenseCategoryRow;
    },

    update: async (id: string, updates: Partial<ExpenseCategoryInsert>) => {
      const { data, error } = await ctx.anyClient
        .from('expense_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isExpenseCategory(data)) throw new Error('Invalid expense category data');
      return data as ExpenseCategoryRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw handleSupabaseError(error);
    },
  };
}

export function createExpensesWrapper(ctx: WrapperContext) {
  return {
    findAll: async (options?: {
      categoryId?: string;
      startDate?: string;
      endDate?: string;
      paymentMethod?: NonNullable<ExpenseRow['payment_method']>;
      limit?: number;
      offset?: number;
    }) => {
      let query = applyTenantScope(
        ctx.client
          .from('expenses')
          .select(`
            *,
            category:expense_categories!expenses_category_id_fkey(id, name, icon),
            created_by_staff:staff!expenses_created_by_fkey(full_name)
          `)
          .order('expense_date', { ascending: false }),
        ctx,
      );

      if (options?.categoryId) {
        query = query.eq('category_id', options.categoryId);
      }
      if (options?.startDate) {
        query = query.gte('expense_date', options.startDate);
      }
      if (options?.endDate) {
        query = query.lt('expense_date', options.endDate);
      }
      if (options?.paymentMethod) {
        query = query.eq('payment_method', options.paymentMethod);
      }

      // Apply pagination with sensible defaults
      const limit = options?.limit ?? 200;
      const offset = options?.offset ?? 0;
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await applyTenantScope(
        ctx.client
          .from('expenses')
          .select(`
            *,
            category:expense_categories!expenses_category_id_fkey(id, name, icon),
            created_by_staff:staff!expenses_created_by_fkey(full_name)
          `)
          .eq('id', id),
        ctx,
      ).single();

      if (error) throw handleSupabaseError(error);
      if (!isExpense(data)) throw new Error('Invalid expense data');
      return data as ExpenseRow;
    },

    create: async (data: ExpenseInsert) => {
      assertInsertTenantMatches(data, ctx);
      const result = await dedupeInsert<unknown>(data.client_request_id, {
        insert: () => ctx.anyClient.from('expenses').insert(data).select().single(),
        refetch: () =>
          applyTenantScope(
            ctx.anyClient
              .from('expenses')
              .select()
              .eq('client_request_id', data.client_request_id ?? ''),
            ctx,
          ).single(),
      });

      if (!isExpense(result)) throw new Error('Invalid expense data');
      return result as ExpenseRow;
    },

    update: async (id: string, updates: Partial<ExpenseUpdate>) => {
      const { data, error } = await ctx.anyClient
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isExpense(data)) throw new Error('Invalid expense data');
      return data as ExpenseRow;
    },

    delete: async (id: string) => {
      const { error } = await ctx.anyClient.from('expenses').delete().eq('id', id);

      if (error) throw handleSupabaseError(error);
    },

    getMonthlySummary: async (year: number, month: number) => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate =
        month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

      const { data, error } = await applyTenantScope(
        ctx.client
          .from('expenses')
          .select(`
            amount,
            category:expense_categories!expenses_category_id_fkey(id, name)
          `)
          .gte('expense_date', startDate)
          .lt('expense_date', endDate),
        ctx,
      );

      if (error) throw handleSupabaseError(error);

      type ExpenseSummaryRow = { amount: number; category: { id: string; name: string } | null };
      const expenses = (data || []) as unknown as ExpenseSummaryRow[];
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      // `name: null` for uncategorized — the wrapper is headless, so it can't
      // translate; UI consumers render the localized `expenses.uncategorized`
      // label for null instead of a hardcoded English string.
      const byCategory: Record<string, { name: string | null; total: number; count: number }> = {};

      for (const e of expenses) {
        const catName = e.category?.name ?? null;
        const catId = e.category?.id || 'uncategorized';
        if (!byCategory[catId]) {
          byCategory[catId] = { name: catName, total: 0, count: 0 };
        }
        byCategory[catId].total += e.amount;
        byCategory[catId].count += 1;
      }

      return {
        total,
        count: expenses.length,
        byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
      };
    },
  };
}

export type ExpenseCategoriesWrapper = ReturnType<typeof createExpenseCategoriesWrapper>;
export type ExpensesWrapper = ReturnType<typeof createExpensesWrapper>;
