# Cafe Idare - Restaurant Management System

A comprehensive restaurant management system built with modern web technologies, featuring real-time order management, table tracking, delivery ordering, inventory management, and multi-platform support.

## Architecture

This is a Turborepo monorepo containing:

### Apps
- **`staff-web`** - Staff management dashboard (Next.js 14)
- **`customer-web`** - Customer ordering interface (QR code + delivery)
- **`mobile`** - React Native mobile app (planned)

### Packages
- **`@cafe-idare/core`** - Shared business logic, utilities, and constants
- **`@cafe-idare/database`** - Database types and schemas
- **`@cafe-idare/api-client`** - Type-safe Supabase API wrapper with runtime validation
- **`@cafe-idare/ui`** - Shared React components

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 8+
- Supabase account
- Git

### Installation

#### macOS / Linux

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/staff-web/.env.example apps/staff-web/.env.local
cp apps/customer-web/.env.example apps/customer-web/.env.local
# Add your Supabase credentials to both .env.local files
```

#### Windows

**Option 1: Using PowerShell (Recommended)**

```powershell
# Install dependencies
pnpm install

# Set up environment variables
Copy-Item apps/staff-web/.env.example apps/staff-web/.env.local
Copy-Item apps/customer-web/.env.example apps/customer-web/.env.local
# Add your Supabase credentials
```

**Option 2: Using Git Bash**

```bash
pnpm install
cp apps/staff-web/.env.example apps/staff-web/.env.local
cp apps/customer-web/.env.example apps/customer-web/.env.local
```

### Windows Troubleshooting

- **Node.js Installation**: Download from [nodejs.org](https://nodejs.org/) or use [nvm-windows](https://github.com/coreybutler/nvm-windows)
- **pnpm Installation**: Run `npm install -g pnpm` or use `corepack enable` (Node.js 16.13+)
- **Long Path Issues**: Enable long paths in Windows:
  ```powershell
  # Run as Administrator
  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
  ```
- **Script Execution Policy**: If PowerShell blocks script execution:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## Database Setup

### Option 1: Using Supabase CLI (Local Development)

```bash
# Start local Supabase instance
supabase start

# Reset database (applies all migrations and seeds data)
supabase db reset

# Create admin user for login
pnpm db:seed-user

# Combined command (reset + create user)
pnpm db:reset
```

### Option 2: Using SQL in Supabase Dashboard (Cloud)

If you're setting up a **Supabase Cloud** project (not local), you can run the complete reset SQL directly in the Supabase Dashboard SQL Editor:

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of [`supabase/reset.sql`](supabase/reset.sql) and run it

This single file contains all tables, functions, triggers, views, and default data — equivalent to running all migration files in order.

### Option 3: Running Migrations Individually

If you prefer to apply migrations one by one, run each file inside `supabase/migrations/` in alphabetical order via the SQL Editor:

```
supabase/migrations/
├── 20250101000001_initial_schema.sql
├── 20250101000002_functions_triggers.sql
├── 20250101000003_rls_policies.sql
├── 20250101000004_views.sql
├── 20250101000005_fix_staff_rls_recursion.sql
├── 20250101000006_allow_staff_menu_access.sql
├── 20250101000007_fix_categories_rls.sql
├── 20250101000008_disable_rls_for_dev.sql
├── 20250101000009_disable_all_rls_for_dev.sql
├── 20250102000001_add_new_features.sql
├── 20250102000002_payment_functions.sql
├── 20250102000003_rls_new_tables.sql
├── 20250102000004_fix_order_number_length.sql
├── 20250102000005_fix_order_number_function.sql
├── 20250102000006_auto_close_on_payment.sql
├── 20250103000001_add_notes_features.sql
├── 20250117000001_disable_customer_feedback_rls.sql
├── 20250120000001_add_cafe_settings.sql
├── 20250121000001_add_cafe_branding.sql
├── 20250131000001_add_order_source_and_approval.sql
├── 20250131000002_fix_table_free_with_multiple_orders.sql
├── 20250131000003_fix_tax_from_settings.sql
├── 20250131000004_add_pending_approval_status.sql
├── 20250131000005_add_tips.sql
├── 20250207000001_enable_realtime.sql
├── 20250222000001_stock_and_expenses.sql
├── 20250222000002_fix_decimal_precision.sql
├── 20250223000001_staff_schedules.sql
├── 20250224000001_delivery_orders.sql
└── 20250224000002_remove_staff_notes.sql
```

### Creating an Admin User

After setting up the database, create an admin user:

1. Create a user in **Supabase Auth** (Dashboard > Authentication > Users > Add User)
   - Email: `admin@test.com`
   - Password: `test1234`
2. Copy the user's UUID
3. Insert a staff record in the SQL Editor:

```sql
INSERT INTO staff (email, full_name, role, is_active, auth_user_id)
VALUES (
  'admin@test.com',
  'Admin User',
  'admin',
  true,
  'YOUR_AUTH_USER_UUID_HERE'
);
```

Or use the provided script:

```bash
pnpm db:seed-user
```

**Default Admin Credentials:**
- Email: `admin@test.com`
- Password: `test1234`

---

## Development

```bash
# Run all apps
pnpm dev

# Run specific app
pnpm dev --filter=@cafe-idare/staff-web
pnpm dev --filter=@cafe-idare/customer-web

# Build all packages
pnpm build

# Type checking
pnpm type-check

# Linting & formatting (Biome)
pnpm check
pnpm check:fix

# Run tests
pnpm test
pnpm test:watch
```

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **State Management**: Zustand, TanStack Query v5
- **Backend**: Supabase (PostgreSQL, Realtime, Auth, Storage)
- **Build System**: Turborepo, tsup
- **Package Manager**: pnpm
- **Linting/Formatting**: Biome
- **Testing**: Vitest

---

## Features

### Staff Dashboard (`staff-web`)
- **Orders** - Real-time order management with status tracking (pending, preparing, ready, served, closed)
- **Tables** - Table status tracking (free, occupied, reserved, closed) with QR codes
- **Kitchen** - Kitchen display for order preparation
- **Delivery** - Delivery order management with driver assignment
- **Menu** - Menu item and category management with multi-language support (EN, AZ, RU, TR)
- **Payments** - Split payments, tips, payment tracking per staff member
- **Waiter Calls** - Real-time customer call notifications
- **Feedback** - Customer complaint and feedback management
- **Stock** - Inventory tracking with movement audit trail and low-stock alerts
- **Expenses** - Expense tracking with categories and reporting
- **Schedules** - Staff work schedule management
- **Cafe Settings** - Restaurant branding, tax/currency configuration, delivery settings
- **Analytics** - Sales summary, order reports

### Customer Interface (`customer-web`)
- **QR Code Ordering** - Scan QR code at table to browse menu and place orders
- **Delivery Ordering** - Order via direct link (shared on social media, WhatsApp, etc.)
- **Digital Menu** - Browse categories, view item details, dietary info
- **Cart** - Add items with notes, review before ordering
- **Real-time Tracking** - Live order status updates via Supabase Realtime
- **Multi-language** - English, Azerbaijani, Russian, Turkish
- **Feedback** - Submit complaints, questions, and praise
- **Call Waiter** - Request assistance from staff

### Order Types
| Type | Source | Table Required | Customer Info |
|------|--------|---------------|---------------|
| Dine-in | QR code or staff | Yes | No |
| Takeout | Staff | No | Name + Phone |
| Delivery | Staff or customer link | No | Name + Phone + Address |

### Order Flow
```
Customer order:  pending_approval -> new -> preparing -> ready -> served -> closed
Staff order:     new -> preparing -> ready -> served -> closed
Delivery order:  new -> preparing -> ready -> out_for_delivery -> delivered -> closed
```

---

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `staff` | Staff members (admin, waiter, kitchen) linked to auth.users |
| `tables` | Physical cafe tables with QR codes |
| `categories` | Menu categories (multi-language) |
| `menu_items` | Menu items with pricing, dietary info, images |
| `orders` | Customer orders (dine-in, takeout, delivery) |
| `order_items` | Individual items within orders |
| `order_payments` | Split payment records with tip support |
| `waiter_calls` | Customer requests for waiter assistance |
| `customer_feedback` | Complaints, questions, and praise |
| `table_transfers` | Audit log of table-to-table transfers |
| `cafe_settings` | Single-row config (tax, currency, branding, delivery) |
| `stock_items` | Inventory items with quantities and suppliers |
| `stock_movements` | Stock movement audit trail (in/out/adjustment) |
| `expense_categories` | Expense category definitions |
| `expenses` | Expense records with payment method and receipts |
| `staff_schedules` | Staff work schedule entries |

### Views

| View | Description |
|------|-------------|
| `active_orders_view` | Real-time active orders for kitchen/waiter |
| `sales_summary_view` | Daily sales summary for reports |
| `order_payment_summary` | Order payment breakdown with remaining balance |

### Key Functions

| Function | Description |
|----------|-------------|
| `generate_order_number()` | Auto-generate sequential order numbers (ORD + date + counter) |
| `calculate_order_total()` | Calculate subtotal, tax (from settings), and total |
| `transfer_table()` | Transfer an order between tables with audit logging |
| `get_order_remaining_balance()` | Calculate remaining balance after payments |
| `set_table_context()` | Set session context for customer QR code access |

---

## Deployment

### Deploy to Supabase Cloud

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

Or run [`supabase/reset.sql`](supabase/reset.sql) directly in the SQL Editor.

### Deploy Apps (Vercel)

```bash
npm i -g vercel
vercel
```

### Environment Variables

Both `staff-web` and `customer-web` need:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## License

MIT
