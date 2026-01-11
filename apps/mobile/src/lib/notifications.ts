import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Must use physical device for Push Notifications");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push token for push notification!");
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  
  try {
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    return pushToken.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

export async function showLocalNotification(
  title: string,
  body: string,
  data?: any
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

// New order notification
export async function notifyNewOrder(orderNumber: string, tableNumber: string) {
  await showLocalNotification(
    "🔔 New Order!",
    `Order ${orderNumber} from Table ${tableNumber}`,
    { type: "new_order", orderNumber, tableNumber }
  );
}

// Waiter call notification
export async function notifyWaiterCall(tableNumber: string, reason: string) {
  await showLocalNotification(
    "🔔 Waiter Call",
    `Table ${tableNumber} needs assistance: ${reason}`,
    { type: "waiter_call", tableNumber, reason }
  );
}

// Order ready notification
export async function notifyOrderReady(orderNumber: string, tableNumber: string) {
  await showLocalNotification(
    "✅ Order Ready",
    `Order ${orderNumber} for Table ${tableNumber} is ready to serve`,
    { type: "order_ready", orderNumber, tableNumber }
  );
}


