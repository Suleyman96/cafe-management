'use client';

import { useTranslation } from '@gustri/i18n';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useMenuItems } from '@/hooks/use-menu';
import { useCartStore } from '@/store/cart-store';

/**
 * H3 — drop cart items that no longer exist or are unavailable in the
 * live menu, and surface a single toast so the customer knows.
 *
 * Cart hydration restores items from localStorage by `menu_item_id`,
 * including a snapshot of the menu item. Without this sync, a stale
 * cart (item disabled by staff, deleted, or moved off-tenant) would
 * pass client-side validation and surface as a generic "Something went
 * wrong" on submit because the server `is_available` / RLS check
 * rejects it without identifying which item is the problem.
 *
 * Triggered once per menu-data settle: when `useMenuItems` resolves
 * with `data`, we cross-check each cart item against the live id set
 * and call `removeItem` for every miss. The toast carries the count
 * of dropped items so the customer sees one notification instead of N.
 *
 * Mount this hook from screens that gate the place-order flow — the
 * menu screen and both cart screens. Each mount re-runs the audit on
 * the latest menu snapshot, so a staff-side toggle while the customer
 * is in the cart still prunes promptly.
 */
export function useCartMenuSync() {
  const { t } = useTranslation('customer');
  const { data: menuItems, isSuccess } = useMenuItems();
  const items = useCartStore((s) => s.items);
  const removeItem = useCartStore((s) => s.removeItem);
  // Coalesce repeat audits on the same menu snapshot so a parent
  // re-render doesn't fire the toast twice. The key bumps when the
  // menu data settles to a fresh array reference (TanStack Query
  // structural sharing — same ids → same ref → no re-audit).
  const lastAuditedMenuRef = useRef<unknown>(null);

  useEffect(() => {
    if (!isSuccess || !menuItems) return;
    if (lastAuditedMenuRef.current === menuItems && items.length === 0) return;
    if (items.length === 0) {
      lastAuditedMenuRef.current = menuItems;
      return;
    }

    const liveIds = new Set(menuItems.map((mi) => mi.id));
    const stale = items.filter((item) => !liveIds.has(item.menuItem.id));

    if (stale.length > 0) {
      for (const item of stale) {
        removeItem(item.menuItem.id);
      }
      toast.warning(t('cart.staleItemsRemoved', { count: stale.length }));
    }

    lastAuditedMenuRef.current = menuItems;
  }, [isSuccess, menuItems, items, removeItem, t]);
}
