# Plan-gate inventory (C5)

This file lists every UI-visible plan gate (mobile + staff-web) and the
authoritative **server-side** enforcement that backs it. Whenever a new
plan-gated feature ships, add a row here and pair the gate with a server
check — UI-only gating is never sufficient (see
[plans/mobile-audit-2026-04/01-CRITICAL.md](../../plans/mobile-audit-2026-04/01-CRITICAL.md)
C5).

Plan tier mapping is the source of truth in
[`packages/core/src/constants.ts`](../../packages/core/src/constants.ts)
(`PLAN_LIMITS`). The SQL helper `plan_allows_feature(feature)` mirrors that
table; if you change one, change the other.

## Client-side plan state

The client reads plan via `useTenantPlan()` from
[`@gustri/queries`](../../packages/queries/src/hooks/use-tenant.ts), which
returns `{ plan: PlanName | null, isLoading: boolean }`. Plan lives in a
TanStack Query keyed by tenant id, so:

- Plan upgrades / downgrades propagate on focus refetch — no re-login needed.
- The auth store stays purely about staff identity. There is no zustand
  `tenantPlan` field; bypassing the hook (e.g. reading staff and assuming
  free) is no longer possible.
- The loading state is surfaced explicitly. Consumers MUST treat
  `plan === null` as **unknown**, never as `'free'`:
  - **Sidebar / drawer nav**: hide plan-gated items while plan is null.
  - **Mutation pre-checks**: skip them entirely. The server is the
    authoritative gate (RLS + friendly-error triggers) — let it respond
    and localize the sentinel via `localizeErrorMessage`.

A previous version of the staff-web store coerced `null` to `'free'`,
which produced spurious "free plan allows up to 5 tables" errors at
paying business-tier tenants during the post-login load window. Do not
re-introduce that pattern.

| Feature | Plan tier required | UI gate (where) | Server route(s) | Server enforcement |
|---|---|---|---|---|
| **Inventory (stock items)** | `pro`, `business` | sidebar `/stock`; mobile drawer | `POST /api/v1/stock/[id]/adjust` | `verifyPlan(['pro', 'business'])` middleware |
| Inventory (direct writes) | `pro`, `business` | wrapper `db.stockItems.*`, `db.stockMovements.*` | n/a (direct supabase) | RLS RESTRICTIVE policies `plan_inventory_*` on `stock_items`, `stock_movements` calling `plan_allows_feature('inventory')` |
| **Waste tracking** | `pro`, `business` | sidebar `/waste`; mobile drawer | n/a (direct supabase) | RLS RESTRICTIVE policies `plan_waste_*` on `waste_logs` calling `plan_allows_feature('waste')` |
| **Staff scheduling** | `pro`, `business` | sidebar `/schedules` | n/a (direct supabase) | RLS RESTRICTIVE policies `plan_schedules_*` on `staff_schedules` calling `plan_allows_feature('scheduling')` |
| **Tasks** | `pro`, `business` | sidebar `/tasks`; mobile drawer | n/a (direct supabase) | RLS RESTRICTIVE policies `plan_tasks_*` on `tasks` calling `plan_allows_feature('tasks')` |
| **QR ordering** | `standard`, `pro`, `business` | customer-web entry | `POST /api/v1/customer/orders` | `customer-order-service.ts` rejects with `plan_required` when `PLAN_LIMITS[plan].qrOrdering === false`. RLS does not need a separate gate because customer orders only land through this route. |
| **Custom branding** | `standard`, `pro`, `business` | settings UI | `PUT /api/v1/settings` (theme fields) | Settings route checks `requirePlanAtLeast('standard')` only when `brand_primary_color` or `brand_logo_url` is in the body, so non-branding settings stay open to free admins. |
| **Monthly order cap** | per-tier `maxOrdersPerMonth` | mobile `useCreateOrder` soft check | `POST /api/v1/orders` | `apps/staff-web/src/lib/services/order-service.ts` runs the per-month count under `verifyStaff` |
| **Table cap** | per-tier `maxTables` | none (server-only) | n/a (direct supabase) | BEFORE INSERT trigger `enforce_table_cap_trigger` calls `plan_allows_new_table(tenant_id)` and raises the `plan_required` sentinel (P0001) for friendly localized errors. RLS RESTRICTIVE policy `plan_tables_insert` (same helper) stays as defense-in-depth — fires only if the trigger is bypassed. Counts active tables vs `PLAN_LIMITS[*].maxTables`; downgraded tenants keep existing rows but can't add. The redundant baseline trigger `enforce_table_limit` (which counted all rows, not just active, and raised an English error) was dropped in the same migration. |

## Conventions

- `verifyPlan(allowed)` (in [`src/lib/api/verify-plan.ts`](src/lib/api/verify-plan.ts))
  is the standard middleware for `/api/v1/*` routes. It resolves the tenant
  from the JWT (never the request body), looks up `tenants.plan`, caches
  for 30s, and rejects with HTTP 403 + `error: "plan_required"`.
- For tables that are written via the user's session client (no `/api/v1`
  hop), use a RESTRICTIVE RLS policy that calls `plan_allows_feature(...)`.
  RESTRICTIVE policies are AND-ed with the existing PERMISSIVE policies, so
  the staff-role and tenant-isolation checks remain in force.
- SELECT/DELETE intentionally aren't plan-gated for these features — a
  tenant downgrading from `pro` to `free` should still see and clean up
  their pro-tier data. Only INSERT/UPDATE produce new chargeable state.

## When you add a new plan-gated feature

1. Add it to `PLAN_LIMITS` in `packages/core/src/constants.ts`.
2. Add a `WHEN '<feature>' THEN ...` branch to `plan_allows_feature` in a
   new migration. Default-deny is automatic for unknown names.
3. If the feature has a `/api/v1` route, call `verifyPlan(['pro', ...])`
   at the top of the handler.
4. If the feature is written via the wrapper, add a RESTRICTIVE RLS policy
   on the target table.
5. Add a row to this table.
6. Add a Vitest test under `src/__tests__/plan-gates/` (or expand
   `verify-plan.test.ts`).
