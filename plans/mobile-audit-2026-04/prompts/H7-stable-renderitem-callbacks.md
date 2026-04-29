# H7 — Stabilize `renderItem` callbacks across hot list rows

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The hot-path list screens use inline `renderItem` and inline per-row `onPress` arrows, so every parent re-render produces new prop identities and breaks `React.memo` on the cards. With 50 active orders, every realtime tick re-renders every card. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H7.

## Implementation steps

1. **Lift handlers to `useCallback` keyed by id**
   - In [apps/mobile/src/screens/orders/OrderDetailScreen.tsx](../../../apps/mobile/src/screens/orders/OrderDetailScreen.tsx) (lines 199–209), replace inline `() => doSomething(item.id)` with `useCallback((id: string) => doSomething(id), [stableDeps])`.
   - Same for [apps/mobile/src/screens/calls/WaiterCallsScreen.tsx](../../../apps/mobile/src/screens/calls/WaiterCallsScreen.tsx) (66–68).
   - Card components accept `onPress: (id: string) => void` and bind the id internally inside their own `useCallback`.

2. **Lift derived state out of memoized cards**
   - In [apps/mobile/src/components/kitchen/KitchenOrderCard.tsx](../../../apps/mobile/src/components/kitchen/KitchenOrderCard.tsx) (41–46), move `activeItems`, `allItemsReady`, `borderColor` to `useMemo` in the *parent* screen (kitchen display) and pass via props.
   - Same audit pass over `OrderCard`, `WaiterCallCard`, `TableCard`, `TaskCard`, `MenuItemManageCard` — derived arrays should be parent-memoized, not card-internal.

3. **Stable `renderItem`**
   - Replace `renderItem={({ item }) => <Card ... />}` with a `useCallback`'d render function that closes only over stable refs. Lift any closures into a memoized handler.

4. **Profiler verification**
   - Use React DevTools Profiler in dev:
     - Trigger a realtime update for a single order.
     - Confirm only the matching card re-renders (it will show "props changed" for that one).
     - Other cards show "Did not render".

5. **Tests**
   - Add a Vitest render-count test for `OrderItemRow` using `@testing-library/react`: render a list of 5 rows, update one item's status, assert only that row re-renders. (Use a render counter in the row.)

## Acceptance criteria

- [ ] No inline `() => fn(item.id)` arrows in `renderItem` for hot-path screens.
- [ ] Cards receive `(id) => void` and bind id internally.
- [ ] Derived state computed once in parent, passed via memoized props.
- [ ] Profiler shows isolated re-renders.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Replacing `FlashList` with another virtualizer.
- Memoization-equality custom `areEqual` (only add if profiler still shows leaky equality).
