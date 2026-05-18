/**
 * Mock db factory for customer-web testing.
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
    // Top-level wrapper methods (not domain resources). The delivery-context
    // hook calls db.setTenantContext after resolving the qr_token; without
    // this stub the post-resolve effect would throw on a real prod build.
    // Default tenant id pretends the wrapper is bound — `useCafeSettings`
    // (C6) gates fetches on `!!tenantId`, so an unset mock would make the
    // existing settings tests skip the fetch. Tests that want to exercise
    // the pre-bind path override with `.mockReturnValue(null)`.
    setTenantContext: vi.fn(),
    getTenantId: vi.fn().mockReturnValue('test-tenant-id'),
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
      'cleanupEmptyOrders',
      'findDeliveryOrders',
      'findDeliveryById',
      'assignDeliveryPerson',
      'updateDeliveryFee',
      'markOutForDelivery',
      'markDelivered',
    ),
    orderItems: mockResource('create', 'updateStatus', 'delete', 'cancel'),
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
    ),
    feedback: mockResource('findAll', 'acknowledge', 'respond', 'dismiss', 'getPendingCount'),
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
    rpc: mockResource('getRemainingBalance', 'transferTable', 'generateOrderNumber'),
    views: mockResource('getSalesSummary', 'getOrderPaymentSummary'),
    realtime: mockResource('subscribeToTables', 'subscribeToOrders', 'subscribeToWaiterCalls'),
  };
}
