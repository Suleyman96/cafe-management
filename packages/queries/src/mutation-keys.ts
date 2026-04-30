/**
 * Single source of truth for stable mutation keys used across mobile and web.
 *
 * Why centralize:
 * - Mobile persists paused mutations to MMKV via React Query's persister.
 *   On rehydrate, the only thing that links a serialized mutation back to
 *   its `mutationFn` is the `mutationKey`. If a key is renamed/missing in
 *   the registration map, the mutation rehydrates as an orphan and silently
 *   errors when it tries to run.
 * - With the keys local to each app, adding a new mutation in
 *   `@gustri/queries` and forgetting the corresponding mobile registration
 *   was an entirely-too-easy mistake. Co-locating the keys here lets
 *   `register-mutation-defaults.ts` iterate this object and assert
 *   completeness at boot.
 *
 * Mutations with `networkMode: 'always'` (payments, refunds, discounts,
 * settings, stock-adjust) are intentionally absent — they must NOT be
 * queued offline because their server-side semantics aren't safely
 * idempotent without a server-side dedupe key per call site.
 */
export const MUTATION_KEYS = {
  CREATE_ORDER: ['create-order'],
  UPDATE_ORDER_STATUS: ['update-order-status'],
  UPDATE_ORDER_ITEM_STATUS: ['update-order-item-status'],
  UPDATE_TABLE_STATUS: ['update-table-status'],
  UPDATE_WAITER_CALL: ['update-waiter-call'],
  UPDATE_STAFF: ['update-staff'],
  UPDATE_EXPENSE: ['update-expense'],
  UPDATE_EXPENSE_CATEGORY: ['update-expense-category'],
  UPDATE_MENU_ITEM: ['update-menu-item'],
  UPDATE_CATEGORY: ['update-category'],
  UPDATE_SCHEDULE: ['update-schedule'],
  UPDATE_STOCK_ITEM: ['update-stock-item'],
} as const satisfies Record<string, readonly string[]>;

export type MutationKeyName = keyof typeof MUTATION_KEYS;
export type MutationKey = (typeof MUTATION_KEYS)[MutationKeyName];
