# Gustri - Restaurant Management System

A comprehensive restaurant management system built with modern web technologies, featuring real-time order management, table tracking, delivery ordering, inventory management, and multi-platform support.

## Architecture

This is a Turborepo monorepo containing:

### Apps
- **`staff-web`** - Staff management dashboard (Next.js 14, port 3001)
- **`customer-web`** - Customer ordering interface (Next.js 14, port 3000)
- **`mobile`** - Staff mobile app (React Native / Expo 54)

### Packages
- **`@gustri/core`** - Shared business logic, utilities, constants, and query keys
- **`@gustri/database`** - Database types (generated from Supabase), Zod schemas, enums
- **`@gustri/api-client`** - Type-safe Supabase API wrapper with runtime validation
- **`@gustri/i18n`** - Internationalization (i18next) with shared locale bundles
- **`@gustri/ui`** - Shared React components (Button, LoadingSpinner)

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm 9+
- Supabase CLI (for local development)
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

If you prefer to apply migrations one by one, run each file inside `supabase/migrations/` in alphabetical order via the SQL Editor. There are currently 51 migration files covering schema creation, RLS policies, functions, views, and incremental features.

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
pnpm dev --filter=@gustri/staff-web
pnpm dev --filter=@gustri/customer-web

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
pnpm test:mobile

# E2E tests (requires running dev server)
pnpm test:e2e

# Open Supabase Studio
pnpm db:studio
```

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript 5
- **Mobile**: React Native 0.81, Expo 54
- **Styling**: Tailwind CSS 3.4, shadcn/ui patterns
- **State Management**: Zustand, TanStack Query v5
- **Backend**: Supabase (PostgreSQL 15, Realtime, Auth, Storage, RLS)
- **Build System**: Turborepo, tsup
- **Package Manager**: pnpm 9
- **Linting/Formatting**: Biome 2.4
- **Testing**: Vitest 4 (unit/integration), Playwright (E2E)
- **Internationalization**: i18next (EN, AZ, RU, TR)

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
- **Waste Tracking** - Waste logging with reason tracking and top-wasted-items analytics
- **Tasks** - Staff task management with categories, priorities, and recurring tasks
- **Schedules** - Staff work schedule management
- **Cafe Settings** - Restaurant branding, tax/currency configuration, delivery settings
- **Analytics** - Sales summary, order reports, PDF export

### Customer Interface (`customer-web`)
- **QR Code Ordering** - Scan QR code at table to browse menu and place orders
- **Delivery Ordering** - Order via direct link (shared on social media, WhatsApp, etc.)
- **Digital Menu** - Browse categories, view item details, dietary info
- **Cart** - Add items with notes, review before ordering
- **Real-time Tracking** - Live order status updates via Supabase Realtime
- **Multi-language** - English, Azerbaijani, Russian, Turkish
- **Feedback** - Submit complaints, questions, and praise
- **Call Waiter** - Request assistance from staff

### Mobile App (`mobile`)
- **Order Management** - View and manage orders on the go
- **Table Overview** - Monitor table statuses
- **Waiter Calls** - Receive real-time notifications
- **Stock & Expenses** - Track inventory and expenses
- **Task Management** - View and complete assigned tasks
- **Push Notifications** - Expo push notifications for real-time alerts

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
| `staff` | Staff members (admin, waiter, kitchen, owner) linked to auth.users |
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
| `waste_logs` | Waste tracking with item, quantity, reason, and cost |
| `task_categories` | Task category definitions |
| `tasks` | Staff tasks with priority, assignment, recurrence |

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

### Enums

```
STAFF_ROLE:       waiter, admin, kitchen, owner
ORDER_STATUS:     pending_approval, new, preparing, ready, out_for_delivery, delivered, served, closed, cancelled
TABLE_STATUS:     free, occupied, reserved, closed
PAYMENT_METHOD:   cash, card, digital
LANGUAGES:        en, az, ru, tr
```

---

## Deployment

### Deploy to Supabase Cloud

**Initial setup (new project):**

Run [`supabase/reset.sql`](supabase/reset.sql) in the Supabase Dashboard SQL Editor to create all tables, functions, and seed data from scratch.

**Ongoing deployments (applying new migrations):**

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Push only new migrations
supabase db push
```

### Deploy Apps (Vercel)

The project includes GitHub Actions workflows for automated deployment:
- **CI** (`ci.yml`) — Runs lint, test, type-check, and build on every PR to `main`
- **Deploy Staff Web** (`deploy-staff-web.yml`) — Auto-deploys to Vercel after CI passes
- **Deploy Customer Web** (`deploy-customer-web.yml`) — Auto-deploys to Vercel after CI passes

Manual deployment:

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
