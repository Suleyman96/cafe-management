# CLAUDE.md

## Project Overview

Gustri — a restaurant management system built as a Turborepo monorepo with 3 client apps and 4 shared packages, powered by Supabase (PostgreSQL + Auth + Realtime).

## Monorepo Structure

```
apps/
  staff-web/        Next.js 14 staff dashboard (port 3001)
  customer-web/     Next.js 14 customer ordering interface (port 3000)
  mobile/           React Native / Expo mobile app

packages/
  database/         Database types, Zod schemas, enums
  core/             Shared business logic, utils, validators, type guards, error handling
  api-client/       Type-safe Supabase wrapper (SupabaseWrapper class)
  ui/               Reusable React components (Button, LoadingSpinner)

supabase/           Migrations, seed data, config
scripts/            Utility scripts (create-admin-user.sh)
```

## Commands

```bash
pnpm dev              # Run all dev servers
pnpm build            # Build everything
pnpm test             # Run unit/integration tests (vitest)
pnpm test:watch       # Watch mode
pnpm test:coverage    # With v8 coverage
pnpm test:e2e         # E2E tests (playwright, requires running dev server)
pnpm check            # Biome lint + format check
pnpm check:fix        # Auto-fix biome issues
pnpm type-check       # TypeScript type checking
pnpm db:reset         # Reset Supabase DB + create admin user
pnpm db:studio        # Open Supabase Studio (port 54323)
```

## Tech Stack

- **Runtime:** Node.js 18+, pnpm 8.14
- **Build:** Turborepo + tsup (packages), Next.js (apps)
- **Language:** TypeScript 5.3+ (strict mode)
- **Linter/Formatter:** Biome 2.4 (NOT eslint/prettier)
- **Testing:** Vitest 4.0 (unit/integration), Playwright 1.58 (E2E)
- **Database:** Supabase (PostgreSQL 15, RLS enabled)
- **Frontend:** React 18, Tailwind CSS 3.4, TanStack React Query 5
- **State:** Zustand
- **Mobile:** Expo 51, React Native 0.74

## Code Conventions

### Imports
- All apps use `@/*` path alias mapping to `./src/*`
- Cross-package imports use workspace names: `@gustri/core`, `@gustri/database`, `@gustri/api-client`

### Data Access
- All database operations go through `@gustri/api-client` wrapper (never raw supabase queries in app code)
- Create wrapper: `const db = createSupabaseWrapper(supabaseClient)`
- Usage: `db.orders.findAll()`, `db.tables.findById(id)`, `db.waiterCalls.create({...})`
- Exception: Supabase Realtime channels use the raw `supabase` client directly (not wrappable)

### Types
- All database types are defined in `@gustri/database` and re-exported from `@gustri/api-client`
- Never create local `database.ts` type files in apps — import from the package
- Zod schemas for runtime validation live in `packages/database/src/schemas/`

### Hooks
- Staff-web hooks use `-safe` suffix convention (e.g., `use-orders-safe.ts`)
- Hooks use TanStack React Query for data fetching with `queryKey` conventions: `['orders']`, `['table', id]`

### Components
- Organized by feature: `components/orders/`, `components/modals/`, `components/auth/`
- UI primitives in `components/ui/` (shadcn/ui style)
- Styling: Tailwind CSS classes, `cn()` utility for conditional classes

### Error Handling
- Use error classes from `@gustri/core`: `AppError`, `ValidationError`, `NotFoundError`, etc.
- `handleSupabaseError()` maps Supabase error codes to typed errors
- Type guards from `@gustri/core`: `isOrder()`, `isTable()`, `isStaff()`, etc.

## Biome Rules

- 2-space indentation, 100 char line width
- Single quotes, trailing commas everywhere
- `noExplicitAny`: off (allowed)
- `noUnusedImports`: warn
- `useConst`: error
- Import sorting enforced (alphabetical)
- Run `pnpm check:fix` before committing

## Testing

### Rules
- Always write tests after implementing a new feature
- Update existing tests when fixing bugs or changing behavior
- Run `pnpm test` before considering work complete

### Unit/Integration (Vitest)
- Config: `vitest.config.ts` at root
- Tests in `packages/*/src/__tests__/`
- Mock Supabase helper at `packages/api-client/src/__tests__/helpers/mock-supabase.ts`
- E2E files excluded from vitest (`**/e2e/**`)

### E2E (Playwright)
- Configs in each app: `apps/*/playwright.config.ts`
- Tests in `apps/*/e2e/`
- Requires running dev server (`reuseExistingServer: true` for local)

## Database

- Migrations in `supabase/migrations/` (sequential numbering)
- RLS policies enabled on all tables
- Default admin: `admin@test.com` / `test1234`
- Key tables: orders, tables, menu_items, categories, staff, waiter_calls, customer_feedback, order_payments, table_transfers, staff_schedules, cafe_settings, stock_items, stock_movements, expense_categories, expenses, waste_logs, tasks, task_categories

### Enums
```
ORDER_STATUS: pending_approval, new, preparing, ready, served, out_for_delivery, delivered, closed, cancelled
ORDER_ITEM_STATUS: pending, preparing, ready, served, cancelled
TABLE_STATUS: free, occupied, reserved, closed
USER_ROLE: waiter, admin, kitchen, owner
ORDER_TYPE: dine_in, takeout, delivery
ORDER_SOURCE: customer, waiter, phone
PAYMENT_METHOD: cash, card, digital
PAYMENT_TYPE: full, partial_amount, specific_items
FEEDBACK_TYPE: complaint_food, complaint_service, complaint_staff, question_menu, request_general, praise
CALL_TYPE: assistance, bill, complaint, question, emergency
PRIORITY: low, normal, high, urgent
SCHEDULE_STATUS: scheduled, in_progress, completed, missed
TASK_STATUS: pending, in_progress, completed, cancelled
WASTE_REASON: expired, spoiled, overcooked, dropped, returned_by_customer, preparation_waste, other
STOCK_MOVEMENT: in, out, adjustment
```

## Real-time

Supabase Realtime is used for live updates on orders, tables, and waiter calls. Sound notifications play via `.mp3` files in `public/`.
