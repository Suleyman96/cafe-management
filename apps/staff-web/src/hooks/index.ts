// Export all hooks from a single entry point

// Shared hooks (re-exported for convenience — apps may import from
// `@gustri/queries` directly, but the index lets feature pages keep one
// import path).
export {
  useActiveOrders,
  useActiveWaiters,
  useAddOrderItems,
  useAssignDeliveryPerson,
  useCafeSettings,
  useCategories,
  useCleanupEmptyOrders,
  useCreateCategory,
  useCreateDeliveryCustomer,
  useCreateExpense,
  useCreateExpenseCategory,
  useCreateMenuItem,
  useCreateSchedule,
  useCreateStaff,
  useCreateTask,
  useCreateWasteLog,
  useDeleteCategory,
  useDeleteDeliveryCustomer,
  useDeleteExpense,
  useDeleteExpenseCategory,
  useDeleteMenuItem,
  useDeleteOrderItem,
  useDeleteSchedule,
  useDeleteStaff,
  useDeleteTask,
  useDeleteWasteLog,
  useDeliveryCustomers,
  useDeliveryCustomersPaginated,
  useDeliveryOrders,
  useExpense,
  useExpenseCategories,
  useExpenseMonthlySummary,
  useExpenseSummary,
  useExpenses,
  useFeatureFlag,
  useFeedback,
  useGenerateRecurringTasks,
  useIncrementDeliveryCustomerOrderCount,
  useKitchenView,
  useMarkDelivered,
  useMarkOutForDelivery,
  useMarkScheduleCompleted,
  useMarkScheduleInProgress,
  useMarkTaskCancelled,
  useMarkTaskCompleted,
  useMarkTaskInProgress,
  useMenuItem,
  useMenuItems,
  useMenuItemsPaginated,
  useMyTasks,
  useOpenTasksCount,
  useOrder,
  useOrders,
  useOverdueTasksCount,
  usePendingFeedbackCount,
  useRecurringTemplates,
  useReplaceStaffKitchenFilters,
  useRevenueSummary,
  useSchedulesByDate,
  useSchedulesByDateRange,
  useSearchDeliveryCustomers,
  useShiftReconciliation,
  useStaff,
  useStaffByEmail,
  useStaffKitchenFilters,
  useStaffMember,
  useStaffPerformance,
  useTakeoutOrders,
  useTask,
  useTasks,
  useTaxMultiplier,
  useTodaysTasks,
  useToggleMenuItemAvailability,
  useTopSoldItems,
  useTopWastedItems,
  useUpdateCategory,
  useUpdateDeliveryCustomer,
  useUpdateDeliveryFee,
  useUpdateExpense,
  useUpdateExpenseCategory,
  useUpdateMenuItem,
  useUpdateOrderNotes,
  useUpdateStaff,
  useUpdateTask,
  useUpdateWasteLog,
  useWasteDailySummary,
  useWasteLog,
  useWasteLogs,
  useWasteMonthlySummary,
  useWasteSummary,
} from '@gustri/queries';
export * from './use-auth';
export * from './use-can-perform';
export * from './use-discount-safe';
export * from './use-feedback-safe';
export * from './use-format-price';
export * from './use-is-online';
export * from './use-order-filters';
export * from './use-orders-safe';
export * from './use-payments-safe';
export * from './use-realtime-sync';
export * from './use-refunds-safe';
export * from './use-schedules-safe';
export * from './use-settings-safe';
export * from './use-staff-cart';
export * from './use-staff-safe';
export * from './use-stock-safe';
export * from './use-table-transfers-safe';
export * from './use-tables-safe';
export * from './use-tasks-safe';
export * from './use-tax-multiplier';
export * from './use-tenant-plan';
export * from './use-waiter-calls-safe';
export * from './use-z-report-safe';
