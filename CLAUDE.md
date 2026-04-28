# CLAUDE.md

## Project Overview

Gustri — a restaurant management system built as a Turborepo monorepo with 4 client apps and 6 shared packages, powered by Supabase (PostgreSQL + Auth + Realtime).

## Monorepo Structure

```
apps/
  staff-web/        Next.js 14 staff dashboard (port 3001)
  customer-web/     Next.js 14 customer ordering interface (port 3000)
  marketing/        Next.js 14 marketing site + blog (port 3002)
  mobile/           React Native 0.81 / Expo 54 staff app

packages/
  database/         DB types, Zod input schemas, enums (headless)
  core/             Business logic, validators, type guards, errors (headless)
  api-client/       Type-safe Supabase wrapper (SupabaseWrapper class)
  queries/          Shared TanStack Query hooks/mutations (web + mobile)
  i18n/             i18next setup + locale bundles (20 languages)
  ui/               Shared React components (Button, Badge, LoadingSpinner, …)

supabase/           Migrations, seed data, config
scripts/            Utility scripts (admin user, type generation, i18n sync)
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
pnpm db:types:generate # Regenerate packages/database/src/types/generated.ts from local DB
pnpm db:types:check   # CI gate: fails if committed types drift from the live schema
```

## Tech Stack

- **Runtime:** Node.js 18+, pnpm 9.15
- **Build:** Turborepo 2.8 + tsup (packages), Next.js 14 (apps)
- **Language:** TypeScript 5.6+ (strict mode)
- **Linter/Formatter:** Biome 2.4 (NOT eslint/prettier)
- **Testing:** Vitest 4 (unit/integration), Playwright 1.58 (E2E), dedicated RLS test config
- **Database:** Supabase (PostgreSQL 15, RLS enabled)
- **Frontend:** React 18 (web), Tailwind CSS 3.4, TanStack React Query 5 (via `@gustri/queries`)
- **State:** Zustand
- **Mobile:** Expo 54, React Native 0.81, React 19

## Where Does New Code Go?

Before adding a file, run through this decision tree. Wrong placement is the #1 source of refactors in this repo.

| You're adding… | Goes in… | Reason |
|---|---|---|
| Pure business logic, validators, calculations, type guards, error classes (provider-agnostic) | `@gustri/core` | Headless, reused across web + mobile + server. NO React, NO Supabase codes, NO Tailwind class strings. |
| DB-shaped types, Zod input schemas, enum constants | `@gustri/database` | Single source of truth for DB shape |
| New table/column/RPC access pattern | `@gustri/api-client` (extend the relevant `*Wrapper`) | Never raw Supabase queries in apps |
| Supabase-specific error/HTTP-status mapping | `@gustri/api-client/errors` (`handleSupabaseError`, `httpStatusToAppError`) | Provider-specific code stays at the boundary, not in core |
| TanStack Query hook/mutation used by **more than one app** | `@gustri/queries` | Shared cache keys & invalidation rules |
| TanStack Query hook used by **only one app** | App-local `src/hooks/` (see "Hooks" rule below — `-safe` only when justified) | YAGNI — promote to `@gustri/queries` once a second consumer appears |
| `QUERY_KEYS` constant / new query-key entry | `@gustri/queries/keys.ts` | Shared cache namespace |
| Reusable React component (used by 2+ apps **or** clearly generic) | `@gustri/ui` | One source of truth for shared visuals |
| Tailwind class helpers (e.g., `getRoleBadgeColor`) | `@gustri/ui/badges.ts` (or alongside the consuming component) | Tailwind strings are styling — not headless |
| App-specific component (feature/screen-specific) | `apps/<app>/src/components/<feature>/` | Locality beats premature sharing |
| User-facing string | i18n key in `@gustri/i18n` locales | Never hardcode visible text — CI gate enforces it |
| Server-side transaction or third-party call | `apps/staff-web` route under `/api/v1/*`; helper in `apps/staff-web/src/lib/services/` | See Data Access exception 2 |
| Shared business constant (tax rounding, color palette as hex) | `@gustri/core/constants.ts` or `@gustri/core/colors.ts` | Headless |

**Promotion rule:** start app-local. Promote to a shared package the moment a **second** consumer needs it — not on speculation.

## Feature Workflow Checklist

When adding a feature, work through this in order:

1. **Schema first.** If new tables/columns are needed, write the migration (see `Database` section), regenerate types (`./scripts/generate-types.sh`), then update Zod schemas in `@gustri/database`.
2. **Wrapper.** Extend `@gustri/api-client` if a new query shape is needed.
3. **Hook.** Add a TanStack Query hook — `@gustri/queries` if it'll be reused, app-local otherwise.
4. **UI.** Build components per the placement table above.
5. **i18n.** Add keys to all required locales (see i18n rule below).
6. **Tests.** Unit tests for `core`/`database` logic, integration tests for the wrapper, component tests for non-trivial UI.
7. **Mobile parity.** Decide explicitly — see Mobile Parity rule below.
8. **Feature flag?** If risky or staged rollout, gate behind `feature_flags` table + `useFeatureFlag` hook.

## Code Conventions

### Imports
- All apps use `@/*` path alias mapping to `./src/*`
- Cross-package imports use workspace names: `@gustri/core`, `@gustri/database`, `@gustri/api-client`

### Data Access
- All database operations go through `@gustri/api-client` wrapper (never raw supabase queries in app code)
- Create wrapper: `const db = createSupabaseWrapper(supabaseClient)`
- Usage: `db.orders.findAll()`, `db.tables.findById(id)`, `db.waiterCalls.create({...})`
- Exception 1 — **Realtime**: Supabase Realtime channels use the raw `supabase` client directly (not wrappable)
- Exception 2 — **Server-side business logic**: Endpoints under `/api/v1/*` (orders create, payments,
  discounts, refunds, stock adjustments, settings updates) execute server-side transactions or
  external-service calls and cannot be expressed as a single Supabase query. Mobile uses
  `apiRoutes` from `apps/mobile/src/lib/api-routes.ts`. The `apiFetch` helper there maps HTTP
  responses to typed `@gustri/core` errors via `httpStatusToAppError`, so error semantics match
  the wrapper.

### Runtime Validation
- Mutation inputs validate at the call boundary (UI → hook) using Zod schemas from
  `@gustri/database/schemas/inputs`. Use `validateOrThrow(schema, data, label)` from
  `@gustri/core` — it throws `ValidationError` with `details.fieldErrors` for per-field UI feedback.
- Validate what the user can corrupt (forms, free text). Don't double-validate fields TypeScript
  already constrains (system columns, enum types).

### Types
- All database types are defined in `@gustri/database` and re-exported from `@gustri/api-client`
- Never create local `database.ts` type files in apps — import from the package
- Zod schemas for runtime validation live in `packages/database/src/schemas/`

### Hooks
- Hooks use TanStack React Query for data fetching. Query keys come from
  `QUERY_KEYS` in `@gustri/queries` — never inline string literals.
- **Shared hooks live in `@gustri/queries`.** Apps import `useOrders`,
  `useCreateOrder`, etc. directly from there.
- **App-local `-safe` wrapper rule (staff-web).** A `-safe` hook in
  `apps/staff-web/src/hooks/` exists ONLY when the app needs one of these
  beyond what the shared hook provides:
  1. **Server-side mutation via `apiRoutes`** that the shared hook can't
     express (e.g. `useCreateOrder` calls `/api/v1/orders` rather than
     `db.orders.create` because it's a multi-table transaction).
  2. **App-specific UI state** layered on top of the shared hook
     (e.g. `usePendingApprovalCount` derives a count from `useOrders` —
     never reimplements the fetch).
  3. **Plan-gated behavior** that consults `useTenantPlan` / `PLAN_LIMITS`
     before mutating (e.g. `useCreateTable` checks the table cap).
- **Default to the shared hook.** If none of the three rules apply, do not
  create a `-safe` wrapper — import from `@gustri/queries` directly.
  Wrappers that just re-export are deleted.
- **Mobile** does not use the `-safe` suffix. Mobile-local hooks in
  `apps/mobile/src/hooks/` follow the same three rules but keep the plain
  name (e.g., `use-create-order.ts`) since there is no shared-hook
  collision.
- **Promotion to `@gustri/queries`.** When a *second* app needs the same
  hook with the same shape, move it to `@gustri/queries` and accept
  per-app overrides via callbacks/options rather than forking.

### Components
- Organized by feature: `components/orders/`, `components/modals/`, `components/auth/`
- UI primitives in `components/ui/` (shadcn/ui style)
- Styling: Tailwind CSS classes, `cn()` utility for conditional classes

### Error Handling
- Provider-agnostic error classes live in `@gustri/core`: `AppError`,
  `ValidationError`, `NotFoundError`, `ConflictError`, `AuthenticationError`,
  `AuthorizationError`, `NetworkError`.
- Provider-specific mapping lives in `@gustri/api-client`:
  - `handleSupabaseError(err)` — translates Supabase/PostgREST/PostgreSQL
    error codes (`PGRST116`, `23505`, `42501`, …) to `AppError` subclasses.
    Used inside every wrapper and once in customer-web's `setTableContext`.
  - `httpStatusToAppError(status, body)` — translates HTTP responses from
    `/api/v1/*` routes (mobile's `apiFetch`, web's fetch helpers).
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

## Mobile Parity Rule

When adding a feature to `staff-web`, decide mobile parity explicitly. Default: **shift-time operations get mobile, admin/org tasks do not.**

| Feature category | Mobile? | Examples |
|---|---|---|
| Shift-time operations | **Yes — ship in same PR or follow-up before release** | Orders, tables, kitchen view, waiter calls, stock counts, waste logging, payments at the table |
| Reporting & analytics | Read-only views OK; bulk export web-only | Daily summary card on mobile; PDF export web-only |
| Admin/org tasks | **No** — see "Intentional mobile-only omissions" | Staff CRUD, billing, plan upgrades, bulk menu import, audit log |
| Settings | Per-shift settings yes; org settings no | Sound toggle yes; tax rate / branding no |

If unsure, leave a TODO + GitHub issue link rather than half-shipping.

## Server-side endpoints (`/api/v1/*`)

Use a route only when the operation **cannot** be expressed as a single Supabase query:

- Multi-table transactions (orders create → items + payments + audit)
- External-service calls (Stripe, push notifications, file generation)
- Operations that need elevated privileges beyond RLS (refunds, discount overrides, financial audit writes)
- Validation that depends on server-only state (rate limits, idempotency keys)

Otherwise, extend `@gustri/api-client`. Don't create routes "for symmetry."

Routes return typed errors via `httpStatusToAppError` so wrapper and route call sites have the same error semantics. Mobile calls routes through `apiRoutes` in `apps/mobile/src/lib/api-routes.ts`.

## Feature Flag Rule

Risky, staged, or tenant-scoped features ship behind `feature_flags`:

- Anything that touches money flow (new payment method, discount type, refund path)
- New realtime subscriptions (load risk)
- Schema-level changes consumed by clients before all clients are upgraded
- Anything you'd want to kill without a deploy

Read flags via the `useFeatureFlag(name)` hook. Default behavior when the flag is absent must be the **safe/old** path. Remove the flag once the feature is stable for ≥2 weeks — stale flags rot.

## Migration Rule

- File name: `YYYYMMDDNNNNNN_short_snake_case.sql` (e.g. `20260427000001_app_versions.sql`).
- **Never edit a migration that has been merged to `main`.** Add a new migration that alters/fixes.
- All new tables must declare RLS policies in the same migration. RLS-disabled tables fail review.
- Destructive changes (`DROP COLUMN`, type narrowing) need a paired rollback file under `supabase/migrations/_rollbacks/`.
- After any schema change: run `pnpm db:types:generate` (writes `packages/database/src/types/generated.ts`) and commit the regenerated file in the same PR. CI runs `pnpm db:types:check` to detect drift.
- Index changes: prefer `CREATE INDEX CONCURRENTLY` for tables with significant row counts.
- Keep migrations idempotent where reasonable (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING` for seed data).

## i18n Rule

- **Every user-visible string** goes through `@gustri/i18n` keys. No hardcoded text in JSX, alerts, toasts, or error messages.
- Locale coverage at PR time:
  - **Required**: `en`, `az` (primary launch markets) — PR is blocked without these.
  - **Required for staff UI**: `en`, `az`, `ru`, `tr`.
  - **Customer-web**: aim for full 20-locale coverage; missing locales fall back to `en`.
- Use `useTranslation()` in components, `t()` in hooks/utilities. Never import locale JSON directly.
- Numbers/dates/currencies go through formatters in `@gustri/i18n/formatters.ts`, not raw `toLocaleString`.
- New keys: place under the most specific namespace; avoid generic top-level keys.

## Database

- Migrations in `supabase/migrations/` (sequential numbering — see Migration Rule)
- RLS policies enabled on all tables
- Default admin: `admin@test.com` / `test1234`
- Key tables: orders, tables, menu_items, categories, staff, waiter_calls, customer_feedback, order_payments, table_transfers, staff_schedules, cafe_settings, stock_items, stock_movements, expense_categories, expenses, waste_logs, tasks, task_categories, financial_audit_log, feature_flags, app_versions, delivery_access_tokens

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

## React Version Policy

- Web apps (staff-web, customer-web): React 18.x
- Mobile app: React 19.x (required by React Native 0.81+)
- Shared packages: Must support both via peer deps (`^18.2.0 || ^19.0.0`)
- Do NOT add React 19-only APIs (`use()`, `useFormStatus`, `useOptimistic`) to shared packages
- Web apps will upgrade to React 19 when Next.js 15 migration is done

### Headless package boundary
`@gustri/core` and `@gustri/database` MUST NOT import `react`, `react-dom`, or
`react-native`. They run in Node (server endpoints, scripts) as well as RN/web,
and a stray React import locks them to a single runtime. Hooks belong in
`@gustri/queries`. Components in `@gustri/ui`. Biome enforces this via a
`noRestrictedImports` override in `biome.json` — `pnpm check` fails on
violation. CI also verifies that `@gustri/queries`, `@gustri/i18n`, and
`@gustri/ui` keep React 19 in their peer range.

## Real-time

Supabase Realtime is used for live updates on orders, tables, and waiter calls. Sound notifications play via `.mp3` files in `public/`.

## Intentional mobile-only omissions

These admin-tier features are intentionally web-only and will not be added to mobile:

- Staff CRUD (hire, edit, deactivate)
- Tenant/cafe creation and billing
- Plan upgrades / Stripe portal
- Bulk menu import / category reorganization
- Audit log viewing

Rationale: keep mobile focused on shift-time operations (orders, tables, kitchen, calls).
Mobile users authenticate but don't perform org-management tasks. The mobile staff list
surfaces a banner pointing org-management work to the web app.
