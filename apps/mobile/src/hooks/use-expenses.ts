import { QUERY_KEYS } from '@cafe-idare/core';
import type { ExpenseCategoryInsert, ExpenseInsert } from '@cafe-idare/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';
import type { Expense, ExpenseCategory } from '@/types';

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

export function useExpenseCategories() {
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES],
    queryFn: async (): Promise<ExpenseCategory[]> => db.expenseCategories.findAll(),
  });
}

type ExpenseMonthlySummary = {
  total: number;
  count: number;
  byCategory: { name: string; total: number; count: number }[];
};

export function useExpenseMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY, year, month],
    queryFn: async (): Promise<ExpenseMonthlySummary> => db.expenses.getMonthlySummary(year, month),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseInsert) => db.expenses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
    onError: (error: Error) => {
      console.error('Failed to create expense:', error.message);
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseInsert> }) =>
      db.expenses.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
    onError: (error: Error) => {
      console.error('Failed to update expense:', error.message);
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.expenses.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete expense:', error.message);
    },
  });
}

// Expense Category CRUD hooks
export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ExpenseCategoryInsert) => db.expenseCategories.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
    },
    onError: (error: Error) => {
      console.error('Failed to create expense category:', error.message);
    },
  });
}

export function useUpdateExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseCategoryInsert> }) =>
      db.expenseCategories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
    onError: (error: Error) => {
      console.error('Failed to update expense category:', error.message);
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.expenseCategories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
    onError: (error: Error) => {
      console.error('Failed to delete expense category:', error.message);
    },
  });
}
