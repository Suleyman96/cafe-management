# Architecture Overview — Gustri

> **Canonical source:** `CLAUDE.md` (monorepo rules, code placement, conventions)
> and `README.md`. This file is a high-level orientation only — when they
> disagree, trust `CLAUDE.md`.

Gustri is a restaurant management system built as a **Turborepo monorepo** on
**Supabase** (PostgreSQL + Auth + Realtime + Storage). Multi-tenant and
plan-gated (`free` / `pro` / `business`).

## Apps (4)

| App | Stack | Port | Purpose |
|---|---|---|---|
| `staff-web` | Next.js 14 | 3001 | Staff dashboard — orders, tables, kitchen, payments, reports, admin/org |
| `customer-web` | Next.js 14 | 3000 | QR-code customer ordering |
| `marketing` | Next.js 14 | 3002 | Marketing site + blog |
| `mobile` | React Native 0.81 / Expo 54 | — | Staff app for shift-time operations |

## Shared packages (9, headless → UI)

- `@gustri/core` — business logic, validators, type guards, errors (no React, no Supabase)
- `@gustri/database` — DB types, Zod input schemas, enums
- `@gustri/api-client` — typed Supabase wrapper (`SupabaseWrapper`)
- `@gustri/queries` — shared TanStack Query hooks/mutations (web + mobile)
- `@gustri/i18n` — i18next setup + 20 locale bundles
- `@gustri/ui`, `@gustri/ui-web`, `@gustri/ui-mobile` — shared components
- `@gustri/design-tokens` — shared design tokens

See `CLAUDE.md` → "Where Does New Code Go?" for the placement decision tree.

## Data flow

- **Reads/writes** go through `@gustri/api-client` wrappers — never raw Supabase
  queries in app code. Multi-table transactions and privileged operations go
  through `staff-web` `/api/v1/*` routes (mobile calls them via `apiRoutes`).
- **Realtime** uses Supabase Realtime `postgres_changes` channels for live
  orders / tables / waiter-calls. The staff-web hook only invalidates React
  Query caches (never writes payloads) — see
  `docs/adr/0001-realtime-cache-version-strategy.md`.
- **Auth.** Staff authenticate via Supabase Auth; a custom access-token hook
  injects `staff_id`, `tenant_id`, `user_role` claims into the JWT. Customers
  use a per-table / QR token. RLS is enabled on every table; `/api/v1/*` routes
  enforce `verifyAdmin` / `verifyStaff` server-side as the authority.

## Multi-tenancy

Every domain table carries `tenant_id`. The wrapper applies tenant scope and RLS
enforces it; a JWT `tenant_id` is cross-checked against the DB
(`verifyTenantClaim`). Plan limits are enforced at the route layer and in RLS.

## Where to go next

- `CLAUDE.md` — conventions, placement, migration / i18n / feature-flag rules
- `README.md` — setup and commands · `QUICKSTART.md` — fast local start
- `docs/architecture.md`, `docs/database-schema.md`, `docs/api-contracts.md`
- `docs/history/` — historical design & migration notes
