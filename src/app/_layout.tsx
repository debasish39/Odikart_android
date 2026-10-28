import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as ExpoSplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import OdikartSplashScreen from "../components/OdikartSplashScreen";
import { OdikartToastProvider } from "../components/OdikartToast";
import { AuthProvider } from "../context/AuthContext";
import { registerForNotifications } from "../services/notificationService";

// Keep the native launch screen as short as possible; the animated React Native
// splash component below is the app's actual branded splash screen.
void ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

function NotificationInitializer() {
  useEffect(() => {
    let mounted = true;

    const register = async () => {
      try {
        await registerForNotifications();
      } catch (error) {
        console.error("Notification registration failed:", error);
      }
    };

    const openNotification = async (
      response: Notifications.NotificationResponse,
    ) => {
      const data = response.notification.request.content.data as {
        route?: string;
        url?: string;
      };

      if (!mounted) return;

      try {
        if (data?.route && data.route.startsWith("/")) {
          router.push(data.route as never);
          return;
        }

        if (data?.url) {
          if (data.url.startsWith("/")) {
            router.push(data.url as never);
          } else if (
            data.url.startsWith("https://") ||
            data.url.startsWith("http://")
          ) {
            await Linking.openURL(data.url);
          }
        }
      } catch (error) {
        console.error("Could not open notification destination:", error);
      }
    };

    void register();

    const receivedSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          "Odikart notification received:",
          notification.request.content.title,
        );
      },
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          return openNotification(response);
        }
      })
      .catch((error) => {
        console.error("Could not read the last notification:", error);
      });

    return () => {
      mounted = false;
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return null;
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    let active = true;

    // Release Android's native launch screen so the animated component can show.
    void ExpoSplashScreen.hideAsync().catch(() => {});

    const timer = setTimeout(() => {
      if (active) setShowSplash(false);
    }, 2800);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, []);

  if (showSplash) {
    return (
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
        <OdikartSplashScreen />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor="#F8FAFC" translucent={false} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#F8FAFC" },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <OdikartToastProvider>
            <NotificationInitializer />
            <AppContent />
          </OdikartToastProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
