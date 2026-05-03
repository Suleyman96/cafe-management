# API Contracts

## Overview

All database operations in Gustri go through the `@gustri/api-client` package, which exposes a `SupabaseWrapper` class. Application code never makes raw Supabase queries -- it uses the wrapper exclusively.

```ts
import { createSupabaseWrapper } from '@gustri/api-client';

const db = createSupabaseWrapper(supabaseClient);
// db.orders.findAll(), db.tables.findById(id), etc.
```

**Authentication**: Supabase Auth with JWT tokens. Staff authenticate via email/password. Customers access via QR code tokens (no auth required).

---

## Enums & Constants

### Order Status
`pending_approval` | `new` | `preparing` | `ready` | `served` | `out_for_delivery` | `delivered` | `closed` | `cancelled`

### Order Item Status
`pending` | `preparing` | `ready` | `served` | `cancelled`

### Order Source
`customer` | `waiter` | `phone`

### Order Type
`dine_in` | `takeout` | `delivery`

### Table Status
`free` | `occupied` | `reserved` | `closed`

### Staff Roles
`waiter` | `admin` | `kitchen` | `owner`

### Payment Method
`cash` | `card` | `digital`

### Payment Type
`full` | `partial_amount` | `specific_items`

### Waiter Call Type
`assistance` | `bill` | `complaint` | `question` | `emergency`

### Waiter Call Priority
`low` | `normal` | `high` | `urgent`

### Waiter Call Status
`pending` | `acknowledged` | `resolved`

### Feedback Type
`complaint_food` | `complaint_service` | `complaint_staff` | `question_menu` | `request_general` | `praise`

### Feedback Status
`pending` | `acknowledged` | `resolved` | `dismissed`

### Stock Movement Type
`in` | `out` | `adjustment`

### Expense Payment Method
`cash` | `card` | `digital` | `bank_transfer`

### Waste Reason
`expired` | `spoiled` | `overcooked` | `dropped` | `returned_by_customer` | `preparation_waste` | `other`

### Task Status
`pending` | `in_progress` | `completed` | `cancelled`

### Task Priority
`low` | `normal` | `high` | `urgent`

### Task Recurrence
`daily` | `weekly` | `monthly`

### Schedule Status
`scheduled` | `in_progress` | `completed` | `missed`

---

## db.tables

Manages restaurant tables.

### Methods

```ts
findAll(): Promise<TableRow[]>
findById(id: string): Promise<TableRow>
findByTableNumber(tableNumber: string): Promise<TableRow>
findByQrCode(qrCode: string): Promise<TableRow>
updateStatus(id: string, status: TableStatus): Promise<TableRow>
create(data: TableInsert): Promise<TableRow>
update(id: string, updates: TableUpdate): Promise<TableRow>
delete(id: string): Promise<void>
```

### TableRow

```ts
{
  id: string;
  table_number: string;
  qr_code: string;
  capacity: number;
  status: 'free' | 'occupied' | 'reserved' | 'closed';
  location: string | null;
  current_session_id: string | null;
  occupied_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const tables = await db.tables.findAll();
const table = await db.tables.findByQrCode('abc123');
await db.tables.updateStatus(table.id, 'occupied');
```

---

## db.orders

Manages orders (dine-in, takeout, and delivery).

### Methods

```ts
findAll(filters?: {
  status?: OrderStatus;
  table_id?: string;
  order_type?: OrderType;
}): Promise<OrderRow[]>
// Returns orders with joined: table, order_items (with menu_item), assigned_waiter, delivery_person

findById(id: string): Promise<OrderRow>
// Returns order with joined: table, order_items (with menu_item), assigned_waiter,
//   delivery_person, order_payments (with received_by_staff), table_transfers

create(data: OrderInsert): Promise<OrderRow>
updateStatus(id: string, status: OrderStatus): Promise<OrderRow>
// Prevents advancing orders with no non-cancelled items

findActiveByTable(tableId: string): Promise<OrderRow | null>
// Returns the most recent active order for a table (status in pending_approval, new, preparing, ready, served)

getActiveOrders(): Promise<OrderRow[]>
// All orders with status in: pending_approval, new, preparing, ready, served, out_for_delivery

assignWaiter(orderId: string, waiterId: string | null): Promise<OrderRow>
cancelOrder(orderId: string, reason: string, tableId?: string | null): Promise<OrderRow>
// Sets status to 'cancelled', stores reason in internal_notes, frees table if no other active orders

updateNotes(orderId: string, notes: {
  customer_notes?: string | null;
  internal_notes?: string | null;
}): Promise<OrderRow>

// Delivery-specific
findDeliveryOrders(): Promise<OrderRow[]>
findDeliveryById(id: string): Promise<OrderRow>
assignDeliveryPerson(orderId: string, staffId: string): Promise<OrderRow>
updateDeliveryFee(orderId: string, fee: number): Promise<OrderRow>
markOutForDelivery(orderId: string, deliveryPersonId: string): Promise<OrderRow>
markDelivered(orderId: string): Promise<OrderRow>

cleanupEmptyOrders(olderThanMinutes?: number): Promise<string[]>
// Cancels new/pending_approval orders with 0 items older than threshold (default: 2 min)
```

### OrderRow

```ts
{
  id: string;
  table_id: string | null;            // Null for takeout/delivery
  assigned_waiter_id: string | null;
  order_number: string;                // Auto-generated
  status: OrderStatus;
  source: 'customer' | 'waiter' | 'phone';
  order_type: 'dine_in' | 'takeout' | 'delivery';
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  tax: number;
  total: number;
  customer_notes: string | null;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  preparing_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  closed_at: string | null;
  payment_method: string | null;
  paid_at: string | null;
  // Delivery fields
  delivery_address: string | null;
  delivery_fee: number;
  delivery_notes: string | null;
  estimated_delivery_time: string | null;
  delivered_at: string | null;
  delivery_person_id: string | null;
}
```

### Example

```ts
const order = await db.orders.create({
  table_id: 'uuid',
  source: 'waiter',
  order_type: 'dine_in',
  status: 'new',
  subtotal: 0, tax: 0, total: 0, delivery_fee: 0,
});

await db.orders.updateStatus(order.id, 'preparing');
await db.orders.assignWaiter(order.id, 'staff-uuid');

// Delivery
const deliveryOrders = await db.orders.findDeliveryOrders();
await db.orders.markOutForDelivery(orderId, deliveryPersonId);
await db.orders.markDelivered(orderId);
```

---

## db.orderItems

Manages individual items within an order.

### Methods

```ts
create(items: OrderItemInsert[]): Promise<OrderItemRow[]>
// Batch-creates items. Order totals are auto-recalculated by a DB trigger.

updateStatus(id: string, status: OrderItemStatus): Promise<OrderItemRow>
delete(id: string): Promise<void>
cancel(id: string, cancelQty?: number): Promise<OrderItemRow>
// If cancelQty is provided and less than item quantity, reduces quantity.
// Otherwise sets status to 'cancelled'.
```

### OrderItemRow

```ts
{
  id: string;
  order_id: string;
  menu_item_id: string;
  item_name: string;
  item_price: number;
  quantity: number;
  notes: string | null;
  status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const items = await db.orderItems.create([
  {
    order_id: 'order-uuid',
    menu_item_id: 'item-uuid',
    item_name: 'Cappuccino',
    item_price: 5.50,
    quantity: 2,
    notes: 'Extra hot',
    status: 'pending',
  },
]);

await db.orderItems.updateStatus(items[0].id, 'preparing');
await db.orderItems.cancel(items[0].id, 1); // Cancel 1 of 2
```

---

## db.menuItems

Manages menu items.

### Methods

```ts
findAll(options?: {
  categoryId?: string;
  isAvailable?: boolean;
  isPopular?: boolean;
}): Promise<MenuItemRow[]>
// Returns items with joined category

findById(id: string): Promise<MenuItemRow>
create(data: MenuItemInsert): Promise<MenuItemRow>
update(id: string, updates: Partial<MenuItemUpdate>): Promise<MenuItemRow>
toggleAvailability(id: string): Promise<MenuItemRow>
delete(id: string): Promise<void>
```

### MenuItemRow

```ts
{
  id: string;
  category_id: string | null;
  name: string;                    // Single language field
  description: string | null;
  price: number;
  image_url: string | null;
  preparation_time: number | null;
  is_popular: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  is_spicy: boolean;
  allergens: string[] | null;
  is_available: boolean;
  is_daily_special: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const items = await db.menuItems.findAll({ categoryId: 'uuid', isAvailable: true });
await db.menuItems.toggleAvailability(items[0].id);
```

---

## db.categories

Manages menu categories.

### Methods

```ts
findAll(options?: { isActive?: boolean }): Promise<CategoryRow[]>
create(data: CategoryInsert): Promise<CategoryRow>
update(id: string, updates: Partial<CategoryUpdate>): Promise<CategoryRow>
delete(id: string): Promise<void>
```

### CategoryRow

```ts
{
  id: string;
  name: string;              // Single language field
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const categories = await db.categories.findAll({ isActive: true });
await db.categories.create({ name: 'Hot Drinks', display_order: 1, is_active: true });
```

---

## db.staff

Manages staff members.

### Methods

```ts
findAll(role?: string): Promise<StaffRow[]>
findById(id: string): Promise<StaffRow>
findByEmail(email: string): Promise<StaffRow>
findByAuthId(authUserId: string): Promise<StaffRow>
// Only returns active staff matching the auth_user_id

create(data: StaffInsert): Promise<StaffRow>
update(id: string, updates: StaffUpdate): Promise<StaffRow>
delete(id: string): Promise<void>
// Soft-delete: sets is_active to false

getActiveWaiters(): Promise<StaffRow[]>
// Returns active staff with role 'waiter'

updateLastLogin(staffId: string): Promise<void>
```

### StaffRow

```ts
{
  id: string;
  email: string;
  full_name: string;
  role: 'waiter' | 'admin' | 'kitchen' | 'owner';
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  auth_user_id: string | null;
  preferred_language: string;
}
```

### Example

```ts
const staff = await db.staff.findByAuthId(session.user.id);
const waiters = await db.staff.getActiveWaiters();
await db.staff.updateLastLogin(staff.id);
```

---

## db.waiterCalls

Manages customer-to-waiter call requests.

### Methods

```ts
create(data: {
  table_id: string;
  call_type?: string;
  reason?: string;
  priority?: string;
  status?: string;          // Defaults to 'pending'
}): Promise<WaiterCallRow>

findByTable(tableId: string, status?: WaiterCallStatus): Promise<WaiterCallRow[]>
findAll(status?: WaiterCallStatus): Promise<WaiterCallRow[]>
// Joins table(table_number, location)

acknowledge(id: string, staffId: string): Promise<WaiterCallRow>
// Sets status='acknowledged', responded_by, acknowledged_at

resolve(id: string, notes?: string): Promise<WaiterCallRow>
// Sets status='resolved', resolved_at, optional notes

getPendingCount(): Promise<number>
```

### WaiterCallRow

```ts
{
  id: string;
  table_id: string;
  reason: string;
  call_type: 'assistance' | 'bill' | 'complaint' | 'question' | 'emergency';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'acknowledged' | 'resolved';
  responded_by: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  notes: string | null;
}
```

### Example

```ts
await db.waiterCalls.create({
  table_id: 'uuid',
  call_type: 'bill',
  reason: 'Customer wants the bill',
  priority: 'normal',
});

const pending = await db.waiterCalls.findAll('pending');
await db.waiterCalls.acknowledge(pending[0].id, staffId);
await db.waiterCalls.resolve(pending[0].id, 'Bill delivered');
```

---

## db.feedback

Manages customer feedback and complaints.

### Methods

```ts
create(data: {
  table_id: string;
  feedback_type: string;
  rating?: number;
  message?: string;
  subject?: string | null;
  order_id?: string | null;
  status?: string;          // Defaults to 'pending'
}): Promise<CustomerFeedbackRow>

findAll(status?: FeedbackStatus): Promise<CustomerFeedbackRow[]>
// Joins table(table_number), responded_by_staff(full_name)

acknowledge(id: string, staffId: string): Promise<CustomerFeedbackRow>
// Sets status='acknowledged', responded_by, acknowledged_at

respond(id: string, staffId: string, response: string, status: FeedbackStatus): Promise<CustomerFeedbackRow>
// Sets responded_by, response text, resolved_at if status='resolved'

dismiss(id: string): Promise<CustomerFeedbackRow>
// Sets status='dismissed'

getPendingCount(): Promise<number>
```

### CustomerFeedbackRow

```ts
{
  id: string;
  table_id: string | null;
  order_id: string | null;
  feedback_type: 'complaint_food' | 'complaint_service' | 'complaint_staff'
    | 'question_menu' | 'request_general' | 'praise';
  subject: string | null;
  message: string;
  status: 'pending' | 'acknowledged' | 'resolved' | 'dismissed';
  responded_by: string | null;
  response: string | null;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}
```

### Example

```ts
await db.feedback.create({
  table_id: 'uuid',
  feedback_type: 'complaint_food',
  message: 'Soup was cold',
});

await db.feedback.respond(feedbackId, staffId, 'We apologize, remaking now', 'resolved');
```

---

## db.payments

Manages order payments (supports split/partial payments).

### Methods

```ts
create(data: OrderPaymentInsert): Promise<OrderPaymentRow>
// Returns payment with joined received_by_staff(full_name, role)

findByOrderId(orderId: string): Promise<OrderPaymentRow[]>
// Returns all payments for an order, newest first

findByReceivedBy(staffId: string, limit?: number): Promise<OrderPaymentRow[]>
// Returns payments received by a specific staff member (default limit: 10)
```

### OrderPaymentRow

```ts
{
  id: string;
  order_id: string;
  received_by: string;
  payment_type: 'full' | 'partial_amount' | 'specific_items';
  amount: number;
  tip_amount: number;
  payment_method: 'cash' | 'card' | 'digital';
  order_item_ids: string[] | null;  // For 'specific_items' payment type
  notes: string | null;
  created_at: string;
}
```

### Example

```ts
await db.payments.create({
  order_id: 'order-uuid',
  received_by: 'staff-uuid',
  payment_type: 'full',
  amount: 25.50,
  tip_amount: 3.00,
  payment_method: 'card',
  order_item_ids: null,
  notes: null,
});

const payments = await db.payments.findByOrderId('order-uuid');
```

---

## db.settings

Manages the single cafe_settings row (singleton pattern).

### Methods

```ts
get(): Promise<CafeSettingsRow>
update(updates: CafeSettingsUpdate): Promise<CafeSettingsRow>
```

### CafeSettingsRow (key fields)

```ts
{
  id: string;
  restaurant_name: string;
  // Tax
  tax_enabled: boolean;
  tax_percentage: number;
  tax_label: string;
  prices_include_tax: boolean;
  show_tax_separately: boolean;
  // Currency
  currency_symbol: string;
  currency_code: string;
  currency_position: 'before' | 'after';
  currency_decimal_places: number;
  minimum_order_amount: number;
  // Feature toggles
  allow_item_notes: boolean;
  allow_order_notes: boolean;
  qr_ordering_enabled: boolean;
  tips_enabled: boolean;
  waste_tracking_enabled: boolean;
  // Branding
  cafe_logo_url: string | null;
  hero_image_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  welcome_heading: string | null;
  welcome_message: string | null;
  // Delivery
  delivery_enabled: boolean;
  delivery_fee_default: number;
  minimum_delivery_amount: number;
  delivery_zone_info: string | null;
  restaurant_address: string | null;
  // Contact & social
  contact_phone: string | null;
  contact_website: string | null;
  social_instagram: string | null;
  social_whatsapp: string | null;
  social_tiktok: string | null;
  social_telegram: string | null;
  social_line: string | null;
  location_maps_url: string | null;
  default_language: string;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const settings = await db.settings.get();
await db.settings.update({ tax_percentage: 18, delivery_enabled: true });
```

---

## db.stockItems

Manages inventory/stock items and stock movements.

### Methods

```ts
findAll(options?: {
  category?: string;
  lowStockOnly?: boolean;
}): Promise<StockItemRow[]>
// Only returns active items. lowStockOnly filters where quantity <= minimum_stock_level.

findById(id: string): Promise<StockItemRow>
create(data: StockItemInsert): Promise<StockItemRow>
update(id: string, updates: Partial<StockItemUpdate>): Promise<StockItemRow>
delete(id: string): Promise<void>
// Soft-delete: sets is_active to false

adjustStock(id: string, data: {
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason?: string;
  performedBy?: string;
}): Promise<StockItemRow>
// Creates a stock_movements record and updates the item quantity.
// 'in' adds, 'out' subtracts, 'adjustment' sets to exact quantity.

getMovements(stockItemId: string): Promise<StockMovementRow[]>
// Returns movements with joined performed_by_staff(full_name)

getLowStockCount(): Promise<number>
// Count of active items where quantity <= minimum_stock_level

getTotalValue(): Promise<number>
// Sum of (quantity * cost_price) for all active items
```

### StockItemRow

```ts
{
  id: string;
  name: string;
  description: string | null;
  category: string;
  quantity: number;
  unit: string;
  cost_price: number;
  minimum_stock_level: number;
  supplier_name: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const lowStock = await db.stockItems.findAll({ lowStockOnly: true });
await db.stockItems.adjustStock('item-uuid', {
  type: 'in',
  quantity: 50,
  reason: 'Weekly delivery',
  performedBy: 'staff-uuid',
});
const totalValue = await db.stockItems.getTotalValue();
```

---

## db.expenseCategories

Manages expense categories.

### Methods

```ts
findAll(): Promise<ExpenseCategoryRow[]>
// Only returns active categories, ordered by name

create(data: ExpenseCategoryInsert): Promise<ExpenseCategoryRow>
update(id: string, updates: Partial<ExpenseCategoryInsert>): Promise<ExpenseCategoryRow>
delete(id: string): Promise<void>
// Soft-delete: sets is_active to false
```

### ExpenseCategoryRow

```ts
{
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}
```

---

## db.expenses

Manages expense records.

### Methods

```ts
findAll(options?: {
  categoryId?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
}): Promise<ExpenseRow[]>
// Joins category(id, name, icon) and created_by_staff(full_name)

findById(id: string): Promise<ExpenseRow>
create(data: ExpenseInsert): Promise<ExpenseRow>
update(id: string, updates: Partial<ExpenseUpdate>): Promise<ExpenseRow>
delete(id: string): Promise<void>

getMonthlySummary(year: number, month: number): Promise<{
  total: number;
  count: number;
  byCategory: Array<{ name: string; total: number; count: number }>;
}>
```

### ExpenseRow

```ts
{
  id: string;
  category_id: string | null;
  amount: number;
  description: string;
  payment_method: 'cash' | 'card' | 'digital' | 'bank_transfer';
  expense_date: string;
  receipt_url: string | null;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
const expenses = await db.expenses.findAll({
  startDate: '2026-03-01',
  endDate: '2026-04-01',
});
const summary = await db.expenses.getMonthlySummary(2026, 3);
// { total: 4500, count: 32, byCategory: [{ name: 'Supplies', total: 2000, count: 15 }, ...] }
```

---

## db.schedules

Manages staff work schedules.

### Methods

```ts
create(data: StaffScheduleInsert): Promise<StaffScheduleRow>
update(id: string, data: StaffScheduleUpdate): Promise<StaffScheduleRow>
delete(id: string): Promise<void>

findByDate(date: string): Promise<StaffScheduleRow[]>
findByStaffAndDate(staffId: string, date: string): Promise<StaffScheduleRow[]>
findByStaffRange(staffId: string, startDate: string, endDate: string): Promise<StaffScheduleRow[]>
findByDateRange(startDate: string, endDate: string): Promise<StaffScheduleRow[]>

markInProgress(id: string, actualStart: string): Promise<StaffScheduleRow>
markCompleted(id: string, actualEnd?: string): Promise<StaffScheduleRow>
markMissed(id: string): Promise<StaffScheduleRow>
```

All read methods join `staff(id, full_name, role)`.

### StaffScheduleRow

```ts
{
  id: string;
  staff_id: string;
  date: string;                 // YYYY-MM-DD
  planned_start: string;        // HH:MM time
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'missed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
await db.schedules.create({
  staff_id: 'uuid',
  date: '2026-03-28',
  planned_start: '09:00',
  planned_end: '17:00',
  status: 'scheduled',
});

const todaySchedules = await db.schedules.findByDate('2026-03-28');
await db.schedules.markInProgress(scheduleId, '09:05');
await db.schedules.markCompleted(scheduleId, '17:10');
```

---

## db.waste

Manages waste/loss tracking logs.

### Methods

```ts
findAll(options?: {
  startDate?: string;
  endDate?: string;
  reason?: string;
  stockItemId?: string;
}): Promise<WasteLogRow[]>
// Joins logged_by_staff(full_name) and stock_item(name, unit)

findById(id: string): Promise<WasteLogRow>
create(data: WasteLogInsert): Promise<WasteLogRow>
update(id: string, updates: Partial<WasteLogUpdate>): Promise<WasteLogRow>
delete(id: string): Promise<void>

getMonthlySummary(year: number, month: number): Promise<{
  totalCost: number;
  count: number;
  byReason: Array<{ reason: string; total: number; count: number }>;
  byCategory: Array<{ category: string; total: number; count: number }>;
}>

getDailySummary(date: string): Promise<{
  totalCost: number;
  count: number;
}>

getTopWastedItems(limit?: number): Promise<Array<{
  item_name: string;
  total_cost: number;
  quantity: number;
  unit: string;
}>>
// Default limit: 5. Ordered by total_cost descending.
```

### WasteLogRow

```ts
{
  id: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  cost_per_unit: number;
  total_cost: number;
  reason: 'expired' | 'spoiled' | 'overcooked' | 'dropped'
    | 'returned_by_customer' | 'preparation_waste' | 'other';
  stock_item_id: string | null;
  notes: string | null;
  logged_by: string | null;
  waste_date: string;
  created_at: string;
}
```

### Example

```ts
await db.waste.create({
  item_name: 'Tomatoes',
  category: 'Produce',
  quantity: 2,
  unit: 'kg',
  cost_per_unit: 3.50,
  total_cost: 7.00,
  reason: 'expired',
  waste_date: '2026-03-28',
  logged_by: 'staff-uuid',
});

const summary = await db.waste.getMonthlySummary(2026, 3);
const topWasted = await db.waste.getTopWastedItems(10);
```

---

## db.tasks

Manages staff tasks with support for recurring task templates.

### Methods

```ts
findAll(options?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  dueBefore?: string;
  isTemplate?: boolean;       // true = recurring templates only, false = non-recurring
}): Promise<TaskRow[]>
// Joins assigned_to_staff(full_name), created_by_staff(full_name)

findById(id: string): Promise<TaskRow>

findMyTasks(staffId: string): Promise<TaskRow[]>
// Non-recurring tasks assigned to staffId with status in (pending, in_progress), ordered by due_date

getTodaysTasks(): Promise<TaskRow[]>
// Non-recurring tasks due today, ordered by due_time

getOverdueCount(): Promise<number>
// Count of non-recurring tasks past due_date with status in (pending, in_progress)

getRecurringTemplates(): Promise<TaskRow[]>
// Templates: is_recurring=true, parent_task_id=null

create(data: TaskInsert): Promise<TaskRow>
update(id: string, updates: Partial<TaskUpdate>): Promise<TaskRow>
delete(id: string): Promise<void>

markInProgress(id: string): Promise<TaskRow>
markCompleted(id: string): Promise<TaskRow>
// Sets completed_at timestamp

markCancelled(id: string): Promise<TaskRow>
assignTo(id: string, staffId: string): Promise<TaskRow>

generateRecurringTasks(date: string): Promise<TaskRow[]>
// For each active recurring template, checks if the date matches the recurrence
// pattern (daily, weekly by day-of-week, monthly by day-of-month).
// Creates task instances with parent_task_id pointing to the template.
// Skips if an instance already exists for the given date.
```

### TaskRow

```ts
{
  id: string;
  title: string;
  description: string | null;
  category_id: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to: string | null;
  created_by: string | null;
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  is_recurring: boolean;
  recurrence_pattern: 'daily' | 'weekly' | 'monthly' | null;
  recurrence_days: number[] | null;   // For weekly: 1=Mon..7=Sun; For monthly: day of month
  parent_task_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Example

```ts
// Create a recurring template
await db.tasks.create({
  title: 'Clean espresso machine',
  priority: 'high',
  status: 'pending',
  is_recurring: true,
  recurrence_pattern: 'daily',
  due_time: '22:00',
  assigned_to: 'staff-uuid',
  created_by: 'admin-uuid',
});

// Generate instances for today
const created = await db.tasks.generateRecurringTasks('2026-03-28');

// Work with tasks
const myTasks = await db.tasks.findMyTasks('staff-uuid');
await db.tasks.markInProgress(myTasks[0].id);
await db.tasks.markCompleted(myTasks[0].id);
```

---

## db.rpc

Remote procedure calls (PostgreSQL functions).

### Methods

```ts
getRemainingBalance(orderId: string): Promise<number>
// Calls get_order_remaining_balance RPC. Returns order total minus sum of payments.

transferTable(params: {
  orderId: string;
  fromTableId: string;
  toTableId: string;
  staffId: string;
  reason?: string;
}): Promise<boolean>
// Calls transfer_table RPC. Moves order to a new table, updates both table statuses,
// creates a table_transfers record.

generateOrderNumber(): Promise<string>
// Calls generate_order_number RPC. Returns a unique order number string.

transferOrderItems(params: {
  sourceOrderId: string;
  destinationTableId: string;
  items: Array<{ item_id: string; quantity: number }>;
  staffId: string;
  reason?: string;
}): Promise<string>
// Calls transfer_order_items RPC. Moves specific items (or partial quantities)
// to a new/existing order on the destination table. Returns the destination order ID.
```

### Example

```ts
const balance = await db.rpc.getRemainingBalance('order-uuid');
// balance = 12.50

await db.rpc.transferTable({
  orderId: 'order-uuid',
  fromTableId: 'table-1-uuid',
  toTableId: 'table-2-uuid',
  staffId: 'staff-uuid',
  reason: 'Customer requested window seat',
});

await db.rpc.transferOrderItems({
  sourceOrderId: 'order-uuid',
  destinationTableId: 'table-3-uuid',
  items: [{ item_id: 'item-uuid', quantity: 1 }],
  staffId: 'staff-uuid',
});
```

---

## db.views

Read-only database views for dashboards and reports.

### Methods

```ts
getActiveOrders(): Promise<ActiveOrderView[]>
getSalesSummary(startDate?: string, endDate?: string): Promise<SalesSummaryView[]>
getOrderPaymentSummary(orderId?: string): Promise<OrderPaymentSummaryView[]>
```

### ActiveOrderView

```ts
{
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  table_number: string;
  location: string | null;
  waiter_name: string | null;
  item_count: number;
  total_quantity: number;
  total: number;
  minutes_elapsed: number;
  items: Json;                 // JSON array of order item details
}
```

### SalesSummaryView

```ts
{
  date: string;
  order_count: number;
  total_revenue: number;
  average_order_value: number;
  tables_served: number;
  avg_service_time_minutes: number;
}
```

### OrderPaymentSummaryView

```ts
{
  order_id: string;
  order_number: string;
  order_total: number;
  paid_amount: number;
  remaining_balance: number;
  payment_count: number;
  payments: Json | null;       // JSON array of payment records
}
```

### Example

```ts
const activeOrders = await db.views.getActiveOrders();
const salesThisMonth = await db.views.getSalesSummary('2026-03-01', '2026-03-28');
const paymentInfo = await db.views.getOrderPaymentSummary('order-uuid');
```

---

## db.realtime

Supabase Realtime subscriptions for live updates.

### Methods

```ts
subscribeToTables(opts: RealtimeSubscribeOptions): Subscription
subscribeToOrders(opts: RealtimeSubscribeOptions): Subscription
subscribeToWaiterCalls(opts: RealtimeSubscribeOptions): Subscription

// Cross-tenant escape hatch (audit listeners, internal tooling).
subscribeUnsafe.tables(opts: RealtimeSubscribeUnsafeOptions): Subscription
subscribeUnsafe.orders(opts: RealtimeSubscribeUnsafeOptions): Subscription
subscribeUnsafe.waiterCalls(opts: RealtimeSubscribeUnsafeOptions): Subscription
```

All `subscribeTo*` methods listen on `postgres_changes` for `event: '*'`
(INSERT, UPDATE, DELETE) on the respective table, scoped to
`tenant_id=eq.<tenantId>`. `tenantId` is REQUIRED — calls without it throw
at runtime as a defense-in-depth guard. Use `subscribeUnsafe.*` only when a
cross-tenant subscription is genuinely needed.

### Types

```ts
type PostgresChangeCallback = (
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>
) => void;

interface RealtimeSubscribeOptions {
  callback: PostgresChangeCallback;
  tenantId: string;          // required
  onError?: (status: string, err?: Error) => void;
}

interface RealtimeSubscribeUnsafeOptions {
  callback: PostgresChangeCallback;
  onError?: (status: string, err?: Error) => void;
}

interface Subscription {
  unsubscribe(): void;
}
```

### Payload Structure

```ts
{
  schema: 'public',
  table: 'orders',            // or 'tables', 'waiter_calls'
  commit_timestamp: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  new: Record<string, unknown>,
  old: Record<string, unknown>,
}
```

### Example

```ts
const sub = db.realtime.subscribeToOrders({
  tenantId,
  callback: (payload) => {
    if (payload.eventType === 'INSERT') {
      playNotificationSound();
      refetchOrders();
    }
  },
});

// Cleanup
sub.unsubscribe();
```

---

## Error Handling

All wrapper methods throw typed errors from `@gustri/core` via `handleSupabaseError()`:

- `AppError` -- base error class
- `ValidationError` -- invalid input
- `NotFoundError` -- row not found (PGRST116)
- `AuthenticationError` -- JWT expired or invalid
- `AuthorizationError` -- RLS policy violation

```ts
import { NotFoundError } from '@gustri/core';

try {
  const order = await db.orders.findById('nonexistent');
} catch (err) {
  if (err instanceof NotFoundError) {
    // Handle 404
  }
}
```
