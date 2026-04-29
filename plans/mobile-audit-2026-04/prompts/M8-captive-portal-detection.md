# M8 — Captive-portal-aware online detection

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. [online-state.ts](../../../apps/mobile/src/lib/online-state.ts) lines 32–34 trusts NetInfo's `isConnected`. On hotel/cafe captive-portal Wi-Fi, NetInfo says online but no internet is reachable — mutations fire and fail instead of queuing. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M8.

## Implementation steps

1. **Reachability check**
   - On every NetInfo `isConnected: true` event, perform a 2s `HEAD https://<api-base>/health` (or any cheap, always-200 endpoint). Cache the result for 30s keyed by network identity (NetInfo `details.ipAddress` if available).
   - Only flip `online = true` after the HEAD succeeds. On failure, keep `online = false` and mark a `captivePortal: true` flag.

2. **Banner**
   - Update `OfflineBanner.tsx` to show a different message when `captivePortal: true`: "Connected to Wi-Fi but no internet — changes will sync when reachable." i18n keys: `online.captive_portal`. Locales: `en`, `az`, `ru`, `tr`.

3. **Tests**
   - Vitest: mock NetInfo `connected: true` + HEAD failure → `onlineManager.isOnline()` returns false; `captivePortal` is true.
   - Vitest: HEAD success → online flips true; `captivePortal` false.

## Acceptance criteria

- [ ] HEAD reachability gate added.
- [ ] Banner message differs for captive-portal vs offline.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Auto-opening the captive-portal login (OS handles).
