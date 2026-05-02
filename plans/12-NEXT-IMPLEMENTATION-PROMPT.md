# Next Implementation Prompt — Tier 1 Pre-Launch Blockers

> Generated: 2026-05-01
> Context: Hand-off prompt for the next implementation agent.
> Scope: Tier 1 from `plans/REVIEW-2026-05-01.md` (the prioritized
> rollup synthesized from plans 01–11). These are the items that block
> a clean web + mobile production launch. Everything else is post-launch.

---

## How to use this file

Paste the **Prompt** section below into a fresh agent session. The agent
should NOT need any other context to start — the prompt is self-contained.
It includes the goal, what's already done, exact files to touch, the
acceptance criteria, and the verification commands.

If you want the agent to do these as separate PRs (recommended), tell it
to do **one task per PR** and wait for review before starting the next.
If you want a single large PR (faster but higher review cost), tell it to
batch.

---

## Prompt

You are a senior full-stack engineer joining the Gustri project (a
Turborepo monorepo: a restaurant management system with `apps/staff-web`,
`apps/customer-web`, `apps/marketing`, `apps/mobile`, and shared
`packages/{database,core,api-client,queries,i18n,ui}`). Read
`/Users/kamilhajilov/Documents/github/cafe-idare/CLAUDE.md` first — it
documents the conventions you must follow (where new code goes, the
data-access boundary, hook placement rules, i18n requirements, migration
rules).

You are picking up the **Tier 1 pre-launch blockers** from a recent
architecture audit. ~80% of the audit findings are already shipped; what
remains is the residue that directly blocks a production deploy. Each
task below is independent — do them as separate PRs unless I tell you
otherwise.

### Ground rules

- **One PR per task.** Each task in this file is sized to land
  independently. Don't bundle. Don't refactor adjacent code.
- **Don't add features.** If a task says "add an env block to eas.json,"
  do exactly that. Don't also "improve" the file structure.
- **Follow CLAUDE.md.** Especially the data-access boundary (`@gustri/api-client`
  wrapper; never raw Supabase in app code), i18n rule (every visible
  string through `t()`), and the migration rule (sequential file naming,
  RLS in same migration, regenerate types via `pnpm db:types:generate`
  and commit the result).
- **Verify before declaring done.** Each task lists explicit acceptance
  commands. Run them. Don't claim success unless they pass.
- **Match existing patterns.** Before writing new code, grep for similar
  code in the repo and copy its conventions.

---

### Task 1 — PII encryption probe (`instrumentation.ts`) for staff-web

**Why:** The PII encryption migration (`supabase/migrations/20260421000001_encrypt_customer_pii.sql`)
silently falls back to *plaintext* storage if `app.pii_encryption_key`
is unset on the database. This is the worst kind of regression — the app
appears to work fine while leaking unencrypted customer PII at rest.
Plan `09-DB-SECURITY-DEFERRED.md` "Operational follow-ups" calls this
out: production must boot-fail if the key is missing.

**File to create:** `apps/staff-web/src/instrumentation.ts`

**What it must do:** Next.js calls `register()` from this file once at
process start (server-side only). The function should:

1. Skip in dev (`process.env.NODE_ENV !== 'production'`) — local dev
   often runs without the key set and we don't want to break `pnpm dev`.
2. Skip when running tests (`process.env.VITEST` or `process.env.CI`
   guards as appropriate).
3. Call the existing `pii_encryption_status()` Postgres RPC (added in
   `20260428000001_single_tenant_security_hardening.sql`). If the RPC
   reports the key is missing or invalid, throw to abort boot.
4. Use the service-role Supabase client (the `getSupabaseAdmin()`
   helper at `apps/staff-web/src/lib/api/verify-admin.ts` or whichever
   factory exists — grep for it).
5. Log a one-line success message via Sentry breadcrumb on success
   (no `console.log`).

**Pattern check before writing:** If `apps/staff-web/src/instrumentation-client.ts`
or any other `instrumentation*.ts` file already exists, read it first.
Match its style.

**Acceptance:**
- `pnpm build --filter=@gustri/staff-web` succeeds.
- Manual: with the env var unset locally, `NODE_ENV=production pnpm start`
  in `apps/staff-web/` should refuse to boot with a clear error
  mentioning `app.pii_encryption_key`.
- With the key set (locally test by running `ALTER DATABASE postgres SET
  app.pii_encryption_key = 'test-key'` against your local Supabase),
  it boots cleanly.

---

### Task 2 — Mobile launch config hardening

This is three small edits in two files. Do them as a single PR titled
something like `chore(mobile): launch-config hardening`.

**Why:** The mobile app currently can't be submitted cleanly to the App
Store because `usesNonExemptEncryption` is unset (Apple will prompt
during submission), `eas.json` production builds use whatever Supabase
URL is in dev, and `google-service-account.json` (a Google service
credential) is referenced by `eas.json` line ~36 but is not gitignored —
if anyone places that file in the repo path it will silently commit a
secret.

**Edits:**

**A. `apps/mobile/app.json`** — add to the `ios` block:
```json
"ios": {
  "supportsTablet": true,
  "bundleIdentifier": "com.gustri.app",
  "config": {
    "usesNonExemptEncryption": false
  },
  ...existing fields...
}
```
Read the current file first; preserve all existing `ios` fields. The
flag tells Apple "we use HTTPS but not custom encryption," skipping the
export-compliance prompt.

**B. `apps/mobile/eas.json`** — add an `env` block under the `production`
profile. **DO NOT commit real production secrets.** Use clearly
placeholder values; the user will fill them in via EAS Secrets later.
Pattern (verify the existing structure first):
```json
"production": {
  "autoIncrement": true,
  "android": { "buildType": "app-bundle" },
  "env": {
    "EXPO_PUBLIC_SUPABASE_URL": "https://REPLACE-ME.supabase.co",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY": "REPLACE_ME",
    "EXPO_PUBLIC_API_BASE_URL": "https://app.gustri.com",
    "EXPO_PUBLIC_SENTRY_DSN": "REPLACE_ME"
  }
}
```
If `EXPO_PUBLIC_*` is not the prefix used elsewhere in mobile, grep
`apps/mobile/src/lib/supabase.ts` to find the actual env var names and
match them.

**C. `.gitignore`** (root) — add a line:
```
apps/mobile/google-service-account.json
```
Place it in a logical section (find where other secret files are
ignored, e.g. `.env.local`).

**Acceptance:**
- `git status` after running `touch apps/mobile/google-service-account.json`
  should NOT show the file as untracked.
- `pnpm --filter=@gustri/mobile type-check` still passes.
- Diff is purely additive; no existing fields are removed.

---

### Task 3 — Marketing site legal pages (privacy + terms)

**Why:** Required for App Store / Play Store submission and for EU/Turkey
compliance (KVKK). Plan 08 §2.1–2.2 specifies what each page must cover.

**Files to create:**
- `apps/marketing/src/app/privacy/page.tsx`
- `apps/marketing/src/app/terms/page.tsx`

**Pattern check before writing:** Read `apps/marketing/src/app/page.tsx`
and any existing `apps/marketing/src/app/*/page.tsx` first. Match their
component conventions, layout wrapper, and Tailwind class style.

**Privacy page must mention:**
- Data collected: staff accounts (email, name, phone), customer orders
  (name, phone, address — for delivery), payment records (method only,
  not card numbers).
- PII at-rest encryption (pgcrypto, per migration `20260421000001`).
- Retention: orders archived after 24 months, PII anonymized after 12
  months (note: actual retention automation is a Tier 4 backlog item;
  the policy doc commits to it).
- User rights under GDPR/KVKK: access, deletion, correction. The
  current procedure is "contact the cafe admin" — document that.
- Last-updated date.

**Terms page must mention:**
- Service description (B2B SaaS for restaurants).
- User responsibilities.
- Liability limitations.
- Last-updated date.

**i18n:** The marketing site is monolingual (English) for now per
existing pattern — confirm by reading the existing pages. If it uses
i18n, follow that pattern; if not, hardcode English text and skip the
CLAUDE.md i18n rule for these two pages only (legal copy is rarely
auto-translated).

**Acceptance:**
- `pnpm dev --filter=@gustri/marketing` serves both pages without
  errors.
- `pnpm build --filter=@gustri/marketing` succeeds.
- Both pages render plain HTML you can read top-to-bottom — no lorem
  ipsum, no TODOs.
- The footer / nav of the existing marketing pages link to them. (If
  there's no footer/nav with links yet, add the links in the same PR.)

---

### Task 4 — Tenant-switch Maestro e2e test for mobile

**Why:** PR 3 (`ref/mobile-auth-tenant-safety`) added cross-tenant cache
isolation in `apps/mobile/src/lib/auth.ts` —
`onAuthStateChange` now calls `cleanupClientState()` when the user
identity changes mid-session. Without an e2e test, a regression here
would leak tenant A's cached data to tenant B's session and we'd never
know. See `plans/follow-up-tenant-switch-e2e.md` for the full backstory.

**Files to create / modify:**

**A. Extend `supabase/seed.sql`:**
- Add a second tenant `Test Tenant Two` with a distinct slug.
- Add `admin2@test.com` (password matching the existing test user
  pattern — grep `admin@test.com` to find what's used) as staff under
  tenant two with role `admin`.
- Add a couple of tenant-scoped rows that would be visually distinct
  if they leaked: e.g., a table named `Tenant-2-Only-Table` and an
  order with a unique customer name.
- Make the seed idempotent — wrap inserts in `ON CONFLICT DO NOTHING`
  or check existence first. Existing seed style will tell you which.

**B. New file: `apps/mobile/maestro/tenant-switch.yaml`:**
- Read existing flows in `apps/mobile/maestro/` first to learn the
  Maestro syntax this project uses (commands, selectors, assertions).
- Flow:
  1. Sign in as `admin@test.com`
  2. Navigate to Tables
  3. Assert a tenant-1 row is visible (e.g., the existing seed table
     name)
  4. Tap Profile → Sign out
  5. Sign in as `admin2@test.com`
  6. Assert tenant-1 row is NOT visible
  7. Assert `Tenant-2-Only-Table` IS visible

**C. Wire into CI:**
- Look at `.github/workflows/` for the existing Maestro job. The new
  flow file should be picked up automatically if the existing job
  globs `apps/mobile/maestro/*.yaml`. If it lists files individually,
  add `tenant-switch.yaml` to the list.

**Acceptance:**
- Local: `pnpm db:reset` followed by running the Maestro flow against
  a built mobile binary passes.
- The flow **fails** on the current `main` branch if you locally
  comment out the `cleanupClientState()` call in
  `apps/mobile/src/lib/auth.ts` (sanity check that the test actually
  asserts the behavior we care about).
- The flow **passes** with the call restored.
- Delete `plans/follow-up-tenant-switch-e2e.md` since the follow-up is
  now closed.

---

## After all four tasks land

Update these files to reflect the new state:

1. **`plans/09-DB-SECURITY-DEFERRED.md`** — remove the
   "PII encryption probe" bullet from "Operational follow-ups" (it's now
   shipped via Task 1).
2. **`plans/00-OVERVIEW.md`** — update the LAUNCH row in the status
   table (was "🟡 in progress — infra setup outstanding"; if all
   non-infra items are done, change to "🟡 code-side ready, infra
   pending").
3. **Optionally:** open a follow-up issue listing the operational
   (non-code) launch items still pending: Upstash provisioning, Sentry
   project creation, Vercel env vars, Supabase Pro upgrade, custom
   domains. These are clicks, not commits — they belong in a project
   tracker, not the codebase.

---

## What NOT to do in this batch

These come up frequently when reading the plans, but are **explicitly
out of scope for this PR series**:

- ❌ Don't start the tenant-#2 hardening work (plans 09 M4/M8/M11, plans
  10 H0/H4/H5/M1/M3/M4). That's Tier 2, behind a separate trigger.
- ❌ Don't refactor the wrapper layer or add `tenantContext` to
  `WrapperContext` — that's H5, a 2–3 day PR with cross-tenant test
  fixtures.
- ❌ Don't replace `packages/database/src/types/database.ts` with the
  generated file — that's H0, a focused PR with shape-diff
  reconciliation.
- ❌ Don't add E2E tests for staff-web/customer-web (SCALE-14) — that's
  Tier 3 post-launch.
- ❌ Don't try to clean up the 303 `as any` in tests (SCALE-15) — that's
  per-file opportunistic work, not a sprint.
- ❌ Don't restructure CI or change the soft-gated jobs (the recent
  "unblock CI" commits left several `continue-on-error: true` flags;
  those are intentional debt to be paid alongside the underlying
  feature work, not in a launch-prep PR).

---

## Reporting back

When you're done, give me:
- A one-line summary per task: what was changed, where, and what
  command verifies it.
- Any deviations from the plan and why.
- Any blockers you hit and what you did about them.
- The 4 PR URLs (or commits, if you batched).

Don't summarize what the diffs do — I can read the diffs. Tell me what
I would only learn by being you.
