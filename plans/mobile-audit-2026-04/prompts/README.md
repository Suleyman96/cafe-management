# Implementation prompts

One prompt per audit finding. Each prompt is self-contained — paste it into a fresh Claude Code session in the repo root and it has everything needed to implement the fix.

## Conventions used in every prompt

- Repo root: `/Users/kamilhajilov/Documents/github/cafe-idare`
- Stack: Turborepo monorepo, pnpm 9.15, Biome 2.4 (no ESLint/Prettier), Vitest 4, Playwright 1.58, Supabase, RN 0.81 / Expo 54 / React 19
- Run `pnpm check:fix` before committing; `pnpm test` before declaring done
- Schema changes: write a new migration (never edit merged ones); regenerate types with `pnpm db:types:generate`
- Each prompt ends with explicit Acceptance Criteria the agent must self-verify before reporting done

## Order

| ID | File | Title |
|---|---|---|
| C1 | `C1-idempotency-keys.md` | Idempotency keys for all mutating endpoints |
| C2 | `C2-tenant-stamped-mutations.md` | Tenant-stamped paused mutations |
| C3 | `C3-encrypted-mmkv.md` | Encrypted MMKV + clean unmount on logout |
| C4 | `C4-push-token-revocation.md` | Blocking push token revocation + uniqueness |
| C5 | `C5-server-plan-enforcement.md` | Server-side plan enforcement |
| H1 | `H1-realtime-degraded-fallback.md` | Aggressive fallback when realtime is degraded |
| H2 | `H2-appstate-health-check.md` | Post-resume realtime health check |
| H3 | `H3-inactivity-lock-hardening.md` | Inactivity lock survives OS-lock + force-quit |
| H4 | `H4-mutation-key-registry.md` | Centralize mutation-key registry |
| H5 | `H5-validate-before-mutationfn.md` | Validate before `mutationFn` |
| H6 | `H6-pendingsync-badge-scope.md` | Scope `PendingSyncBadge` predicate |
| H7 | `H7-stable-renderitem-callbacks.md` | Stabilize `renderItem` callbacks |
| H8 | `H8-global-now-ticker.md` | Single global `useNow` ticker |
| H9 | `H9-jwt-tenant-claim-verify.md` | Re-verify JWT tenant claim |
| H10 | `H10-discount-cap-by-role.md` | Server-side discount cap by role |
| M1 | `M1-realtime-push-sound-dedup.md` | Suppress duplicate sound (realtime + push) |
| M2 | `M2-debounce-sound-playback.md` | Debounce/serialize order sound |
| M3 | `M3-single-tenantplan-fetch.md` | Single `tenantPlan` fetch path |
| M4 | `M4-zustand-selectors.md` | Convert whole-store subscribers to selectors |
| M5 | `M5-persist-auth-store.md` | Persist `useAuthStore` |
| M6 | `M6-scoped-invalidation.md` | Scope `invalidateOrdersAndTables` |
| M7 | `M7-pending-intent-queue.md` | `pending-intent-store` queues |
| M8 | `M8-captive-portal-detection.md` | Captive-portal-aware online detection |
| M9 | `M9-sentry-body-redaction.md` | Sentry breadcrumb body redaction |
| M10 | `M10-deeplink-tenant-validation.md` | Tenant-validate deep-link payloads |
| M11 | `M11-memoize-category-counts.md` | Memoize `MenuManagementScreen` counts |
| M12 | `M12-tasks-server-side-filter.md` | Tasks: server-side filter |
| M13 | `M13-reports-collapse-memos.md` | `ReportsScreen` collapse memos |
| M14 | `M14-push-permission-timeout.md` | Push permission with timeout |
| M15 | `M15-rls-staff-visibility.md` | Restrict broad staff-visibility RLS |
| L1 | `L1-memoize-dietary-badges.md` | Memoize `MenuItemManageCard.dietaryBadges` |
| L2 | `L2-flashlist-estimated-size.md` | `FlashList estimatedItemSize` |
| L3 | `L3-keepprevious-on-tabs.md` | `keepPreviousData` on tab swaps |
| L4 | `L4-debounce-pushtoken-sync.md` | Debounce `updatePushToken` |
| L5 | `L5-split-hooks-barrel.md` | Split `apps/mobile/src/hooks/index.ts` |
| L6 | `L6-shared-cache-version.md` | Shared `CACHE_SCHEMA_VERSION` |
| L7 | `L7-numberinput-dom-leak.md` | Move NumberInput DOM types out of `@gustri/ui` |
| L8 | `L8-document-refresh-intervals.md` | Document `REFRESH_INTERVALS` platform contract |
| L9 | `L9-pin-react-i18next.md` | Pin `react-i18next` major |
| L10 | `L10-shared-offline-sync-window.md` | Export `OFFLINE_SYNC_WINDOW_MS` |
| L11 | `L11-shared-enabled-guard.md` | Shared hooks accept `enabled` |

## How to use

```
# In a fresh Claude Code session at the repo root:
cat plans/mobile-audit-2026-04/prompts/C1-idempotency-keys.md
# Paste content into the chat. Or:
claude < plans/mobile-audit-2026-04/prompts/C1-idempotency-keys.md
```

Each prompt assumes the agent has full read/write access to the repo and may run `pnpm` and `git`.
