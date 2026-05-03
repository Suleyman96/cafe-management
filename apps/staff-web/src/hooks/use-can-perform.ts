import { useAuthStore } from '@/store/auth-store';

/**
 * Authorization gate for app-side UI controls.
 *
 * Source-of-truth role checks happen on the server (`verifyAdmin` in
 * `/api/v1/*` routes, RLS for direct-wrapper writes). This hook only
 * decides whether the UI should *offer* the control — hiding admin
 * buttons from non-admin staff so they don't get a confusing 403.
 *
 * If a check is missing from `Action`, prefer adding a new entry over
 * inlining `staff?.role === 'admin' || staff?.role === 'owner'` —
 * spreading the role expression across the codebase makes it harder to
 * tighten the policy in one place when product/legal asks.
 */
export type Action =
  | 'edit_menu'
  | 'apply_discount'
  | 'issue_refund'
  | 'assign_waiter'
  | 'edit_settings'
  | 'manage_staff'
  | 'manage_tables'
  | 'manage_tasks'
  | 'manage_stock'
  | 'manage_expenses';

const ADMIN_ONLY: ReadonlySet<Action> = new Set([
  'edit_menu',
  'apply_discount',
  'issue_refund',
  'assign_waiter',
  'edit_settings',
  'manage_staff',
  'manage_tables',
  'manage_stock',
  'manage_expenses',
]);

export function useCanPerform(action: Action): boolean {
  const role = useAuthStore((s) => s.staff?.role);
  if (!role) return false;
  if (ADMIN_ONLY.has(action)) return role === 'admin' || role === 'owner';
  return true;
}
