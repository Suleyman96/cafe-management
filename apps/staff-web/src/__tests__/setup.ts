import '@testing-library/jest-dom';
import { createMockDb } from './helpers/mock-db';

// Mock i18n with English translations for component tests
vi.mock('@gustri/i18n', () => {
  const en: Record<string, string> = {
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    notes: 'Notes',
    quantity: 'Quantity',
    category: 'Category',
    description: 'Description',
    cash: 'Cash',
    card: 'Card',
    digital: 'Digital',
    bankTransfer: 'Bank Transfer',
    'tasks.newTask': 'New Task',
    'tasks.editTask': 'Edit Task',
    'tasks.taskTitle': 'Task Title',
    'tasks.whatNeedsDone': 'What needs to be done?',
    'tasks.optionalDescription': 'Optional description',
    'tasks.assignTo': 'Assign To',
    'tasks.unassigned': 'Unassigned',
    'tasks.priority': 'Priority',
    'tasks.low': 'Low',
    'tasks.normal': 'Normal',
    'tasks.high': 'High',
    'tasks.urgent': 'Urgent',
    'tasks.dueDate': 'Due Date',
    'tasks.dueTime': 'Due Time',
    'tasks.noTime': 'No time',
    'tasks.makeRecurring': 'Make this a recurring task',
    'tasks.update': 'Update',
    'waste.logWaste': 'Log Waste',
    'waste.editWasteLog': 'Edit Waste Log',
    'waste.linkToStockItem': 'Link to Stock Item',
    'waste.manualEntry': 'Manual entry (no stock item)',
    'waste.itemName': 'Item Name',
    'waste.whatWasWasted': 'What was wasted?',
    'waste.costPerUnit': 'Cost per Unit',
    'waste.totalCost': 'Total Cost',
    'waste.wasteReason': 'Reason',
    'waste.wasteDate': 'Waste Date',
    'waste.deductFromStock': 'Deduct from stock inventory',
    'waste.expired': 'Expired',
    'waste.spoiled': 'Spoiled',
    'waste.overcooked': 'Overcooked',
    'waste.dropped': 'Dropped',
    'waste.returnedByCustomer': 'Returned',
    'waste.preparationWaste': 'Prep Waste',
    'waste.other': 'Other',
    'stock.unit': 'Unit',
    'expenses.addExpense': 'Add Expense',
    'expenses.editExpense': 'Edit Expense',
    'expenses.expenseAmount': 'Amount',
    'expenses.expenseDescription': 'Description',
    'expenses.whatExpenseFor': 'What was this expense for?',
    'expenses.paymentMethod': 'Payment Method',
    'expenses.expenseDate': 'Date',
    'expenses.updateExpense': 'Update Expense',
    'expenses.noCategory': 'No category',
    'expenses.optionalNotes': 'Optional notes',
    'feedback.title': 'Customer Feedback',
    'feedback.subtitle': 'Manage complaints, questions, and requests from customers',
    'feedback.unreadTab': 'Unread',
    'feedback.readTab': 'Read',
    'feedback.noFeedback': 'No feedback to display',
    'feedback.markRead': 'Mark as Read',
    'feedback.markedAsRead': 'Marked as read',
    'feedback.failedMarkRead': 'Failed to mark feedback as read',
    'feedback.status.pending': 'Unread',
    'feedback.status.read': 'Read',
    'calls.title': 'Waiter Calls',
    'calls.subtitle': 'Respond to customer requests',
    'calls.allTab': 'All',
    'calls.pendingTab': 'Pending',
    'calls.respondedTab': 'Responded',
    'calls.completedTab': 'Completed',
    'calls.justNow': 'Just now',
    'calls.minuteAgo': '1 minute ago',
    'calls.minutesAgo': '{{count}} minutes ago',
    'calls.hourAgo': '1 hour ago',
    'calls.hoursAgo': '{{count}} hours ago',
    'calls.respond': 'Respond',
    'calls.requestBill': 'Request Bill',
    'calls.assistance': 'Assistance',
    'calls.complaint': 'Complaint',
    'calls.question': 'Question',
    'calls.emergency': 'Emergency',
    'kitchen.title': 'Kitchen Orders',
    'kitchen.noOrders': 'No orders in the kitchen',
    'kitchen.newOrders': 'New',
    'kitchen.preparing': 'Preparing',
    'kitchen.ready': 'Ready',
    'kitchen.startCooking': 'Start Cooking',
    'kitchen.allItemsReady': 'All Items Ready',
    'kitchen.orderReady': 'Order Ready',
    'kitchen.noActiveOrders': 'No active orders',
    'kitchen.waitingForOrders': 'Waiting for orders',
    'kitchen.newStatus': 'NEW',
    'kitchen.cookingStatus': 'COOKING',
    'kitchen.readyStatus': 'READY',
    'kitchen.cooking': 'Cooking',
    'kitchen.readyLabel': 'Ready',
    'kitchen.min': 'min',
    'kitchen.urgent': 'URGENT',
    'kitchen.orderNotes': 'Notes:',
    'kitchen.allServed': 'All Served',
    pending: 'Pending',
    completed: 'Completed',
    all: 'All',
    'tables.takeout': 'Takeout',
    'orders.ready': 'Ready',
    'orders.served': 'Served',
    'orders.tax': 'Tax',
    'delivery.failedUpdate': 'Failed to update',
    'calls.call': 'call',
    'calls.callsPlural': 'calls',
    'calls.callCompleted': 'Call completed',
    'calls.failedRespond': 'Failed to respond',
    'calls.errorLoading': 'Error loading calls',
    'calls.noCalls': 'No calls',
    'calls.acknowledged': 'Acknowledged',
    'calls.acknowledge': 'Acknowledge',
    'calls.resolved': 'Resolved',
    'calls.resolve': 'Resolve',
    'calls.callAcknowledged': 'Call acknowledged',
    'calls.respondedBy': 'Responded by {{name}}',
    'payment.processPaymentCash': 'Process Payment',
    'payment.paymentMethod': 'Payment Method',
    'payment.paymentType': 'Payment',
    'payment.totalToCollect': 'Total to Collect',
    'payment.processPaymentBtn': 'Process Payment',
    'payment.processing': 'Processing...',
    'payment.completing': 'Completing...',
    'payment.completeOrder': 'Complete Order',
    'payment.orderFullyPaid': 'Order fully paid',
    'payment.noItemsToPay': 'No items to pay',
    'payment.clickComplete': 'Click complete to close the order',
    'payment.orderTotal': 'Order Total',
    'payment.alreadyPaid': 'Already Paid',
    'payment.remainingBalance': 'Remaining Balance',
    'payment.exceedsBalance': 'Amount exceeds balance',
    'payment.paymentFailed': 'Payment failed',
    'payment.addTip': 'Add Tip',
    'orders.tip': 'Tip',
    subtotal: 'Subtotal',
    'orders.paymentTitle': 'Payment',
    'orders.splitPayment': 'Split Payment',
    'orders.payFull': 'Pay Full',
    'orders.payPartial': 'Pay Partial',
    'orders.payByItems': 'Pay by Items',
    'orders.remaining': 'Remaining',
    'orders.amount': 'Amount',
    'orders.paymentMethod': 'Payment Method',
    'orders.processPayment': 'Process Payment',
    'orders.invalidAmount': 'Invalid amount',
    'orders.exceedsRemaining': 'Amount exceeds remaining balance',
    'orders.paymentSuccess': 'Payment recorded',
    'orders.paymentFailed': 'Payment failed',
    'orders.completeOrder': 'Complete Order',
    loading: 'Loading',
  };

  return {
    initI18n: vi.fn(),
    useTranslation: () => ({
      t: (key: string) => en[key] ?? key,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    // Consumed by `useFormatPrice` in `@gustri/queries`. Missing any of these
    // surfaces as "No 'X' export is defined on the '@gustri/i18n' mock".
    useLocale: () => 'en',
    useDateFormatter: (options?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en', options),
    useNumberFormatter: (options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat('en', options),
    useCurrencyFormatter: (currency: string) =>
      new Intl.NumberFormat('en', { style: 'currency', currency }),
    I18nextProvider: ({ children }: any) => children,
    Trans: ({ children }: any) => children,
  };
});

// Mock Supabase wrapped client (prevents real client initialization)
vi.mock('@/lib/supabase/wrapped-client', () => ({
  db: createMockDb(),
  supabase: {},
}));

// Mock API routes (used by hooks that now call server-side endpoints)
vi.mock('@/lib/api-routes', () => ({
  apiRoutes: {
    orders: {
      create: vi.fn().mockResolvedValue({ order: { id: 'new-order', status: 'new' } }),
    },
    discounts: {
      apply: vi.fn().mockResolvedValue({ success: true }),
    },
    payments: {
      create: vi.fn().mockResolvedValue({ payment: { id: 'new-payment', amount: 50 } }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({ refund: { id: 'new-refund' } }),
    },
    stock: {
      adjust: vi.fn().mockResolvedValue({ stockItem: { id: 'stock-1', quantity: 10 } }),
    },
    settings: {
      update: vi.fn().mockResolvedValue({ settings: {} }),
    },
  },
}));

// Mock raw Supabase client (used by use-auth.ts)
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    }),
    removeChannel: vi.fn(),
  },
}));

// Clear all mock call counts between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));
