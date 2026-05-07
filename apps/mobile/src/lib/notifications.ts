import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { markEvent, seenRecently } from './event-dedup';

// Configure notification behavior. Two dedup gates suppress duplicate sound:
//
//   - Realtime↔push race (event-id keyed, 500 ms window). The realtime path
//     stamps `order:<id>` / `waiter_call:<tableId>` just before playing the
//     in-app sound, so when the same event is also delivered via Expo push
//     the foreground handler can suppress the second sound.
//
//   - OS re-delivery (audit #7, identifier keyed, 60 s window). Expo / FCM /
//     APNs can re-invoke the foreground handler with the same notification
//     `request.identifier` during reconnect, app boot, or rare OS retry
//     paths. Without an identifier-keyed gate, the same banner sound plays
//     twice within seconds. Expo handles most OS-level dedup in practice;
//     this is belt-and-braces.
const NOTIFICATION_REDELIVERY_WINDOW_MS = 60_000;

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
    const orderId = typeof data.orderId === 'string' ? data.orderId : null;
    const tableId = typeof data.tableId === 'string' ? data.tableId : null;
    const type = typeof data.type === 'string' ? data.type : null;
    const requestId = notification.request.identifier;

    let suppressSound = false;

    // Existing realtime↔push race dedup (event-id keyed, default 500 ms).
    if (type === 'new_order' && orderId && seenRecently(`order:${orderId}`)) {
      suppressSound = true;
    } else if (type === 'waiter_call' && tableId && seenRecently(`waiter_call:${tableId}`)) {
      suppressSound = true;
    }

    // OS re-delivery dedup (identifier keyed, longer window).
    if (requestId && seenRecently(`notif:${requestId}`, NOTIFICATION_REDELIVERY_WINDOW_MS)) {
      suppressSound = true;
    }
    if (requestId) {
      markEvent(`notif:${requestId}`);
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
