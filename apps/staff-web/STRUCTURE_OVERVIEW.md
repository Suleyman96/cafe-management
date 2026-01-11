# Staff-Web App: Structure, Business Logic & Implementation Overview

## 📋 Table of Contents
1. [App Structure](#app-structure)
2. [Business Logic & Features](#business-logic--features)
3. [Database Requirements](#database-requirements)
4. [Current Implementation Status](#current-implementation-status)
5. [Shared Hooks & Utilities](#shared-hooks--utilities)
6. [Missing Features](#missing-features)

---

## 🏗️ App Structure

### Directory Structure
```
staff-web/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (staff)/                  # Protected staff routes group
│   │   │   ├── feedback/            # ✅ Implemented
│   │   │   │   └── page.tsx         # Feedback management page
│   │   │   ├── menu/                # ✅ Implemented
│   │   │   │   └── page.tsx         # Menu management page
│   │   │   └── layout.tsx           # Staff layout wrapper
│   │   ├── api/                      # API routes (auth-related, mostly removed)
│   │   ├── auth/                     # Auth callback handling
│   │   ├── login/                    # Login page (auth removed)
│   │   ├── page.tsx                  # Home/dashboard page
│   │   ├── layout.tsx                # Root layout with Providers
│   │   └── providers.tsx            # QueryClientProvider wrapper
│   │
│   ├── components/
│   │   ├── auth/                     # Auth components (mostly unused)
│   │   ├── menu/                     # ✅ Menu management components
│   │   │   ├── category-modal.tsx   # Add/edit category modal
│   │   │   └── menu-item-modal.tsx   # Add/edit menu item modal
│   │   ├── orders/                   # ⚠️ Components exist but not integrated
│   │   │   ├── create-takeout-modal.tsx
│   │   │   └── split-payment-modal.tsx
│   │   ├── tables/                   # ⚠️ Component exists but not integrated
│   │   │   └── table-transfer-modal.tsx
│   │   └── ui/                       # Reusable UI components
│   │       ├── button.tsx
│   │       └── loading-spinner.tsx
│   │
│   ├── hooks/                        # App-specific hooks
│   │   └── use-auth.ts               # (Unused - auth removed)
│   │
│   ├── lib/                          # Utilities
│   │   ├── supabase.ts              # Supabase client initialization
│   │   └── utils.ts                  # Helper functions
│   │
│   ├── store/                        # State management
│   │   └── auth-store.ts            # (Unused - auth removed)
│   │
│   └── types/                        # TypeScript types
│       └── index.ts                  # Re-exports shared types
│
└── package.json
```

### Technology Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: 
  - Zustand (for local state)
  - TanStack React Query (for server state)
- **Backend**: Supabase (PostgreSQL + Realtime)
- **UI Components**: Custom components + shadcn/ui patterns

---

## 💼 Business Logic & Features

### 1. **Menu Management** ✅ IMPLEMENTED
**Location**: `/menu`

**Features**:
- View all menu items grouped by category
- Filter by category
- Add/Edit/Delete menu items
- Add/Edit/Delete categories
- Toggle item availability
- Multi-language support (EN, AZ, RU, TR)
- Image upload to Supabase Storage
- Dietary flags (Vegetarian, Vegan, Gluten-Free, Spicy)
- Allergen tags
- Popular/Daily Special flags
- Display order management

**Business Rules**:
- Categories can be active/inactive
- Menu items can be available/unavailable
- Items can exist without categories (uncategorized)
- Images stored in Supabase Storage
- Price stored as DECIMAL(10, 2)

### 2. **Customer Feedback Management** ✅ IMPLEMENTED
**Location**: `/feedback`

**Features**:
- View all customer feedback/complaints/questions
- Filter by status (Pending, Acknowledged, Resolved, Dismissed)
- Acknowledge feedback
- Respond to feedback
- Dismiss feedback
- View feedback with table context
- Track response times

**Business Rules**:
- Feedback types: `complaint_food`, `complaint_service`, `complaint_staff`, `question_menu`, `request_general`, `praise`
- Status flow: `pending` → `acknowledged` → `resolved` or `dismissed`
- Feedback linked to tables and orders
- Staff can respond with text

### 3. **Order Management** ⚠️ NOT IMPLEMENTED
**Location**: `/orders` (placeholder on home page)

**Required Features**:
- View all active orders
- Filter by status (new, preparing, ready, served, closed)
- Update order status
- View order details (items, notes, customer info)
- Assign waiter to orders
- Merge orders
- Lock order edits after "Preparing" status
- Real-time order updates

**Business Rules**:
- Order statuses: `new` → `preparing` → `ready` → `served` → `closed`
- Orders can be cancelled
- Orders linked to tables (dine-in) or customer info (takeout)
- Order items can have individual notes
- Order totals calculated automatically (subtotal + tax)

### 4. **Table Management** ⚠️ NOT IMPLEMENTED
**Location**: `/tables` (placeholder on home page)

**Required Features**:
- View all tables with status (Free, Occupied, Reserved, Closed)
- View table details (current order, waiter, occupied time)
- Transfer tables (move orders between tables)
- Create takeout orders
- Auto-open table when QR scanned
- Close table after payment

**Business Rules**:
- Table statuses: `free` → `occupied` → `closed` → `free`
- One active order per table
- Table transfer logs history
- Takeout orders don't require table

### 5. **Payment Management** ⚠️ PARTIALLY IMPLEMENTED
**Components exist but not integrated into pages**

**Required Features**:
- Split payments (full, partial amount, specific items)
- Track payment method (cash, card, digital)
- View remaining balance
- Payment history per order
- Track who received each payment

**Business Rules**:
- Payment types: `full`, `partial_amount`, `specific_items`
- Cannot overpay (validated by database trigger)
- Order marked as paid when balance = 0
- Multiple payments per order allowed

### 6. **Reports & Analytics** ⚠️ NOT IMPLEMENTED
**Location**: `/reports` (not created)

**Required Features** (Admin only):
- Sales reports (by day/hour/item)
- Best/worst sellers
- Staff performance
- Split payment analytics
- Table transfer frequency
- Feedback analytics
- Takeout vs dine-in ratio

---

## 🗄️ Database Requirements

### Core Tables Used by Staff-Web

#### 1. **staff**
```sql
- id (UUID)
- email (VARCHAR)
- full_name (VARCHAR)
- role (waiter | admin | kitchen)
- phone (VARCHAR)
- is_active (BOOLEAN)
- auth_user_id (UUID) → auth.users
```

**Used for**: Authentication, role-based access, staff assignment

#### 2. **categories**
```sql
- id (UUID)
- name_en, name_az, name_ru, name_tr (VARCHAR)
- description_en, description_az, description_ru, description_tr (TEXT)
- icon (VARCHAR)
- display_order (INTEGER)
- is_active (BOOLEAN)
```

**Used for**: Menu organization, filtering

#### 3. **menu_items**
```sql
- id (UUID)
- category_id (UUID) → categories
- name_en, name_az, name_ru, name_tr (VARCHAR)
- description_en, description_az, description_ru, description_tr (TEXT)
- price (DECIMAL 10,2)
- image_url (TEXT)
- preparation_time (INTEGER)
- is_popular, is_vegetarian, is_vegan, is_gluten_free, is_spicy (BOOLEAN)
- allergens (TEXT[])
- is_available (BOOLEAN)
- is_daily_special (BOOLEAN)
- display_order (INTEGER)
```

**Used for**: Menu management, order creation

#### 4. **tables**
```sql
- id (UUID)
- table_number (VARCHAR, UNIQUE)
- qr_code (TEXT, UNIQUE)
- capacity (INTEGER)
- status (free | occupied | reserved | closed)
- location (VARCHAR)
- current_session_id (UUID)
- occupied_at (TIMESTAMPTZ)
- is_active (BOOLEAN)
```

**Used for**: Table management, order assignment

#### 5. **orders**
```sql
- id (UUID)
- table_id (UUID) → tables (nullable for takeout)
- assigned_waiter_id (UUID) → staff
- order_number (VARCHAR, UNIQUE)
- status (new | preparing | ready | served | closed | cancelled)
- subtotal, tax, total (DECIMAL 10,2)
- customer_notes, internal_notes (TEXT)
- order_type (dine_in | takeout)
- customer_name, customer_phone (VARCHAR) -- for takeout
- payment_method (VARCHAR)
- timestamps: created_at, preparing_at, ready_at, served_at, closed_at, paid_at
```

**Used for**: Order management, status tracking

#### 6. **order_items**
```sql
- id (UUID)
- order_id (UUID) → orders
- menu_item_id (UUID) → menu_items
- item_name, item_price (VARCHAR, DECIMAL)
- quantity (INTEGER)
- notes (TEXT) -- item-level notes
- status (pending | preparing | ready | served)
```

**Used for**: Order details, item tracking

#### 7. **order_payments** (NEW)
```sql
- id (UUID)
- order_id (UUID) → orders
- received_by (UUID) → staff
- payment_type (full | partial_amount | specific_items)
- amount (DECIMAL 10,2)
- payment_method (cash | card | digital)
- order_item_ids (UUID[]) -- for specific_items
- notes (TEXT)
```

**Used for**: Split payment tracking

#### 8. **table_transfers** (NEW)
```sql
- id (UUID)
- order_id (UUID) → orders
- from_table_id, to_table_id (UUID) → tables
- transferred_by (UUID) → staff
- reason (TEXT)
- created_at (TIMESTAMPTZ)
```

**Used for**: Table transfer history

#### 9. **customer_feedback** (NEW)
```sql
- id (UUID)
- table_id (UUID) → tables
- order_id (UUID) → orders
- feedback_type (complaint_food | complaint_service | complaint_staff | question_menu | request_general | praise)
- subject, message (VARCHAR, TEXT)
- status (pending | acknowledged | resolved | dismissed)
- responded_by (UUID) → staff
- response (TEXT)
- timestamps: created_at, acknowledged_at, resolved_at
```

**Used for**: Customer feedback management

#### 10. **waiter_calls**
```sql
- id (UUID)
- table_id (UUID) → tables
- reason (VARCHAR) -- assistance, bill, complaint, question, emergency
- status (pending | acknowledged | resolved)
- responded_by (UUID) → staff
- call_type, priority (VARCHAR)
- timestamps: created_at, acknowledged_at, resolved_at
```

**Used for**: Waiter call notifications

### Database Functions

1. **`get_order_remaining_balance(order_uuid)`**
   - Calculates remaining balance after all payments
   - Returns DECIMAL(10, 2)

2. **`transfer_table(order_id, from_table, to_table, staff_id, reason)`**
   - Transfers order between tables
   - Updates table statuses
   - Logs transfer history

3. **Payment Validation Triggers**:
   - `validate_payment_amount()` - Prevents overpayment
   - `validate_items_payment()` - Validates item-specific payments
   - `update_order_payment_status()` - Auto-marks order as paid

---

## ✅ Current Implementation Status

### Fully Implemented

1. **Menu Management** (`/menu`)
   - ✅ Full CRUD for categories
   - ✅ Full CRUD for menu items
   - ✅ Image upload
   - ✅ Multi-language support
   - ✅ Availability toggle
   - ✅ Category filtering

2. **Customer Feedback** (`/feedback`)
   - ✅ View all feedback
   - ✅ Filter by status
   - ✅ Acknowledge/Respond/Dismiss
   - ✅ Status tracking

3. **Home Dashboard** (`/`)
   - ✅ Navigation cards
   - ✅ Links to implemented features

### Partially Implemented (Components Exist)

1. **Split Payment Modal** (`components/orders/split-payment-modal.tsx`)
   - ✅ Component created
   - ❌ Not integrated into orders page
   - ❌ No orders page exists

2. **Table Transfer Modal** (`components/tables/table-transfer-modal.tsx`)
   - ✅ Component created
   - ❌ Not integrated into tables page
   - ❌ No tables page exists

3. **Takeout Order Modal** (`components/orders/create-takeout-modal.tsx`)
   - ✅ Component created
   - ❌ Not integrated
   - ❌ No orders page exists

### Not Implemented

1. **Order Management** (`/orders`)
   - ❌ No page exists
   - ❌ No order list view
   - ❌ No order detail view
   - ❌ No status update functionality
   - ❌ No waiter assignment

2. **Table Management** (`/tables`)
   - ❌ No page exists
   - ❌ No table list view
   - ❌ No table status management
   - ❌ No table transfer integration

3. **Reports & Analytics** (`/reports`)
   - ❌ No page exists
   - ❌ No reports
   - ❌ No analytics

4. **Authentication**
   - ❌ Removed per user request
   - ⚠️ All routes are currently unprotected

---

## 🔧 Shared Hooks & Utilities

### Available Hooks (from `shared/lib/hooks/`)

#### Menu Management
- `useMenuItems(categoryId?)` - Get menu items
- `useMenuItem(id)` - Get single item
- `useCreateMenuItem()` - Create item
- `useUpdateMenuItem()` - Update item
- `useDeleteMenuItem()` - Delete item
- `useCategories()` - Get active categories
- `useAllCategories()` - Get all categories
- `useCreateCategory()` - Create category
- `useUpdateCategory()` - Update category
- `useDeleteCategory()` - Delete category

#### Payments
- `useOrderPayments(orderId)` - Get payments for order
- `useOrderPaymentSummary(orderId)` - Get payment summary
- `useOrderRemainingBalance(orderId)` - Get remaining balance
- `useCreatePayment()` - Create payment
- `useDeletePayment()` - Delete payment

#### Table Transfer
- `useOrderTransferHistory(orderId)` - Get transfer history
- `useRecentTransfers(limit)` - Get recent transfers
- `useTodayTransferCount()` - Get today's transfer count
- `useTransferTable()` - Transfer table

#### Feedback
- `useFeedback(status?)` - Get feedback list
- `useTableFeedback(tableId)` - Get feedback for table
- `usePendingFeedbackCount()` - Get pending count
- `useSubmitFeedback()` - Submit feedback
- `useAcknowledgeFeedback()` - Acknowledge feedback
- `useRespondToFeedback()` - Respond to feedback
- `useDismissFeedback()` - Dismiss feedback

### Supabase Client
- Initialized in `src/lib/supabase.ts`
- Shared hooks use `getSupabaseClient()` from `shared/lib/supabase.ts`
- Initialized in `Providers` component

---

## ❌ Missing Features

### High Priority

1. **Order Management Page** (`/orders`)
   - List all orders with filters
   - Order detail view
   - Status update
   - Waiter assignment
   - Merge orders
   - View order items with notes

2. **Table Management Page** (`/tables`)
   - Table grid/list view
   - Table status indicators
   - Table detail view
   - Integrate table transfer modal
   - Create takeout orders

3. **Authentication** (if needed)
   - Login page
   - Protected routes
   - Role-based access control
   - Session management

### Medium Priority

4. **Reports & Analytics** (`/reports`)
   - Sales reports
   - Staff performance
   - Popular items
   - Payment analytics

5. **Real-time Updates**
   - WebSocket subscriptions for orders
   - Live table status updates
   - Notification system

### Low Priority

6. **Settings/Configuration**
   - System settings
   - Tax configuration
   - Staff management (if admin)

---

## 📝 Notes

- **Authentication**: Currently removed per user request. All routes are accessible without login.
- **Shared Library**: Most business logic is in `shared/` folder, making it reusable across web and mobile apps.
- **Database**: All tables and functions are defined in Supabase migrations.
- **RLS Policies**: Row-Level Security policies exist but may need review for staff-web access.
- **Components**: Some components (split payment, table transfer) exist but need integration into pages.

---

## 🚀 Next Steps

1. **Fix QueryClientProvider issue** (current blocker)
2. **Create Orders Management Page** (`/orders`)
3. **Create Tables Management Page** (`/tables`)
4. **Integrate existing modals** into new pages
5. **Add real-time subscriptions** for live updates
6. **Implement Reports** (if admin role needed)


