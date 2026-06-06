'use client';

import { PLAN_ORDER } from '@gustri/core';
import { useCanPerform } from '@/hooks/use-can-perform';
import { useCafeSettings } from '@/hooks/use-settings-safe';
import { useTenantPlan } from '@/hooks/use-tenant-plan';
import { type NavGroup, type NavItem, navGroups } from './nav-config';

/**
 * Computes the nav groups (and their items) visible to the current user.
 *
 * Visibility policy is routed through the permissions/plan hooks rather than
 * inline role checks — see CLAUDE.md "Authorization vs connectivity gates".
 * Returns the filtered groups (empty groups removed) so the render path stays
 * presentational.
 */
export function useVisibleNavItems(): NavGroup[] {
  const { data: cafeSettings } = useCafeSettings();
  const { plan: tenantPlan } = useTenantPlan();

  // Sidebar uses `manage_staff` as a stand-in for "admin tier UI" — both
  // admin and owner pass this check, matching the prior `role === 'admin'
  // || isOwner` semantics. Inline role expressions are banned in new code;
  // see CLAUDE.md "Authorization vs connectivity gates".
  const isAdmin = useCanPerform('manage_staff');
  // `view_reports` gates the owner-only Reports entry (the sole `ownerOnly`
  // nav item). Routed through the permissions policy rather than an inline
  // `role === 'owner'` check for the same reason as `isAdmin` above.
  const canViewReports = useCanPerform('view_reports');

  const filterItems = (items: NavItem[]) =>
    items.filter((item) => {
      if (item.ownerOnly && !canViewReports) return false;
      if (item.adminOnly && !isAdmin) return false;
      // Plan unknown (post-login fetch pending or failed) → hide gated
      // items rather than coercing to 'free'. The gated entry will appear
      // once the plan resolves; this is preferable to surfacing a link the
      // user can't actually reach (or — worse — hiding entries they paid
      // for if the fetch failed transiently).
      if (item.minPlan) {
        if (!tenantPlan) return false;
        if (PLAN_ORDER[tenantPlan] < PLAN_ORDER[item.minPlan]) return false;
      }
      if (item.href === '/waste' && !cafeSettings?.waste_tracking_enabled) return false;
      return true;
    });

  // Build visible groups with filtered items
  return navGroups
    .filter((group) => {
      if (group.adminOnly && !isAdmin) return false;
      return true;
    })
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);
}
