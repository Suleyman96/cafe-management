/**
 * Type-Safe Expenses Hooks
 */

import { QUERY_KEYS } from '@cafe-idare/core';
import type { Database } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invalidateExpenses, refetchExpenses } from '@/lib/query-helpers';
import { db } from '@/lib/supabase/wrapped-client';

type Expense = Database['public']['Tables']['expenses']['Row'];
type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
type ExpenseCategoryInsert = Database['public']['Tables']['expense_categories']['Insert'];

export function useExpenses(options?: {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSES, options],
    queryFn: async (): Promise<Expense[]> => db.expenses.findAll(options),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE, id],
    queryFn: async (): Promise<Expense> => db.expenses.findById(id),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseInsert) => db.expenses.create(data),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
    onSettled: () => {
      refetchExpenses(queryClient);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Expense> }) =>
      db.expenses.update(id, updates),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
    onSettled: () => {
      refetchExpenses(queryClient);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.expenses.delete(id),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
    onSettled: () => {
      refetchExpenses(queryClient);
    },
  });
}

type ExpenseCategory = Database['public']['Tables']['expense_categories']['Row'];

export function useExpenseCategories() {
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES],
    queryFn: async (): Promise<ExpenseCategory[]> => db.expenseCategories.findAll(),
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseCategoryInsert) => db.expenseCategories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExpenseCategoryInsert> }) =>
      db.expenseCategories.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.expenseCategories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
    },
  });
}

export function useExpenseMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY, year, month],
    queryFn: () => db.expenses.getMonthlySummary(year, month),
  });
}
