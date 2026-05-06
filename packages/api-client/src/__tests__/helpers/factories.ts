import type {
  CategoryInsert,
  CategoryRow,
  ExpenseCategoryRow,
  ExpenseRow,
  ExpenseUpdate,
  MenuItemInsert,
  MenuItemRow,
  OrderInsert,
  OrderItemInsert,
  OrderItemRow,
  OrderPaymentInsert,
  OrderRow,
  StaffInsert,
  StaffRow,
  StaffScheduleInsert,
  StaffScheduleRow,
  StaffScheduleUpdate,
  StaffUpdate,
  StockItemInsert,
  StockItemRow,
  StockItemUpdate,
  StockMovementRow,
  WaiterCallRow,
  WasteLogRow,
} from '../../wrapper/types';

let counter = 0;

function nextId(): string {
  counter++;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
}

export function resetFactoryCounter() {
  counter = 0;
}

export function buildOrder(overrides?: Partial<OrderRow>): OrderRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    table_id: null,
    assigned_waiter_id: null,
    order_number: `ORD-${counter}`,
    status: 'new',
    source: 'waiter',
    order_type: 'dine_in',
    customer_name: null,
    customer_phone: null,
    subtotal: 0,
    tax: 0,
    total: 0,
    customer_notes: null,
    internal_notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    preparing_at: null,
    ready_at: null,
    served_at: null,
    closed_at: null,
    payment_method: null,
    paid_at: null,
    discount_type: 'none',
    discount_value: 0,
    discount_amount: 0,
    discount_reason: null,
    discount_applied_by: null,
    delivery_address: null,
    delivery_fee: 0,
    delivery_notes: null,
    estimated_delivery_time: null,
    delivered_at: null,
    delivery_person_id: null,
    delivery_access_token: null,
    client_request_id: null,
    force_close_reason: null,
    version: 1,
    ...overrides,
  };
}

export function buildOrderItem(overrides?: Partial<OrderItemRow>): OrderItemRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    order_id: nextId(),
    menu_item_id: nextId(),
    item_name: 'Test Item',
    item_price: 10.0,
    quantity: 1,
    notes: null,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    client_request_id: null,
    ...overrides,
  };
}

export function buildMenuItem(overrides?: Partial<MenuItemRow>): MenuItemRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    category_id: null,
    name: 'Test Menu Item',
    description: null,
    price: 15.99,
    image_url: null,
    preparation_time: null,
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    allergens: null,
    is_available: true,
    is_daily_special: false,
    display_order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function buildCategory(overrides?: Partial<CategoryRow>): CategoryRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    name: 'Test Category',
    description: null,
    icon: null,
    display_order: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function buildStaff(overrides?: Partial<StaffRow>): StaffRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    email: `staff-${counter}@cafe.com`,
    full_name: 'Test Staff',
    role: 'waiter',
    phone: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_login_at: null,
    auth_user_id: null,
    preferred_language: 'en',
    pin_hash: null,
    pin_set_at: null,
    ...overrides,
  };
}

export function buildStockItem(overrides?: Partial<StockItemRow>): StockItemRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    name: 'Test Stock Item',
    description: null,
    category: 'General',
    quantity: 50,
    unit: 'kg',
    cost_price: 10.0,
    minimum_stock_level: 5,
    supplier_name: null,
    notes: null,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function buildStockMovement(overrides?: Partial<StockMovementRow>): StockMovementRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    stock_item_id: nextId(),
    movement_type: 'in',
    quantity_change: 10,
    quantity_after: 60,
    reason: null,
    performed_by: null,
    created_at: new Date().toISOString(),
    client_request_id: null,
    ...overrides,
  };
}

export function buildExpenseCategory(overrides?: Partial<ExpenseCategoryRow>): ExpenseCategoryRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    name: 'Test Expense Category',
    description: null,
    icon: null,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function buildExpense(overrides?: Partial<ExpenseRow>): ExpenseRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    category_id: null,
    amount: 100.0,
    description: 'Test Expense',
    payment_method: 'cash',
    expense_date: '2025-02-20',
    receipt_url: null,
    created_by: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    client_request_id: null,
    ...overrides,
  };
}

export function buildWasteLog(overrides?: Partial<WasteLogRow>): WasteLogRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    item_name: 'Test Waste Item',
    category: 'General',
    quantity: 1.0,
    unit: 'kg',
    cost_per_unit: 5.0,
    total_cost: 5.0,
    reason: 'expired',
    stock_item_id: null,
    notes: null,
    logged_by: null,
    waste_date: '2025-02-20',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function buildWaiterCall(overrides?: Partial<WaiterCallRow>): WaiterCallRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    table_id: nextId(),
    reason: 'Need assistance',
    call_type: 'assistance',
    priority: 'normal',
    status: 'pending',
    responded_by: null,
    created_at: new Date().toISOString(),
    acknowledged_at: null,
    resolved_at: null,
    notes: null,
    client_request_id: null,
    acknowledged_client_request_id: null,
    resolved_client_request_id: null,
    ...overrides,
  };
}

export function buildSchedule(overrides?: Partial<StaffScheduleRow>): StaffScheduleRow {
  return {
    id: nextId(),
    tenant_id: nextId(),
    staff_id: nextId(),
    date: '2025-02-23',
    planned_start: '09:00:00',
    planned_end: '17:00:00',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// --- Insert builders (for wrapper .create() / .update() calls) ---

export function buildOrderInsert(overrides?: Partial<OrderInsert>): OrderInsert {
  return {
    order_number: `ORD-${Date.now()}`,
    status: 'new',
    source: 'waiter',
    order_type: 'dine_in',
    table_id: null,
    assigned_waiter_id: null,
    customer_name: null,
    customer_phone: null,
    subtotal: 0,
    tax: 0,
    total: 0,
    customer_notes: null,
    internal_notes: null,
    preparing_at: null,
    ready_at: null,
    served_at: null,
    closed_at: null,
    payment_method: null,
    paid_at: null,
    delivery_address: null,
    delivery_fee: 0,
    delivery_notes: null,
    estimated_delivery_time: null,
    delivered_at: null,
    delivery_person_id: null,
    ...overrides,
  };
}

export function buildOrderItemInsert(overrides?: Partial<OrderItemInsert>): OrderItemInsert {
  return {
    order_id: nextId(),
    menu_item_id: nextId(),
    item_name: 'Test Item',
    item_price: 10.0,
    quantity: 1,
    notes: null,
    status: 'pending',
    ...overrides,
  };
}

export function buildPaymentInsert(overrides?: Partial<OrderPaymentInsert>): OrderPaymentInsert {
  return {
    order_id: nextId(),
    received_by: nextId(),
    payment_type: 'full',
    amount: 50.0,
    tip_amount: 0,
    payment_method: 'cash',
    order_item_ids: null,
    notes: null,
    ...overrides,
  };
}

export function buildMenuItemInsert(overrides?: Partial<MenuItemInsert>): MenuItemInsert {
  return {
    name: 'Test Menu Item',
    price: 15.99,
    category_id: null,
    description: null,
    image_url: null,
    preparation_time: null,
    is_popular: false,
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    is_spicy: false,
    allergens: null,
    is_available: true,
    is_daily_special: false,
    display_order: 0,
    ...overrides,
  };
}

export function buildCategoryInsert(overrides?: Partial<CategoryInsert>): CategoryInsert {
  return {
    name: 'Test Category',
    description: null,
    icon: null,
    display_order: 0,
    is_active: true,
    ...overrides,
  };
}

export function buildStaffInsert(overrides?: Partial<StaffInsert>): StaffInsert {
  return {
    email: `staff-${counter}@cafe.com`,
    full_name: 'Test Staff',
    role: 'waiter',
    phone: null,
    is_active: true,
    last_login_at: null,
    auth_user_id: null,
    preferred_language: 'en',
    ...overrides,
  };
}

export function buildStockItemInsert(overrides?: Partial<StockItemInsert>): StockItemInsert {
  return {
    name: 'Test Stock Item',
    description: null,
    category: 'General',
    quantity: 50,
    unit: 'kg',
    cost_price: 10.0,
    minimum_stock_level: 5,
    supplier_name: null,
    notes: null,
    is_active: true,
    ...overrides,
  };
}

export function buildScheduleInsert(overrides?: Partial<StaffScheduleInsert>): StaffScheduleInsert {
  return {
    staff_id: nextId(),
    date: '2025-02-23',
    planned_start: '09:00',
    planned_end: '17:00',
    actual_start: null,
    actual_end: null,
    status: 'scheduled',
    notes: null,
    ...overrides,
  };
}

export function buildScheduleUpdate(overrides?: Partial<StaffScheduleUpdate>): StaffScheduleUpdate {
  return {
    ...overrides,
  };
}

export function buildStaffUpdate(overrides?: Partial<StaffUpdate>): StaffUpdate {
  return {
    ...overrides,
  };
}

export function buildStockItemUpdate(overrides?: Partial<StockItemUpdate>): StockItemUpdate {
  return {
    ...overrides,
  };
}

export function buildExpenseUpdate(overrides?: Partial<ExpenseUpdate>): ExpenseUpdate {
  return {
    ...overrides,
  };
}
