import { QUERY_KEYS } from '@gustri/queries';
import { renderHook } from '@testing-library/react';
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
import { createWrapper, renderHookWithProviders, waitFor } from '../helpers/test-utils';

describe('useExpenses', () => {
  it('calls db.expenses.findAll', () => {
    const { mockDb } = renderHookWithProviders(() => useExpenses());
    expect(mockDb.expenses.findAll).toHaveBeenCalled();
  });

  it('passes options to findAll', () => {
    const opts = { categoryId: 'c1', startDate: '2026-01-01' };
    const { mockDb } = renderHookWithProviders(() => useExpenses(opts));
    expect(mockDb.expenses.findAll).toHaveBeenCalledWith(opts);
  });

  it('returns fetched expenses', async () => {
    const mockExpenses = [{ id: 'e1', amount: 100, description: 'Supplies' }];
    const { wrapper, mockDb } = createWrapper();
    (mockDb.expenses.findAll as any).mockResolvedValueOnce(mockExpenses);
    const { result } = renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual(mockExpenses));
  });

  it('reports error when findAll rejects', async () => {
    const { wrapper, mockDb } = createWrapper();
    (mockDb.expenses.findAll as any).mockRejectedValueOnce(new Error('DB error'));
    const { result } = renderHook(() => useExpenses(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useExpense', () => {
  it('calls findById', () => {
    const { mockDb } = renderHookWithProviders(() => useExpense('e1'));
    expect(mockDb.expenses.findById).toHaveBeenCalledWith('e1');
  });

  it('is disabled when id is empty', () => {
    const { mockDb } = renderHookWithProviders(() => useExpense(''));
    expect(mockDb.expenses.findById).not.toHaveBeenCalled();
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
    const { mockDb } = renderHookWithProviders(() => useExpenseMonthlySummary(2026, 2));
    expect(mockDb.expenses.getMonthlySummary).toHaveBeenCalledWith(2026, 2);
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
    const { result, mockDb } = renderHookWithProviders(() => useCreateExpense());
    await result.current.mutateAsync(expenseData);
    expect(mockDb.expenses.create).toHaveBeenCalledWith(expenseData);
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
  it('invalidates EXPENSES and EXPENSE_MONTHLY_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useCreateExpenseCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ name: 'New Category' } as any);

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY]);
  });
});

describe('useUpdateExpenseCategory', () => {
  it('invalidates EXPENSES and EXPENSE_MONTHLY_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useUpdateExpenseCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync({ id: 'c1', updates: { name: 'Updated' } as any });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY]);
  });
});

describe('useDeleteExpenseCategory', () => {
  it('invalidates EXPENSES and EXPENSE_MONTHLY_SUMMARY on success', async () => {
    const { result, queryClient } = renderHookWithProviders(() => useDeleteExpenseCategory());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.mutateAsync('c1');

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => (c[0] as any).queryKey);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSES]);
    expect(invalidatedKeys).toContainEqual([QUERY_KEYS.EXPENSE_MONTHLY_SUMMARY]);
  });
});
