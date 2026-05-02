# Tier 3 Implementation Prompt — Production Hardening

> Generated: 2026-05-01
> Context: Hand-off prompt for the next implementation agent.
> Scope: The hardening items from `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`,
> `plans/03-MEDIUM-fixes.md`, and `plans/11-PACKAGE-ARCHITECTURE-ROADMAP.md`
> that don't block launch but become painful under real production
> traffic. None of these depend on tenant-#2 work (Tier 2) — they can
> ship in parallel with that batch.

---

## How to use this file

Paste the **Prompt** section below into a fresh agent session. It is
self-contained — no other context needed.

The work is structured as **six independent PRs** (1–6). They have no
inter-PR dependencies; do them in any order, or split across implementers.
Recommended order is by ROI per hour: **1 → 2 → 3 → 4 → 5 → 6**.

If the agent has limited time, doing **PR 1 (web E2E tests) and PR 2
(staff-web CSP nonce)** alone is high-value: the first prevents
regressions, the second closes a real XSS hole.

---

## Prompt

You are a senior full-stack engineer working on Gustri (a Turborepo
monorepo: `apps/{staff-web,customer-web,marketing,mobile}` and
`packages/{database,core,api-client,queries,i18n,ui}`). Read
`/Users/kamilhajilov/Documents/github/cafe-idare/CLAUDE.md` first — it
documents the data-access boundary, hook placement, migration rules,
and i18n requirements you must follow.

You're picking up the **production-hardening** batch. Tier 1
(pre-launch blockers) is done. The system is in soft launch with the
first cafes. These six items don't block any launch but each closes a
risk that real production traffic will eventually exercise.

### Ground rules

- **One PR per task.** Independent. Don't bundle.
- **Don't expand scope.** No drive-by refactors.
- **Follow CLAUDE.md.** Especially the data-access boundary, the i18n
  rule, and the migration rule.
- **Verify before claiming done.** Each task lists explicit acceptance
  commands.
- **Match existing patterns.** Before writing new code, grep for
  similar code in the repo.

---

### Task 1 — Real E2E tests for staff-web and customer-web (SCALE-14)

**Why:** Today there are zero `*.spec.ts` files under
`apps/staff-web/e2e/` or `apps/customer-web/e2e/`. Mobile has Maestro
flows, but the web apps have nothing — every refactor is a coin flip.
Highest ROI in this batch because every other future change becomes
safer once these exist.

**Files to create:**
- `apps/staff-web/playwright.config.ts` (if missing — check first)
- `apps/staff-web/e2e/auth.spec.ts`
- `apps/staff-web/e2e/order-lifecycle.spec.ts`
- `apps/staff-web/e2e/orders.spec.ts`
- `apps/staff-web/e2e/security.spec.ts`
- `apps/customer-web/playwright.config.ts` (if missing)
- `apps/customer-web/e2e/menu.spec.ts`
- `apps/customer-web/e2e/order-flow.spec.ts`
- `apps/customer-web/e2e/waiter-call.spec.ts`

**Pattern check before writing:**
- Read `playwright.config.ts` files if they exist.
- Read `apps/mobile/maestro/*.yaml` to understand what flows the team
  considers worth testing — replicate the same coverage on web.
- Grep for any `playwright` reference in the repo to find existing
  conventions (selectors, fixtures, test users).

**Coverage targets (minimum):**

Staff-web:
- `auth.spec.ts`: log in with `admin@test.com` / `test1234` → land on
  dashboard. Wrong password → error message.
- `order-lifecycle.spec.ts`: create order → mark item preparing → mark
  ready → mark served → close. Assert each transition is visible.
- `orders.spec.ts`: filter by status, search by table number.
- `security.spec.ts`: visiting `/dashboard` while logged out redirects
  to login.

Customer-web:
- `menu.spec.ts`: load `/table/T01/menu` → categories render → an
  item is clickable.
- `order-flow.spec.ts`: add item to cart → checkout → order appears in
  staff-web (use a separate Playwright context).
- `waiter-call.spec.ts`: trigger waiter call → assert call appears in
  staff-web realtime.

**Setup:**
- Tests run against local Supabase (`supabase start`) seeded with
  `pnpm db:reset`.
- Reuse Playwright config from existing apps if present.
- Add a `pnpm test:e2e` script if missing in each app's `package.json`.
- Wire into CI: extend `.github/workflows/ci.yml` `e2e` job to run
  the web E2E suite. The job already starts Supabase per
  `plans/02-HIGH-fixes.md`; add the Playwright run after the existing
  steps.

**Acceptance:**
- All E2E specs pass locally with `pnpm test:e2e --filter=@gustri/staff-web`
  and `--filter=@gustri/customer-web`.
- A deliberate regression (e.g., breaking the login route) makes the
  relevant spec fail.
- CI runs the new specs.
- Don't aim for exhaustive coverage — aim for "the critical happy path
  for each app is asserted."

---

### Task 2 — Remove `unsafe-inline` from staff-web CSP (SCALE-17)

**Why:** Customer-web already moved to nonce-based CSP (commit
`6444b1c`). Staff-web still allows `'unsafe-inline'` in `script-src`,
meaning any successfully injected `<script>` can execute. Real XSS
exposure.

**Files to touch:**
- `apps/staff-web/next.config.js` (or `next.config.ts`)
- `apps/staff-web/src/middleware.ts`
- Any layout file that renders inline `<script>` tags (Next.js
  hydration scripts use nonces from middleware).

**Pattern to follow:** Read commit `6444b1c` (`fix(customer-web):
nonce-based CSP — unblock Next.js inline hydration`) and
`apps/customer-web/src/middleware.ts` to see the exact pattern. Mirror it.

**Steps:**

1. In `apps/staff-web/src/middleware.ts`, generate a per-request nonce
   (16+ bytes, base64-encoded), inject it into the request headers
   so layouts can read it, and write a CSP header that includes
   `'nonce-<value>'` in `script-src` (and `style-src` if needed).
2. Update layouts (`apps/staff-web/src/app/layout.tsx` etc.) to read
   the nonce from `headers()` and pass it to `<Script nonce={nonce}>`
   tags. Next.js auto-applies the nonce to its hydration scripts when
   the CSP header is set correctly.
3. Remove `'unsafe-inline'` from `script-src` in both
   `next.config.js` `headers()` and the middleware CSP.
4. Keep `'unsafe-inline'` in `style-src` if Tailwind/inline styles
   require it — note this in the PR description and TODO it for a
   later pass.

**Acceptance:**
- `pnpm dev --filter=@gustri/staff-web` runs without CSP violations
  in the browser console.
- `pnpm build --filter=@gustri/staff-web` and `pnpm start` produce a
  working app with no runtime CSP errors.
- View source on the page: each `<script>` tag has a unique `nonce=`
  attribute.
- Network tab shows `Content-Security-Policy` header with
  `'nonce-…'` in `script-src` and no `'unsafe-inline'` for scripts.
- All existing E2E tests pass (especially after Task 1 lands).

---

### Task 3 — Server-side upload validation (SCALE-21)

**Why:** Routes that accept file uploads (image-upload paths) currently
validate with Zod schemas but lack MIME-type and size guards. An
attacker can upload arbitrary content with a fake extension.

**Files to touch:**
- Search for existing upload routes:
  `grep -r "formData\|multipart" apps/staff-web/src/app/api/`
- Likely candidates:
  - `apps/staff-web/src/app/api/v1/uploads/**/route.ts`
  - Or wherever `branding`/`menu-images` storage uploads happen.
- If uploads happen client-side via Supabase Storage SDK directly,
  the validation goes in `apps/staff-web/src/components/.../image-upload.tsx`
  and similar — though server-side validation via a route is
  preferable.

**Validation rules:**
- **MIME types allowed:** `image/jpeg`, `image/png`, `image/webp`. No
  SVG (XSS vector), no GIF, no anything else.
- **Max size:** 5 MB for menu images, 2 MB for branding (or whatever
  the team's expectations are — check the design system).
- **Magic-byte check:** don't trust the `Content-Type` header. Read
  the first ~12 bytes and verify the file actually is an image.
  Use a lightweight library (`file-type` package) or hand-roll for
  the three allowed formats.

**Pattern:**
```ts
import { fileTypeFromBuffer } from 'file-type';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

if (file.size > MAX_SIZE) throw new ValidationError('File too large');
const buf = Buffer.from(await file.arrayBuffer());
const detected = await fileTypeFromBuffer(buf);
if (!detected || !ALLOWED.has(detected.mime)) {
  throw new ValidationError('Invalid file type');
}
```

Use `ValidationError` from `@gustri/core`. Use the existing
`httpStatusToAppError` mapping so the route returns a proper 400.

**Acceptance:**
- `pnpm test` passes (add a test for each upload route covering: too
  large, wrong MIME, magic-byte mismatch, valid image).
- Manual: upload a `.txt` file renamed to `.png` → server rejects with
  400.
- Manual: upload a 10MB image → server rejects with 400.
- Manual: upload a valid JPEG → succeeds.
- No regression on existing image upload UI.

---

### Task 4 — Error boundaries on remaining staff-web pages (SCALE-18)

**Why:** Five `error.tsx` files exist (root, `(staff)`, `cafe-settings`,
`feedback`, `schedules`). Several high-traffic pages are missing one —
a render error white-screens the whole tab.

**Files to create:**
- `apps/staff-web/src/app/(staff)/reports/error.tsx`
- `apps/staff-web/src/app/(staff)/menu/error.tsx`
- `apps/staff-web/src/app/(staff)/delivery/error.tsx`
- `apps/staff-web/src/app/(staff)/settings/error.tsx`
- (Verify which of these route folders actually exist; create `error.tsx`
  for any that exist but lack one.)

**Pattern check:** Read one of the existing `error.tsx` files first
(e.g. `apps/staff-web/src/app/(staff)/cafe-settings/error.tsx`).
Match its style — same i18n keys for "Something went wrong" and "Try
again," same Sentry capture pattern, same Tailwind classes.

**Required structure:**
```tsx
'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    // …match the existing error.tsx layout exactly…
  );
}
```

**i18n:** Use existing keys (e.g. `errors.generic_title`,
`errors.try_again`) — grep one of the existing `error.tsx` to find
them. Don't create new keys unless none of the existing ones fit.

**Acceptance:**
- `pnpm dev --filter=@gustri/staff-web` runs.
- Manually throw an error in each affected page (temporarily add
  `throw new Error('test')` at the top of `page.tsx`) → the relevant
  `error.tsx` renders with "Try again" button.
- The "Try again" button calls `reset()` and re-renders.
- Sentry captures the error (verify via dev tools or
  `Sentry.addBreadcrumb` log).
- `pnpm test` passes.
- Revert the `throw new Error` test after verifying.

---

### Task 5 — Split the two remaining oversize components (MED-7 residue)

**Why:** [`apps/staff-web/src/components/orders/split-payment-modal.tsx`](apps/staff-web/src/components/orders/split-payment-modal.tsx)
is 477 lines and [`apps/staff-web/src/app/(staff)/menu/page.tsx`](apps/staff-web/src/app/(staff)/menu/page.tsx)
is 441 lines. Delivery and takeout pages have already been split. These
two are the last over-the-400-line outliers.

**Pattern to follow:** Look at the existing splits in
`apps/staff-web/src/app/(staff)/delivery/` and `takeout/` — they were
split in a prior PR. Match the directory structure and naming
conventions.

**`split-payment-modal.tsx` — split into:**
- `split-payment-modal.tsx` (~150 lines: modal shell + mode selection
  state)
- `split-payment/item-payment-form.tsx` (~150 lines: per-item payment
  UI)
- `split-payment/partial-payment-form.tsx` (~100 lines: partial-amount
  UI)
- `split-payment/payment-summary.tsx` (~80 lines: totals + remaining
  balance display)

**`menu/page.tsx` — split into:**
- `menu/page.tsx` (~100 lines: page shell + data fetching)
- `menu/menu-item-list.tsx` (~150 lines)
- `menu/menu-item-form.tsx` (~100 lines: create/edit form)
- `menu/category-sidebar.tsx` (~80 lines)

**Anti-patterns to avoid:**
- ❌ Don't change behavior. The split is purely organizational. Tests
  should pass without modification.
- ❌ Don't introduce new abstractions or hooks. Move existing code; do
  not refactor.
- ❌ Don't promote anything to `@gustri/ui` unless a second app
  already needs it.
- ❌ Don't change i18n keys.

**Acceptance:**
- All existing tests pass without changes.
- `pnpm type-check` passes.
- Manual: open the split-payment modal — same UI, same flow. Open the
  menu page — same UI, same flow.
- Each new file is < 200 lines.
- The original files are < 200 lines.

---

### Task 6 — Consolidate stray routes under `/api/v1/` (M5 / C3)

**Why:** Four client-facing routes sit outside `/api/v1/`, making the
versioning prefix meaningless. Cheap to fix; should land before any
`/v2/*` work begins.

**Routes to move:**
- `apps/staff-web/src/app/api/staff/route.ts` → `…/api/v1/staff/route.ts`
- `apps/staff-web/src/app/api/staff/reset-password/route.ts` →
  `…/api/v1/staff/reset-password/route.ts`
- `apps/staff-web/src/app/api/schedules/clock/route.ts` →
  `…/api/v1/schedules/clock/route.ts`
- (Check for any others outside `/v1/` that aren't `health` or
  `webhooks` — those stay where they are because they're infra-facing.)

**Steps:**

1. Move each file to its new path. Don't change implementation.
2. Update callers:
   - **Mobile:** `apps/mobile/src/lib/api-routes.ts` — update the
     constants pointing at these paths.
   - **Staff-web:** grep for the old paths in app code (`fetch('/api/staff…')`
     and similar) — update each.
   - **Customer-web:** unlikely to call any of these, but grep to be
     sure.
3. Add 308 redirects from the old paths if external callers might
   exist:
   ```ts
   // apps/staff-web/src/app/api/staff/route.ts (new stub)
   import { NextResponse } from 'next/server';
   export function GET(req: Request) {
     const url = new URL(req.url);
     url.pathname = url.pathname.replace('/api/staff', '/api/v1/staff');
     return NextResponse.redirect(url, 308);
   }
   ```
   Or — if the team is confident no external caller uses these — just
   delete the old files. Mention the choice in the PR description.
4. Update any E2E tests that reference these paths.

**Acceptance:**
- `pnpm test` and `pnpm test:e2e` pass.
- Manual: log in to staff-web, hit each affected feature (staff
  management, password reset, clock-in) → all work.
- Manual: log in on mobile, hit the schedules clock-in flow → it
  works.
- `grep -r "'/api/staff'\|'/api/schedules" apps/` returns zero hits
  (or only the redirect stubs, if used).

---

## After all six tasks land

Update `plans/00-OVERVIEW.md`:
- Flip the SCALE row from "🟡 22 done, 12 pending" to reflect the
  count delta (E2E tests close SCALE-14; CSP closes SCALE-17; upload
  validation closes SCALE-21; error boundaries close SCALE-18; route
  consolidation closes M5/C3).
- Flip the MEDIUM row to "✅ all shipped" once MED-7 residue closes.

Update `plans/03-MEDIUM-fixes.md` and `plans/07-SCALING-AND-ARCHITECTURE-fixes.md`:
- Add a "Status" line to MED-7, SCALE-14, SCALE-17, SCALE-18, SCALE-21
  noting the closing PR/commit.

Update `plans/11-PACKAGE-ARCHITECTURE-ROADMAP.md`:
- Mark C3 (M5) ✅ done.

---

## What NOT to do in this batch

- ❌ Don't start tenant-#2 hardening (Tier 2 — see
  `plans/13-TIER2-TENANT2-READINESS-PROMPT.md`).
- ❌ Don't tackle SCALE-15 (`as any` in tests, 303 occurrences) —
  that's per-file opportunistic work, not a sprint.
- ❌ Don't add SSR for reports/menu pages (SCALE-13) — defer until
  customer TTI complaints surface.
- ❌ Don't add HTTP/edge caching (SCALE-10) — defer until busy-hour
  read traffic creates measurable load.
- ❌ Don't enable `pg_stat_statements` (SCALE-26) — it's a Supabase
  dashboard toggle (with a one-line migration to call `pg_stat_statements_reset()`),
  not a code change. Track separately.
- ❌ Don't add data retention/archival (SCALE-25) — defer until
  `orders` table approaches ~2M rows.
- ❌ Don't add optimistic updates (M3 / ADD-5) — defer until staff
  complain about UI lag.
- ❌ Don't restructure CI's soft-gated jobs (`continue-on-error: true`
  flags from the recent unblock commits) — those are intentional debt
  paid alongside underlying feature work, not in a hardening PR.

---

## Reporting back

For each PR, tell me:
- One-line summary of what changed and where.
- The acceptance commands you ran and their outcomes.
- Any deviations from the plan and the reasoning.
- Any regression risk you flagged but couldn't fully test.
- The PR URL or commit SHA.

Don't summarize the diffs — I read those. Tell me what only you know.
