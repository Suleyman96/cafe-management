/**
 * Expenses wrapper module
 */

import { handleSupabaseError, isExpense, isExpenseCategory } from '@gustri/core';
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
    findAll: async () => {
      const { data, error } = await ctx.client
        .from('expense_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    create: async (data: ExpenseCategoryInsert) => {
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
      paymentMethod?: string;
    }) => {
      let query = ctx.client
        .from('expenses')
        .select(`
          *,
          category:expense_categories!expenses_category_id_fkey(id, name, icon),
          created_by_staff:staff!expenses_created_by_fkey(full_name)
        `)
        .order('expense_date', { ascending: false });

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

      const { data, error } = await query;

      if (error) throw handleSupabaseError(error);
      return data || [];
    },

    findById: async (id: string) => {
      const { data, error } = await ctx.client
        .from('expenses')
        .select(`
          *,
          category:expense_categories!expenses_category_id_fkey(id, name, icon),
          created_by_staff:staff!expenses_created_by_fkey(full_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw handleSupabaseError(error);
      if (!isExpense(data)) throw new Error('Invalid expense data');
      return data as ExpenseRow;
    },

    create: async (data: ExpenseInsert) => {
      const { data: result, error } = await ctx.anyClient
        .from('expenses')
        .insert(data)
        .select()
        .single();

      if (error) throw handleSupabaseError(error);
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

      const { data, error } = await ctx.client
        .from('expenses')
        .select(`
          amount,
          category:expense_categories!expenses_category_id_fkey(id, name)
        `)
        .gte('expense_date', startDate)
        .lt('expense_date', endDate);

      if (error) throw handleSupabaseError(error);

      type ExpenseSummaryRow = { amount: number; category: { id: string; name: string } | null };
      const expenses = (data || []) as unknown as ExpenseSummaryRow[];
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      const byCategory: Record<string, { name: string; total: number; count: number }> = {};

      for (const e of expenses) {
        const catName = e.category?.name || 'Uncategorized';
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
