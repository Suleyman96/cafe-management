import type { UserRole } from '@gustri/database';

/**
 * UI authorization policy. Single source of truth for which roles can
 * perform which actions in the *client* — used by `useCanPerform` in
 * staff-web and mobile to decide whether to *offer* a control.
 *
 * Server-side enforcement is independent: `verifyAdmin` in `/api/v1/*`
 * routes and RLS for direct-wrapper writes. This file does NOT replace
 * those — a missing entry here does not weaken security, it just leaks
 * a button that produces a 403.
 *
 * Adding a new gate: pick the existing role-set that matches, or add a
 * new one. Never inline `role === 'admin' || role === 'owner'` at the
 * call site — that's exactly the grep-and-pray pattern this module
 * exists to prevent.
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
  | 'manage_expenses'
  | 'mark_item_ready'
  | 'grant_owner_role';

const ADMIN_OR_OWNER: ReadonlySet<UserRole> = new Set(['admin', 'owner']);
const KITCHEN_ADMIN_OR_OWNER: ReadonlySet<UserRole> = new Set(['kitchen', 'admin', 'owner']);
const OWNER_ONLY: ReadonlySet<UserRole> = new Set(['owner']);

const ACTION_ALLOWED_ROLES: Record<Action, ReadonlySet<UserRole>> = {
  edit_menu: ADMIN_OR_OWNER,
  apply_discount: ADMIN_OR_OWNER,
  issue_refund: ADMIN_OR_OWNER,
  assign_waiter: ADMIN_OR_OWNER,
  edit_settings: ADMIN_OR_OWNER,
  manage_staff: ADMIN_OR_OWNER,
  manage_tables: ADMIN_OR_OWNER,
  manage_tasks: ADMIN_OR_OWNER,
  manage_stock: ADMIN_OR_OWNER,
  manage_expenses: ADMIN_OR_OWNER,
  mark_item_ready: KITCHEN_ADMIN_OR_OWNER,
  grant_owner_role: OWNER_ONLY,
};

export function canPerform(role: UserRole | null | undefined, action: Action): boolean {
  if (!role) return false;
  return ACTION_ALLOWED_ROLES[action].has(role);
}
