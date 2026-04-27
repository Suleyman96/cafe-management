/**
 * Stable mutation keys for every mobile mutation that should survive an app
 * crash and replay on next launch.
 *
 * Used in two places that MUST stay in sync:
 * - The `useMutation({ mutationKey: ... })` call in each hook.
 * - The `queryClient.setMutationDefaults(key, { mutationFn })` in
 *   `register-mutation-defaults.ts` — without that registration, a rehydrated
 *   paused mutation has no function to call when it resumes.
 *
 * Mutations with `networkMode: 'always'` (payments, refunds, discounts,
 * settings, stock-adjust) are intentionally absent — they are not safe to
 * queue offline and therefore must not be persisted.
 */
export const MUTATION_KEYS = {
  CREATE_ORDER: ['create-order'] as const,
  UPDATE_ORDER_STATUS: ['update-order-status'] as const,
  UPDATE_ORDER_ITEM_STATUS: ['update-order-item-status'] as const,
  UPDATE_TABLE_STATUS: ['update-table-status'] as const,
  UPDATE_WAITER_CALL: ['update-waiter-call'] as const,
  UPDATE_STAFF: ['update-staff'] as const,
  UPDATE_EXPENSE: ['update-expense'] as const,
  UPDATE_EXPENSE_CATEGORY: ['update-expense-category'] as const,
  UPDATE_MENU_ITEM: ['update-menu-item'] as const,
  UPDATE_CATEGORY: ['update-category'] as const,
  UPDATE_SCHEDULE: ['update-schedule'] as const,
  UPDATE_STOCK_ITEM: ['update-stock-item'] as const,
} as const;

export type MutationKey = (typeof MUTATION_KEYS)[keyof typeof MUTATION_KEYS];
