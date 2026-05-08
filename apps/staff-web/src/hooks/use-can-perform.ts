import { type Action, canPerform } from '@gustri/core';
import { useAuthStore } from '@/store/auth-store';

/**
 * Authorization gate for app-side UI controls.
 *
 * Source-of-truth role checks happen on the server (`verifyAdmin` in
 * `/api/v1/*` routes, RLS for direct-wrapper writes). This hook only
 * decides whether the UI should *offer* the control — hiding admin
 * buttons from non-admin staff so they don't get a confusing 403.
 *
 * Policy data lives in `@gustri/core/permissions` so mobile and web
 * share one source of truth. Add new gates there, not here.
 */
export type { Action };

export function useCanPerform(action: Action): boolean {
  const role = useAuthStore((s) => s.staff?.role);
  return canPerform(role, action);
}
