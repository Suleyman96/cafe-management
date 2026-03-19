import { describe, expect, it, vi } from 'vitest';
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from '@/hooks/use-expenses';
import { db } from '@/lib/supabase';
import { renderHookWithProviders } from '../helpers/test-utils';

describe('useExpenses', () => {
  it('calls db.expenses.findAll', () => {
    renderHookWithProviders(() => useExpenses());
    expect(db.expenses.findAll).toHaveBeenCalled();
  });

  it('passes options', () => {
    const opts = { categoryId: 'cat-1' };
    renderHookWithProviders(() => useExpenses(opts));
    expect(db.expenses.findAll).toHaveBeenCalledWith(opts);
  });
});

describe('useExpenseCategories', () => {
  it('calls db.expenseCategories.findAll', () => {
    renderHookWithProviders(() => useExpenseCategories());
    expect(db.expenseCategories.findAll).toHaveBeenCalled();
  });
});

describe('useExpenseMonthlySummary', () => {
  it('calls getMonthlySummary with year and month', () => {
    renderHookWithProviders(() => useExpenseMonthlySummary(2026, 3));
    expect(db.expenses.getMonthlySummary).toHaveBeenCalledWith(2026, 3);
  });
});

describe('useCreateExpense', () => {
  it('invalidates expenses and expense-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateExpense());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ description: 'Office supplies', amount: 50 });

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['expenses']);
    expect(keys).toContainEqual(['expense-summary']);
  });
});

describe('useDeleteExpense', () => {
  it('invalidates expenses and expense-summary on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteExpense());
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('e1');

    const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(keys).toContainEqual(['expenses']);
    expect(keys).toContainEqual(['expense-summary']);
  });
});
