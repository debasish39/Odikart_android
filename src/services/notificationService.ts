import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import api from "../api/api";
import { getToken } from "../api/authStorage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForNotifications() {
  if (Platform.OS !== "android") {
    console.log("Odikart push notifications are configured for Android.");
    return null;
  }

  if (!Device.isDevice) {
    console.log("Use a physical Android device to test push notifications.");
    return null;
  }

  await Notifications.setNotificationChannelAsync("orders", {
    name: "Order Updates",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });

  await Notifications.setNotificationChannelAsync("offers", {
    name: "Offers & Promotions",
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    console.log("Notification permission was not granted.");
    return null;
  }

  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = await getToken();

  if (!token) {
    console.log(
      "Device token obtained. Sign in to register it with the backend.",
    );

    return deviceToken.data;
  }

  // Backend endpoint to implement:
  // POST /api/notifications/register-device
  await api.post("/notifications/register-device", {
    token: deviceToken.data,
    platform: "android",
  });

  console.log("Odikart device token registered successfully.");

  return deviceToken.data;
}

export async function unregisterNotifications() {
  const deviceToken = await Notifications.getDevicePushTokenAsync();

  // Implement this endpoint in your backend before calling this function.
  await api.delete("/notifications/unregister-device", {
    data: {
      token: deviceToken.data,
      platform: "android",
    },
  });
}
