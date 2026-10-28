
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import api from "./api";

export async function registerForNativePushNotifications() {
  if (Platform.OS !== "android") return null;

// Create Android notification channels.
await Notifications.setNotificationChannelAsync("orders", {
  name: "Order Updates",
  importance: Notifications.AndroidImportance.MAX,
});

await Notifications.setNotificationChannelAsync("offers", {
  name: "Offers and Promotions",
  importance: Notifications.AndroidImportance.DEFAULT,
});
  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    console.log("Odikart notification permission not granted");
    return null;
  }

  const result = await Notifications.getDevicePushTokenAsync();

  if (result.type !== "android" || !result.data) {
    throw new Error("Native Android FCM token unavailable");
  }

  await api.post("/notifications/register-device", {
    token: result.data,
    platform: "android",
  });

  console.log("Odikart FCM device registered");

  return result.data;
}

export async function unregisterNativePushNotifications() {
  if (Platform.OS !== "android") return;

  const result = await Notifications.getDevicePushTokenAsync();

  if (result.type !== "android" || !result.data) return;

  await api.delete("/notifications/unregister-device", {
    data: { token: result.data },
  });
}
