# L10 — Export `OFFLINE_SYNC_WINDOW_MS`

## Context

[apps/mobile/src/lib/query-client.ts](../../../apps/mobile/src/lib/query-client.ts) line 29 hardcodes 60_000 ms for the offline-sync detection window. No shared constant.

## Steps

1. Add `OFFLINE_SYNC_WINDOW_MS = 60_000` to `packages/core/src/constants.ts`.
2. Update mobile to import it.
3. Document in JSDoc: "How long after going offline a recently-failed mutation is treated as 'queued for retry' rather than a hard failure."

## Acceptance

- [ ] Constant shared; mobile imports it.
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.
