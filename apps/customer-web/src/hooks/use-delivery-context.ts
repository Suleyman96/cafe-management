import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiRoutes } from '@/lib/api-routes';
import { STALE_TIMES } from '@/lib/stale-times';
import { bindCustomerTenantContext } from '@/lib/supabase';
import { useCartStore } from '@/store/cart-store';

/**
 * Resolve the bearer `qr_token` to a `tenant_id` and bind it to the
 * customer-web Supabase wrapper.
 *
 * Closes the deferred multi-tenant SSR gap from
 * `plans/18-CUSTOMER-WEB-AUDIT-CONTINUATION.md`. Pre-PR the delivery
 * menu page SSR-fetched against an anon Supabase client with no tenant
 * binding, briefly leaking mixed-tenant items in multi-tenant
 * deployments. Now the menu page mounts client-side, calls this hook,
 * and once `tenant_id` is back from the server-side `qr_tokens` lookup
 * we set it on the wrapper so `useMenuItems` / `useCategories` add the
 * `applyTenantScope` predicate.
 *
 * `enabled` is gated on the qrToken so a missing token (the user
 * landed on `/delivery/menu` without going through `/delivery?token=…`)
 * doesn't fire a wasted POST. The DeliveryMenuContent guard redirects
 * to `/delivery` when the token is missing or this query rejects.
 *
 * Caching: keyed on the qrToken itself so a fresh scan with a rotated
 * token re-validates instead of reusing the prior tenant binding.
 * `staleTime: Infinity` because the resolved tenant for a given token
 * never changes — only revocation/expiry does, and the server returns
 * an error in those cases which TanStack Query won't cache as success.
 */
export function useDeliveryContext(qrToken: string | null) {
  const query = useQuery({
    queryKey: ['delivery-context', qrToken],
    queryFn: async (): Promise<{ tenant_id: string }> => {
      if (!qrToken) throw new Error('qr_token_missing');
      return apiRoutes.customerQrTokens.resolve(qrToken);
    },
    enabled: !!qrToken,
    staleTime: STALE_TIMES.STATIC,
    retry: false,
  });

  // Bind the resolved tenant to the wrapper as soon as the query
  // succeeds. `setTenantContext` is idempotent — re-binding the same id
  // on a re-render is a no-op, and a refetch returning the same id
  // doesn't churn anything downstream.
  //
  // M4 — bind the cart partition in the same effect. Delivery carts
  // are scoped by (flow: 'delivery', tenantId) with no tableId; a
  // single tenant has one delivery cart at a time per device.
  useEffect(() => {
    if (query.data?.tenant_id) {
      bindCustomerTenantContext(query.data.tenant_id, 'delivery-context');
      useCartStore.getState().setPartition({
        flow: 'delivery',
        tenantId: query.data.tenant_id,
      });
    }
  }, [query.data?.tenant_id]);

  return query;
}
