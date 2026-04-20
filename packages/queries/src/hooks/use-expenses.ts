import { QUERY_KEYS } from '@gustri/core';
import type { Expense, ExpenseCategory } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { useDb } from '../provider';

export function useExpenses(options?: Record<string, unknown>) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSES, options],
    queryFn: () => db.expenses.findAll(options) as Promise<Expense[]>,
  });
}

export function useExpense(id: string) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE, id],
    queryFn: () => db.expenses.findById(id) as Promise<Expense>,
    enabled: !!id,
  });
}

export function useExpenseCategories() {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE_CATEGORIES],
    queryFn: () => db.expenseCategories.findAll() as Promise<ExpenseCategory[]>,
  });
}

export function useExpenseMonthlySummary(year: number, month: number) {
  const db = useDb();
  return useQuery({
    queryKey: [QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY, year, month],
    queryFn: () => db.expenses.getMonthlySummary(year, month),
    enabled: !!year && !!month,
  });
}
