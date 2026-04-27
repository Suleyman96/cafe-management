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
  queryClient.setMutationDefaults(MUTATION_KEYS.CREATE_ORDER, {
    mutationFn: (orderData: OrdersInsert) => db.orders.create(orderData),
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
