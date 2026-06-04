# Quick Start — Gustri

> **Canonical source:** `CLAUDE.md` and `README.md`. This is the short path to a
> running local environment.

## Prerequisites

- Node.js 18+ and pnpm 9.15 (`corepack enable`)
- Docker (for local Supabase)
- Supabase CLI

## 1. Install

```bash
pnpm install
```

## 2. Start Supabase + seed the admin user

```bash
pnpm db:reset   # applies migrations and creates the default admin
```

Default admin: `admin@test.com` / `test1234`. Supabase Studio: `pnpm db:studio`
(http://localhost:54323).

## 3. Run the apps

```bash
pnpm dev        # runs all apps via Turborepo
```

| App | URL |
|---|---|
| customer-web | http://localhost:3000 |
| staff-web | http://localhost:3001 |
| marketing | http://localhost:3002 |
| mobile | Expo — `pnpm --filter @gustri/mobile start` |

## Common commands

| Command | What |
|---|---|
| `pnpm check` | Biome lint + format |
| `pnpm type-check` | TypeScript |
| `pnpm test` | Vitest unit/integration |
| `pnpm test:e2e` | Playwright (requires a running dev server) |
| `pnpm build` | Build everything |
| `pnpm db:types:generate` | Regenerate DB types after a migration |

See `CLAUDE.md` → "Commands" for the full list.

## Troubleshooting

- **Port already in use** — stop the other dev server or change the app's port.
- **Schema / RLS errors** — re-run `pnpm db:reset`.
- **Type drift in CI** — run `pnpm db:types:generate` and commit the result.

For production deployment, see `DEPLOYMENT.md`.
