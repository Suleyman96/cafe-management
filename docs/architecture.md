# System Architecture

## Overview

Gustri is a restaurant management system built as a Turborepo monorepo with 3 client applications and 5 shared packages, powered by Supabase (PostgreSQL + Auth + Realtime).

### Monorepo Structure

```
apps/
  customer-web/     Next.js 14 customer ordering interface (port 3000)
  staff-web/        Next.js 14 staff dashboard (port 3001)
  mobile/           React Native / Expo mobile app

packages/
  database/         Database types, Zod schemas, enums
  core/             Shared business logic, utils, validators, type guards, error handling
  api-client/       Type-safe Supabase wrapper (SupabaseWrapper class)
  i18n/             Internationalization (i18next) — 20 languages
  ui/               Reusable React components (Button, LoadingSpinner)
```

## System Components

### 1. Customer Web Application

**Technology**: Next.js 14 (App Router), port 3000

**Access Method**:
- QR code scan → Redirects to `/table/{tableId}?token=encrypted_token`
- No authentication required
- Session-based table assignment via encrypted token

**Key Features**:
- Dine-in ordering via QR code (`/table/[tableId]/menu`, `/table/[tableId]/cart`, `/table/[tableId]/order`)
- Delivery ordering (`/delivery/menu`, `/delivery/cart`, `/delivery/order`)
- Real-time order status tracking via Supabase Realtime
- Waiter call with reason/priority selection
- Customer feedback submission
- Multi-language support

**Data Flow**:
```
QR Scan → Load Table Info → Display Menu → Place Order → Real-time Status Updates
```

### 2. Staff Web Application

**Technology**: Next.js 14 (App Router), port 3001

**Key Sections** (route groups under `(staff)/`):
- Tables — grid view of all tables with real-time status
- Orders — order list with filtering, detail view, status management
- Kitchen — kitchen display with real-time order/item updates
- Delivery — delivery order management
- Calls — waiter call queue
- Menu — menu item and category management
- Staff — staff member management
- Reports — revenue, sales, and operational reports
- Stock — inventory/stock management
- Expenses — expense tracking with categories
- Waste — waste log tracking
- Tasks — task management and assignment
- Schedules — staff shift scheduling
- Feedback — customer feedback review
- Cafe Settings — restaurant-wide configuration
- Settings — user preferences

**Real-time Subscriptions** (staff-web):
- `orders-realtime` — orders + order_items changes
- `tables-realtime` — tables + orders changes
- `waiter-calls-realtime` — waiter_calls changes
- `kitchen-realtime` — orders + order_items changes
- `delivery-orders-realtime` — orders + order_items changes
- `notify-waiter-calls` — notification sound for new calls
- `notify-orders` — notification sound for new/pending orders
- `notify-order-items` — notification sound for new items

### 3. Mobile Application (React Native)

**Technology**: React Native (Expo) with TypeScript

**User Roles**:
- **Waiter**: Table and order management, waiter calls, delivery, feedback, waste, tasks
- **Admin**: All waiter capabilities + stock, expenses, staff management, menu management, schedules, cafe settings
- **Owner**: All admin capabilities + reports
- **Kitchen**: Kitchen order display, tasks, waste logging

**Navigation Structure**:
```
Auth Stack (Login)
  └─> Root Stack
       └─> Drawer Navigator
            ├─> Home (Main Bottom Tabs)
            │    ├─> Tables Tab (waiter, admin, owner)
            │    ├─> Orders Tab (all roles)
            │    ├─> Kitchen Tab (kitchen, admin, owner)
            │    ├─> Calls Tab (waiter, admin, owner)
            │    └─> Profile Tab (all roles)
            ├─> Delivery (waiter, admin, owner)
            ├─> Tasks (all roles)
            ├─> Feedback (waiter, admin, owner)
            ├─> Stock (admin, owner)
            ├─> Waste (all roles)
            ├─> Expenses (admin, owner)
            ├─> Staff Management (admin, owner)
            ├─> Menu Management (admin, owner)
            ├─> Schedules (admin, owner)
            ├─> Reports (owner)
            └─> Cafe Settings (admin, owner)
```

**Authentication Flow**:
```
App Launch → Check Auth State
  ├─> Not Authenticated → Login Screen
  └─> Authenticated → Drawer Navigator → Role-Based Navigation
       ├─> Waiter Role → Bottom Tabs (Tables, Orders, Calls, Profile) + Drawer items
       ├─> Admin Role → All Tabs + Management drawer items
       ├─> Owner Role → All Tabs + All drawer items including Reports
       └─> Kitchen Role → Bottom Tabs (Orders, Kitchen, Profile) + Tasks, Waste
```

### 4. Backend (Supabase)

**Components**:

#### PostgreSQL Database
- ACID compliance
- Row-level security (RLS) enabled on all tables
- Real-time subscriptions via `postgres_changes`
- Database functions for complex operations (table transfers, order item transfers, payment processing)

#### Key Database Tables
- `orders` — order records with status tracking, delivery support
- `order_items` — individual line items per order
- `tables` — table definitions with QR codes and status
- `menu_items` — menu items with multilingual names/descriptions
- `categories` — menu categories with multilingual names
- `staff` — staff records with roles
- `waiter_calls` — waiter call queue with type, priority, status
- `customer_feedback` — customer feedback with types and response tracking
- `order_payments` — payment records supporting split payments (full, partial_amount, specific_items)
- `table_transfers` — audit trail for table-to-table order transfers
- `staff_schedules` — shift scheduling with planned/actual times
- `stock_items` — inventory items with minimum stock levels
- `stock_movements` — stock in/out/adjustment tracking
- `expenses` — expense records with payment method and receipts
- `expense_categories` — categorization for expenses
- `waste_logs` — waste tracking with reason codes and costs
- `tasks` — task management with priority, assignment, and recurrence
- `task_categories` — categorization for tasks
- `cafe_settings` — restaurant-wide configuration (tax, currency, branding, delivery, social links)

#### Enums

```
ORDER_STATUS:     pending_approval, new, preparing, ready, served,
                  out_for_delivery, delivered, closed, cancelled
ORDER_TYPE:       dine_in, takeout, delivery
ORDER_SOURCE:     customer, waiter, phone
ORDER_ITEM_STATUS: pending, preparing, ready, served, cancelled
TABLE_STATUS:     free, occupied, reserved, closed
USER_ROLE:        waiter, admin, kitchen, owner
PAYMENT_METHOD:   cash, card, digital
PAYMENT_TYPE:     full, partial_amount, specific_items
WAITER_CALL_STATUS: pending, acknowledged, resolved
WAITER_CALL_TYPE: assistance, bill, complaint, question, emergency
FEEDBACK_TYPE:    complaint_food, complaint_service, complaint_staff,
                  question_menu, request_general, praise
FEEDBACK_STATUS:  pending, acknowledged, resolved, dismissed
TASK_STATUS:      pending, in_progress, completed, cancelled
TASK_PRIORITY:    low, normal, high, urgent
TASK_RECURRENCE:  daily, weekly, monthly
SCHEDULE_STATUS:  scheduled, in_progress, completed, missed
STOCK_MOVEMENT_TYPE: in, out, adjustment
WASTE_REASON:     expired, spoiled, overcooked, dropped,
                  returned_by_customer, preparation_waste, other
```

#### Supabase Auth
- JWT-based authentication (staff only)
- Role-based access control via staff table
- Secure password hashing
- Session management

#### Supabase Storage
- Menu item images
- Expense receipt uploads
- Cafe logo and hero images
- Public read access, admin-only write

## Shared Packages

### @gustri/database
- Zod schemas for all database tables (runtime validation)
- TypeScript types inferred from schemas
- Enum constants matching PostgreSQL CHECK constraints
- Supabase generated types

### @gustri/core
- Error classes: `AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `NetworkError`
- `handleSupabaseError()` — maps Supabase error codes to typed errors
- Type guards: `isOrder()`, `isTable()`, `isStaff()`, etc.
- Shared constants: status colors, query keys, refresh intervals, storage keys
- Utility functions

### @gustri/api-client
- `SupabaseWrapper` class with domain-specific sub-wrappers:
  - `tables`, `orders`, `orderItems`, `menuItems`, `categories`, `staff`
  - `feedback`, `payments`, `waiterCalls`, `settings`
  - `stockItems`, `expenses`, `expenseCategories`, `schedules`
  - `waste`, `tasks`, `rpc`, `views`, `realtime`
- Factory: `createSupabaseWrapper(supabaseClient)`
- Usage: `db.orders.findAll()`, `db.tables.findById(id)`, `db.rpc.transferTable({...})`
- Re-exports all database types

### @gustri/i18n
- i18next-based internationalization
- 20 supported languages: en, az, ru, tr, ja, ka, kk, uz, de, fr, es, pt, th, id, uk, ar, ko, it, fa, el
- Shared across mobile and web apps

### @gustri/ui
- Reusable React components: `Button`, `LoadingSpinner`
- `cn()` utility for conditional Tailwind classes

## Data Flow Diagrams

### Order Placement Flow
```
Customer Web                 Supabase                    Staff App (Web/Mobile)
    │                           │                            │
    │─── Place Order ──────────>│                            │
    │   (status: pending_       │                            │
    │    approval)              │                            │
    │                           │──── Validate & Insert ────>│
    │                           │         (RLS Check)        │
    │                           │                            │
    │                           │──── Realtime Broadcast ───>│
    │                           │    (Kitchen + Waiter)      │
    │                           │                            │
    │<─── Confirmation ─────────│                            │
    │    (WebSocket)            │                            │
    │                           │                            │
    │                           │                            │<─ Sound Alert
    │                           │                            │  + Toast Notification
```

### Status Update Flow
```
Staff App (Web/Mobile)       Supabase                 Customer Web
    │                           │                            │
    │─── Update Status ────────>│                            │
    │    (new → preparing →     │                            │
    │     ready → served →      │                            │
    │     closed)               │                            │
    │                           │──── Update Order ─────────>│
    │                           │         (RLS)              │
    │                           │                            │
    │                           │──── Broadcast Update ─────>│
    │                           │       (WebSocket)          │
    │                           │                            │
    │<─── Success ──────────────│                            │
    │                           │                            │
    │                           │                            │<─ UI Update
    │                           │                            │  (Real-time)
```

### Delivery Order Flow
```
Customer Web                 Supabase                    Staff App (Web/Mobile)
    │                           │                            │
    │─── Place Delivery ───────>│                            │
    │   Order (with address,    │                            │
    │   phone, delivery notes)  │                            │
    │                           │──── Insert Order ─────────>│
    │                           │   (type: delivery)         │
    │                           │                            │
    │<─── Track Status ─────────│                            │
    │   (preparing →            │                            │
    │    out_for_delivery →     │──── Realtime Broadcast ───>│
    │    delivered)             │                            │
```

## Security Architecture

### Authentication & Authorization

**Customer**: No authentication
- Access via QR code (`/table/{tableId}?token=encrypted_token`)
- Token-based table session validation
- Can only interact with their table's orders

**Staff**: Email/password authentication
- JWT tokens with role claims
- Tokens stored securely (mobile keychain/secure storage)
- Auto-refresh before expiration
- Role-based UI and data access (waiter, admin, kitchen, owner)

### Row-Level Security (RLS) Policies

**Tables Table**:
```sql
-- Customers: Read-only access to their own table
CREATE POLICY "Customers can view their table"
  ON tables FOR SELECT
  USING (id = current_table_id());

-- Staff: Read all tables
CREATE POLICY "Staff can view all tables"
  ON tables FOR SELECT
  TO authenticated
  USING (true);

-- Waiters/Admins/Owners: Update table status
CREATE POLICY "Staff can update tables"
  ON tables FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('waiter', 'admin', 'owner'));
```

**Orders Table**:
```sql
-- Customers: Can insert orders for their table
CREATE POLICY "Customers can place orders"
  ON orders FOR INSERT
  WITH CHECK (table_id = current_table_id() AND status = 'pending_approval');

-- Customers: Can view their table's orders
CREATE POLICY "Customers can view their orders"
  ON orders FOR SELECT
  USING (table_id = current_table_id());

-- Staff: View all orders
CREATE POLICY "Staff can view all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (true);

-- Waiters/Admins/Owners: Update order status
CREATE POLICY "Staff can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('waiter', 'admin', 'owner'));
```

**Menu Items**:
```sql
-- Public read access
CREATE POLICY "Anyone can view menu"
  ON menu_items FOR SELECT
  USING (is_available = true);

-- Admin/Owner write access
CREATE POLICY "Admins can manage menu"
  ON menu_items FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' IN ('admin', 'owner'));
```

## Real-Time Subscriptions

### Customer Web App
```javascript
// Subscribe to order updates for specific table
const orderSubscription = supabase
  .channel(`orders:table_${tableId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `table_id=eq.${tableId}`
    },
    (payload) => {
      // Update UI with new order status
    }
  )
  .subscribe();

// Subscribe to delivery order updates
const deliverySubscription = supabase
  .channel(`delivery_order:${orderId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`
    },
    (payload) => {
      // Update delivery tracking UI
    }
  )
  .subscribe();
```

### Mobile App (Kitchen/Waiter)
```javascript
// Subscribe to all orders
const ordersSubscription = supabase
  .channel('orders:all')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'orders'
    },
    (payload) => {
      // Refresh order list
    }
  )
  .subscribe();

// Subscribe to waiter calls
const waiterCallSubscription = supabase
  .channel('waiter_calls')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'waiter_calls'
    },
    (payload) => {
      // Show notification
      // Play alert sound
    }
  )
  .subscribe();
```

### Staff Web App (Notifications)
```javascript
// Global notification channels (sound alerts + toasts)
supabase.channel('notify-waiter-calls')  // waiter_calls table changes
supabase.channel('notify-orders')        // orders table changes (new/pending_approval)
supabase.channel('notify-order-items')   // order_items table changes

// Page-specific realtime channels
supabase.channel('tables-realtime')           // tables + orders
supabase.channel('orders-realtime')           // orders + order_items
supabase.channel('kitchen-realtime')          // orders + order_items
supabase.channel('waiter-calls-realtime')     // waiter_calls
supabase.channel('delivery-orders-realtime')  // orders + order_items
supabase.channel(`table-${tableId}`)          // single table detail
supabase.channel(`order-${orderId}`)          // single order detail
```

## Implemented Features

- **Dine-in ordering** — QR code-based menu browsing and order placement
- **Delivery ordering** — customer-facing delivery flow with address, phone, delivery fee, and tracking
- **Order management** — full lifecycle from pending_approval through closed/cancelled
- **Order types** — dine_in, takeout, delivery with source tracking (customer, waiter, phone)
- **Table management** — status tracking, QR code assignment, session management
- **Table transfers** — move orders between tables with audit trail
- **Order item transfers** — move individual items between orders/tables
- **Split payments** — full payment, partial amount, or specific items per payment
- **Kitchen display** — real-time order queue for kitchen staff
- **Waiter call system** — call types (assistance, bill, complaint, question, emergency) with priority levels
- **Customer feedback** — typed feedback (complaints, questions, requests, praise) with staff response workflow
- **Stock/Inventory management** — stock items with minimum levels, movement tracking (in/out/adjustment)
- **Expense tracking** — categorized expenses with payment methods and receipt uploads
- **Waste tracking** — waste logs with reason codes, cost calculation, stock item linkage
- **Task management** — tasks with categories, priority, assignment, due dates, and recurring schedules
- **Staff scheduling** — shift planning with planned/actual times and status tracking
- **Menu management** — items and categories with multilingual support, dietary flags, allergens
- **Reports** — revenue, sales, and operational reporting (owner role)
- **Cafe settings** — tax configuration, currency, branding, delivery settings, social links
- **Multi-language** — 20 languages via `@gustri/i18n`; menu items have multilingual name/description columns
- **Sound notifications** — audio alerts for new orders, waiter calls, and ready orders
- **Real-time updates** — Supabase Realtime across all three apps

## Scalability Considerations

### Database Optimization
- Indexed columns: `table_id`, `status`, `created_at`, and foreign keys
- Connection pooling: handled by Supabase
- RLS policies for data isolation

### Caching Strategy
- Client-side: TanStack React Query cache with configurable stale times
- Static assets: CDN delivery via Vercel

### Performance Targets
- Initial page load: < 2 seconds
- Real-time update latency: < 500ms
- API response time: < 200ms (p95)
- Concurrent users: 100+ per cafe

## Disaster Recovery

### Backup Strategy
- Automatic daily backups (Supabase)
- Point-in-time recovery (7 days)

### High Availability
- Supabase managed infrastructure
- Graceful degradation when backend is unavailable

## Development & Deployment

### Environments
- **Development**: Local Supabase + local dev servers (`pnpm dev`)
- **Staging**: Supabase staging project + preview deployments
- **Production**: Supabase production + main branch

### CI/CD Pipeline
```
Git Push → GitHub Actions
  ├─> Turborepo Pipeline (pnpm workspaces)
  │    ├─> Biome Lint + Format Check (pnpm check)
  │    ├─> TypeScript Type Check (pnpm type-check)
  │    ├─> Unit/Integration Tests (Vitest)
  │    └─> Build All (Turborepo caching)
  └─> Deploy
       ├─> Customer Web → Vercel
       ├─> Staff Web → Vercel
       ├─> Mobile App → Expo EAS
       └─> Database Migrations → Supabase CLI
```

### Testing
- **Unit/Integration**: Vitest with Supabase mocks (`packages/*/src/__tests__/`)
- **E2E**: Playwright (`apps/*/e2e/`)
- **Linting/Formatting**: Biome 2.4 (not ESLint/Prettier)

## Future Enhancements

1. **Multi-cafe Support**: Single deployment, multiple locations
2. **Loyalty Program**: Customer accounts with rewards
3. **Payment Gateway Integration**: Stripe or local payment gateways
4. **AI Recommendations**: Suggest items based on order history
5. **Advanced Analytics Dashboard**: Real-time business intelligence with trends
