import { QUERY_KEYS } from '@cafe-idare/core';
import { describe, expect, it, vi } from 'vitest';
import {
  useCreateExpense,
  useCreateExpenseCategory,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
  useUpdateExpense,
  useUpdateExpenseCategory,
} from '@/hooks/use-expenses-safe';
import { db } from '@/lib/supabase/wrapped-client';
import { renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useExpenses', () => {
  it('calls db.expenses.findAll', () => {
    renderHookWithProviders(() => useExpenses());
    expect(db.expenses.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { categoryId: 'c1', startDate: '2026-01-01' };
    renderHookWithProviders(() => useExpenses(opts));
    expect(db.expenses.findAll).toHaveBeenCalledWith(opts);
  });

  it('returns fetched expenses', async () => {
    const mockExpenses = [{ id: 'e1', amount: 100, description: 'Supplies' }];
    (db.expenses.findAll as any).mockResolvedValueOnce(mockExpenses);
    const { result } = renderHookWithProviders(() => useExpenses());
    await waitFor(() => expect(result.current.data).toEqual(mockExpenses));
  });

  it('reports error when findAll rejects', async () => {
    (db.expenses.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHookWithProviders(() => useExpenses());
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useExpense', () => {
  it('calls findById', () => {
    renderHookWithProviders(() => useExpense('e1'));
    expect(db.expenses.findById).toHaveBeenCalledWith('e1');
  });

  it('is disabled when id is empty', () => {
    renderHookWithProviders(() => useExpense(''));
    expect(db.expenses.findById).not.toHaveBeenCalled();
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
    renderHookWithProviders(() => useExpenseMonthlySummary(2026, 2));
    expect(db.expenses.getMonthlySummary).toHaveBeenCalledWith(2026, 2);
  });
});

describe('useCreateExpense', () => {
  it('invalidates EXPENSES and EXPENSE_MONTHLY_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateExpense());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ amount: 100, description: 'Test' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY]);
  });

  it('calls db.expenses.create with data', async () => {
    const expenseData = { amount: 100, description: 'Supplies', payment_method: 'cash' } as any;
    const { result } = renderHookWithProviders(() => useCreateExpense());
    await result.current.mutateAsync(expenseData);
    expect(db.expenses.create).toHaveBeenCalledWith(expenseData);
  });
});

describe('useUpdateExpense', () => {
  it('invalidates EXPENSES and EXPENSE_MONTHLY_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateExpense());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'e1', updates: { amount: 200 } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY]);
  });
});

describe('useDeleteExpense', () => {
  it('invalidates EXPENSES and EXPENSE_MONTHLY_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteExpense());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('e1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY]);
  });
});

describe('useCreateExpenseCategory', () => {
  it('invalidates EXPENSE_CATEGORIES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateExpenseCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'New Category' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_CATEGORIES]);
  });
});

describe('useUpdateExpenseCategory', () => {
  it('invalidates EXPENSE_CATEGORIES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateExpenseCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'c1', updates: { name: 'Updated' } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_CATEGORIES]);
  });
});

describe('useDeleteExpenseCategory', () => {
  it('invalidates EXPENSE_CATEGORIES on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteExpenseCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('c1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_CATEGORIES]);
  });
});
