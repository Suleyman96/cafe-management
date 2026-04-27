import { createNavigationContainerRef } from '@react-navigation/native';
import { useAuthStore } from '@/store/auth-store';
import { usePendingIntentStore } from '@/store/pending-intent-store';

/**
 * Ref to the root navigation container — used to imperatively navigate
 * from outside the React tree (notification tap handlers, deep links).
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Routes a notification payload to the appropriate screen.
 *
 * If navigation isn't ready yet, or the user is logged out, the payload is
 * stashed in the pending-intent store so the post-login replay effect in
 * RootNavigator can dispatch it once the Main stack mounts. This prevents
 * cold-start notification taps from being silently dropped.
 */
export function handleNotificationNavigation(data: Record<string, unknown> | null | undefined) {
  if (!data) return;

  if (!navigationRef.isReady() || !useAuthStore.getState().staff) {
    usePendingIntentStore.getState().setPending({ type: 'notification', data });
    return;
  }

  const type = data.type as string | undefined;

  // React Navigation's nested navigate types are complex; runtime is correct
  const navigate = navigationRef.navigate as (name: string, params: unknown) => void;

  if (type === 'new_order' || type === 'order_ready') {
    const orderId = data.orderId as string | undefined;
    if (orderId) {
      navigate('Main', {
        screen: 'OrdersTab',
        params: { screen: 'OrderDetail', params: { orderId } },
      });
    }
    return;
  }

  if (type === 'waiter_call') {
    const tableId = data.tableId as string | undefined;
    if (tableId) {
      navigate('Main', {
        screen: 'TablesTab',
        params: { screen: 'TableDetail', params: { tableId } },
      });
    }
    return;
  }
}
