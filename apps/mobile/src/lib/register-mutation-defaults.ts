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
import { MUTATION_KEYS, type MutationKeyName } from '@gustri/queries';
import * as Sentry from '@sentry/react-native';
import type { MutationFunction, QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { getOrCreateClientRequestId } from './idempotency';
import { db } from './supabase';

/**
 * Build the full per-key registration map. We define this as a
 * `Record<MutationKeyName, MutationFunction>` so `tsc` errors at compile time
 * if a new key is added to `MUTATION_KEYS` in `@gustri/queries` without a
 * corresponding mobile registration. Static check beats the runtime check
 * below — the runtime check is the safety net for shape drift across
 * untyped boundaries (e.g. shared package gets out of sync).
 */
function buildDefaults(): Record<MutationKeyName, MutationFunction<unknown, unknown>> {
  return {
    CREATE_ORDER: ((orderData: OrdersInsert) => {
      // Defense-in-depth: hooks should stamp `client_request_id` in their
      // own `onMutate` so it's persisted with the variables. If a paused
      // mutation predating this PR rehydrates without one, mint one here so
      // a single replay retry still goes through the dedupe path. Multiple
      // retries within the same mutation lifecycle reuse the variables
      // object, so the id stays stable across retries.
      const clientRequestId = getOrCreateClientRequestId(orderData.client_request_id);
      return db.orders.create({ ...orderData, client_request_id: clientRequestId });
    }) as MutationFunction<unknown, unknown>,
    UPDATE_ORDER_STATUS: (({ orderId, status }: { orderId: string; status: Order['status'] }) =>
      db.orders.updateStatus(orderId, status)) as MutationFunction<unknown, unknown>,
    UPDATE_ORDER_ITEM_STATUS: (({
      itemId,
      status,
    }: {
      itemId: string;
      status: OrderItem['status'];
    }) => db.orderItems.updateStatus(itemId, status)) as MutationFunction<unknown, unknown>,
    UPDATE_TABLE_STATUS: (({ tableId, status }: { tableId: string; status: Table['status'] }) =>
      db.tables.updateStatus(tableId, status)) as MutationFunction<unknown, unknown>,
    UPDATE_WAITER_CALL: (async ({
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
    }) as MutationFunction<unknown, unknown>,
    UPDATE_STAFF: (({ id, data }: { id: string; data: StaffUpdate }) =>
      db.staff.update(id, data)) as MutationFunction<unknown, unknown>,
    UPDATE_EXPENSE: (({ id, data }: { id: string; data: ExpenseUpdate }) =>
      db.expenses.update(id, data)) as MutationFunction<unknown, unknown>,
    UPDATE_EXPENSE_CATEGORY: (({ id, data }: { id: string; data: ExpenseCategoryUpdate }) =>
      db.expenseCategories.update(id, data)) as MutationFunction<unknown, unknown>,
    UPDATE_MENU_ITEM: (({ id, data }: { id: string; data: MenuItemsUpdate }) =>
      db.menuItems.update(id, data)) as MutationFunction<unknown, unknown>,
    UPDATE_CATEGORY: (({ id, data }: { id: string; data: CategoriesUpdate }) =>
      db.categories.update(id, data)) as MutationFunction<unknown, unknown>,
    UPDATE_SCHEDULE: (({ id, data }: { id: string; data: StaffScheduleUpdate }) =>
      db.schedules.update(id, data)) as MutationFunction<unknown, unknown>,
    UPDATE_STOCK_ITEM: (({ id, data }: { id: string; data: StockItemUpdate }) =>
      db.stockItems.update(id, data)) as MutationFunction<unknown, unknown>,
  };
}

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
 * Completeness check: we iterate `MUTATION_KEYS` (the shared registry in
 * `@gustri/queries`) and assert each entry has a registered default. In dev
 * we throw — visible during the next hot reload. In prod we capture to Sentry
 * and skip registration so the app still boots, even if a release ships with
 * a missing key (the affected mutation will fail loudly, but unrelated
 * mutations still drain).
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

  const defaults = buildDefaults();

  for (const [name, key] of Object.entries(MUTATION_KEYS) as [
    MutationKeyName,
    readonly string[],
  ][]) {
    const fn = defaults[name];
    if (!fn) {
      const message = `register-mutation-defaults: missing mutationFn for ${name}`;
      // `__DEV__` is the React Native runtime flag; absent in vitest/jsdom,
      // so guard the access with `typeof` to avoid a ReferenceError under
      // tests (where we WANT the throw, by design).
      const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
      if (isDev) {
        throw new Error(message);
      }
      Sentry.captureMessage(message, {
        level: 'error',
        tags: { area: 'register-mutation-defaults' },
      });
      continue;
    }
    queryClient.setMutationDefaults(key, { mutationFn: fn });
  }
}

// Test-only escape hatch: the buildDefaults map is the actual content
// surface, so tests can drop a key and assert the registration check fires.
export const __defaultsForTests = buildDefaults;
