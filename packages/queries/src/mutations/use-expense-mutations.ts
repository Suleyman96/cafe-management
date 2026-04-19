import type { ExpenseCategoryInsert, ExpenseInsert, ExpenseUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateExpenses } from '../invalidation';
import { useDb } from '../provider';

// ─── Expenses ───────────────────────────────────────────────────────────────

export function useCreateExpense() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseInsert) => db.expenses.create(data),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
  });
}

export function useUpdateExpense() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExpenseUpdate> }) =>
      db.expenses.update(id, updates),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
  });
}

export function useDeleteExpense() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.expenses.delete(id),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
  });
}

// ─── Expense Categories ─────────────────────────────────────────────────────

export function useCreateExpenseCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseCategoryInsert) => db.expenseCategories.create(data),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
  });
}

export function useUpdateExpenseCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExpenseCategoryInsert> }) =>
      db.expenseCategories.update(id, updates),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
  });
}

export function useDeleteExpenseCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.expenseCategories.delete(id),
    onSuccess: () => {
      invalidateExpenses(queryClient);
    },
  });
}
