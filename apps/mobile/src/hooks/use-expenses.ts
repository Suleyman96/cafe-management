import { QUERY_KEYS } from '@gustri/core';
import type { ExpenseCategoryUpdate, ExpenseUpdate } from '@gustri/database';
import { useDb } from '@gustri/queries';
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Re-export hooks and mutations with matching param shapes
export {
  useCreateExpense,
  useCreateExpenseCategory,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from '@gustri/queries';

// Local mutations — mobile consumers use { id, data } instead of { id, updates }

export function useUpdateExpense() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseUpdate }) => db.expenses.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
  });
}

export function useUpdateExpenseCategory() {
  const db = useDb();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseCategoryUpdate }) =>
      db.expenseCategories.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY] });
    },
  });
}
