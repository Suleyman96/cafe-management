import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/lib/supabase';

export function useExpenses(options?: {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}) {
  return useQuery({
    queryKey: ['expenses', options],
    queryFn: () => db.expenses.findAll(options),
  });
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => db.expenseCategories.findAll(),
  });
}

export function useExpenseMonthlySummary(year: number, month: number) {
  return useQuery({
    queryKey: ['expense-summary', year, month],
    queryFn: () => db.expenses.getMonthlySummary(year, month),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => db.expenses.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => db.expenses.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}
