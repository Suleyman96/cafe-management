# 🟢 Low fixes — Mobile

Polish, anti-drift guardrails, and small wins. Group these into a single cleanup PR if convenient.

---

## L1 — Memoize `MenuItemManageCard.dietaryBadges`

**Where:** [apps/mobile/src/components/menu-management/MenuItemManageCard.tsx](../../apps/mobile/src/components/menu-management/MenuItemManageCard.tsx) (47–49)

**Fix:** Wrap `.filter()` in `useMemo([item.dietary_flags])`.

**Estimate:** 0.1 day

---

## L2 — `FlashList estimatedItemSize` on `TablesListScreen`

**Where:** [apps/mobile/src/screens/tables/TablesListScreen.tsx](../../apps/mobile/src/screens/tables/TablesListScreen.tsx) (96–119)

**Fix:** Add `estimatedItemSize={160}` (measure actual card height in dev). Apply same audit to other `FlashList` consumers.

**Estimate:** 0.1 day

---

## L3 — `keepPreviousData` on tab/filter swaps

**Where:** [apps/mobile/src/screens/feedback/FeedbackListScreen.tsx](../../apps/mobile/src/screens/feedback/FeedbackListScreen.tsx) (59–68)

**Fix:** Pass `placeholderData: keepPreviousData` (TanStack Query v5 syntax) to the relevant `useQuery`.

**Estimate:** 0.1 day

---

## L4 — Debounce `updatePushToken` calls

**Where:** [apps/mobile/src/hooks/use-push-token-sync.ts](../../apps/mobile/src/hooks/use-push-token-sync.ts) (46–54)

**Fix:** Skip sync if `Date.now() - lastSyncedAt < 60_000`. Already partially deduped by token-equality cache; this adds a time floor for the AppState-active hot path.

**Estimate:** 0.1 day

---

## L5 — Split `apps/mobile/src/hooks/index.ts` barrel

**Where:** [apps/mobile/src/hooks/index.ts](../../apps/mobile/src/hooks/index.ts)

**Fix:** Two barrels:
- `apps/mobile/src/hooks/shared.ts` — re-exports from `@gustri/queries`
- `apps/mobile/src/hooks/local.ts` — mobile-only hooks

Update imports. Add a JSDoc on each exported symbol indicating origin.

**Estimate:** 0.5 day

---

## L6 — Move `CACHE_BUSTER` to a shared constant

**Where:** [apps/mobile/src/lib/query-persister.ts](../../apps/mobile/src/lib/query-persister.ts) (55–57)

**Fix:** Export `CACHE_SCHEMA_VERSION` from `@gustri/core/constants.ts`. Mobile composes its `CACHE_BUSTER` as `${CACHE_SCHEMA_VERSION}-${appVersion}`. Future web persistence can reuse the schema version.

**Estimate:** 0.1 day

---

## L7 — Move `NumberInput` DOM types out of `@gustri/ui`

**Where:** [packages/ui/src/number-input.tsx](../../packages/ui/src/number-input.tsx) (39, 111)

**Fix:** Either:
- (a) Move `number-input.tsx` to `packages/ui-web/` (new web-only package).
- (b) Behind a `react-native` field in `package.json` `exports`, alias to a stub that throws at import time.

Add a Biome `noRestrictedImports` override under `packages/ui/biome.json` banning `HTMLElement` types and direct `document`/`window` references for files not under `packages/ui/src/web-only/`.

**Estimate:** 0.5 day

---

## L8 — Document realtime polling intervals as platform-aware

**Where:** [packages/core/src/constants.ts](../../packages/core/src/constants.ts) (65–71)

**Fix:** Add a JSDoc on `REFRESH_INTERVALS` describing the contract: web tabs use these directly, mobile may halve them when backgrounded; do not raise without checking battery impact.

**Estimate:** 0.1 day

---

## L9 — Pin `react-i18next` major

**Where:** [packages/i18n/package.json](../../packages/i18n/package.json) (26)

**Fix:** Replace `^15.4.1` with `~15.4.0` (or whatever is current) until the React 18/19 dual-target story is verified for the next major. Add a CI smoke test that resolves the dependency tree under both apps.

**Estimate:** 0.1 day

---

## L10 — Document the offline-sync window as a shared constant

**Where:** [apps/mobile/src/lib/query-client.ts](../../apps/mobile/src/lib/query-client.ts) (29)

**Fix:** Export `OFFLINE_SYNC_WINDOW_MS = 60_000` from `@gustri/core/constants.ts`. Reference it in mobile and document for future web offline parity.

**Estimate:** 0.1 day

---

## L11 — Mobile `useTables` enabled guard parity for shared hooks

**Where:** [packages/queries/src/hooks/use-tables.ts](../../packages/queries/src/hooks/use-tables.ts), [apps/mobile/src/hooks/use-tables.ts](../../apps/mobile/src/hooks/use-tables.ts) (23)

**Fix:** Shared hook accepts `enabled?: boolean` (default `true`); mobile passes `!!tenantId`. Document that all tenant-scoped shared hooks expose this option; consumers wire it to their auth state.

**Estimate:** 0.25 day
