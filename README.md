# Gustri — Restaurant Management Platform

A multi-tenant restaurant management SaaS: staff dashboard, QR-code customer ordering, delivery links,
a React Native staff app, and a marketing site — all on one TypeScript monorepo backed by Supabase
(PostgreSQL + Auth + Realtime).

Co-developed by **Suleyman Hajilov** and **Kamil Hajilov** (January – October 2026).

## 概要（日本語）

Gustri は飲食店向けのマルチテナント型 SaaS です。スタッフ用ダッシュボード、テーブルの QR コードからの
セルフオーダー、デリバリー注文リンク、スタッフ用モバイルアプリ（React Native / Expo）、マーケティング
サイトを、Supabase（PostgreSQL・認証・リアルタイム通信）を基盤とした TypeScript のモノレポで構成しています。

- **主な機能:** リアルタイム注文管理、テーブル・キッチン表示、分割会計・チップ・割引・返金、在庫・経費・
  廃棄管理、シフト・タスク管理、売上・利益レポート
- **技術:** Next.js 14 / React 18、React Native 0.81 / Expo 54、TypeScript（strict）、Supabase、
  TanStack Query、Turborepo、Vitest / Playwright
- **品質:** 全テーブルに行レベルセキュリティ（RLS）、約 300 のテストファイル、GitHub Actions による CI/CD
- **多言語対応:** 日本語を含む 20 言語
- **担当:** Suleyman はプロジェクトを立ち上げ、初期アーキテクチャ、主要機能の大半、RLS 設計、CI/CD、
  モバイルアプリの初期版、テスト基盤を担当しました（詳細は下記「My role」）。

---

## Highlights

- **4 apps, 8 shared packages** in a Turborepo monorepo — web and mobile share business logic,
  data access, query hooks, and translations.
- **Multi-tenant by design** — tenant isolation enforced in PostgreSQL with row-level security on
  every table, verified by a dedicated RLS test suite (16 test files run against a real database).
- **Real-time operations** — orders, tables, and waiter calls update live across staff devices via
  Supabase Realtime, with sound and push notifications.
- **Money paths treated carefully** — split payments (by amount or by item), tips, discounts, and
  refunds go through server-side transactions with an append-only financial audit log.
- **20 languages**, including Japanese, with a CI gate that blocks hardcoded user-facing strings.
- **Tested** — ~290 unit/integration test files (Vitest) plus Playwright E2E suites.
- **114 SQL migrations**, typed end-to-end: database types are generated from the live schema and
  CI fails if they drift.

## My role (Suleyman)

I started the project and built the first version end to end (January – April 2026):

- **Foundation** — initial architecture, Supabase schema, authentication and staff roles.
- **Core features** — order lifecycle (including cancellation with a required reason), order notes,
  tips, cafe settings, real-time notifications, stock and expense tracking, profit reporting, staff
  schedules, delivery ordering, waste logging, task management, and pricing plans.
- **Payments** — discounts and refunds on top of split payments.
- **Security** — RLS enabled and hardened on all tables for production (fixing recursive staff
  policies, security-invoker views, function `search_path` hardening).
- **Mobile** — first version of the React Native / Expo staff app.
- **Engineering quality** — test infrastructure, Biome lint/format setup, GitHub Actions CI/CD with
  Vercel deployments, and the refactor into shared packages (`core`, `database`, `api-client`,
  `queries`).
- **i18n** — multi-language support and keeping all locales in sync with the English source.

Kamil led the later phase (April – October 2026): turning the product into a self-serve SaaS
(plans, billing, onboarding), security and anti-abuse hardening, push notifications, and
operational work such as encrypted backups and data retention.

## Screenshots

<!-- Add screenshots here, e.g. docs/screenshots/staff-orders.png -->

| Staff dashboard | Customer QR ordering | Mobile app |
|---|---|---|
| _coming soon_ | _coming soon_ | _coming soon_ |

---

## Architecture

```
apps/
  staff-web/        Next.js 14 staff dashboard            (http://localhost:3009)
  customer-web/     Next.js 14 customer ordering UI       (http://localhost:3007)
  marketing/        Next.js 14 marketing site + blog      (http://localhost:3002)
  mobile/           React Native 0.81 / Expo 54 staff app

packages/
  database/         Generated DB types, Zod input schemas, enums (headless)
  core/             Business logic, validators, type guards, errors (headless)
  api-client/       Type-safe Supabase wrapper used by every app
  queries/          Shared TanStack Query hooks and mutations (web + mobile)
  i18n/             i18next setup and locale bundles (20 languages)
  ui-web/           Shared web components
  ui-mobile/        Shared mobile components
  design-tokens/    Colors, spacing, typography

supabase/           Migrations, seed data, config
scripts/            Admin user setup, type generation, i18n sync
```

Key design decisions:

- **Headless core.** `@gustri/core` and `@gustri/database` never import React, so the same business
  logic runs in Next.js server routes, scripts, the browser, and React Native. Biome enforces the
  boundary.
- **One data-access layer.** Apps never write raw Supabase queries; everything goes through
  `@gustri/api-client`, which also maps database errors to typed application errors.
- **Server routes only where needed.** Multi-table transactions and privileged operations
  (order creation, payments, refunds, discounts) run under `/api/v1/*`; everything else is a direct
  RLS-protected query.

## Tech Stack

| Area | Tools |
|---|---|
| Web | Next.js 14 (App Router), React 18, Tailwind CSS 3.4 |
| Mobile | React Native 0.81, Expo 54, React 19 |
| Language | TypeScript 5.6+ (strict) |
| Data | Supabase — PostgreSQL 15, Auth, Realtime, Storage, RLS |
| State | TanStack Query 5, Zustand |
| Build | Turborepo 2.8, tsup, pnpm 10 |
| Quality | Biome 2.4, Vitest 4, Playwright 1.58 |
| Infra | GitHub Actions, Vercel, Sentry |

## Features

**Staff dashboard** — real-time orders, table map with QR codes, kitchen display, delivery
management, menu and categories (multi-language), split payments / tips / discounts / refunds,
waiter calls, customer feedback, stock with movement history and low-stock alerts, expenses, waste
tracking, tasks, staff schedules, cafe settings, sales and profit reports with PDF export.

**Customer interface** — scan a table QR code to browse the menu and order, or order delivery
through a shareable link; live order tracking, call-waiter button, feedback, 20 languages.

**Mobile app** — shift-time work on the floor: orders, tables, kitchen queue, waiter calls, stock,
expenses, waste, tasks, push notifications, and a forced-update flow.

**Order flow**

```
Customer order:  pending_approval → new → preparing → ready → served → closed
Staff order:     new → preparing → ready → served → closed
Delivery order:  new → preparing → ready → out_for_delivery → delivered → closed
```

---

## Running Locally

**Prerequisites:** Node.js 22, Docker Desktop (for local Supabase). pnpm is provided via Corepack.

```bash
# 1. Install dependencies
corepack enable
pnpm install

# 2. Start the local Supabase stack (applies all migrations + seed data)
npx supabase start

# 3. Create the test staff accounts
pnpm db:seed-user

# 4. Configure the apps
cp apps/staff-web/.env.example apps/staff-web/.env.local
cp apps/customer-web/.env.example apps/customer-web/.env.local
#    Set NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 and the anon / service-role
#    keys printed by `npx supabase start`.

# 5. Run the web apps
pnpm dev
```

Test accounts (password `test1234`): `admin@test.com`, `owner@test.com` (tenant 1),
`admin2@test.com` (tenant 2 — for checking tenant isolation).

| Service | URL |
|---|---|
| Staff dashboard | http://localhost:3009 |
| Customer ordering | http://localhost:3007 |
| Marketing site | http://localhost:3002 |
| Supabase Studio | http://localhost:54323 |

### Useful commands

```bash
pnpm test           # unit + integration tests
pnpm test:rls       # RLS policy tests (needs local Supabase)
pnpm test:e2e       # Playwright E2E (needs running dev servers)
pnpm check          # Biome lint + format
pnpm type-check     # TypeScript
pnpm build          # build all packages and apps
pnpm db:reset       # reset local DB and recreate test accounts
```

---

## License

Copyright © 2026 Suleyman Hajilov and Kamil Hajilov. All rights reserved.
This repository is shared privately for evaluation purposes only.
