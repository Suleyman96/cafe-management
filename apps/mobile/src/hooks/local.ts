/**
 * Mobile-only hooks and wrapper hooks.
 *
 * Three categories live here:
 *
 * 1. **Mobile-only hooks** that have no shared equivalent: `useNetworkStatus`,
 *    `useSnackbar`, `useCurrencySymbol`, `useOrdersHistory`.
 *
 * 2. **Wrapper hooks** that wrap a shared `@gustri/queries` hook with
 *    mobile-specific behavior (realtime subscription, sound, push
 *    notifications, fallback polling, auth-boot gating). These intentionally
 *    shadow the shared name — `useOrders`, `useTables`, `useWaiterCalls`,
 *    `useCategories`.
 *
 * 3. **Param-shape wrappers** that adapt a shared mutation's variables to
 *    mobile's `{ id, data }` convention instead of the shared `{ id, updates }`:
 *    `useUpdateExpense`, `useUpdateMenuItem`, etc.
 *
 * 4. **Server-route mutations** that call `apiRoutes` instead of the wrapper
 *    because the operation is a server-side transaction: `useCreateOrder`,
 *    `useCreatePayment`, `useUpdateCafeSettings`, `useAdjustStock`.
 *
 * If a hook is a pure re-export from `@gustri/queries`, it belongs in
 * `./shared.ts` instead.
 */
export { useUpdateCafeSettings } from './use-cafe-settings';
export { useCreateOrder } from './use-create-order';
export { useCurrencySymbol } from './use-currency-symbol';
export { useUpdateExpense, useUpdateExpenseCategory } from './use-expenses';
export { useCategories } from './use-menu';
export { useUpdateCategory, useUpdateMenuItem } from './use-menu-management';
export { useNetworkStatus } from './use-network-status';
export { useOrder, useOrders, useUpdateOrderItemStatus, useUpdateOrderStatus } from './use-orders';
export { useOrdersHistory } from './use-orders-history';
export { useCreatePayment } from './use-payments';
export { useUpdateSchedule } from './use-schedules';
export { useSnackbar } from './use-snackbar';
export { useUpdateStaff } from './use-staff-management';
export {
  useAdjustStock,
  useStockMovements,
  useStockTotalValue,
  useUpdateStockItem,
} from './use-stock';
export { useTables, useUpdateTableStatus } from './use-tables';
export { useMyOpenTasksCount, useMyTasks } from './use-tasks';
export { useUpdateWaiterCall, useWaiterCalls } from './use-waiter-calls';
