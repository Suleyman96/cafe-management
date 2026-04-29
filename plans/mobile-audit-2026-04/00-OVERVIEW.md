# Mobile Staff App Audit — Implementation Plan

**Date:** 2026-04-28
**Scope:** `apps/mobile` (Expo 54 / RN 0.81 / React 19) and shared package consumption
**Threat model:** Compromised staff accounts, unstable cafe Wi-Fi, low-end Android, busy service hours

## Files in this directory

| File | Purpose |
|---|---|
| `01-CRITICAL.md` | Issues that can leak data across tenants, duplicate financial writes, or leave the persisted cache readable on a stolen device. Must ship before next staff release. |
| `02-HIGH.md` | Operational reliability — realtime gaps, lock bypass, mutation registry drift, render hotspots that break a 12h shift. |
| `03-MEDIUM.md` | Correctness, UX, and resilience improvements that aren't user-visible failures yet but mask behind well-built scaffolding. |
| `04-LOW.md` | Cleanup, polish, and anti-drift guardrails. |

## How to use these plans

- Each finding has: **ID**, **Where**, **Failure scenario**, **Fix steps**, **Acceptance criteria**, **Test plan**, **Estimate**.
- Tickets are sized for one developer-day or less unless flagged.
- IDs (`C1`, `H1`, …) match the audit report so PR titles can reference them directly.
- Items I could not verify from mobile-only code are flagged `[needs-server-confirm]` — those have a server-side step and a client-side step.

## Suggested rollout order

1. **Sprint 1 (security freeze):** C1 → C2 → C3 → C4. Block any new feature work until merged.
2. **Sprint 2 (reliability):** C5, H1, H2, H3, H4.
3. **Sprint 3 (perf + UX):** H5–H10, then medium batch.
4. **Backlog:** low items folded into general cleanup PRs.

## Cross-cutting work

Several fixes share infrastructure — do these once, reference from individual tickets:

- **Idempotency-key middleware** (used by C1, C2): generate UUID at first mutation attempt, persist with the mutation, send in payload. Server adds unique index `(tenant_id, client_request_id)`.
- **Tenant-stamped persistence** (C2, C3): persist `{tenantId, staffId}` alongside cache and paused mutations; gate hydration on match.
- **Encrypted MMKV bootstrap** (C3): single Keychain/Keystore-backed key shared by query persister, future stores.
- **`@gustri/queries` mutation key registry** (H4): single exported list; mobile registers from it; boot throws if any default is missing.
