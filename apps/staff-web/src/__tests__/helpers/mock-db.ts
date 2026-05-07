/**
 * Mock db factory for testing.
 * Returns a mock matching the SupabaseWrapper shape with all methods as vi.fn().
 */

function mockResource(...methods: string[]) {
  const resource: Record<string, any> = {};
  for (const m of methods) {
    resource[m] = vi.fn().mockResolvedValue([]);
  }
  return resource;
}

export function createMockDb() {
  return {
    // Top-level wrapper methods (not domain resources). use-auth.ts calls
    // db.setTenantContext(staff.tenant_id) on login and db.setTenantContext(null)
    // on logout — without this stub the whole login flow throws before setStaff.
    setTenantContext: vi.fn(),
    getTenantId: vi.fn().mockReturnValue(null),
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
      'cancelOrder',
      'updateNotes',
      'applyDiscount',
      'findDeliveryOrders',
      'findDeliveryById',
      'assignDeliveryPerson',
      'updateDeliveryFee',
      'markOutForDelivery',
      'markDelivered',
    ),
    orderItems: mockResource('create', 'updateStatus', 'delete'),
    menuItems: mockResource(
      'findAll',
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
      'updateLastLogin',
    ),
    feedback: mockResource('findAll', 'markRead', 'getPendingCount'),
    payments: mockResource('create', 'findByOrderId', 'findByReceivedBy'),
    waiterCalls: mockResource(
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
    tenants: mockResource('getCurrent', 'getMonthlyOrderCount'),
    rpc: mockResource('getRemainingBalance', 'transferTable', 'generateOrderNumber'),
    views: mockResource('getSalesSummary', 'getOrderPaymentSummary'),
    realtime: mockResource('subscribeToTables', 'subscribeToOrders', 'subscribeToWaiterCalls'),
  };
}
