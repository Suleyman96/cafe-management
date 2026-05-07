'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MenuScreen } from '@/components/menu/menu-screen';
import { useDeliveryStore } from '@/store/delivery-store';
import type { Category, MenuItemWithCategory } from '@/types';

interface DeliveryMenuContentProps {
  initialCategories: Category[];
  initialMenuItems: MenuItemWithCategory[];
}

export function DeliveryMenuContent({
  initialCategories,
  initialMenuItems,
}: DeliveryMenuContentProps) {
  const router = useRouter();
  const { customerName, deliveryAddress, qrToken } = useDeliveryStore();

  // L5 — bounce back to /delivery if any of the three pieces the cart
  // depends on are missing. Pre-audit the guard only checked
  // customerName/deliveryAddress; a customer who hit /delivery without a
  // valid `?token=…` would land here, browse a menu, and only fail at
  // cart submission with a "missing qr token" toast. Failing fast on
  // /delivery/menu is the explicit failure mode the audit asked for.
  //
  // KNOWN GAP (not addressed here, tracked in plan 18 §"Performance"):
  // the SSR menu fetch in app/delivery/menu/page.tsx runs against an
  // anon Supabase client with no tenant context bound, and the
  // `anon_read_menu_items` / `anon_read_categories` RLS policies are
  // `USING (true)`. In a single-tenant deployment this is a non-issue;
  // in a multi-tenant deployment the SSR HTML can briefly contain
  // cross-tenant items before the client-side guard redirects. A proper
  // fix moves tenant resolution server-side (cookie / signed URL with
  // the qr_token, validated against `qr_tokens`) and tenant-scopes the
  // wrapper read — bigger surgery than the audit scoped this rev.
  useEffect(() => {
    if (!customerName || !deliveryAddress || !qrToken) {
      router.replace('/delivery');
    }
  }, [customerName, deliveryAddress, qrToken, router]);

  if (!customerName || !deliveryAddress || !qrToken) return null;

  return (
    <MenuScreen
      tableId="__delivery__"
      initialCategories={initialCategories}
      initialMenuItems={initialMenuItems}
    />
  );
}
