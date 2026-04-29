# L2 — `FlashList estimatedItemSize`

## Context

[apps/mobile/src/screens/tables/TablesListScreen.tsx](../../../apps/mobile/src/screens/tables/TablesListScreen.tsx) lines 96–119 omits `estimatedItemSize` on a grid `FlashList`. Causes blank rows during fast scroll and jerky first paint.

## Steps

1. Measure actual card height in dev (e.g., 160 for the table card grid). Add `estimatedItemSize={160}`.
2. Audit other `FlashList` consumers in `apps/mobile/`. Add `estimatedItemSize` everywhere it's missing. Use realistic values per row type.

## Acceptance

- [ ] Every `FlashList` has `estimatedItemSize`.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
