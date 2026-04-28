# Gustri - Restaurant Management System

A comprehensive restaurant management system built with modern web technologies, featuring real-time order management, table tracking, delivery ordering, inventory management, and multi-platform support.

## Architecture

This is a Turborepo monorepo containing four apps and six shared packages:

```
apps/
  staff-web/        Next.js 14 staff dashboard (port 3001)
  customer-web/     Next.js 14 customer ordering UI (port 3000)
  marketing/        Next.js 14 marketing site + blog (port 3002)
  mobile/           React Native / Expo staff app

packages/
  database/         Generated DB types, Zod input schemas, enums (headless)
  core/             Business logic, validators, type guards, errors (headless)
  api-client/       Type-safe Supabase wrapper used by all apps
  queries/          Shared TanStack Query hooks/mutations (web + mobile)
  i18n/             i18next setup + locale bundles (20 languages)
  ui/               Shared React components

supabase/           Migrations, seed data, config
scripts/            Utility scripts (admin user, type generation, i18n sync)
```

### Apps
- **`staff-web`** - Staff management dashboard (Next.js 14, port 3001)
- **`customer-web`** - Customer ordering interface (Next.js 14, port 3000)
- **`marketing`** - Public marketing site and blog (Next.js 14, port 3002)
- **`mobile`** - Staff mobile app (React Native 0.81, Expo 54)

### Packages
- **`@gustri/core`** - Headless business logic: utilities, validators, type guards, error classes, profit metrics, color/constants. Runtime-agnostic (no React, no react-native).
- **`@gustri/database`** - Database types (generated from Supabase), Zod input schemas, enums, supabase helpers. Headless.
- **`@gustri/api-client`** - Type-safe Supabase wrapper (`SupabaseWrapper`) used by all apps for data access.
- **`@gustri/queries`** - Shared TanStack Query hooks and mutations (orders, tables, menu, stock, payments, reports, etc.) used by web and mobile.
- **`@gustri/i18n`** - Internationalization (i18next) with locale bundles for 20 languages.
- **`@gustri/ui`** - Shared React components (Button, Badge, LoadingSpinner, NumberInput, GustriLogo, etc.).

> **Headless package boundary:** `@gustri/core` and `@gustri/database` MUST NOT import `react`, `react-dom`, or `react-native` — they run in Node (server endpoints, scripts) as well as RN/web. Hooks live in `@gustri/queries`, components in `@gustri/ui`. Biome enforces this via `noRestrictedImports` in `biome.json`.

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
cp apps/marketing/.env.example apps/marketing/.env.local 2>/dev/null || true
# Add your Supabase credentials to each .env.local file
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

> Mobile (`apps/mobile`) reads its Supabase config from `app.config.ts` / `eas.json`. See the app's own README for Expo setup.

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

If you prefer to apply migrations one by one, run each file inside `supabase/migrations/` in alphabetical order via the SQL Editor. The schema starts from a single squashed baseline (`00000000000000_baseline.sql`) followed by incremental migrations covering RLS hardening, indexes, encryption of customer PII, financial audit logging, feature flags, push tokens, monitoring functions, data retention, and app version gating. Older pre-baseline migrations are preserved under `supabase/migrations/_archive/` for reference.

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
pnpm dev --filter=@gustri/marketing
pnpm dev --filter=@gustri/mobile

# Build all packages
pnpm build

# Type checking
pnpm type-check

# Linting & formatting (Biome)
pnpm check
pnpm check:fix

# Run tests (root + every workspace config)
pnpm test
pnpm test:watch
pnpm test:mobile
pnpm test:coverage

# RLS policy tests (require local Supabase running)
pnpm test:rls

# E2E tests (requires running dev server)
pnpm test:e2e

# Open Supabase Studio
pnpm db:studio
```

---

## Tech Stack

- **Frontend (web)**: Next.js 14 (App Router), React 18, TypeScript 5.6+ (strict)
- **Mobile**: React Native 0.81, Expo 54, React 19 (RN's required version)
- **Styling**: Tailwind CSS 3.4, shadcn/ui patterns
- **State Management**: Zustand, TanStack Query v5 (via `@gustri/queries`)
- **Backend**: Supabase (PostgreSQL 15, Realtime, Auth, Storage, RLS)
- **Build System**: Turborepo 2.8, tsup
- **Package Manager**: pnpm 9.15
- **Linting/Formatting**: Biome 2.4 (no eslint/prettier)
- **Testing**: Vitest 4 (unit/integration), Playwright 1.58 (E2E), dedicated RLS test config
- **Internationalization**: i18next — 20 customer-facing locales (ar, az, de, el, en, es, fa, fr, id, it, ja, ka, kk, ko, pt, ru, th, tr, uk, uz); staff UI ships in EN/AZ/RU/TR

### React version policy

- Web apps (`staff-web`, `customer-web`, `marketing`): React 18.x
- Mobile app: React 19.x (required by React Native 0.81+)
- Shared packages declare both via peer ranges (`^18.2.0 || ^19.0.0`)
- Do **not** add React 19-only APIs (`use()`, `useFormStatus`, `useOptimistic`) to shared packages

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
- **Delivery Ordering** - Order via tokenized direct link (shareable on social, WhatsApp, etc.)
- **Digital Menu** - Browse categories, view item details, dietary info
- **Cart** - Add items with notes, review before ordering
- **Real-time Tracking** - Live order status updates via Supabase Realtime
- **Multi-language** - 20 locales (see Tech Stack)
- **Feedback** - Submit complaints, questions, and praise
- **Call Waiter** - Request assistance from staff

### Mobile App (`mobile`)
- **Order Management** - Take, edit, and progress orders from the floor
- **Table Overview** - Monitor table statuses
- **Kitchen View** - Cook-side order queue
- **Waiter Calls** - Receive real-time call notifications
- **Stock & Expenses & Waste** - Operational logging on the go
- **Task Management** - View and complete assigned tasks
- **Push Notifications** - Expo push for new orders, waiter calls, and announcements
- **Force-update flow** - Backed by the `app_versions` table — clients below the minimum supported build are blocked with an upgrade prompt

> **Mobile is intentionally scoped to shift-time work.** Staff CRUD, tenant/billing, plan upgrades,
> bulk menu import, and audit log viewing remain web-only. The mobile staff list shows a banner
> pointing org-management tasks to the web app.

### Marketing Site (`marketing`)
- Public landing page, pricing, and MDX-powered blog
- Independent of staff/customer apps; runs on port 3002

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
| `staff` | Staff members (admin, waiter, kitchen, owner) linked to auth.users; per-tenant unique emails; carries Expo push token |
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
| `financial_audit_log` | Append-only audit trail for money-affecting changes (payments, refunds, discounts) |
| `feature_flags` | Server-driven feature toggles consumed via `useFeatureFlag` |
| `app_versions` | Min/recommended mobile build numbers driving the force-update flow |
| `delivery_access_tokens` | Per-link customer-facing delivery ordering tokens |

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
USER_ROLE:           waiter, admin, kitchen, owner
ORDER_STATUS:        pending_approval, new, preparing, ready, served,
                     out_for_delivery, delivered, closed, cancelled
ORDER_ITEM_STATUS:   pending, preparing, ready, served, cancelled
TABLE_STATUS:        free, occupied, reserved, closed
ORDER_TYPE:          dine_in, takeout, delivery
ORDER_SOURCE:        customer, waiter, phone
PAYMENT_METHOD:      cash, card, digital
PAYMENT_TYPE:        full, partial_amount, specific_items
FEEDBACK_TYPE:       complaint_food, complaint_service, complaint_staff,
                     question_menu, request_general, praise
CALL_TYPE:           assistance, bill, complaint, question, emergency
PRIORITY:            low, normal, high, urgent
SCHEDULE_STATUS:     scheduled, in_progress, completed, missed
TASK_STATUS:         pending, in_progress, completed, cancelled
WASTE_REASON:        expired, spoiled, overcooked, dropped,
                     returned_by_customer, preparation_waste, other
STOCK_MOVEMENT:      in, out, adjustment
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
