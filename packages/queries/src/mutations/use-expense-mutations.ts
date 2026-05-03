import type { ExpenseCategoryInsert, ExpenseInsert, ExpenseUpdate } from '@gustri/database';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrCreateClientRequestId } from '../idempotency';
import { invalidateExpenses } from '../invalidation';
import { useDb, useTenantId } from '../provider';
import type { MutationCallbacks } from './types';

// ─── Expenses ───────────────────────────────────────────────────────────────

export function useCreateExpense(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    // Stamp `client_request_id` onto variables so a paused-then-replayed
    // mutation hits the server's `(tenant_id, client_request_id)` dedupe
    // path. Web consumers gain in-flight retry safety for free; mobile
    // gets full offline-replay safety via the persister.
    onMutate: (data: ExpenseInsert) => {
      data.client_request_id = getOrCreateClientRequestId(data.client_request_id);
    },
    mutationFn: (data: ExpenseInsert) => db.expenses.create(data),
    onSuccess: () => {
      invalidateExpenses(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateExpense(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExpenseUpdate> }) =>
      db.expenses.update(id, updates),
    onSuccess: () => {
      invalidateExpenses(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteExpense(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.expenses.delete(id),
    onSuccess: () => {
      invalidateExpenses(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

// ─── Expense Categories ─────────────────────────────────────────────────────

export function useCreateExpenseCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ExpenseCategoryInsert) => db.expenseCategories.create(data),
    onSuccess: () => {
      invalidateExpenses(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useUpdateExpenseCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ExpenseCategoryInsert> }) =>
      db.expenseCategories.update(id, updates),
    onSuccess: () => {
      invalidateExpenses(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}

export function useDeleteExpenseCategory(options?: MutationCallbacks) {
  const db = useDb();
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.expenseCategories.delete(id),
    onSuccess: () => {
      invalidateExpenses(queryClient, tenantId);
    },
    onError: options?.onError,
  });
}
