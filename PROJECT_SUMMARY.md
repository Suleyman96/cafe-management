# Gustri — Project Summary

> **Canonical source:** `CLAUDE.md` and `README.md`.

Gustri is a restaurant management system: QR-code customer ordering, staff
operations, kitchen display, and back-office management, with real-time sync
over Supabase. Multi-tenant and plan-gated (`free` / `pro` / `business`).

## Apps

- **customer-web** (Next.js) — QR ordering, menu browsing, cart, order tracking,
  call-waiter; 20-language support.
- **staff-web** (Next.js) — orders, tables, kitchen, waiter calls, payments,
  refunds/discounts, stock, expenses, schedules, tasks, reports, **and all
  admin/org management** (staff CRUD, billing, settings, menu).
- **marketing** (Next.js) — marketing site + blog.
- **mobile** (React Native / Expo) — shift-time staff operations (orders,
  tables, kitchen, calls). Admin/org tasks are intentionally web-only (see
  `CLAUDE.md` → "Intentional mobile-only omissions").

## Stack

| Layer | Tech |
|---|---|
| Build | Turborepo, tsup, Next.js 14 |
| Language | TypeScript 5.6 (strict) |
| Lint / format | Biome 2.4 |
| Backend | Supabase (PostgreSQL 15 + RLS, Auth, Realtime, Storage) |
| Data / state | TanStack Query 5 (`@gustri/queries`) + Zustand |
| Styling | Tailwind CSS 3.4 |
| i18n | i18next, 20 locales |
| Testing | Vitest, Playwright, dedicated RLS suite |
| Mobile | Expo 54, React Native 0.81, React 19 |

## Key domain tables

orders, order_items, tables, menu_items, categories, staff, waiter_calls,
order_payments, refunds, table_transfers, customer_feedback, stock_items,
stock_movements, expenses, waste_logs, tasks, cafe_settings, feature_flags,
financial_audit_log. Full list + enums: `CLAUDE.md` → "Database".

## Status

Production-grade: RLS on every table, server-side authorization on `/api/v1/*`,
idempotency keys + atomic financial RPCs, type-to-confirm on high-stakes
actions, 20-locale coverage. Open/pending work is tracked in `docs/BACKLOG.md`.
