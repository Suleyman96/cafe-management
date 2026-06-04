# customer-web Phase 6 — Performance, Polish & Release Checklist

Index: [21-CW-PROD-AUDIT-OVERVIEW.md](21-CW-PROD-AUDIT-OVERVIEW.md)

Nine performance/polish items + the consolidated release-readiness checklist.
This is the last phase before tagging the customer-web public release.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` shipped · `[-]` won't fix

---

## P1. Debounce realtime invalidations

- [x] **Where.**
  - [apps/customer-web/src/hooks/use-order.ts:92-105](../apps/customer-web/src/hooks/use-order.ts#L92-L105)
  - [apps/customer-web/src/hooks/use-delivery.ts:71-85](../apps/customer-web/src/hooks/use-delivery.ts#L71-L85)
- [x] **What.** Each `postgres_changes` event calls `queryClient.invalidateQueries`. If staff bulk-edit 10 items → 10 invalidations → 10 RPC refetches in one second.
- [x] **Why it matters.** Refetch storm on a phone with weak signal feels janky; also wastes server.
- [x] **Fix steps.**
  1. Add a small debounce inside each hook:
     ```ts
     const invalidate = useRef(
       debounce(() => queryClient.invalidateQueries({ queryKey: [...] }), 150)
     ).current;
     ```
     (use a small inline debounce — don't pull in lodash for this.)
  2. Apply to both `orders` and `order_items` callbacks.
  3. 150ms is the sweet spot — invisible to the user, kills the storm.
- [x] **Verification.**
  - Staff bulk-edit 10 items → customer sees a single refetch ~150ms after the last event.
- [x] **Done when.** Debounced, no UI regression.

---

## P2. Tune supabase fetch throttle — budget + per-endpoint keying

- [x] **Where.** [apps/customer-web/src/lib/supabase.ts:18-36](../apps/customer-web/src/lib/supabase.ts#L18-L36)
- [x] **What.** Throttle is 20 req / 10 s shared across every Supabase call. The menu page legitimately fires 6–10 requests on first load; a retry on a flaky network can blow past the budget and produce a generic `new Error('Too many requests...')` with no localization.
- [x] **Why it matters.** Aggressive throttle + bare Error class = customer sees a cryptic English toast on legitimate use.
- [x] **Fix steps.**
  1. **Bump budget** to 40 req / 10 s for the global throttle.
  2. **Throw `RateLimitError`** (from `@gustri/core`) instead of `new Error('Too many requests...')`. The mutation cache `onError` already knows how to localize this.
  3. **Optional:** key the throttle by URL path (`new URL(input).pathname`) so a single noisy endpoint doesn't starve the rest. Probably unnecessary if the budget bump is enough.
  4. Add a Sentry breadcrumb every time the throttle fires — visibility into how often we hit the cap in production.
- [x] **Verification.**
  - Initial menu page load → no throttle hit.
  - Manual: fire 50 reqs in a script → throttle kicks in, error is `RateLimitError`, toast localizes.
- [x] **Done when.** Throttle tuned, RateLimitError thrown, breadcrumb added.

---

## P3. Debounce menu search input

- [x] **Where.** [apps/customer-web/src/components/menu/menu-screen.tsx:82-102, 148-153](../apps/customer-web/src/components/menu/menu-screen.tsx#L82-L102)
- [x] **What.** `filteredItems` recomputes on every keystroke via `useMemo`. For a 200-item menu this is fine, but `getLocalizedField` is called twice per item per keystroke. Burns battery and triggers re-renders.
- [x] **Why it matters.** Battery on long restaurant sessions. Perceived smoothness on cheap Android devices.
- [x] **Fix steps.**
  1. Add a `useDebouncedValue(searchQuery, 200)` (small custom hook, ~10 lines) and use the debounced value in the filter.
  2. Keep the input controlled with the raw `searchQuery` so typing feels responsive — only the filter is debounced.
- [x] **Verification.**
  - Type fast in search → input remains responsive; filter updates ~200ms after last keystroke.
- [x] **Done when.** Debounced filter, no regression on UX feel.

---

## P4. Settings / price skeleton during initial load

- [x] **Where.**
  - [apps/customer-web/src/hooks/use-settings.ts:17-66, 80-81](../apps/customer-web/src/hooks/use-settings.ts#L17-L66)
  - Consumers: [providers.tsx:25](../apps/customer-web/src/components/providers.tsx#L25), every screen that reads `settings?.currency_symbol`
- [x] **What.** `placeholderData: DEFAULT_SETTINGS` provides `$` + "Restaurant" + USD until the real fetch resolves. On a slow connection, prices flicker from "$5" to "₺250."
- [x] **Why it matters.** Trust hit. Looks unprofessional. Failure scenario #8.
- [x] **Fix steps.**
  1. **Where currency matters (cart, menu prices, banners):** when `isPlaceholderData === true`, render a price skeleton (`<Skeleton className="h-4 w-12" />`) instead of the placeholder value.
  2. **Where currency doesn't matter (page headers, modal titles):** OK to use placeholder.
  3. Hook variant: `useCafeSettings({ blockOnPlaceholder: true })` returns `undefined` data while placeholder; lets consumers decide.
  4. **Or:** drop the placeholder entirely and render `<LoadingSpinner />` while loading. Simpler but adds visible loading state on every page.
  5. Pick option 1 — surgical, preserves UX, addresses the flicker.
- [x] **Verification.**
  - Throttle network, hard refresh → no `$` → real currency transition; instead, brief skeleton → real currency.
- [x] **Done when.** No currency flicker observable on slow network.

---

## P5. Memoize `getLocalizedField` calls in menu lists

- [x] **Where.** [apps/customer-web/src/components/menu/menu-screen.tsx:85-102](../apps/customer-web/src/components/menu/menu-screen.tsx#L85-L102), [menu-item-card.tsx:31-32](../apps/customer-web/src/components/menu/menu-item-card.tsx#L31-L32)
- [x] **What.** Each render of the menu list calls `getLocalizedField` twice per item. Inexpensive per call, but combined with the search debounce gap it can show up on profilers.
- [x] **Why it matters.** Marginal but real on 200-item menus + cheap phones.
- [x] **Fix steps.**
  1. Compute name+description once per item in a `useMemo` keyed on `language` and the items array, returning `Array<{ item, name, description }>`. Pass the augmented object to `MenuItemCard`.
  2. Alternative: pre-localize at fetch time in `useMenuItems` — but that ties the data layer to the language, which is wrong (language can change without re-fetching).
  3. Pick option 1.
- [x] **Verification.**
  - React DevTools Profiler shows fewer commits per keystroke.
- [x] **Done when.** Profiler shows the saving, no UX regression.

---

## P6. Use `useShallow` / selector for cart store reads

- [x] **Where.** Every component that reads from `useCartStore`. Quick search:
  - [menu-screen.tsx:64](../apps/customer-web/src/components/menu/menu-screen.tsx#L64)
  - [cart-screen.tsx:26](../apps/customer-web/src/components/cart/cart-screen.tsx#L26)
  - [menu-cart-sidebar.tsx:29](../apps/customer-web/src/components/menu/menu-cart-sidebar.tsx#L29)
  - [delivery-cart-screen.tsx:24](../apps/customer-web/src/components/cart/delivery-cart-screen.tsx#L24)
  - [menu-item-card.tsx:25](../apps/customer-web/src/components/menu/menu-item-card.tsx#L25)
  - [menu-item-modal.tsx:26](../apps/customer-web/src/components/menu/menu-item-modal.tsx#L26)
- [x] **What.** `const { items, updateQuantity, ... } = useCartStore()` subscribes to the whole store; every store update re-renders every consumer regardless of what changed.
- [x] **Why it matters.** Adding one item re-renders the entire menu grid. Cheap phones feel it.
- [x] **Fix steps.**
  1. Use selector form: `const items = useCartStore(s => s.items);` per consumer.
  2. For multi-field reads, `import { useShallow } from 'zustand/react/shallow'` and `useCartStore(useShallow(s => ({ items: s.items, getTotal: s.getTotal })))`.
  3. Audit every consumer.
- [x] **Verification.**
  - React DevTools "Highlight updates" — adding an item no longer flashes the entire menu grid.
- [x] **Done when.** Consumers use selector/shallow form, profiler shows scoped re-renders.

---

## P7. Image `priority` conditional on viewport

- [x] **Where.** [apps/customer-web/src/components/menu/menu-item-card.tsx:62](../apps/customer-web/src/components/menu/menu-item-card.tsx#L62)
- [x] **What.** `priority={index < 4}` — sensible on a 2-col grid (first 2 rows above fold), wasteful on a 4-col grid (first row already covers 4 items, only 1 row above fold for `lg:`).
- [x] **Why it matters.** Wasted preloads on desktop / large tablets; on mobile this happens to be correct.
- [x] **Fix steps.**
  1. Cheapest fix: lower the prioritize-count to 2 (covers first row on most viewports).
  2. Smarter: read `window.matchMedia('(min-width: 1024px)')` to pick a count. Skip — over-engineered for the savings.
  3. Pick option 1.
- [x] **Verification.**
  - Lighthouse score unchanged or slightly improved on mobile; desktop preloads reduced.
- [x] **Done when.** Priority count tuned.

---

## P8. Remove the `.split('•').pop()?.trim()` translation parsing

- [x] **Where.** [apps/customer-web/src/components/table/table-landing.tsx:339-347](../apps/customer-web/src/components/table/table-landing.tsx#L339-L347)
- [x] **What.** A translated label is split on a literal bullet character to extract a segment. Fragile across locales — most languages don't include a bullet.
- [x] **Why it matters.** Currently produces an empty string or weird output for most locales (with a fallback to `t('tableLanding.items')`). Already covered as part of Phase 3 M7.
- [x] **Fix steps.**
  1. Removed as part of M7 — restructure the banner to take `count` directly and render via a clean `t('tableLanding.activeOrder', { count, status })` pattern.
  2. If M7 hasn't shipped yet, treat this as a separate cleanup: replace the parse with a direct `t('tableLanding.items', { count })`.
- [x] **Verification.**
  - All 20 locales render the active-order banner cleanly with no fallback strings.
- [x] **Done when.** Parse removed.

---

## P9. Bundle-size guardrail in CI

- [x] **Where.** [apps/customer-web/next.config.js](../apps/customer-web/next.config.js) (already has `@next/bundle-analyzer`)
- [x] **What.** Analyzer is wired but not gated. Regressions ship silently.
- [x] **Why it matters.** customer-web is the surface most sensitive to bundle size (cold-load on a 3G phone). One stray import of `framer-motion` doubles JS payload.
- [x] **Fix steps.**
  1. Add a CI step that runs `ANALYZE=true pnpm --filter customer-web build` and parses the resulting bundle JSON.
  2. Compare against a baseline JSON committed to the repo (`apps/customer-web/.bundle-baseline.json`).
  3. Fail CI if any first-load chunk regresses by >10kB or total first-load > 200kB.
  4. Update the baseline in the same PR that intentionally increases bundle size.
  5. **Alternative:** use `@next/bundle-analyzer` with a CI mode that just fails on a threshold. Or use `size-limit`.
- [x] **Verification.**
  - Add a 50kB dummy import → CI fails.
  - Revert → CI green.
- [x] **Done when.** CI gate active, baseline committed.

---

## 🚀 Release-readiness checklist

Run through every item before tagging the customer-web release. Each box is a
manual or automated gate.

### Mobile testing

- [ ] iPhone SE (4.7") — first paint < 3s on throttled 3G; Place Order visible above iOS URL bar
- [ ] iPhone 14 Pro Max — one-handed test of FAB, cart, modal close
- [ ] Pixel 6a — Android Chrome, soft keyboard interaction with sticky bottom cart bar
- [ ] iPad Mini — landscape menu, no clipped content
- [ ] iOS dynamic type XL — no overlap on cart totals
- [ ] Touch targets audit (DevTools ruler) — every interactive element ≥ 44×44

### Reconnect / realtime testing

- [ ] Background tab for 5 min → return → order status refreshes (Phase 2 H2)
- [ ] Airplane mode mid-order for 30s → restore → state reconciles (Phase 2 H1)
- [ ] Kitchen bulk-edit 10 items → customer screen shows all updates, no flicker (Phase 6 P1)
- [ ] Realtime subscribed=false → banner visible + manual refetch works (Phase 2 H1)
- [ ] Two tabs on same `/table/T01/order` → both update from realtime, no duplicate mutations

### Low-end device testing

- [ ] Throttled 3G + CPU 4x slowdown — first paint < 3s
- [ ] 200-item menu — search debounce smooth (Phase 6 P3)
- [ ] Realtime over throttled connection — no UI lockup

### Translation testing

- [ ] All 20 locales render menu without horizontal overflow
- [ ] AR + FA → `dir="rtl"` correctness; FAB on right; back arrow direction (Phase 5 A2)
- [ ] German `placeOrderLabel` doesn't break the button
- [ ] Plural rules: 1 / 2 / 5 items in RU, AR
- [ ] No hardcoded English strings (CI grep for `>Powered by</span>` etc.)
- [ ] Server sentinels localize in toasts (Phase 4 S5)

### QR workflow testing

- [ ] Scan valid QR → "Browse Menu" CTA visible
- [ ] Scan revoked QR → "Invalid Table" screen
- [ ] Direct-nav `/table/T01` (no `?token=`) → wrapper bound from `useTable`; menu reads work; CTA visible
- [ ] Token rotated mid-session → next mutation fails with "rescan" prompt (Phase 2 H4)
- [ ] Two customers on same table → no cross-order leakage in realtime

### Production resilience

- [ ] Synthetic test: place 50 orders/min with stable client_request_ids → server creates exactly 50 (Phase 1 C1)
- [ ] CSP report-only header in staging for 1 week → no new violations → flip to enforced
- [ ] `NEXT_PUBLIC_API_BASE_URL` validation: unset env → CI build fails (Phase 2 H5)
- [ ] Sentry alert: spike in `set_table_context` non-sentinel errors → page on-call
- [ ] Sentry alert: spike in throttle hits → tune budget

### Privacy / shared-device

- [ ] Place delivery order → reload `/delivery` → form empty (Phase 4 S1)
- [ ] Place delivery order → reload `/delivery` → no `qrToken` (Phase 4 S2)
- [ ] Close + reopen tab on delivery order URL with fragment → tracking works
- [ ] Close + reopen tab on delivery order URL without fragment → "missing token" UI

### Conversion

- [ ] Place order → confirmation surface appears immediately, order number visible (Phase 3 M1)
- [ ] Order-status shows ETA (Phase 3 M6)
- [ ] Active-order banner shows total (Phase 3 M7)
- [ ] Persistent cart icon visible in menu header (Phase 3 M3)

---

## Phase 6 exit gate / release tag

All P-items shipped. Release-readiness checklist fully ticked. Tag
`customer-web@vX.Y.Z`. Monitor Sentry for 7 days post-release for:

- Spike in `set_table_context` errors
- Spike in client-side throttle hits
- New CSP violations
- Mutation cache `onError` rates per endpoint
- Realtime channel error rates

After 7 clean days, close out this entire audit series.
