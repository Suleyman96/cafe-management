import type { Expense, ExpenseCategory } from '@gustri/database';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, tenantKey } from '../keys';
import { useDb, useTenantId } from '../provider';

export function useExpenses(options?: Record<string, unknown> & { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  const { enabled, ...filters } = options ?? {};
  const filterKey = Object.keys(filters).length > 0 ? filters : undefined;
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSES, filterKey),
    queryFn: () => db.expenses.findAll(filterKey) as Promise<Expense[]>,
    enabled: enabled ?? true,
  });
}

export function useExpense(id: string, options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSE, id),
    queryFn: () => db.expenses.findById(id) as Promise<Expense>,
    enabled: !!id && (options?.enabled ?? true),
  });
}

export function useExpenseCategories(options?: { enabled?: boolean }) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSE_CATEGORIES),
    queryFn: () => db.expenseCategories.findAll() as Promise<ExpenseCategory[]>,
    enabled: options?.enabled ?? true,
  });
}

export function useExpenseMonthlySummary(
  year: number,
  month: number,
  options?: { enabled?: boolean },
) {
  const db = useDb();
  const tenantId = useTenantId();
  return useQuery({
    queryKey: tenantKey(tenantId, QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY, year, month),
    queryFn: () => db.expenses.getMonthlySummary(year, month),
    enabled: !!year && !!month && (options?.enabled ?? true),
  });
}
