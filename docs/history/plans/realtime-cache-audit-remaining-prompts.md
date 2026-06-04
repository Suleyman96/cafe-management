# Remaining audit follow-ups — agent prompts

These prompts are self-contained. They assume the agent has read access to the
full repo but has NOT seen the audit conversation that produced this list.
Treat each as a separate session.

Background that applies to all three: a multi-agent realtime + cache integrity
audit produced a list of findings. Six of them were fixed this week (PRs: detail
invalidation, multi-tab channel collision, NotificationProvider JWT rebind,
discount audit unique index, stock atomic delta, order status state-machine
trigger). These three are the leftovers and each needs its own focused decision
or design pass.

---

## #4 — Refund pre-check: drop or atomicize

**Goal.** Decide and ship the right shape for the service-side refund balance
check.

**Context.**
- File: [`apps/staff-web/src/lib/services/refund-service.ts`](../apps/staff-web/src/lib/services/refund-service.ts).
- The service reads `total_paid` (sum of `order_payments.amount`) and
  `total_refunded` (sum of `refunds.amount`) in two separate un-locked SELECTs,
  then compares the available balance against the requested amount before
  inserting the refund row.
- Under READ COMMITTED, a concurrent payment between the two reads can
  invalidate the comparison. The service believes balance X is available; by
  the time the INSERT lands, the real balance is < X.
- The DB trigger `validate_refund_amount` (see migration
  [`supabase/migrations/20260503000003_atomic_payment_refund_locking.sql`](../supabase/migrations/20260503000003_atomic_payment_refund_locking.sql))
  takes a row-level lock on the order and rechecks `paid - refunded ≥ amount`
  before the INSERT commits. The trigger is the authority — the data invariant
  is safe.
- The user-visible cost: when the trigger rejects the INSERT, the service
  surfaces a 5xx-shaped error rather than the friendly 400/409 the pre-check
  was meant to produce. Under load this happens more often than expected.

**The decision.** Pick one of two paths and ship it. Don't ship both.

1. **Drop the pre-check.** Delete the two SELECTs and the comparison.
   Document in a header comment that the trigger is the sole authority and
   that the friendly-error UX has been traded for code simplicity. Update
   `handle-route-error.ts` (or whatever maps `check_violation` from the
   trigger) to surface a typed `ConflictError` so the route returns 409 with
   a stable error code instead of a 500.

2. **Atomicize via RPC.** Move the entire flow (read paid + read refunded +
   insert refund) into a SECURITY DEFINER plpgsql function that holds
   `SELECT … FOR UPDATE` on the order row across all three operations. Same
   pattern as `cancel_order_item_qty` (migration
   [`supabase/migrations/20260503000007_cancel_order_item_rpc.sql`](../supabase/migrations/20260503000007_cancel_order_item_rpc.sql))
   and `adjust_stock_atomic` (migration
   [`supabase/migrations/20260504000003_atomic_stock_adjust.sql`](../supabase/migrations/20260504000003_atomic_stock_adjust.sql)).
   Refund-service then calls the RPC; the in-flight balance check is now
   serialized with concurrent payments and refunds.

**Pick the right one. Heuristic.**
- If the friendly-error UX is load-bearing for staff (they need to see the
  exact paid/refunded numbers in the rejection toast), do option 2.
- If the rejection is rare and the staff just need "refund failed, try again"
  semantics, do option 1.
- Default to option 1 unless the product team explicitly disagrees.

**Constraints.**
- Do NOT change the wire format of the refund response. Existing mobile +
  staff-web callers must keep working.
- Do NOT skip the existing AFTER INSERT trigger that writes the
  `financial_audit_log` row (migration
  [`20260503000004_audit_refund_inserts.sql`](../supabase/migrations/20260503000004_audit_refund_inserts.sql)).
- If choosing option 2: the Supabase CLI's migration splitter rejects
  multi-statement files containing dollar-quoted function bodies. Put the
  function in one migration and the GRANT/REVOKE in a paired follow-up. See
  the four-file split for `adjust_stock_atomic`
  ([`20260504000003`–`20260504000006`](../supabase/migrations/)) for the
  pattern.
- service_role-only grant. REVOKE EXECUTE FROM authenticated, anon (Supabase's
  `pg_default_acl` issues those automatically). Use a `DO $$ … $$;` block
  for grouped REVOKEs — that's one statement and the splitter handles it.

**Tests.**
- Unit tests for the service in
  `apps/staff-web/src/__tests__/services/refund-service.test.ts` (create if
  it doesn't exist, mirror `discount-service.test.ts`'s queued-response mock
  pattern).
- For option 2, add an RLS integration test in
  `packages/api-client/src/__tests__/rls/` that fires two concurrent refunds
  against the same order and asserts (a) total refunded never exceeds total
  paid, (b) one refund succeeds and one fails with a 409-shaped error.

**Definition of done.**
- pnpm --filter staff-web test green.
- pnpm --filter staff-web type-check clean.
- pnpm check clean.
- For option 2: pnpm db:types:check green after `pnpm db:types:generate`.
- For option 2: the new RPC is callable from the route via
  `supabaseAdmin.rpc(...)` and the existing route handler returns the same
  shape it did before.

---

## #7 — Realtime cache version-aware writes

**Status: do NOT implement reflexively.** This finding has been re-evaluated
and is not actionable in the current architecture. The right "fix" is a
documentation-only ADR explaining why no code is needed, plus a guard test
that prevents future drift.

**Why it's not a bug today.**
- The realtime hook
  [`apps/staff-web/src/hooks/use-realtime-sync.ts`](../apps/staff-web/src/hooks/use-realtime-sync.ts)
  responds to `postgres_changes` events by calling `invalidateQueries` only.
  It never writes payload contents to cache via `setQueryData`. Refetches
  always pull ground truth from the server.
- TanStack Query 5 dedupes parallel fetches per query key. If a debounced
  invalidation triggers a refetch while another is in flight, both share the
  same promise.
- The race the audit imagined requires either Postgres read-replica lag (this
  codebase uses one Postgres instance via Supabase) or a server-side caching
  layer (none).

**What this prompt is for.** Write a short ADR
(`docs/adr/0001-realtime-cache-version-strategy.md` or similar — check
`docs/` for existing ADR pattern, create the directory if it doesn't exist)
that records:

1. The decision: realtime invalidation is pure `invalidateQueries` — no
   `setQueryData` from realtime payloads. Refetches are the source of truth.
2. The conditions under which this would change: read replicas with lag,
   server-side response caches, or a measurable performance need to elide
   refetches by trusting payload contents.
3. The minimum-bar fix if any of those conditions appear: a small
   `mergeIfNewer(prev, next)` helper that compares `updated_at`. Reference
   it in the ADR but don't implement it speculatively.

Then add a guard test in
`apps/staff-web/src/__tests__/hooks/use-realtime-sync.test.ts` that asserts
the hook never calls `queryClient.setQueryData` from a postgres_changes
handler. The test should grep the hook's source for `setQueryData` (use
`fs.readFileSync` in the test itself if needed) and fail if anyone adds one.
A failing test will force the next person to either consciously change the
strategy and update the ADR, or use `invalidateQueries` and stay consistent.

**Definition of done.**
- ADR file exists, reviewed by another engineer.
- Guard test exists, passes today, would fail if someone introduced
  `setQueryData` into the realtime path.
- pnpm --filter staff-web test green.

**Anti-goal.** Do NOT add a `mergeIfNewer` helper to the codebase as part of
this prompt. Helpers without callers rot. The ADR documents when to add it;
adding it speculatively is the mistake this prompt explicitly avoids.

---

## #9 — Customer-web cross-tenant realtime defense-in-depth

**Status: low-priority. Pure defense-in-depth.** Practically there is no
cross-tenant leak today because `table_id` and order `id` are UUIDs (globally
unique) and the customer-web subscriptions filter on those. The concern is
that a future maintainer might filter realtime on a non-unique column (status,
priority, etc.) without thinking about tenant scope, and reintroduce a
presence-leak surface.

**Files.**
- [`apps/customer-web/src/hooks/use-order.ts`](../apps/customer-web/src/hooks/use-order.ts)
- [`apps/customer-web/src/hooks/use-delivery.ts`](../apps/customer-web/src/hooks/use-delivery.ts)
- [`apps/customer-web/src/lib/supabase.ts`](../apps/customer-web/src/lib/supabase.ts)
  — `setTableContext(qrToken)` already resolves and binds `tenant_id` to the
  wrapper. That's where the tenant is known.

**Constraint that was discovered mid-audit.** Supabase Realtime's
`postgres_changes` filter takes ONE column predicate per `.on()` call. There
is no `table_id=X AND tenant_id=Y` syntax. So the choice is:

1. Subscribe to `table_id=eq.X` only (current state — safe by UUID uniqueness).
2. Subscribe to `tenant_id=eq.Y` only (broader, more event noise but
   tenant-scoped at the broadcast layer).
3. Migrate to Supabase Realtime "private" channels (post-2024 feature). Channel
   subscriptions are gated by RLS-on-broadcast at the channel level. The
   client subscribes to `private:tenant:Y` and receives only events the JWT
   policy permits.

**The decision.** Pick one based on tradeoffs:

- Option 1 (status quo): zero work, zero risk *today*, fragile to future
  changes that use non-UUID filters.
- Option 2: change the filter to `tenant_id=eq.${tenantId}` and filter
  client-side by the original `table_id` / `id`. More events over the wire
  per customer (the whole tenant's order traffic), but tenant-scoped at the
  source. May exceed Supabase Realtime's `eventsPerSecond` budget on busy
  tenants.
- Option 3 (correct long-term): private channels. Requires JWT-or-service-role
  authorization for the channel. Customer-web uses the anon JWT; it would
  need a short-lived signed JWT keyed to the QR session. Substantial change.

**Recommended path.** Default to **option 1 + lint guard**. Add a CI check
(eslint-disable-style comment requirement, or a custom Biome lint rule) that
flags any `supabase.channel(...).on('postgres_changes', { filter: ... })`
call where the filter doesn't include either `id=eq.` or `tenant_id=eq.`.
That makes the safe-by-UUID assumption explicit and load-bearing.

If the product team wants real isolation guarantees (e.g. for compliance
posture), pick **option 3**. That's a bigger PR — write a follow-up plan
covering: a new `set_customer_session_jwt` RPC that mints a tenant-scoped
short-lived JWT against the qr_token, the channel-rename to
`private:order:${orderId}`, and the broadcast-RLS policies on the
`realtime.messages` table.

**Definition of done.**
- Either: a Biome rule (or a precommit script) that fails on a
  `postgres_changes` filter without an `id=eq` or `tenant_id=eq` predicate,
  PLUS a one-paragraph note in customer-web's README explaining the safe-by-
  UUID assumption.
- Or: a complete option-3 migration plan checked in under
  `plans/customer-web-private-realtime-channels.md`, NOT implemented in this
  pass.

**Anti-goal.** Do NOT silently widen the filter to `tenant_id=eq.Y` without
measuring the per-tenant event rate against the
[`apps/customer-web/src/lib/supabase.ts`](../apps/customer-web/src/lib/supabase.ts)
realtime config (`eventsPerSecond: 10`). On a busy tenant that throttle will
drop legitimate events.
