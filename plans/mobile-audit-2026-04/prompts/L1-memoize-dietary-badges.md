# L1 — Memoize `MenuItemManageCard.dietaryBadges`

## Context

[apps/mobile/src/components/menu-management/MenuItemManageCard.tsx](../../../apps/mobile/src/components/menu-management/MenuItemManageCard.tsx) lines 47–49 builds `dietaryBadges` via `.filter()` on every render. The card is `React.memo`'d, but the array's identity is new each render → memo equality fails when parent re-renders.

## Steps

1. Wrap the filter in `useMemo([item.dietary_flags])`.
2. Confirm the card's memo comparison still works (no behavior change for prop equality).

## Acceptance

- [ ] Single filter computation per `dietary_flags` change.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
