import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Ref to the root navigation container — used to imperatively navigate
 * from outside the React tree (notification tap handlers, deep links).
 */
export const navigationRef = createNavigationContainerRef();

/**
 * Routes a notification payload to the appropriate screen.
 * Safe to call before navigation is ready — falls back silently.
 */
export function handleNotificationNavigation(data: Record<string, unknown> | null | undefined) {
  if (!data || !navigationRef.isReady()) return;

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
