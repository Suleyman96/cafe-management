# Customer-web E2E stabilization — agent prompt

You are a senior full-stack engineer working on Gustri (Turborepo
monorepo: `apps/{staff-web,customer-web,marketing,mobile}` and
`packages/{database,core,api-client,queries,i18n,ui}`). Read
`/Users/kamilhajilov/Documents/github/cafe-idare/CLAUDE.md` first — the
data-access boundary, hook placement, migration rules, and i18n
requirements apply.

## What you're fixing

The `E2E Tests` job in `.github/workflows/ci.yml` is **red on `main`**
because of two independent customer-web problems. Staff-web E2E
passes (17/17 with retries). The Tier 3 hardening batch landed five
PRs into a red `main` because the failures pre-existed and weren't
introduced by that work — see the bottom of this file for the closed
PR (#75) the team had already attempted.

Your job: get the customer-web E2E suite passing in CI, end to end.

## Problem 1 — `order-flow.spec.ts` cold-start timeout

**Symptom.** On CI, `cd apps/customer-web && npx playwright test`
fails with patterns like `×±····××F××F·××F××F··` —
multiple `page.goto: Test timeout of 30000ms exceeded`. Local repro
also flakes the first test (35s on cold start) but passes on retry.

**Root cause.** [`apps/customer-web/playwright.config.ts`](apps/customer-web/playwright.config.ts)
uses `command: 'pnpm dev'`. Next.js dev mode JIT-compiles each route
on first request. On GitHub-hosted runners, `/table/T01/menu`'s first
compile + render exceeds the 30s `page.goto` timeout, and because
the suite runs serially with `workers: 1`, subsequent tests inherit
a still-warming server and cascade.

**Existing attempt.** Closed PR #75 had the right idea
(`83e14da fix(customer-web): switch e2e webServer to prod build in CI`)
but was abandoned because Problem 2 below kept it red. The branch
still exists locally — `fix/customer-web-e2e-menu-locators`.

**What you should do.** Cherry-pick or re-apply the customer-web
playwright config from that branch:

```ts
// apps/customer-web/playwright.config.ts
import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  webServer: {
    // CI runs against a production build — Next.js dev mode JIT-compiles
    // each route on first request which on the GitHub runner exceeds 30s
    // and times out `page.goto`. Production builds serve pre-compiled
    // routes in <100ms. Local dev keeps `pnpm dev` for HMR ergonomics.
    command: isCI ? 'pnpm build && pnpm start' : 'pnpm dev',
    port: 3000,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
```

**Do not** also apply prod-build to staff-web —
`f9d5fcb fix(staff-web e2e): revert to dev-mode webServer — prod build
exceeds 180s on CI` proved staff-web's build is too slow on CI.
Staff-web's current dev config is fine (17/17 passing with retries).

## Problem 2 — `waiter-call.spec.ts:38` test rot

**Symptom.** Even after Problem 1's fix is in (PR #75 had it), this
test still failed all retries:

```
F···········××F  (last F = post-retry)
expect(received).toBeGreaterThanOrEqual(expected)
  at apps/customer-web/e2e/waiter-call.spec.ts:38:45
```

**Root cause.** The test assumes clicking "call waiter" opens a modal
with **at least 2** reason buttons. Look at the current UI in
[apps/customer-web/src/app/table/[tableId]/layout.tsx:62-79](apps/customer-web/src/app/table/[tableId]/layout.tsx#L62-L79) — there is no
modal. The FAB at the bottom-left calls `useCreateWaiterCall.mutateAsync(...)`
directly with `callType: 'assistance'` and shows a toast. The test's
modal selector `[role="dialog"], .fixed` over-matches the FAB itself
(the FAB has `className="fixed ..."`), counts the single icon button
inside it, and asserts ≥2 → fails.

**What you should do.** Decide between:

1. **Rewrite the test against the actual flow.** Click the FAB, assert
   that the success toast (`t('callStaff.toastSuccess')` —
   `apps/customer-web/src/locales/en/customer.json`) appears. This is
   what the user actually experiences.
2. **Delete the test.** If a separate "call waiter with reason
   selection" modal exists elsewhere in the app, target *that* instead
   and remove this stale assertion. The feature might have been
   simplified deliberately.
3. **Skip with `test.skip` and a TODO.** Fastest path to green; only
   if you can't tell which of #1 or #2 is correct in 10 minutes.

Check first whether a reason-picking flow exists anywhere else in
customer-web before deleting — look for `CALL_TYPE` enum usage and
`useCreateWaiterCall` callers.

## How to verify

Local repro requires `supabase start` running (see `scripts/create-admin-user.sh`):

```bash
# From repo root, with supabase already up
./scripts/create-admin-user.sh
cat > apps/customer-web/.env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from supabase status>
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
EOF

# Simulate CI's build-then-start:
CI=true pnpm --filter=@gustri/customer-web exec playwright test --reporter=list
```

You should see `12 passed (X.Xm)` with no `F` symbols and no retries.

Push to a branch and watch the GitHub `E2E Tests` job — it should go
green for the first time since 2026-05-01.

## Acceptance

- [ ] `apps/customer-web/playwright.config.ts` uses prod-build webServer
  on CI (180s timeout) and `pnpm dev` locally.
- [ ] `apps/customer-web/e2e/waiter-call.spec.ts` either matches the
  current UI or is removed/skipped — no test that fails because of UI
  drift.
- [ ] CI's `E2E Tests` job goes green on your PR.
- [ ] Open the PR against `main`; reference this file in the
  description.

## What NOT to change

- ❌ **Don't touch staff-web's `playwright.config.ts`.** It's fine as
  dev-mode; prod build exceeds the 180s build timeout on CI runners.
- ❌ **Don't change `.github/workflows/ci.yml`.** The job's order and
  setup are correct (Supabase start, admin user creation, env file
  generation, Playwright install). The only thing wrong is the
  webServer config in customer-web.
- ❌ **Don't expand E2E coverage.** Add no new specs. The goal is to
  unstick the existing suite, not extend it.
- ❌ **Don't tighten anon RLS on menu/category reads** — it would
  require a JWT-claim or signed-cookie tenant-id mechanism (see PR
  #76 description) and is well outside this task. Anon menu reads
  staying `USING (true)` with the wrapper's `.eq('tenant_id', X)` as
  the gate is the agreed model.
- ❌ **Don't bump Supabase CLI or regenerate types.** PR #73 pinned
  `2.78.1`; bumps are deliberate and out of scope here.

## Reporting back

For your PR, tell me:
- One-line summary of what changed in each file.
- Local Playwright result (paste the final `N passed (Xs)` line).
- CI result on the PR (link to the green E2E Tests job).
- Whether you rewrote, removed, or skipped `waiter-call.spec.ts`, and
  why.
- Any follow-up flake you observed but couldn't reproduce.

## Reference: closed PR and related work

- **#75 (closed):** `fix/customer-web-e2e-menu-locators` —
  prod-build mitigation that didn't fully land. Branch still has the
  config you need to copy.
- **f25a30f, f9d5fcb:** the round-trip on staff-web prod-build. Read
  these commit messages to understand the timeout constraint.
- **#76 (merged):** `fix(customer-web): bind wrapper tenant context in
  table layout` — explains why anon menu reads work the way they do.
- **PR #80 (merged 2026-05-02):** added a new migration
  `20260502000002_drop_svg_from_branding_uploads.sql`. If you start
  fresh from `pnpm db:reset`, that migration applies cleanly — but
  worth knowing in case you see it in `supabase db diff` output.
