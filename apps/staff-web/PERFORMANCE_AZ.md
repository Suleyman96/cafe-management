# Staff-Web Performance Plan — Azerbaijan

## TL;DR

Japan is okay and Azerbaijan is slow because **Supabase lives in a single
fixed region** — confirmed 2026-05-13 as **Singapore (`ap-southeast-1`)**.
Every request from Baku to Supabase costs ~200–280 ms RTT, vs ~70 ms from
Japan (close enough to feel okay). The hot path makes 2–4 of these
round-trips per page navigation, which is what the user perceives as
"slightly slow".

The Supabase project's region is **read-only after creation** — moving
regions would require a full project migration. PRs in this plan pin
Vercel functions to Singapore (`sin1`) to remove the function ↔ Supabase
hop; the structural fix (read replica in EU, §3.1) is what actually
brings AZ latency down.

This document is a prioritised, code-level plan to close the gap.
Estimated total wall-clock improvement for AZ users after **P0 + P1**:
**~400–600 ms shaved off every page navigation**, plus visibly snappier
revisits and modals.

---

## Status (as of 2026-05-13)

| Step | Status | Where |
|---|---|---|
| 0.1 Confirm Supabase region | ✅ done 2026-05-13 | `ap-southeast-1` (Singapore) |
| 0.2 Confirm Vercel function region | 🟡 pending | Vercel dashboard — needs tech lead |
| 0.3 Baseline AZ vs JP measurement | 🟡 pending | needs Baku browser / VPN |
| **1.1** Pin function region | ✅ shipped | PR [#135](https://github.com/gunnerkh/cafe-idare/pull/135) — pinned to Singapore (`sin1`) |
| **1.2** Drop `getUser()` in middleware | ✅ shipped | PR [#133](https://github.com/gunnerkh/cafe-idare/pull/133) |
| **1.3** `staleTime` + `keepPreviousData` | ✅ shipped | PR [#134](https://github.com/gunnerkh/cafe-idare/pull/134) |
| **1.4** Preconnect to Supabase | ✅ shipped | PR [#133](https://github.com/gunnerkh/cafe-idare/pull/133) |
| 2.1 RUM with country tagging | 🟡 pending | needs Vercel Speed Insights vs. Sentry decision |
| **2.2** Query consolidation | ⏭️ skipped 2026-05-13 | Investigation showed the hoist is already implicit — see §2.2 |
| **2.3** Cache `verifyStaff` / `verifyAdmin` | ✅ shipped | PR [#136](https://github.com/gunnerkh/cafe-idare/pull/136) — needs `UPSTASH_REDIS_REST_URL` confirmed in prod |
| **2.4** Edge runtime audit | ✅ verified (no code change) | Bundled into PR [#133](https://github.com/gunnerkh/cafe-idare/pull/133); middleware already on Edge by default |
| 3.1 Supabase read replica | 🟡 pending | infra/billing decision |
| 3.2 Per-region tenant sharding | 🟡 not-pursued | gated on 3.1 + AZ market growth |

**What's left to action right now:**
1. ~~Confirm Supabase region (0.1)~~ — done 2026-05-13: `ap-southeast-1` (Singapore). PR #135 pinned to `sin1`.
2. Confirm `UPSTASH_REDIS_REST_URL` is set in Vercel prod env (PR #136).
3. Pick Vercel Speed Insights vs. Sentry `tracesSampleRate` for 2.1, then ship.
4. After everything merges, run the §5 verification checklist from a Baku browser to measure actual impact.

---

## 0. Confirm the assumption first (15 minutes)

Before changing code, verify the diagnosis — otherwise we're guessing.

### 0.1 Find Supabase region

- Open Supabase dashboard → Project → Settings → General.
- **Confirmed 2026-05-13: `ap-southeast-1` (Singapore).** PR #135 pins
  Vercel functions to `sin1` to match. Update both if the Supabase
  region ever changes (requires a project migration — there's no
  in-place region change in Supabase).

### 0.2 Find Vercel function region

- Open Vercel dashboard → `staff-web` project → Settings → Functions.
- Note the **default region** (likely `iad1` or `cdg1` if untouched).
- If the function region is **not** the same as Supabase, every API
  request currently does a triangle: AZ user → Vercel function region →
  Supabase region → back. That's the worst case and explains a lot of
  the AZ slowness on its own.

### 0.3 Get a real measurement

From a browser in Baku, in DevTools → Network:

1. Hard reload `/orders`. Record:
   - TTFB on the document
   - TTFB on the first `*.supabase.co/rest/v1/*` request
   - Total `load` time
2. Repeat from a JP browser (or VPN exit node in Japan).
3. The delta between these two numbers is your **performance budget**;
   every change below should chip away at it.

Acceptance: a small markdown note pasted into Linear / wherever the
incident is tracked, e.g. `AZ TTFB orders=820ms, JP TTFB orders=180ms`.

---

## 1. P0 — Quick wins (ship this week)

These are reversible, low-risk, no schema or infra changes. Do all
three together.

### 1.1 Pin Vercel function region to Supabase region — ✅ shipped (PR #135)

**Why:** Today every `/api/v1/*` call in AZ goes
`Baku → Vercel(default) → Supabase(Singapore) → Vercel → Baku`.
Co-locating Vercel functions with Supabase removes one full RTT
(~250 ms in AZ) per API call. JP is unaffected because Singapore
is already optimal for them.

**Change:**

Edit `apps/staff-web/next.config.js`. Add `preferredRegion` is route-level
in App Router; the cleanest way is to centralise it.

Create `apps/staff-web/src/app/api/_region.ts`:

```ts
// Pin all /api/v1 functions to the Supabase region so server-side
// queries don't pay an extra hop. Update this if Supabase moves.
export const preferredRegion = ['sin1']; // Singapore. 'cdg1' if Supabase EU, etc.
```

Then in **every** `apps/staff-web/src/app/api/v1/**/route.ts`, add:

```ts
export { preferredRegion } from '@/app/api/_region';
```

Or set it project-wide in Vercel dashboard → Settings → Functions →
Region → choose Singapore. Dashboard setting is faster to ship; per-route
is more explicit and survives a project re-creation.

**Acceptance:**
- `vercel inspect <deployment>` shows `region: sin1` for `/api/v1/*`.
- Manual test from AZ: `/api/v1/health` p50 drops by ~200 ms.

**Risk:** Tiny — function cold starts in Singapore are the same as
elsewhere. EU/US users get marginally slower middleware (~50 ms) but
that's already dwarfed by the Supabase RTT they pay anyway.

---

### 1.2 Stop calling `getUser()` in middleware on page navigations — ✅ shipped (PR #133)

**Why:** [src/middleware.ts:88](src/middleware.ts#L88) calls
`supabase.auth.getUser()` which is a **network call** to Supabase Auth
on every navigation. Then [src/middleware.ts:99](src/middleware.ts#L99)
calls `getSession()` which is **local-only** (reads cookie, parses JWT).
We then read `is_active_staff` from the JWT payload at
[src/middleware.ts:108](src/middleware.ts#L108) anyway — so `getUser()`
is redundant for the page-nav path.

For AZ that's ~250 ms of dead weight on every link click.

**Important caveat:** `getUser()` is the only way to *verify* the JWT
signature against Supabase. `getSession()` trusts the cookie. For the
**middleware** path this is acceptable because:
1. RLS on every table re-validates the JWT server-side — a forged cookie
   gets nothing back.
2. Every `/api/v1/*` route already calls `verifyStaff` /
   [src/lib/api/verify-staff.ts:29](src/lib/api/verify-staff.ts#L29)
   which does its own `auth.getUser(token)` server-side.

So middleware doesn't need to verify; it only needs to gate UI access.

**Change:** Replace the page-nav branch of middleware with a
session-only check:

```ts
// src/middleware.ts — page navigation branch (currently lines 83–122)
const { supabase, response } = createMiddlewareClient(request);
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

let isActiveStaff = false;
try {
  const payload = JSON.parse(
    Buffer.from(session.access_token.split('.')[1], 'base64').toString(),
  );
  isActiveStaff = payload.is_active_staff === true;
} catch {}

if (!isActiveStaff) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('error', 'inactive');
  return NextResponse.redirect(loginUrl);
}

return response;
```

Keep `getUser()` for the `/api/*` branch — those routes don't all run
`verifyStaff`, and we still want one network-verified gate before
unauthenticated traffic touches a route handler.

**Acceptance:**
- AZ TTFB on `/orders` drops by ~250 ms.
- Existing E2E (`apps/staff-web/e2e/`) passes.
- Manual: log in, suspend the user in Supabase Studio (`is_active = false`),
  refresh — middleware still redirects to `/login?error=inactive` because
  the JWT is re-issued on token refresh and the hook reads the latest
  `is_active`. Worst case: a deactivated user has up to `jwt_expiry`
  (3600 s, see `supabase/config.toml`) of grace. That's already the
  existing trust model on the API side.

**Risk:** Low. Documented above — the only behaviour change is that
deactivation has up to 1 hour of UI lag. If that's unacceptable, keep
`getUser()` but cache its result for 30 s in a cookie/header (see 2.3).

---

### 1.3 Tune TanStack Query for high-RTT clients — ✅ shipped (PR #134)

**Why:** [src/app/providers.tsx:188](src/app/providers.tsx#L188) sets
`staleTime: 60_000` and `refetchOnMount: true` globally. That means
every time the user navigates back to a page the hook treats the
60-second cache as stale enough to refetch in the background. At 30 ms
RTT (JP) that's invisible; at 300 ms RTT (AZ) it's visible jank.

For most read-heavy data on this app (menu, categories, tables list,
cafe settings, staff list) one minute of staleness is fine — the
realtime subscription will invalidate within seconds of any actual
change anyway.

**Change:** Bump `staleTime` for stable lists individually rather than
globally. Don't change the global default — order/payment hooks need
the current 60 s.

Add per-hook overrides in `@gustri/queries` for the stable reads:

| Hook | Current staleTime | New staleTime | Justification |
|---|---|---|---|
| `useMenu` / `useCategories` | global (60 s) | 5 min | Realtime invalidates on edit |
| `useTables` (list, not status) | global (60 s) | 2 min | Realtime invalidates on add/remove |
| `useCafeSettings` | global (60 s) | 10 min | Manually edited, realtime backstop |
| `useStaff` (list) | global (60 s) | 5 min | Edited rarely |
| `useFeatureFlags` | global (60 s) | 5 min | Long-lived flags |
| `useExpenseCategories` / `useTaskCategories` | global (60 s) | 10 min | Quasi-static |

Also add `placeholderData: keepPreviousData` to **paginated** hooks
(`useOrders`, `useStockMovements`, `useFeedback`, `useWasteLogs`) so
page-to-page navigation in lists shows the previous page until the
next one arrives, instead of a spinner.

**Acceptance:**
- Manual in AZ: navigate `Menu → Orders → Menu` — second `Menu` visit
  is instant (cache hit, no spinner).
- Realtime test: edit a menu item in tab A, see it in tab B within 2 s
  via realtime invalidation. (This already works; verify we didn't break it.)

**Risk:** Low. Realtime is the source of truth for freshness; staleTime
is a fallback. If realtime is broken on a tenant, they get up-to-10-min
stale data on settings — already mitigated by the foreground 30s
fallback poll in `use-realtime-sync.ts`.

---

### 1.4 Preconnect to Supabase — ✅ shipped (PR #133)

**Why:** Browser does a TCP+TLS handshake to `*.supabase.co` lazily on
the first REST/Realtime call. From Baku that handshake is ~500 ms
(2 × RTT for TCP + 2 × RTT for TLS). Preconnect lets the browser do it
in parallel with HTML parsing.

**Change:** Add to `apps/staff-web/src/app/layout.tsx` `<head>`:

```tsx
<link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />
<link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
```

(If `layout.tsx` already exists with a `<head>`, append. If not, use the
Next.js Metadata API or `<Script strategy="beforeInteractive">`.)

**Acceptance:**
- DevTools → Network: `connection start` for first `*.supabase.co`
  request happens ~300 ms earlier in AZ.
- No regressions in JP (preconnect is a no-op when latency is already low).

**Risk:** Zero.

---

## 2. P1 — Medium-term (this month)

### 2.1 Add RUM with country tagging — 🟡 pending decision

**Why:** "AZ feels slow" is a vibes-based bug report. We need numbers
per country before we can tell whether further work is paying off.

**Change:** Two options, pick one:

- **Vercel Speed Insights** — already a Vercel project, one-line setup.
  Gives core web vitals split by country out of the box.
- **Sentry Performance** (we already have Sentry) — set
  `tracesSampleRate: 0.1` in `instrumentation-client.ts` and tag spans
  with `country` from `navigator.language` or a CDN-injected header.

Tag every transaction with `country = navigator.language.split('-')[1]`
(rough but free) or, better, read the `x-vercel-ip-country` header in
middleware and stamp it as a Sentry tag.

**Acceptance:**
- After 24 h of production traffic, dashboard shows TTFB / LCP / FID
  histograms split by AZ vs JP. Use this as the regression detector.

---

### 2.2 Reduce parallel queries on the orders/kitchen pages — ⏭️ skipped 2026-05-13

**Decision:** Investigation showed the recommended hoist is **already
happening implicitly**. The staff layout renders [components/layout/sidebar.tsx](src/components/layout/sidebar.tsx)
and [components/auth/idle-soft-lock.tsx](src/components/auth/idle-soft-lock.tsx),
both of which call `useCafeSettings` before any child page mounts.
Combined with the 5-min `staleTime` from PR #134, every child page
hits cache for cafe settings, feature flags, and `useFormatPrice`.

The "double-fetch" worry on kitchen (`useKitchenView` + explicit
`useCategories()`) is a non-issue — both resolve to the same query
key and TanStack dedupes into a single request.

Real remaining wins are NOT what this section originally promised:
- RSC migration for Server-Component prefetching (large refactor)
- Single RPC for `orders + tables` (only relevant if a page actually
  fetches both — `/orders` doesn't)
- An explicit `<SessionPrefetch />` at the layout level to lock in the
  hoist against future Sidebar refactors (~30 LOC, marginal value)

Revisit only if RUM (2.1) surfaces a measurable wait on session-stable
data despite the staleTime bumps.

---

### 2.2.bis (original action items, kept for context)

**Why:** Hot pages in this app fire 3–5 queries in parallel on mount
(orders, tables, staff, cafe_settings, feature_flags). At 300 ms RTT
the longest one dominates LCP — but each one also burns a TCP slot
and CPU. Some of these can be merged or moved to an SSR fetch.

**Action:**
- Audit `apps/staff-web/src/app/(staff)/orders/page.tsx` and
  `apps/staff-web/src/app/(staff)/kitchen/page.tsx` for query count on
  mount.
- For data that's the same per session (cafe_settings,
  feature_flags, staff profile), prefetch once in the staff layout via
  a Server Component or a top-level `useQueries` and let other
  components read from cache. The `staleTime` bumps in 1.3 already help
  here — formalise it by hoisting the prefetches.
- For orders + tables on the same page, consider a single RPC that
  returns both shapes — saves one RTT.

**Acceptance:**
- Network panel on `/orders` first paint shows ≤3 Supabase requests
  instead of 5.
- LCP in AZ down by another 200–400 ms.

**Risk:** Medium. Refactor touches multiple files. Do behind a feature
flag (`feature_flags.consolidated_orders_fetch`) per the project rule.

---

### 2.3 Cache `getUser()` validation for API routes — ✅ shipped (PR #136)

> **Implementation note:** the shipped PR cached uniformly across all
> endpoints, including `reset-password` and `revoke-sessions`. The
> original plan below recommended skipping those; on closer review the
> cache stores the **caller's** auth (always admin) rather than the
> target's, so the security argument doesn't apply. See PR #136
> description for the full reasoning.

**Why:** Even after 1.2, every `/api/v1/*` call still pays one
`auth.getUser()` RTT (~250 ms in AZ) for verification. We can cache
that validation per-token for 30 s in a Vercel KV / Upstash Redis
(we already have Upstash for rate-limiting, see `.env.example`).

**Change:** In `src/lib/api/verify-staff.ts`, wrap `auth.getUser(token)`
in a Redis cache keyed by `sha256(token).slice(0,16)`, TTL 30 s. On hit,
skip the network call and decode JWT claims directly.

```ts
const cacheKey = `auth:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
const cached = await redis.get<StaffClaims>(cacheKey);
if (cached) return cached;
const { data: { user } } = await supabaseAdmin.auth.getUser(token);
// … validate, then:
await redis.set(cacheKey, claims, { ex: 30 });
```

**Acceptance:**
- `verifyStaff` p50 latency drops to <10 ms on cache hits.
- AZ /api/v1/orders POST drops by another ~250 ms.
- Cache invalidation on logout: explicit `redis.del(cacheKey)` in the
  signout endpoint, *and* the 30 s TTL is the safety net.

**Risk:** Medium. A revoked-but-cached token has up to 30 s of grace
window where it can still hit `/api/v1/*`. That's the same trust model
as 1.2's middleware change. Don't enable for the staff-revoke /
password-reset endpoints — those must always re-verify.

---

### 2.4 Make middleware run on Edge runtime — ✅ verified (no code change)

> **Audit result (bundled with PR #133):** Next.js 14 already pins
> `middleware.ts` to the Edge runtime by default — there's no opt-out.
> The import chain (`@/lib/supabase/server` → `@supabase/ssr`) has no
> Node-only APIs (`fs`, `crypto`, `path`, `next/headers`), and
> `Buffer.from(...)` for the JWT decode is supported on Vercel's Edge
> Runtime. No code change needed.

**Why:** Middleware is a fast-path; running it on Node.js means cold
starts and a heavier runtime per invocation. Edge runtime in the same
region as Supabase (Singapore edge POP) is cheaper per call.

**Change:** Verify middleware is already Edge (Next.js default for
`middleware.ts`). If anything in `createMiddlewareClient` pulls in a
Node-only API (it shouldn't — `@supabase/ssr` is edge-compatible) move
it out.

**Acceptance:** `vercel logs` shows middleware running in `edge` mode.
Cold-start tail latency for AZ drops slightly.

---

## 3. P2 — Strategic (next quarter)

### 3.1 Supabase read replicas (the real fix) — 🟡 pending

**Why:** Everything above is shaving milliseconds. The structural
problem is "single-region database". Supabase Pro+ supports read
replicas in additional regions. A Frankfurt or Mumbai replica drops
AZ read latency from ~300 ms to ~30–80 ms.

**Plan:**
1. Upgrade plan if not already on Pro+.
2. Add a Frankfurt (`eu-central-1`) read replica.
3. Route reads from clients with `x-vercel-ip-country` in
   `{AZ, GE, AM, TR, RU, …}` to the replica via a region-aware
   Supabase client (or via PgBouncer routing).
4. Writes still go to primary (Singapore). Restaurant POS write volume is
   tiny — write latency cost is bounded.

**Acceptance:** AZ read p50 < 100 ms.

**Risk:** Replication lag (~200 ms typical) means a write followed by
an immediate read of the same row may miss it. Mitigate by routing
the read-after-write to primary for ~1 s after a mutation, or by using
the optimistic-update path that already exists for orders.

**Effort:** ~1–2 weeks including migration of read paths and testing.

---

### 3.2 Per-region tenant sharding (only if AZ becomes a major market) — 🟡 not-pursued

If AZ + neighbouring regions grow to ≥20% of revenue, run a separate
Supabase project in EU and shard tenants by region at signup. Higher
ops cost (two databases to back up, two sets of migrations to run);
only worth it past a certain volume.

Don't pursue this until 3.1 is exhausted.

---

## 4. Things NOT to do (and why)

- **Don't** enable Vercel ISR/SSG for staff pages. The data is
  per-tenant, RLS-gated, and changes on every shift. SSG is wrong for
  this domain.
- **Don't** add a service-worker write cache. Money flows through
  these endpoints; eventual-consistency caches and payment writes are
  a known foot-gun. The existing `sw.js` for asset caching is fine;
  don't extend it to API responses.
- **Don't** lower `jwt_expiry` to "fix" the deactivation lag from 1.2.
  Lower expiry = more token-refresh round-trips = *worse* AZ perf.
- **Don't** ship a "switch language to use lighter bundle" optimisation.
  i18n bundles are already code-split per locale
  ([src/lib/i18n.ts:38](src/lib/i18n.ts#L38)) and cached at the CDN edge.
  Not the bottleneck.

---

## 5. Verification checklist

After P0 ships, run this from a Baku browser (or VPN):

- [ ] `/login` → `/orders` total time ≤ 1.2 s (was ~2.0 s)
- [ ] `/orders` → `/kitchen` (cached) navigation ≤ 300 ms
- [ ] First Supabase REST call TTFB ≤ 350 ms (was ~600 ms)
- [ ] Realtime SUBSCRIBED status reached ≤ 500 ms after page load
- [ ] No regression in JP: `/orders` total time still ≤ 350 ms

Track these in Speed Insights / Sentry once 2.1 is done.

---

## 6. Owner & sequencing

| Step | Status | Owner | Notes |
|---|---|---|---|
| 0. Confirm regions | 🟡 pending | tech lead | Blocks merge of #135 |
| 1.1 preferredRegion | ✅ PR #135 | tech lead | Verify region before merge |
| 1.2 middleware getUser drop | ✅ PR #133 | tech lead | — |
| 1.3 staleTime tuning | ✅ PR #134 | tech lead | — |
| 1.4 preconnect | ✅ PR #133 | tech lead | Bundled with 1.2 |
| 2.1 RUM | 🟡 pending | tech lead | Needs Vercel Speed Insights vs. Sentry call |
| 2.2 query consolidation | ⏭️ skipped | — | Investigated 2026-05-13; already implicit |
| 2.3 verify cache | ✅ PR #136 | tech lead | Confirm `UPSTASH_REDIS_REST_URL` in prod |
| 2.4 edge runtime audit | ✅ verified | tech lead | No code change (bundled with #133) |
| 3.1 read replica | 🟡 pending | tech lead + ops | The structural fix |
| 3.2 per-region sharding | 🟡 not-pursued | — | Gated on 3.1 + AZ market growth |
