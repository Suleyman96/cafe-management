import { QUERY_KEYS } from '@gustri/queries';
import { createNavigationContainerRef } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { queryClient } from '@/lib/query-client';
import { db } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { usePendingIntentStore } from '@/store/pending-intent-store';

/**
 * Ref to the root navigation container — used to imperatively navigate
 * from outside the React tree (notification tap handlers, deep links).
 */
export const navigationRef = createNavigationContainerRef();

type Tenanted = { tenant_id?: string | null };

/**
 * Resolve the tenant id of an entity targeted by a notification payload.
 * Tries the cache first (fast, common path) and falls back to a wrapper
 * fetch (RLS-guarded) so we don't trust the payload to determine routing.
 *
 * Returns:
 *  - the entity's tenant_id when found
 *  - `null` when the entity exists but has no tenant id (shouldn't happen
 *    for orders/tables/waiter_calls, but be defensive)
 *  - `'not-found'` when the entity is missing, RLS-blocked, or fetch errors
 */
async function resolveEntityTenant(
  kind: 'order' | 'table' | 'waiter_call',
  id: string,
): Promise<string | null | 'not-found'> {
  // Cache peek: most notifications fire shortly after the realtime invalidate
  // populates the corresponding list cache, so this is the hot path.
  const listKey =
    kind === 'order'
      ? QUERY_KEYS.ORDERS
      : kind === 'table'
        ? QUERY_KEYS.TABLES
        : QUERY_KEYS.WAITER_CALLS;
  const list = queryClient.getQueryData<Tenanted[] | undefined>([listKey]);
  if (Array.isArray(list)) {
    const hit = list.find((row) => (row as { id?: string }).id === id);
    if (hit) return hit.tenant_id ?? null;
  }

  // Cache miss — fall back to the wrapper. RLS blocks foreign-tenant rows,
  // so the safest signal is "the row exists for me OR it doesn't". 404/null
  // are normalised to 'not-found'.
  try {
    if (kind === 'order') {
      const row = (await db.orders.findById(id)) as Tenanted | null;
      return row?.tenant_id ?? 'not-found';
    }
    if (kind === 'table') {
      const row = (await db.tables.findById(id)) as Tenanted | null;
      return row?.tenant_id ?? 'not-found';
    }
    // waiter_calls: no findById exists in mobile mock; rely on cache only.
    return 'not-found';
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: `tenant resolution failed for ${kind}:${id}`,
      level: 'warning',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
    return 'not-found';
  }
}

/**
 * Routes a notification payload to the appropriate screen.
 *
 * If navigation isn't ready yet, or the user is logged out, the payload is
 * stashed in the pending-intent store so the post-login replay effect in
 * RootNavigator can dispatch it once the Main stack mounts. This prevents
 * cold-start notification taps from being silently dropped.
 *
 * Tenant validation: before navigating to a sensitive detail screen, we
 * verify the target entity belongs to the current tenant. RLS already
 * blocks the actual fetch, but the screen would still mount and flicker
 * — and a spoofed payload could be used to direct the user to a familiar
 * screen with someone else's id. Foreign-tenant targets land on the
 * generic NotificationExpired screen.
 */
export async function handleNotificationNavigation(
  data: Record<string, unknown> | null | undefined,
) {
  if (!data) return;

  const currentTenantId = useAuthStore.getState().staff?.tenant_id;
  if (!navigationRef.isReady() || !currentTenantId) {
    usePendingIntentStore.getState().addPending({ type: 'notification', data });
    return;
  }

  const type = data.type as string | undefined;

  // React Navigation's nested navigate types are complex; runtime is correct
  const navigate = navigationRef.navigate as (name: string, params?: unknown) => void;

  function routeExpired() {
    navigate('NotificationExpired');
  }

  if (type === 'new_order' || type === 'order_ready') {
    const orderId = data.orderId as string | undefined;
    if (!orderId) return;
    const tenant = await resolveEntityTenant('order', orderId);
    if (tenant !== currentTenantId) {
      routeExpired();
      return;
    }
    navigate('Main', {
      screen: 'OrdersTab',
      params: { screen: 'OrderDetail', params: { orderId } },
    });
    return;
  }

  if (type === 'waiter_call') {
    const tableId = data.tableId as string | undefined;
    if (!tableId) return;
    const tenant = await resolveEntityTenant('table', tableId);
    if (tenant !== currentTenantId) {
      routeExpired();
      return;
    }
    navigate('Main', {
      screen: 'TablesTab',
      params: { screen: 'TableDetail', params: { tableId } },
    });
    return;
  }
}
