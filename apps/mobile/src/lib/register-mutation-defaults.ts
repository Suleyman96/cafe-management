import type {
  CategoriesUpdate,
  ExpenseCategoryUpdate,
  ExpenseUpdate,
  MenuItemsUpdate,
  Order,
  OrderItem,
  OrdersInsert,
  StaffScheduleUpdate,
  StaffUpdate,
  StockItemUpdate,
  Table,
} from '@gustri/database';
import type { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { getOrCreateClientRequestId } from './idempotency';
import { MUTATION_KEYS } from './mutation-keys';
import { db } from './supabase';

/**
 * Register a `mutationFn` for every replayable mobile mutation key BEFORE the
 * persister hydrates. When the persister rehydrates a paused mutation, React
 * Query looks up the registered defaults by `mutationKey` to find the function
 * to resume with — without this, rehydrated mutations are orphans that error
 * the moment they try to run.
 *
 * Functions here use the singleton `db` from `lib/supabase` (NOT useDb), so
 * they work outside the React tree on next launch when no provider is mounted
 * yet.
 *
 * Keep in sync with `mutation-keys.ts` and the `useMutation` call sites.
 */
export function registerMutationDefaults(queryClient: QueryClient) {
  // Stamp every newly-created mutation with the current tenant/staff identity
  // so the persister carries enough context to drain mismatched entries on
  // next launch (see C2 / mutation-drain.ts). The mutation cache emits the
  // `added` event synchronously when a mutation is created, before its
  // `onMutate` runs, so this is the earliest hook we have. We only stamp
  // mutations whose key is one we plan to persist — anything else (e.g.
  // shared-package mutations without a mobile mutationKey) is left alone so
  // we don't accidentally promote them into the persisted set.
  const cache = queryClient.getMutationCache();
  const knownKeys = new Set<string>(Object.values(MUTATION_KEYS).map((k) => JSON.stringify(k)));
  cache.subscribe((event) => {
    if (event.type !== 'added') return;
    const m = event.mutation;
    const key = m.options.mutationKey;
    if (!key || !knownKeys.has(JSON.stringify(key))) return;

    const staff = useAuthStore.getState().staff;
    if (!staff) return;

    const existing = (m.options.meta ?? {}) as Record<string, unknown>;
    const existingClientRequestId =
      typeof existing.clientRequestId === 'string' ? existing.clientRequestId : null;
    m.options.meta = {
      ...existing,
      tenantId: staff.tenant_id,
      staffId: staff.id,
      clientRequestId: getOrCreateClientRequestId(existingClientRequestId),
    };
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.CREATE_ORDER, {
    // Defense-in-depth: hooks should stamp `client_request_id` in their
    // own `onMutate` so it's persisted with the variables. If a paused
    // mutation predating this PR rehydrates without one, mint one here so
    // a single replay retry still goes through the dedupe path. Multiple
    // retries within the same mutation lifecycle reuse the variables
    // object, so the id stays stable across retries.
    mutationFn: (orderData: OrdersInsert) => {
      const clientRequestId = getOrCreateClientRequestId(orderData.client_request_id);
      return db.orders.create({ ...orderData, client_request_id: clientRequestId });
    },
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_ORDER_STATUS, {
    mutationFn: ({ orderId, status }: { orderId: string; status: Order['status'] }) =>
      db.orders.updateStatus(orderId, status),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_ORDER_ITEM_STATUS, {
    mutationFn: ({ itemId, status }: { itemId: string; status: OrderItem['status'] }) =>
      db.orderItems.updateStatus(itemId, status),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_TABLE_STATUS, {
    mutationFn: ({ tableId, status }: { tableId: string; status: Table['status'] }) =>
      db.tables.updateStatus(tableId, status),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_WAITER_CALL, {
    mutationFn: async ({
      callId,
      status,
      staffId,
    }: {
      callId: string;
      status: string;
      staffId?: string;
    }) => {
      if (status === 'acknowledged' && staffId) {
        return await db.waiterCalls.acknowledge(callId, staffId);
      }
      if (status === 'resolved') {
        return await db.waiterCalls.resolve(callId);
      }
      throw new Error(`Unsupported waiter call status: ${status}`);
    },
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_STAFF, {
    mutationFn: ({ id, data }: { id: string; data: StaffUpdate }) => db.staff.update(id, data),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_EXPENSE, {
    mutationFn: ({ id, data }: { id: string; data: ExpenseUpdate }) => db.expenses.update(id, data),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_EXPENSE_CATEGORY, {
    mutationFn: ({ id, data }: { id: string; data: ExpenseCategoryUpdate }) =>
      db.expenseCategories.update(id, data),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_MENU_ITEM, {
    mutationFn: ({ id, data }: { id: string; data: MenuItemsUpdate }) =>
      db.menuItems.update(id, data),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_CATEGORY, {
    mutationFn: ({ id, data }: { id: string; data: CategoriesUpdate }) =>
      db.categories.update(id, data),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_SCHEDULE, {
    mutationFn: ({ id, data }: { id: string; data: StaffScheduleUpdate }) =>
      db.schedules.update(id, data),
  });

  queryClient.setMutationDefaults(MUTATION_KEYS.UPDATE_STOCK_ITEM, {
    mutationFn: ({ id, data }: { id: string; data: StockItemUpdate }) =>
      db.stockItems.update(id, data),
  });
}
