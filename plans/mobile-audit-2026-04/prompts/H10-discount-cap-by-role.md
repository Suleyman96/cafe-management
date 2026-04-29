# H10 — Server-side discount cap by role  `[server-side]`

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. `apps/staff-web/src/app/api/v1/orders/[id]/discount/route.ts` requires only `verifyStaff()`, while refunds require `verifyAdmin()`. A waiter can apply a 99% fixed discount on a 10000 order — economically equivalent to a refund without admin role or audit. Read [plans/mobile-audit-2026-04/02-HIGH.md](../02-HIGH.md) section H10.

## Implementation steps

1. **Per-role cap constants**
   - Add to `packages/core/src/constants.ts`:
     ```ts
     export const DISCOUNT_CAPS_BY_ROLE: Record<UserRole, number> = {
       waiter: 0.10,
       kitchen: 0,
       admin: 1.0,
       owner: 1.0,
     };
     ```
   - Allow per-tenant override via `tenant_settings.max_discount_percent_<role>` columns. Migration-add only if the table exists; otherwise, hardcode for now and document a TODO.

2. **Enforce in `discount-service.ts`**
   - In `apps/staff-web/src/lib/services/discount-service.ts`, before applying the discount:
     - Compute the effective discount fraction (whether `percentage` or `fixed`).
     - Compare against `DISCOUNT_CAPS_BY_ROLE[caller.role]` (with tenant override applied if present).
     - If exceeded, throw a typed `ForbiddenError('discount_cap_exceeded', { cap, requested })` mapped to 403.

3. **Audit log**
   - Any discount > 20% of subtotal writes a `financial_audit_log` row with `{ tenant_id, staff_id, order_id, discount_amount, role, reason }`.

4. **Mobile UI guard**
   - In the discount entry screen (find `apps/mobile/src/screens/orders/DiscountScreen.tsx` or similar), read the current role from `useAuthStore` and disable values above the cap. Show an i18n error if the user attempts to exceed.

5. **Tests**
   - Vitest server: waiter token attempting >10% → 403; admin token at 50% → 200.
   - Vitest: audit log row written for >20% discounts.
   - Mobile component test: waiter sees the disabled state for high-percent inputs.

## Acceptance criteria

- [ ] `DISCOUNT_CAPS_BY_ROLE` exists in `@gustri/core`.
- [ ] `discount-service.ts` enforces caps; UI mirrors them as a courtesy.
- [ ] Audit log entries written for above-threshold discounts.
- [ ] Tests pass; `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Manager override flow with 2FA (future ticket).
- Restructuring `discount-service.ts` beyond the cap.
