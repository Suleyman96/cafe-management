# M15 — Restrict broad staff-visibility RLS  `[server-side]`

## Context

Repo: `/Users/kamilhajilov/Documents/github/cafe-idare`. The policy `Staff can view all staff` in [supabase/migrations/00000000000000_baseline.sql](../../../supabase/migrations/00000000000000_baseline.sql) (line ~2791) lets any active staff member read every other staff row, including emails, roles, and (if present) salary/scheduling fields. Read [plans/mobile-audit-2026-04/03-MEDIUM.md](../03-MEDIUM.md) section M15.

## Implementation steps

1. **New migration** (do NOT edit the baseline)
   - File: `supabase/migrations/<ts>_restrict_staff_visibility.sql`
   - Drop and recreate:
     ```sql
     DROP POLICY "Staff can view all staff" ON public.staff;
     CREATE POLICY "Staff can view colleagues in tenant" ON public.staff
       FOR SELECT USING (
         is_active_staff()
         AND tenant_id = current_tenant_id()
         AND (current_user_role() IN ('admin','owner') OR id = current_staff_id())
       );
     ```
   - Add a rollback file `supabase/migrations/_rollbacks/<ts>_restrict_staff_visibility.sql`.

2. **Audit consumers**
   - Many UI screens list colleagues for assignment (tasks, schedules). After the policy change, waiters may not see other waiters — confirm whether that's intended.
   - If colleague-listing for assignment is a real product need, add a separate policy that exposes only `(id, name, role)` columns to other waiters via a view or column-level grants.

3. **RLS test suite**
   - In the dedicated RLS test config (per `vitest.rls.config.ts`), add tests:
     - Waiter sees their own row + admin rows; not other waiters.
     - Admin sees all rows in their tenant.
     - No row visible from another tenant.

4. **Regenerate types if needed**
   - `pnpm db:types:generate`. RLS changes alone don't affect types, but the run is cheap.

## Acceptance criteria

- [ ] New migration applies; `pnpm db:reset` succeeds.
- [ ] RLS tests pass.
- [ ] No UI regression for staff-list use cases (manual smoke).
- [ ] `pnpm check`, `pnpm type-check`, `pnpm test` pass.

## Out of scope

- Restructuring the `staff` table.
- Column-level grants (only if step 2 confirms a need).
