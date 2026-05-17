'use client';

import { LoadingSpinner } from '@gustri/ui-web';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { MenuScreen } from '@/components/menu/menu-screen';
import { useDeliveryContext } from '@/hooks/use-delivery-context';
import { useDeliveryStore } from '@/store/delivery-store';

export function DeliveryMenuContent() {
  const router = useRouter();
  const { customerName, deliveryAddress, qrToken } = useDeliveryStore();

  // L5 / SSR multi-tenant — bounce back to /delivery if any of the three
  // pieces the cart depends on are missing. Pre-audit the guard only
  // checked customerName/deliveryAddress; a customer who hit
  // /delivery/menu without a valid `?token=…` would land here, browse a
  // menu, and only fail at cart submission with a "missing qr token"
  // toast. Failing fast on /delivery/menu is the explicit failure mode
  // the audit asked for.
  useEffect(() => {
    if (!customerName || !deliveryAddress || !qrToken) {
      router.replace('/delivery');
    }
  }, [customerName, deliveryAddress, qrToken, router]);

  // Resolve the qr_token → tenant_id server-side and bind it to the
  // customer-web wrapper before MenuScreen mounts. Subsequent
  // `useMenuItems` / `useCategories` calls then add the
  // `applyTenantScope` predicate so a multi-tenant deployment shows the
  // correct cafe's menu instead of mixed items. Closes the deferred
  // SSR multi-tenant fix from plans/18 — the SSR fetch is gone (the
  // page-level component is now a thin client shell) and tenant
  // resolution runs through the `/api/v1/customer/qr-tokens/resolve`
  // route's bearer-validated path.
  const ctx = useDeliveryContext(qrToken);

  // Redirect on hard token failure (invalid/revoked/expired/plan_required).
  // The query has `retry: false` so a single 4xx surfaces here directly.
  useEffect(() => {
    if (ctx.isError) {
      router.replace('/delivery');
    }
  }, [ctx.isError, router]);

  if (!customerName || !deliveryAddress || !qrToken) return null;
  if (ctx.isLoading || ctx.isError || !ctx.data) return <LoadingSpinner fullScreen />;

  return <MenuScreen tableId="__delivery__" />;
}
