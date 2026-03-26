import '@testing-library/jest-dom';
import { createMockDb } from './helpers/mock-db';

// Mock i18n with English translations for component tests
vi.mock('@cafe-idare/i18n', () => {
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
  };

  return {
    useTranslation: () => ({
      t: (key: string) => en[key] ?? key,
      i18n: { language: 'en', changeLanguage: vi.fn() },
    }),
    I18nextProvider: ({ children }: any) => children,
    Trans: ({ children }: any) => children,
  };
});

// Mock Supabase wrapped client (prevents real client initialization)
vi.mock('@/lib/supabase/wrapped-client', () => ({
  db: createMockDb(),
  supabase: {},
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
  },
}));
