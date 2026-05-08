import { type Action, canPerform } from '@gustri/core';
import { useAuthStore } from '@/store/auth-store';

/**
 * Authorization gate for app-side UI controls. Mobile mirror of
 * staff-web's `useCanPerform` — both delegate to `canPerform` in
 * `@gustri/core/permissions` so policy data has one source of truth.
 *
 * Server-side enforcement is the actual security boundary
 * (`verifyAdmin` for `/api/v1/*`, RLS for direct-wrapper writes).
 * This hook only decides whether the UI should *offer* a control.
 *
 * Inline expressions like `staff?.role === 'admin' || staff?.role === 'owner'`
 * are forbidden in new mobile code per CLAUDE.md — add a new `Action`
 * to `@gustri/core/permissions` instead.
 */
export type { Action };

export function useCanPerform(action: Action): boolean {
  const role = useAuthStore((s) => s.staff?.role);
  return canPerform(role, action);
}
