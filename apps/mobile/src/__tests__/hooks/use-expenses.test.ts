import { tenantKey } from '@gustri/queries';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from '@/hooks/use-expenses';
import { renderHookWithProviders, TEST_TENANT_ID } from '../helpers/test-utils';

describe('useExpenses', () => {
  it('calls db.expenses.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenses());
    expect(mockDb.expenses.findAll).toHaveBeenCalled();
  });

  it('passes options', () => {
    const opts = { categoryId: 'cat-1' };
    const { mockDb } = renderHookWithProviders(() => useExpenses(opts));
    expect(mockDb.expenses.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useExpenseCategories', () => {
  it('calls db.expenseCategories.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenseCategories());
    expect(mockDb.expenseCategories.findAll).toHaveBeenCalled();
  });
});

describe('useExpenseMonthlySummary', () => {
  it('calls getMonthlySummary with year and month', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenseMonthlySummary(2026, 3));
    expect(mockDb.expenses.getMonthlySummary).toHaveBeenCalledWith(2026, 3);
  });
});

describe('useCreateExpense', () => {
  it('invalidates expenses and expense-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateExpense());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ description: 'Office supplies', amount: 50 });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'expenses'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'expense_monthly_summary'));
  });
});

describe('useDeleteExpense', () => {
  it('invalidates expenses and expense-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteExpense());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('e1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'expenses'));
    expect(keys).toContainEqual(tenantKey(TEST_TENANT_ID, 'expense_monthly_summary'));
  });
});
