/**
 * Mock db factory for @gustri/queries testing.
 * Mirrors the SupabaseWrapper shape with all methods as vi.fn().
 */

import { vi } from 'vitest';

function mockResource(...methods: string[]) {
  const resource: Record<string, any> = {};
  for (const m of methods) {
    resource[m] = vi.fn().mockResolvedValue([]);
  }
  return resource;
}

export function createMockDb() {
  return {
    tables: mockResource(
      'findAll',
      'findById',
      'findByTableNumber',
      'findByQrCode',
      'updateStatus',
      'create',
      'update',
      'delete',
    ),
    orders: mockResource(
      'findAll',
      'findById',
      'create',
      'updateStatus',
      'findActiveByTable',
      'getActiveOrders',
      'assignWaiter',
      'cancelOrder',
      'updateNotes',
      'cleanupEmptyOrders',
      'findDeliveryOrders',
      'findTakeoutOrders',
      'findDeliveryById',
      'assignDeliveryPerson',
      'updateDeliveryFee',
      'markOutForDelivery',
      'markDelivered',
    ),
    orderItems: mockResource('create', 'updateStatus', 'delete', 'cancel'),
    menuItems: mockResource(
      'findAll',
      'findAllPaginated',
      'findById',
      'update',
      'create',
      'toggleAvailability',
      'delete',
    ),
    categories: mockResource('findAll', 'create', 'update', 'delete'),
    staff: mockResource(
      'findAll',
      'findById',
      'findByEmail',
      'findByAuthId',
      'create',
      'update',
      'delete',
      'getActiveWaiters',
    ),
    feedback: mockResource('create', 'findAll', 'markRead', 'getPendingCount'),
    payments: mockResource('create', 'findByOrderId', 'findByReceivedBy'),
    waiterCalls: mockResource(
      'create',
      'findByTable',
      'findAll',
      'acknowledge',
      'resolve',
      'getPendingCount',
    ),
    settings: mockResource('get', 'update'),
    stockItems: mockResource(
      'findAll',
      'findById',
      'create',
      'update',
      'delete',
      'adjustStock',
      'getMovements',
      'getLowStockCount',
      'getTotalValue',
    ),
    expenseCategories: mockResource('findAll', 'create', 'update', 'delete'),
    expenses: mockResource(
      'findAll',
      'findById',
      'create',
      'update',
      'delete',
      'getMonthlySummary',
    ),
    schedules: mockResource(
      'create',
      'update',
      'delete',
      'findByDate',
      'findByStaffAndDate',
      'findByStaffRange',
      'findByDateRange',
      'markInProgress',
      'markCompleted',
      'markMissed',
    ),
    waste: mockResource(
      'findAll',
      'findById',
      'create',
      'update',
      'delete',
      'getMonthlySummary',
      'getDailySummary',
      'getTopWastedItems',
    ),
    tasks: mockResource(
      'findAll',
      'findById',
      'findMyTasks',
      'getTodaysTasks',
      'getOverdueCount',
      'getOpenCount',
      'getRecurringTemplates',
      'create',
      'update',
      'delete',
      'markInProgress',
      'markCompleted',
      'markCancelled',
      'assignTo',
      'generateRecurringTasks',
    ),
    deliveryCustomers: mockResource(
      'findAll',
      'findAllPaginated',
      'search',
      'create',
      'update',
      'delete',
      'incrementOrderCount',
    ),
    rpc: mockResource('getRemainingBalance', 'transferTable', 'generateOrderNumber'),
    reports: mockResource(
      'getRevenueSummary',
      'getExpenseSummary',
      'getWasteSummary',
      'getTopSoldItems',
      'getStaffPerformance',
    ),
    views: mockResource('getSalesSummary', 'getOrderPaymentSummary'),
    realtime: mockResource('subscribeToTables', 'subscribeToOrders', 'subscribeToWaiterCalls'),
  };
}

export type MockDb = ReturnType<typeof createMockDb>;
