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
| **Table cap** | per-tier `maxTables` | `useCreateTable` (web) soft check | n/a (direct supabase) | RLS RESTRICTIVE policy `plan_tables_insert` calling `plan_allows_new_table(tenant_id)`. Counts active tables vs `PLAN_LIMITS[*].maxTables`; downgraded tenants keep existing rows but can't add. |

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
