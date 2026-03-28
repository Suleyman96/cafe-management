# New Features Implementation Guide

This document explains the new features added to the Gustri system and how to integrate them.

## 🎯 Overview

### New Features Added:

**Customer App (Web):**
1. Enhanced Call Staff with structured reasons and priorities
2. Item-level notes in cart
3. Customer feedback/complaint system

**Waiter/Admin App (Web + Mobile):**
4. Split payment tracking (by items, by amount, or full)
5. Table transfer functionality
6. Take-out order creation
7. Feedback management dashboard

---

## 📦 Files Created/Modified

### Database Migrations (Supabase)

Created new migration files in `supabase/migrations/`:

1. **`20250102000001_add_new_features.sql`**
   - New tables: `customer_feedback`, `order_payments`, `table_transfers`
   - Modified `orders` table for takeout support
   - Modified `waiter_calls` table with call types and priorities

2. **`20250102000002_payment_functions.sql`**
   - `get_order_remaining_balance()` function
   - `transfer_table()` function
   - Payment validation triggers
   - Auto-update order payment status trigger

3. **`20250102000003_rls_new_tables.sql`**
   - RLS policies for all new tables
   - `order_payment_summary` view
   - Permission grants

### Shared Library Updates

Updated `shared/` folder (used by all apps):

- **`types/database.ts`** - Added new table types
- **`types/index.ts`** - Added helper types and type guards
- **`lib/hooks/use-payments.ts`** - Payment management hooks (NEW)
- **`lib/hooks/use-feedback.ts`** - Feedback management hooks (NEW)
- **`lib/hooks/use-table-transfer.ts`** - Table transfer hooks (NEW)

### Customer Web App

New components in `customer-web/src/components/`:

- **`waiter/call-staff-modal.tsx`** - Enhanced call staff modal
- **`feedback/feedback-form.tsx`** - Customer feedback form

Modified files:
- **`order/order-status.tsx`** - Integrated new call staff modal and feedback form
- **`cart/cart-screen.tsx`** - Added notes editor for each cart item

### Staff Web App

New components in `staff-web/src/components/`:

- **`orders/split-payment-modal.tsx`** - Split payment interface
- **`tables/table-transfer-modal.tsx`** - Table transfer interface
- **`orders/create-takeout-modal.tsx`** - Takeout order creation

New pages:
- **`app/(staff)/feedback/page.tsx`** - Feedback management dashboard

---

## 🚀 Deployment Steps

### 1. Apply Database Migrations

```bash
cd supabase
supabase db push

# Or if running locally:
supabase db reset
```

This will create all new tables, functions, triggers, and policies.

### 2. Verify Database Schema

Check that these tables exist:
- `customer_feedback`
- `order_payments`
- `table_transfers`

Check that `orders` table has new columns:
- `order_type` (dine_in | takeout)
- `customer_name`
- `customer_phone`

### 3. Update Environment Variables

No new environment variables needed! All components use existing Supabase connection.

### 4. Install Dependencies

The shared hooks use `@tanstack/react-query` which should already be installed.

```bash
# If needed:
cd customer-web && npm install
cd ../staff-web && npm install
```

### 5. Test Each Feature

See the Testing Checklist section below.

---

## 🎨 Feature Integration Guide

### Feature 1: Enhanced Call Staff (Customer App)

**What changed:**
- Old: Simple "Call Waiter" button with basic reason text
- New: Structured modal with predefined reasons, priorities, and optional notes

**Component:** `customer-web/src/components/waiter/call-staff-modal.tsx`

**Usage:**
```tsx
import { CallStaffModal } from '@/components/waiter/call-staff-modal';

<CallStaffModal
  tableId={tableId}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

**Database fields used:**
- `waiter_calls.call_type`: assistance | bill | complaint | question | emergency
- `waiter_calls.priority`: low | normal | high | urgent

**Real-time notifications:**
Staff apps should subscribe to `waiter_calls` table and show alerts for high/urgent priority calls.

---

### Feature 2: Item Notes in Cart (Customer App)

**What changed:**
- Old: Could add order-level notes only
- New: Can add notes to individual items (e.g., "no onions", "extra sauce")

**Component:** Enhanced `customer-web/src/components/cart/cart-screen.tsx`

**How it works:**
1. Customer adds item to cart
2. In cart screen, click "Add special notes" button on any item
3. Enter notes (max 200 characters)
4. Notes are saved with the order item

**Database field:** `order_items.notes`

---

### Feature 3: Customer Feedback System

**What changed:**
- New: Customers can submit feedback/complaints/questions

**Components:**
- `customer-web/src/components/feedback/feedback-form.tsx`
- `staff-web/src/app/(staff)/feedback/page.tsx`

**Feedback types:**
- complaint_food
- complaint_service
- complaint_staff
- question_menu
- request_general
- praise

**Workflow:**
1. Customer submits feedback → status: `pending`
2. Staff views in feedback dashboard
3. Staff can:
   - Acknowledge (status → `acknowledged`)
   - Respond & Resolve (status → `resolved`)
   - Dismiss (status → `dismissed`)

**Integration in customer app:**
```tsx
import { FeedbackForm } from '@/components/feedback/feedback-form';

<FeedbackForm
  tableId={tableId}
  orderId={orderId}
  onSuccess={() => {}}
  onCancel={() => {}}
/>
```

---

### Feature 4: Split Payments

**What changed:**
- Old: One waiter marks order as paid
- New: Multiple waiters can receive payments for different items or amounts

**Component:** `staff-web/src/components/orders/split-payment-modal.tsx`

**Payment modes:**

1. **Full Payment** - Receive entire remaining balance
2. **Partial Amount** - Receive custom amount (e.g., $20 of $50 total)
3. **Specific Items** - Select which items being paid for

**Database:**
- `order_payments` table tracks each payment
- `order_payment_summary` view shows total paid/remaining
- Trigger auto-marks order as paid when balance reaches $0

**Usage:**
```tsx
import { SplitPaymentModal } from '@/components/orders/split-payment-modal';

<SplitPaymentModal
  order={orderWithDetails}
  staffId={currentStaff.id}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

**Hooks:**
```tsx
import { useOrderPayments, useCreatePayment } from '@gustri/shared/lib/hooks/use-payments';

const { data: payments } = useOrderPayments(orderId);
const createPayment = useCreatePayment();
```

---

### Feature 5: Table Transfer

**What changed:**
- New: Move customers and their order to a different table

**Component:** `staff-web/src/components/tables/table-transfer-modal.tsx`

**Workflow:**
1. Waiter opens order details
2. Clicks "Transfer Table"
3. Selects available (free/reserved) table
4. Optionally enters reason
5. Order moves to new table, old table becomes free

**Constraints:**
- Cannot transfer closed/cancelled orders
- Target table must be free or reserved
- Transfer is logged in `table_transfers` table

**Usage:**
```tsx
import { TableTransferModal } from '@/components/tables/table-transfer-modal';

<TableTransferModal
  order={order}
  currentTable={table}
  availableTables={allTables}
  staffId={currentStaff.id}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
/>
```

**Hooks:**
```tsx
import { useTransferTable } from '@gustri/shared/lib/hooks/use-table-transfer';

const transferTable = useTransferTable();
```

---

### Feature 6: Take-out Orders

**What changed:**
- New: Create orders without table assignment (phone/counter orders)

**Component:** `staff-web/src/components/orders/create-takeout-modal.tsx`

**Requirements:**
- Customer name (required)
- Customer phone (required)
- At least one menu item

**Database:**
- `orders.order_type = 'takeout'`
- `orders.table_id = null`
- `orders.customer_name` and `orders.customer_phone` are required

**Usage:**
```tsx
import { CreateTakeoutModal } from '@/components/orders/create-takeout-modal';

<CreateTakeoutModal
  staffId={currentStaff.id}
  menuItems={menuItems}
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onSuccess={(orderId) => router.push(`/orders/${orderId}`)}
/>
```

**Kitchen Display:**
- Takeout orders appear in KDS like regular orders
- Labeled as "TAKEOUT" with customer name/phone

---

## 🧪 Testing Checklist

### Customer App Tests

- [ ] **Call Staff:**
  - [ ] Open call staff modal
  - [ ] Select each call type (assistance, bill, question, complaint, emergency)
  - [ ] Add optional notes
  - [ ] Verify staff receives notification
  - [ ] Verify priority colors (red for urgent, orange for high)

- [ ] **Item Notes:**
  - [ ] Add item to cart
  - [ ] Click "Add special notes"
  - [ ] Enter notes and save
  - [ ] Verify notes appear in cart
  - [ ] Submit order and verify notes in kitchen display

- [ ] **Feedback:**
  - [ ] Open feedback form
  - [ ] Select each feedback type
  - [ ] Enter subject and message
  - [ ] Submit feedback
  - [ ] Verify appears in staff dashboard

### Staff App Tests

- [ ] **Split Payments:**
  - [ ] Open order with $50 total
  - [ ] Waiter A: Receive $20 (partial amount)
  - [ ] Verify remaining balance shows $30
  - [ ] Waiter B: Receive payment for specific items
  - [ ] Waiter C: Receive remaining balance
  - [ ] Verify order marked as fully paid
  - [ ] View payment history

- [ ] **Table Transfer:**
  - [ ] Open order at Table 5
  - [ ] Click "Transfer Table"
  - [ ] Select Table 8 (must be free)
  - [ ] Enter reason (optional)
  - [ ] Confirm transfer
  - [ ] Verify order moved to Table 8
  - [ ] Verify Table 5 is now free
  - [ ] Check transfer history

- [ ] **Take-out Orders:**
  - [ ] Click "Create Takeout"
  - [ ] Enter customer name and phone
  - [ ] Add menu items
  - [ ] Add notes to items
  - [ ] Submit order
  - [ ] Verify order appears in order list as "TAKEOUT"
  - [ ] Verify no table assignment
  - [ ] Verify shows in kitchen display

- [ ] **Feedback Management:**
  - [ ] View pending feedback (should show count badge)
  - [ ] Acknowledge feedback
  - [ ] Respond to feedback
  - [ ] Verify customer sees response
  - [ ] Dismiss spam feedback
  - [ ] Filter by status (pending/acknowledged/resolved/dismissed)

### Edge Cases

- [ ] **Payment Validation:**
  - [ ] Try to overpay (should be prevented)
  - [ ] Try to pay with negative amount (should fail)
  - [ ] Try specific items payment with wrong amount (should fail)

- [ ] **Table Transfer Validation:**
  - [ ] Try to transfer to occupied table (should fail)
  - [ ] Try to transfer closed order (should fail)
  - [ ] Try to transfer to same table (should fail)

- [ ] **Takeout Validation:**
  - [ ] Try to create without customer name (should fail)
  - [ ] Try to create without phone (should fail)
  - [ ] Try to create with no items (should fail)

---

## 📊 Real-time Subscriptions

Add these real-time subscriptions to staff apps:

### 1. Payment Updates

```typescript
supabase
  .channel(`payments:${orderId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'order_payments',
    filter: `order_id=eq.${orderId}`,
  }, (payload) => {
    // Refresh order data
    queryClient.invalidateQueries(['order', orderId]);
  })
  .subscribe();
```

### 2. Feedback Notifications

```typescript
supabase
  .channel('feedback:all')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'customer_feedback',
  }, (payload) => {
    // Show notification
    showNotification('New customer feedback received');
    // Play sound
    playNotificationSound();
  })
  .subscribe();
```

### 3. High-Priority Waiter Calls

```typescript
supabase
  .channel('urgent_calls')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'waiter_calls',
    filter: 'priority=in.(high,urgent)',
  }, (payload) => {
    // Show urgent notification
    showUrgentAlert(payload.new);
  })
  .subscribe();
```

---

## 🎯 Next Steps

### Optional Enhancements:

1. **Analytics Dashboard:**
   - Most common feedback types
   - Average payment split count
   - Table transfer frequency
   - Takeout vs dine-in ratio

2. **Mobile App (React Native):**
   - Port all staff components to React Native
   - Use same hooks from `shared/` folder
   - Add native push notifications

3. **Advanced Features:**
   - Tipping system (add tip to split payments)
   - Customer loyalty points
   - Feedback response templates
   - Bulk table operations

4. **Performance:**
   - Add pagination to feedback list
   - Cache payment summaries
   - Optimize transfer table selection

---

## 🐛 Troubleshooting

### Issue: Payment validation fails

**Solution:** Ensure `get_order_remaining_balance()` function is deployed:

```sql
SELECT get_order_remaining_balance('<order-id>');
```

### Issue: Table transfer fails

**Solution:** Check RLS policies on `tables` table. Staff must have UPDATE permission.

### Issue: Feedback not showing in dashboard

**Solution:** Verify RLS policies on `customer_feedback` table. Check staff authentication.

### Issue: Takeout orders missing customer info

**Solution:** Ensure database constraints are applied:
```sql
SELECT * FROM orders WHERE order_type = 'takeout' AND (customer_name IS NULL OR customer_phone IS NULL);
```

---

## 📚 Additional Resources

- [Supabase Real-time Docs](https://supabase.com/docs/guides/realtime)
- [React Query Docs](https://tanstack.com/query/latest)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

## ✅ Feature Completion Status

- [x] Database migrations
- [x] Shared types and hooks
- [x] Customer: Enhanced call staff
- [x] Customer: Item notes
- [x] Customer: Feedback form
- [x] Staff: Split payment modal
- [x] Staff: Table transfer modal
- [x] Staff: Takeout order creation
- [x] Staff: Feedback management dashboard
- [ ] Mobile app (React Native versions)
- [ ] Real-time notification integration
- [ ] Analytics/reports for new features

---

**Last Updated:** January 2, 2025  
**Version:** 2.0.0


