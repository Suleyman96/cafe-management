# M1 — Suppress duplicate sound when realtime + push fire for the same event

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The backend can fire both a realtime `INSERT` event and an Expo push for the same order. Both call `playNewOrderSound()` within ~100ms — kitchen hears two overlapping sounds. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M1.

## Implementation steps

1. **Build a small dedup map**
   - New file `apps/mobile/src/lib/event-dedup.ts`:
     - `const recent = new Map<string, number>()` keyed by `event_id` (or `${type}:${orderId}`).
     - `markEvent(id)` writes `Date.now()`.
     - `seenRecently(id, windowMs = 500)` returns true if last mark < window. Cleanup entries older than 5s on every call.

2. **Mark on realtime; check on push**
   - In [apps/mobile/src/hooks/use-orders.ts](../../../apps/mobile/src/hooks/use-orders.ts) (75–96) `onPayload`, call `markEvent(`order:${order.id}`)` before `playNewOrderSound()`.
   - In the foreground notification handler (find in [apps/mobile/src/lib/notifications.ts](../../../apps/mobile/src/lib/notifications.ts) or `App.tsx`), before playing sound, check `seenRecently(`order:${data.orderId}`)`. If recent, skip the sound (still display the banner).
   - Same for waiter calls.

3. **Tests**
   - Vitest: mark + check within 500ms returns true; >500ms returns false.
   - Vitest: cleanup removes old entries.

## Acceptance criteria

- [ ] Realtime + push for the same event play exactly one sound.
- [ ] Banner still shows for the push (user awareness).
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Backend deduplication (separate decision).
