import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { seenRecently } from './event-dedup';

// Configure notification behavior. The dedup gate suppresses the foreground
// sound when the same event already played via the realtime path within the
// last 500ms. The banner still shows so the user has the visual cue.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
    const orderId = typeof data.orderId === 'string' ? data.orderId : null;
    const tableId = typeof data.tableId === 'string' ? data.tableId : null;
    const type = typeof data.type === 'string' ? data.type : null;

    let suppressSound = false;
    if (type === 'new_order' && orderId && seenRecently(`order:${orderId}`)) {
      suppressSound = true;
    } else if (type === 'waiter_call' && tableId && seenRecently(`waiter_call:${tableId}`)) {
      suppressSound = true;
    }

    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: !suppressSound,
      shouldSetBadge: true,
    };
  },
});

/**
 * Wrap `requestPermissionsAsync()` with a 5s timeout. On rare custom Android
 * ROMs the dialog hangs and blocks app startup; the timeout treats the
 * unanswered prompt as `'undetermined'` so boot continues. The next AppState
 * `active` event in `usePushTokenSync` retries — by then the system dialog
 * has usually resolved one way or the other.
 */
const PERMISSION_TIMEOUT_MS = 5_000;

export async function requestPermissionsWithTimeout(
  timeoutMs: number = PERMISSION_TIMEOUT_MS,
): Promise<{ status: Notifications.PermissionStatus }> {
  type PermResult = { status: Notifications.PermissionStatus };
  const undetermined: PermResult = {
    status: 'undetermined' as Notifications.PermissionStatus,
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<PermResult>((resolve) => {
    timer = setTimeout(() => resolve(undetermined), timeoutMs);
  });
  try {
    const result = (await Promise.race([
      Notifications.requestPermissionsAsync(),
      timeoutPromise,
    ])) as PermResult;
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await requestPermissionsWithTimeout();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;

  // Skip push token registration in development (no valid EAS project)
  if (!projectId || projectId === 'your-project-id') {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    return null;
  }

  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    return pushToken.data;
  } catch {
    // Push notifications not available in Expo Go — local notifications still work
    return null;
  }
}

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
  });
}

// New order notification — orderId enables deep link to OrderDetail
export async function notifyNewOrder(orderNumber: string, tableNumber: string, orderId?: string) {
  await showLocalNotification('🔔 New Order!', `Order ${orderNumber} from Table ${tableNumber}`, {
    type: 'new_order',
    orderNumber,
    tableNumber,
    ...(orderId ? { orderId } : {}),
  });
}

// Waiter call notification — tableId enables deep link to TableDetail
export async function notifyWaiterCall(tableNumber: string, reason: string, tableId?: string) {
  await showLocalNotification(
    '🔔 Waiter Call',
    `Table ${tableNumber} needs assistance: ${reason}`,
    { type: 'waiter_call', tableNumber, reason, ...(tableId ? { tableId } : {}) },
  );
}

// Order ready notification
export async function notifyOrderReady(orderNumber: string, tableNumber: string, orderId?: string) {
  await showLocalNotification(
    '✅ Order Ready',
    `Order ${orderNumber} for Table ${tableNumber} is ready to serve`,
    { type: 'order_ready', orderNumber, tableNumber, ...(orderId ? { orderId } : {}) },
  );
}
