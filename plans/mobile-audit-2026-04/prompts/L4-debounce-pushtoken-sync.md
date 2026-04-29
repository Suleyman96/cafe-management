# L4 — Debounce `updatePushToken` calls

## Context

[apps/mobile/src/hooks/use-push-token-sync.ts](../../../apps/mobile/src/hooks/use-push-token-sync.ts) lines 46–54 calls the sync on every AppState `active`. Already deduped by token equality, but lacks a time floor.

## Steps

1. Persist `lastSyncedAt` in module-local state (or MMKV under `gustri.push-token-last-sync`). On each call, skip if `Date.now() - lastSyncedAt < 60_000`.
2. Reset on logout via `clearPushTokenSyncCache`.

## Acceptance

- [ ] At most one sync per 60s under normal usage.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
