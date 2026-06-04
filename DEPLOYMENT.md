# Deployment — Gustri

> **Canonical source:** `CLAUDE.md`, `README.md`, and `.github/workflows/`. The
> workflows are the source of truth for what actually runs; this is the topology
> overview.

## Topology

- **Supabase** — PostgreSQL + Auth + Realtime + Storage (one project per env).
- **Vercel** — hosts the three Next.js apps (`staff-web`, `customer-web`,
  `marketing`), each as its own Vercel project.
- **Expo EAS** — builds and distributes the `mobile` app.

## CI/CD

`.github/workflows/ci.yml` runs on every PR: Lint & Format, Test, Build & Type
Check, DB Types Drift, Mobile, E2E. On merge to `main`, Supabase migrations are
pushed before the app deploys; Vercel auto-deploys each app.

## Supabase setup (per environment)

```bash
supabase link --project-ref <ref>
supabase db push          # apply migrations
```

1. Note the project URL, anon key, and service-role key.
2. **Auth** — disable public email signup (only admins create staff accounts).
3. **Storage buckets** — `menu-images`, `branding`, `qr-codes` (created by
   migrations / first run).

Create the local admin with `pnpm db:reset` (dev) — do not hand-write
`auth.users` SQL.

## Required environment variables

| Var | Scope |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | all web apps (browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only — staff-web `/api/v1/*` |
| `NEXT_PUBLIC_API_BASE_URL` | customer-web → staff-web `/api/v1/customer/*` |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | error reporting |

Never expose the service-role key to the browser. See `CLAUDE.md` →
"Data Access" / "Error Handling" for the boundaries.

## Mobile (Expo EAS)

```bash
pnpm --filter @gustri/mobile exec eas build --platform all
```

Configure secrets in the EAS project. The mobile app talks to staff-web
`/api/v1/*` through `apiRoutes`.

## Migrations

Follow `CLAUDE.md` → "Migration Rule". After any schema change run
`pnpm db:types:generate` and commit the regenerated types in the same PR — CI
gates on `pnpm db:types:check`.
