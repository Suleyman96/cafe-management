// Provider

// Read hooks — Settings & Pricing
export { type CafeSettings, useCafeSettings } from './hooks/use-cafe-settings';
// Read hooks — Menu
export { useCategories } from './hooks/use-categories';
// Read hooks — Delivery Customers
export {
  useDeliveryCustomers,
  useDeliveryCustomersPaginated,
  useSearchDeliveryCustomers,
} from './hooks/use-delivery';
// Read hooks — Expenses
export {
  useExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenses,
} from './hooks/use-expenses';
export { useFeatureFlag } from './hooks/use-feature-flag';
// Read hooks — Feedback
export { useFeedback, usePendingFeedbackCount } from './hooks/use-feedback';
export { useFormatPrice, useFormatPriceWithSettings } from './hooks/use-format-price';
// Read hooks — Kitchen
export {
  type ActiveKitchenFilter,
  deriveKitchenView,
  type HiddenCategoryBucket,
  type KitchenOrderView,
  useKitchenView,
} from './hooks/use-kitchen-view';
export { useMenuItemOptions } from './hooks/use-menu-item-options';
export { useMenuItem, useMenuItems, useMenuItemsPaginated } from './hooks/use-menu-items';
// Read hooks — Orders
export {
  useActiveOrders,
  useDeliveryOrders,
  useOrder,
  useOrders,
  useTakeoutOrders,
} from './hooks/use-orders';
// Read hooks — Payments
export {
  useOrderPayments,
  useOrderRemainingBalance,
  usePaymentsByStaff,
} from './hooks/use-payments';
// Read hooks — Reports
export {
  useExpenseSummary,
  useRevenueSummary,
  useShiftReconciliation,
  useStaffPerformance,
  useTopSoldItems,
  useWasteSummary,
} from './hooks/use-reports';
// Read hooks — Schedules
export {
  useMySchedule,
  useMyScheduleToday,
  useSchedulesByDate,
  useSchedulesByDateRange,
} from './hooks/use-schedules';
// Read hooks — Staff
export { useActiveWaiters, useStaff, useStaffByEmail, useStaffMember } from './hooks/use-staff';
export {
  useReplaceStaffKitchenFilters,
  useStaffKitchenFilters,
} from './hooks/use-staff-kitchen-filters';
// Read hooks — Stock
export {
  useLowStockCount,
  useStockItem,
  useStockItems,
  useStockMovements,
} from './hooks/use-stock';
// Read hooks — Tables
export { useTable, useTableByQrCode, useTables } from './hooks/use-tables';
// Read hooks — Tasks
export {
  useMyTasks,
  useOpenTasksCount,
  useOverdueTasksCount,
  useRecurringTemplates,
  useTask,
  useTasks,
  useTodaysTasks,
} from './hooks/use-tasks';
export { useTaxMultiplier } from './hooks/use-tax-multiplier';
// Read hooks — Tenant + plan
export { type Tenant, useTenant, useTenantPlan } from './hooks/use-tenant';
// Read hooks — Waiter Calls
export { usePendingWaiterCallsCount, useWaiterCalls } from './hooks/use-waiter-calls';
// Read hooks — Waste
export {
  useTopWastedItems,
  useWasteDailySummary,
  useWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
} from './hooks/use-waste';
// Idempotency helpers
export { getOrCreateClientRequestId, randomUUIDv4 } from './idempotency';
// Invalidation helpers
export type { OrderTransition } from './invalidation';
export {
  invalidateDeliveryOrders,
  invalidateExpenses,
  invalidateMenuAndCategories,
  invalidateOrders,
  invalidateOrdersAndTables,
  invalidateSchedules,
  invalidateStock,
  invalidateTakeoutOrders,
  invalidateTasks,
  invalidateWaiterCalls,
  invalidateWaste,
  refetchExpenses,
  refetchStock,
  refetchTasks,
  refetchWaste,
} from './invalidation';
// Centralized query keys
export { NO_TENANT_KEY_SEGMENT, QUERY_KEYS, tenantKey } from './keys';
// Centralized mutation keys (mobile persister + web mutations)
export { MUTATION_KEYS, type MutationKey, type MutationKeyName } from './mutation-keys';
// Mutation types
export type { MutationCallbacks } from './mutations/types';
export { DbProvider, REALTIME_INVALIDATE_DEBOUNCE_MS, useDb, useTenantId } from './provider';
export {
  type StableClientRequestId,
  useStableClientRequestId,
} from './use-stable-client-request-id';

// ─── Mutations ──────────────────────────────────────────────────────────────

// Delivery customer mutations
export {
  useCreateDeliveryCustomer,
  useDeleteDeliveryCustomer,
  useIncrementDeliveryCustomerOrderCount,
  useUpdateDeliveryCustomer,
} from './mutations/use-delivery-customer-mutations';
// Expense mutations
export {
  useCreateExpense,
  useCreateExpenseCategory,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useUpdateExpense,
  useUpdateExpenseCategory,
} from './mutations/use-expense-mutations';
// Feedback mutations
export { useMarkFeedbackRead } from './mutations/use-feedback-mutations';
// Menu mutations
export {
  useCreateCategory,
  useCreateMenuItem,
  useDeleteCategory,
  useDeleteMenuItem,
  useToggleMenuItemAvailability,
  useToggleMenuItemDeliverable,
  useToggleMenuItemTakeoutable,
  useUpdateCategory,
  useUpdateMenuItem,
} from './mutations/use-menu-mutations';
export {
  useCreateMenuItemOption,
  useCreateMenuItemOptionValue,
  useDeleteMenuItemOption,
  useDeleteMenuItemOptionValue,
  useUpdateMenuItemOption,
  useUpdateMenuItemOptionValue,
} from './mutations/use-menu-option-mutations';
// Order mutations
export {
  useAddOrderItems,
  useAssignDeliveryPerson,
  useCancelOrder,
  useCancelOrderItem,
  useCleanupEmptyOrders,
  useDeleteOrderItem,
  useMarkDelivered,
  useMarkOutForDelivery,
  useUpdateDeliveryFee,
  useUpdateOrderItemStatus,
  useUpdateOrderNotes,
  useUpdateOrderStatus,
} from './mutations/use-order-mutations';
// Schedule mutations
export {
  useCreateSchedule,
  useDeleteSchedule,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useUpdateSchedule,
} from './mutations/use-schedule-mutations';
// Settings mutations
export { useUpdateCafeSettings } from './mutations/use-settings-mutations';
// Staff mutations
export { useCreateStaff, useDeleteStaff, useUpdateStaff } from './mutations/use-staff-mutations';
// Stock mutations
export {
  useCreateStockItem,
  useDeleteStockItem,
  useUpdateStockItem,
} from './mutations/use-stock-mutations';
// Table mutations
export {
  useCreateTable,
  useDeleteTable,
  useTransferTable,
  useUpdateTable,
  useUpdateTableStatus,
} from './mutations/use-table-mutations';
// Task mutations
export {
  useCreateTask,
  useDeleteTask,
  useGenerateRecurringTasks,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useUpdateTask,
} from './mutations/use-task-mutations';
// Waiter call mutations
export {
  useAcknowledgeWaiterCall,
  useResolveWaiterCall,
} from './mutations/use-waiter-call-mutations';
// Waste mutations
export {
  useCreateWasteLog,
  useDeleteWasteLog,
  useUpdateWasteLog,
} from './mutations/use-waste-mutations';
