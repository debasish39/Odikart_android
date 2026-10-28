import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../api/api";
import { colors } from "../theme/colors";

/* =========================================================
   TYPES
========================================================= */

type NotificationType =
  | "order"
  | "delivery"
  | "wishlist"
  | "offer"
  | "account"
  | "announcement"
  | "system";

type NotificationItem = {
  _id: string;
  type?: NotificationType;
  title?: string;
  message?: string;
  orderId?: string | null;
  link?: string;
  isRead?: boolean;
  readAt?: string | null;
  isPromotional?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type NotificationSettings = {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  promotionalEmail: boolean;
  promotionalSms: boolean;
  promotionalPush: boolean;
};

type FilterType = "all" | "order" | "offer" | "account" | "others";

const NOTIFICATIONS_CACHE_KEY = "odikart_notifications_cache_v1";

/* =========================================================
   SHINE
========================================================= */

const ShineSweep = () => {
  const translateX = useRef(new Animated.Value(-280)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 420,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(900),
        Animated.timing(translateX, {
          toValue: -280,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [translateX]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{ translateX }, { skewX: "-18deg" }],
        },
      ]}
    >
      <View style={styles.shineBar} />
    </Animated.View>
  );
};

/* =========================================================
   HELPERS
========================================================= */

const getNotificationMeta = (type?: NotificationType) => {
  switch (type) {
    case "order":
      return {
        icon: "bag-handle-outline" as const,
        label: "Order",
        iconColor: "#7C3AED",
        softColor: "#F3E8FF",
      };

    case "delivery":
      return {
        icon: "car-outline" as const,
        label: "Delivery",
        iconColor: "#2563EB",
        softColor: "#DBEAFE",
      };

    case "wishlist":
      return {
        icon: "heart-outline" as const,
        label: "Wishlist",
        iconColor: "#DB2777",
        softColor: "#FCE7F3",
      };

    case "offer":
      return {
        icon: "pricetag-outline" as const,
        label: "Offer",
        iconColor: "#EA580C",
        softColor: "#FFEDD5",
      };

    case "account":
      return {
        icon: "person-circle-outline" as const,
        label: "Account",
        iconColor: "#475569",
        softColor: "#F1F5F9",
      };

    case "announcement":
      return {
        icon: "megaphone-outline" as const,
        label: "Announcement",
        iconColor: "#CA8A04",
        softColor: "#FEF9C3",
      };

    default:
      return {
        icon: "notifications-outline" as const,
        label: "System",
        iconColor: "#4F46E5",
        softColor: "#EEF2FF",
      };
  }
};

const getNotificationArtwork = (notification: NotificationItem) => {
  const text =
    `${notification.title || ""} ${notification.message || ""}`.toLowerCase();
  if (notification.type === "delivery" || /deliver/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-order-delivered.png");
  }
  if (/ship|dispatch|pickup|courier/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-order-shipped.png");
  }
  if (notification.type === "order" || /order|confirm|placed/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-order-confirmed.png");
  }
  if (/coupon|promo code|voucher/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-coupon.png");
  }
  if (notification.type === "offer" || /offer|discount|sale|deal/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-offer-50.png");
  }
  if (/wallet|refund|payment/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-wallet.png");
  }
  if (/return|replace|exchange/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-return.png");
  }
  if (/handicraft|handloom|odisha|artisan|new product/.test(text)) {
    return require("../../assets/images/notifications/thumbnails/thumb-handicraft.png");
  }
  return null;
};

const getDateGroup = (value?: string) => {
  if (!value) return "Earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.floor((startOfDay(now) - startOfDay(date)) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This Week";
  return "Earlier";
};

const formatTime = (value?: string) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const diff = Date.now() - date.getTime();

  if (diff < 60_000) return "Just now";

  const minutes = Math.floor(diff / 60_000);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
};

const extractNotifications = (data: any): NotificationItem[] => {
  const list =
    data?.notifications || data?.data?.notifications || data?.data || [];

  return Array.isArray(list) ? list : [];
};

/* =========================================================
   SCREEN
========================================================= */

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [loading, setLoading] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationItem | null>(
    null,
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [settings, setSettings] = useState<NotificationSettings>({
    inApp: true,
    email: true,
    sms: true,
    push: true,
    promotionalEmail: true,
    promotionalSms: true,
    promotionalPush: true,
  });

  /* =======================================================
     LOAD
  ======================================================= */

  const loadNotifications = useCallback(async (showLoader = true) => {
    // Only show the full skeleton on the very first screen load.
    // On later visits/refreshes, keep existing or cached content visible.
    let hasCachedData = false;
    if (showLoader && !hasLoadedOnce.current) {
      try {
        const cached = await AsyncStorage.getItem(NOTIFICATIONS_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.notifications)) {
            hasCachedData = true;
            setNotifications(parsed.notifications);
            if (typeof parsed?.notificationsEnabled === "boolean") {
              setNotificationsEnabled(parsed.notificationsEnabled);
            }
            setLoading(false);
          }
        }
      } catch (cacheError) {
        console.log("NOTIFICATIONS CACHE READ ERROR:", cacheError);
      }
    }

    try {
      if (showLoader && !hasLoadedOnce.current && !hasCachedData) {
        setLoading(true);
      }

      const response = await api.get("/notifications?limit=100");
      const data = response?.data;
      const nextNotifications = extractNotifications(data);

      setNotifications(nextNotifications);

      if (typeof data?.notificationsEnabled === "boolean") {
        setNotificationsEnabled(data.notificationsEnabled);
      }

      try {
        await AsyncStorage.setItem(
          NOTIFICATIONS_CACHE_KEY,
          JSON.stringify({
            notifications: nextNotifications,
            notificationsEnabled:
              typeof data?.notificationsEnabled === "boolean"
                ? data.notificationsEnabled
                : false,
            cachedAt: new Date().toISOString(),
          }),
        );
      } catch (cacheError) {
        console.log("NOTIFICATIONS CACHE WRITE ERROR:", cacheError);
      }

      console.log("NOTIFICATIONS RESPONSE:", data);
    } catch (error: any) {
      console.log("NOTIFICATIONS LOAD ERROR:", error?.response?.data || error);

      // Keep cached/current notifications on network failure.
      if (!hasLoadedOnce.current && notifications.length === 0) {
        Alert.alert(
          "Notifications",
          error?.response?.data?.message ||
            error?.message ||
            "Unable to load notifications.",
        );
      }
    } finally {
      hasLoadedOnce.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");

      const userSettings =
        response?.data?.user?.notificationSettings ||
        response?.data?.notificationSettings;

      if (userSettings) {
        setSettings((previous) => ({
          ...previous,
          ...userSettings,
        }));

        if (typeof userSettings.inApp === "boolean") {
          setNotificationsEnabled(userSettings.inApp);
        }
      }
    } catch (error) {
      console.log("NOTIFICATION SETTINGS LOAD ERROR:", error);
    }
  }, []);

  useEffect(() => {
    loadNotifications(true);
    loadSettings();
  }, [loadNotifications, loadSettings]);

  /* =======================================================
     DERIVED
  ======================================================= */

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  // Highlight recent login/security notifications separately so users notice them.
  const loginAlert = useMemo(
    () =>
      notifications.find((item) => {
        const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
        return (
          (item.type === "account" || item.type === "system") &&
          /login|sign[ -]?in|new device|new location|security alert|logged in|account access/.test(
            text,
          )
        );
      }),
    [notifications],
  );

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    if (filter === "order") {
      return notifications.filter(
        (item) => item.type === "order" || item.type === "delivery",
      );
    }
    if (filter === "offer") {
      return notifications.filter(
        (item) => item.type === "offer" || item.isPromotional,
      );
    }
    if (filter === "account") {
      return notifications.filter((item) => item.type === "account");
    }
    return notifications.filter(
      (item) =>
        item.type === "wishlist" ||
        item.type === "announcement" ||
        item.type === "system" ||
        item.type === "delivery" ||
        !item.type,
    );
  }, [notifications, filter]);

  // Sort the selected category newest-first before rendering.
  const sortedFilteredNotifications = useMemo(() => {
    return [...filteredNotifications].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return (
        (Number.isFinite(bTime) ? bTime : 0) -
        (Number.isFinite(aTime) ? aTime : 0)
      );
    });
  }, [filteredNotifications]);

  /* =======================================================
     REFRESH
  ======================================================= */

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadNotifications(false);
    await loadSettings();
  };

  /* =======================================================
     MARK ONE READ
  ======================================================= */

  const markOneAsRead = async (notification: NotificationItem) => {
    if (notification.isRead || !notification._id) {
      return;
    }

    try {
      setBusyId(notification._id);

      await api.patch(`/notifications/${notification._id}/read`);

      setNotifications((previous) => {
        const updated = previous.map((item) =>
          item._id === notification._id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item,
        );
        void persistNotificationsCache(updated);
        return updated;
      });
    } catch (error: any) {
      console.log(
        "MARK NOTIFICATION READ ERROR:",
        error?.response?.data || error,
      );

      Alert.alert(
        "Notification",
        error?.response?.data?.message ||
          "Unable to mark notification as read.",
      );
    } finally {
      setBusyId(null);
    }
  };

  /* =======================================================
     OPEN
  ======================================================= */

  const handleNotificationPress = async (notification: NotificationItem) => {
    if (busyId) return;

    await markOneAsRead(notification);

    const destination =
      notification.link ||
      (notification.orderId ? `/orders/${notification.orderId}` : "");

    if (!destination) {
      return;
    }

    try {
      if (
        destination.startsWith("http://") ||
        destination.startsWith("https://")
      ) {
        await Linking.openURL(destination);
        return;
      }

      router.push(destination as any);
    } catch (error) {
      console.log("NOTIFICATION NAVIGATION ERROR:", error);
    }
  };

  /* =======================================================
     MARK ALL
  ======================================================= */

  const handleMarkAllRead = async () => {
    if (!unreadCount || busyId) return;

    try {
      setBusyId("all");

      await api.patch("/notifications/read-all");

      const now = new Date().toISOString();

      setNotifications((previous) => {
        const updated = previous.map((item) => ({
          ...item,
          isRead: true,
          readAt: item.readAt || now,
        }));
        void persistNotificationsCache(updated);
        return updated;
      });
    } catch (error: any) {
      console.log("MARK ALL READ ERROR:", error?.response?.data || error);

      Alert.alert(
        "Notifications",
        error?.response?.data?.message ||
          "Unable to mark notifications as read.",
      );
    } finally {
      setBusyId(null);
    }
  };

  /* =======================================================
     DELETE
  ======================================================= */

  const handleDelete = (notification: NotificationItem) => {
    setDeleteTarget(notification);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id || busyId) return;

    const target = deleteTarget;
    try {
      setBusyId(target._id);
      await api.delete(`/notifications/${target._id}`);
      setNotifications((previous) => {
        const updated = previous.filter((item) => item._id !== target._id);
        void persistNotificationsCache(updated);
        return updated;
      });
      setDeleteTarget(null);
    } catch (error: any) {
      console.log("DELETE NOTIFICATION ERROR:", error?.response?.data || error);
      Alert.alert(
        "Notifications",
        error?.response?.data?.message || "Unable to delete notification.",
      );
    } finally {
      setBusyId(null);
    }
  };

  /* =======================================================
     SETTINGS
  ======================================================= */

  const updateSetting = (key: keyof NotificationSettings, value: boolean) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const saveSettings = async () => {
    try {
      setSettingsSaving(true);

      const response = await api.patch("/notifications/settings", settings);

      const returned = response?.data?.notificationSettings;

      if (returned) {
        setSettings((previous) => ({
          ...previous,
          ...returned,
        }));
      }

      if (typeof response?.data?.notificationsEnabled === "boolean") {
        setNotificationsEnabled(response.data.notificationsEnabled);
      }

      setSettingsOpen(false);

      await loadNotifications(false);
    } catch (error: any) {
      console.log(
        "SAVE NOTIFICATION SETTINGS ERROR:",
        error?.response?.data || error,
      );

      Alert.alert(
        "Notification settings",
        error?.response?.data?.message ||
          "Unable to update notification settings.",
      );
    } finally {
      setSettingsSaving(false);
    }
  };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
        <View style={styles.header}>
          <Pressable style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={21} color={colors.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Notifications</Text>
          </View>

          <View style={styles.iconButton}>
            <Ionicons
              name="notifications-outline"
              size={21}
              color={colors.primary}
            />
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.loadingContent}
        >
          <View style={styles.skeletonFilterRow}>
            {[58, 76, 72, 82, 68].map((width, index) => (
              <View
                key={index}
                style={[
                  styles.skeleton,
                  { width, height: 34, borderRadius: 13 },
                ]}
              />
            ))}
          </View>

          {Array.from({ length: 5 }).map((_, index) => (
            <View key={index} style={styles.notificationSkeleton}>
              <View style={[styles.skeleton, styles.skeletonCircleSmall]} />
              <View style={styles.skeletonTextWrap}>
                <View style={[styles.skeleton, styles.skeletonTitleSmall]} />
                <View style={[styles.skeleton, styles.skeletonLine]} />
                <View style={[styles.skeleton, styles.skeletonLineShort]} />
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
      {/* HEADER */}

      <View style={styles.header}>
        <Pressable style={styles.iconButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>

        <Pressable
          style={styles.iconButton}
          onPress={() => setSettingsOpen(true)}
        >
          <Ionicons name="settings-outline" size={21} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* ODIKART NOTIFICATION PROMO BANNER */}
        <Pressable
          style={styles.promoBannerWrap}
          onPress={() => setSettingsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Enable Odikart notifications"
        >
          <Image
            source={require("../../assets/images/notifications/Odikart Notification Banner.png")}
            style={styles.promoBannerImage}
            resizeMode="cover"
          />
        </Pressable>

        {/* LOGIN / ACCOUNT SECURITY ALERT */}
        {loginAlert ? (
          <Pressable
            style={[
              styles.loginAlertCard,
              !loginAlert.isRead && styles.loginAlertUnread,
            ]}
            onPress={() => handleNotificationPress(loginAlert)}
            accessibilityRole="button"
            accessibilityLabel="Open login security alert"
          >
            <View style={styles.loginAlertIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={23}
                color="#B45309"
              />
            </View>

            <View style={styles.loginAlertBody}>
              <View style={styles.loginAlertHeading}>
                <Text style={styles.loginAlertTitle}>Account login alert</Text>
                {!loginAlert.isRead ? (
                  <View style={styles.loginAlertNewBadge}>
                    <Text style={styles.loginAlertNewText}>NEW</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.loginAlertMessage} numberOfLines={2}>
                {loginAlert.title || "New login activity detected"}
                {loginAlert.message ? ` · ${loginAlert.message}` : ""}
              </Text>
              <Text style={styles.loginAlertAction}>Review activity →</Text>
            </View>
          </Pressable>
        ) : null}

        {/* CATEGORY-FIRST NOTIFICATION LAYOUT */}
        {/* DISABLED NOTICE */}

        {!notificationsEnabled ? (
          <View style={styles.disabledCard}>
            <View style={styles.disabledIcon}>
              <Ionicons
                name="notifications-off-outline"
                size={20}
                color="#B45309"
              />
            </View>

            <View style={styles.disabledText}>
              <Text style={styles.disabledTitle}>
                In-app notifications are off
              </Text>

              <Text style={styles.disabledMessage}>
                Turn them on from settings to see future updates here.
              </Text>
            </View>

            <Pressable
              style={styles.enableButton}
              onPress={() => setSettingsOpen(true)}
            >
              <Text style={styles.enableButtonText}>Enable</Text>
            </Pressable>
          </View>
        ) : null}

        {/* TOOLBAR */}

        <View style={styles.toolbar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            {(
              [
                ["all", "All"],
                ["order", "Orders"],
                ["offer", "Offers"],
                ["account", "Account"],
                ["others", "Others"],
              ] as const
            ).map(([value, label]) => {
              const active = filter === value;

              const count =
                value === "all"
                  ? notifications.length
                  : value === "order"
                    ? notifications.filter(
                        (item) =>
                          item.type === "order" || item.type === "delivery",
                      ).length
                    : value === "offer"
                      ? notifications.filter(
                          (item) => item.type === "offer" || item.isPromotional,
                        ).length
                      : value === "account"
                        ? notifications.filter(
                            (item) => item.type === "account",
                          ).length
                        : notifications.filter(
                            (item) =>
                              item.type === "wishlist" ||
                              item.type === "announcement" ||
                              item.type === "system" ||
                              item.type === "delivery" ||
                              !item.type,
                          ).length;

              return (
                <Pressable
                  key={value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilter(value)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {label}
                  </Text>

                  <View
                    style={[
                      styles.filterCount,
                      active && styles.filterCountActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterCountText,
                        active && styles.filterCountTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* LIST */}

        {sortedFilteredNotifications.length > 0 ? (
          <View style={styles.list}>
            {sortedFilteredNotifications.map((notification, index) => {
              const meta = getNotificationMeta(notification.type);
              const isBusy = busyId === notification._id;
              return (
                <Pressable
                  key={notification._id || `notification-${index}`}
                  style={[
                    styles.notificationCard,
                    !notification.isRead && styles.notificationUnread,
                  ]}
                  onPress={() => handleNotificationPress(notification)}
                >
                  <View
                    style={[
                      styles.notificationIcon,
                      { backgroundColor: meta.softColor },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon}
                      size={22}
                      color={meta.iconColor}
                    />
                  </View>
                  <View style={styles.notificationBody}>
                    <View style={styles.notificationTop}>
                      <Text
                        style={[
                          styles.notificationTitle,
                          !notification.isRead &&
                            styles.notificationTitleUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {notification.title || "Notification"}
                      </Text>
                      <Text style={styles.timeText} numberOfLines={1}>
                        {formatTime(notification.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.notificationMessage} numberOfLines={2}>
                      {notification.message || ""}
                    </Text>
                    {notification.orderId ? (
                      <View style={styles.orderLink}>
                        <Ionicons
                          name="receipt-outline"
                          size={13}
                          color={colors.primary}
                        />
                        <Text style={styles.orderLinkText}>View order</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.notificationRight}>
                    {isBusy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        {!notification.isRead ? (
                          <View style={styles.newDot} />
                        ) : null}
                        <Ionicons
                          name="chevron-forward"
                          size={19}
                          color="#94A3B8"
                        />
                        <Pressable
                          hitSlop={8}
                          style={styles.deleteButton}
                          onPress={(event) => {
                            event.stopPropagation();
                            handleDelete(notification);
                          }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={14}
                            color="#94A3B8"
                          />
                        </Pressable>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIllustrationWrap}>
              <Image
                source={require("../../assets/images/notifications/illustrations/empty-notifications.png")}
                style={styles.emptyIllustration}
                resizeMode="contain"
              />
            </View>
            {/* 
            <Text
              style={styles.emptyTitle}
            >
              {filter === "all" ? "No notifications yet" : `No ${filter === "order" ? "order" : filter === "offer" ? "offer" : "update"} notifications`}
            </Text>

            <Text
              style={styles.emptyMessage}
            >
              {filter === "all"
                ? "When something important happens, your updates will appear here."
                : "Try another category to see more updates."}
            </Text>

            <Pressable
              style={styles.refreshButton}
              onPress={() =>
                loadNotifications(true)
              }
            >
              <Ionicons
                name="refresh-outline"
                size={17}
                color="#FFFFFF"
              />
              <Text
                style={styles.refreshButtonText}
              >
                Refresh
              </Text>
            </Pressable> */}
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* MODERN DELETE CONFIRMATION */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.deleteModalRoot}>
          <Pressable
            style={styles.deleteModalBackdrop}
            onPress={() => !busyId && setDeleteTarget(null)}
          />
          <View style={styles.deleteDialog}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={28} color="#E11D48" />
            </View>
            <Text style={styles.deleteDialogTitle}>Delete notification?</Text>
            <Text style={styles.deleteDialogMessage}>
              This notification will be permanently removed from your Odikart
              notification center.
            </Text>
            {deleteTarget?.title ? (
              <View style={styles.deletePreview}>
                <View style={styles.deletePreviewDot} />
                <Text numberOfLines={2} style={styles.deletePreviewText}>
                  {deleteTarget.title}
                </Text>
              </View>
            ) : null}
            <View style={styles.deleteDialogActions}>
              <Pressable
                disabled={!!busyId}
                style={({ pressed }) => [
                  styles.deleteCancelButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={styles.deleteCancelText}>Keep it</Text>
              </Pressable>
              <Pressable
                disabled={!!busyId}
                style={({ pressed }) => [
                  styles.deleteConfirmButton,
                  (pressed || !!busyId) && styles.buttonPressed,
                ]}
                onPress={confirmDelete}
              >
                {busyId === deleteTarget?._id ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.deleteConfirmText}>Delete</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SETTINGS MODAL */}

      <Modal
        visible={settingsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSettingsOpen(false)}
          />

          <View style={styles.settingsSheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Notification settings</Text>

                <Text style={styles.sheetSubtitle}>
                  Choose how Odikart keeps you updated.
                </Text>
              </View>

              <Pressable
                style={styles.sheetClose}
                onPress={() => setSettingsOpen(false)}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.settingsContent}
            >
              <SettingRow
                icon="notifications-outline"
                title="In-app notifications"
                description="Show updates inside Odikart"
                value={settings.inApp}
                onChange={(value) => updateSetting("inApp", value)}
              />

              <SettingRow
                icon="phone-portrait-outline"
                title="Push notifications"
                description="Receive device notifications"
                value={settings.push}
                onChange={(value) => updateSetting("push", value)}
              />

              <SettingRow
                icon="mail-outline"
                title="Email notifications"
                description="Receive important updates by email"
                value={settings.email}
                onChange={(value) => updateSetting("email", value)}
              />

              <SettingRow
                icon="chatbubble-outline"
                title="SMS notifications"
                description="Receive important updates by SMS"
                value={settings.sms}
                onChange={(value) => updateSetting("sms", value)}
              />

              <View style={styles.settingsDivider} />

              <Text style={styles.settingsSectionTitle}>
                Promotional updates
              </Text>

              <SettingRow
                icon="pricetag-outline"
                title="Promotional push"
                description="Offers, coupons and deals"
                value={settings.promotionalPush}
                onChange={(value) => updateSetting("promotionalPush", value)}
              />

              <SettingRow
                icon="mail-open-outline"
                title="Promotional email"
                description="Deals and product announcements"
                value={settings.promotionalEmail}
                onChange={(value) => updateSetting("promotionalEmail", value)}
              />

              <SettingRow
                icon="chatbubbles-outline"
                title="Promotional SMS"
                description="Special offers by SMS"
                value={settings.promotionalSms}
                onChange={(value) => updateSetting("promotionalSms", value)}
              />

              <Pressable
                style={[
                  styles.saveSettingsButton,
                  settingsSaving && styles.saveSettingsDisabled,
                ]}
                disabled={settingsSaving}
                onPress={saveSettings}
              >
                {settingsSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={19}
                      color="#FFFFFF"
                    />
                    <Text style={styles.saveSettingsText}>
                      Save preferences
                    </Text>
                  </>
                )}
              </Pressable>

              <View style={styles.settingsBottomSpace} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
   SETTING ROW
========================================================= */

function SettingRow({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>

      <View style={styles.settingText}>
        <Text style={styles.settingTitle}>{title}</Text>

        <Text style={styles.settingDescription}>{description}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: "#CBD5E1",
          true: colors.primary,
        }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F8FF",
  },

  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: colors.textMuted,
  },

  content: {
    paddingHorizontal: 15,
    paddingTop: 4,
    paddingBottom: 25,
  },

  heroCard: {
    minHeight: 96,
    borderRadius: 25,
    padding: 16,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#312E81",
    borderWidth: 1,
    borderColor: "#4F46E5",
    shadowColor: "#312E81",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: 7,
    },
    elevation: 6,
  },

  shineBar: {
    width: 70,
    height: "150%",
    marginTop: "-25%",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  heroGlow: {
    width: 55,
    height: 55,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },

  heroText: {
    flex: 1,
    marginLeft: 13,
    marginRight: 8,
  },

  heroTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  heroMessage: {
    marginTop: 5,
    fontSize: 10.5,
    lineHeight: 15,
    color: "#DDD6FE",
  },

  unreadBadge: {
    minWidth: 35,
    height: 35,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: "#FBBF24",
    alignItems: "center",
    justifyContent: "center",
  },

  unreadBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#422006",
  },

  doneBadge: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  promoBannerWrap: {
    marginTop: 12,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },

  promoBannerImage: {
    width: "100%",
    aspectRatio: 3,
    height: undefined,
  },

  dateGroupTitle: {
    marginTop: 8,
    marginBottom: 0,
    fontSize: 14,
    fontWeight: "800",
    color: "#64748B",
  },

  notificationRight: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },

  deleteButton: {
    padding: 2,
    marginTop: 2,
  },

  notificationArtwork: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },

  loginAlertCard: {
    marginTop: 12,
    padding: 13,
    borderRadius: 19,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  loginAlertUnread: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFF7D6",
  },

  loginAlertIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },

  loginAlertBody: {
    flex: 1,
    minWidth: 0,
  },

  loginAlertHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  loginAlertTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "900",
    color: "#92400E",
  },

  loginAlertNewBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor: "#DC2626",
  },

  loginAlertNewText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  loginAlertMessage: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 15,
    color: "#92400E",
  },

  loginAlertAction: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: "900",
    color: "#B45309",
  },

  disabledCard: {
    marginTop: 11,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    flexDirection: "row",
    alignItems: "center",
  },

  disabledIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },

  disabledText: {
    flex: 1,
    marginHorizontal: 10,
  },

  disabledTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#92400E",
  },

  disabledMessage: {
    marginTop: 2,
    fontSize: 9.5,
    lineHeight: 14,
    color: "#A16207",
  },

  enableButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: "#F59E0B",
  },

  enableButtonText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  toolbar: {
    marginTop: 5,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  filterContent: {
    paddingRight: 2,
    gap: 7,
    flexGrow: 1,
    justifyContent: "space-between",
  },

  filterChip: {
    minHeight: 39,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  filterText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  filterTextActive: {
    color: "#FFFFFF",
  },

  filterCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountActive: {
    backgroundColor: "rgba(255,255,255,0.20)",
  },

  filterCountText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.textMuted,
  },

  filterCountTextActive: {
    color: "#FFFFFF",
  },

  markAllButton: {
    width: 39,
    height: 37,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  markAllDisabled: {
    opacity: 0.55,
  },

  list: {
    gap: 8,
  },

  notificationCard: {
    minHeight: 86,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOpacity: 0.035,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    elevation: 2,
  },

  notificationUnread: {
    borderColor: "#F1F2FB",
    backgroundColor: "#FFFFFF",
  },

  unreadRail: {
    position: "absolute",
    left: 0,
    top: 16,
    bottom: 16,
    width: 3,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },

  notificationIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  notificationBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
    marginRight: 5,
  },

  notificationTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },

  typePill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },

  typePillText: {
    fontSize: 8.5,
    fontWeight: "900",
  },

  timeText: {
    fontSize: 9,
    color: "#94A3B8",
    flexShrink: 0,
  },

  notificationTitle: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "800",
    color: colors.text,
  },

  notificationTitleUnread: {
    fontWeight: "900",
  },

  notificationMessage: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },

  orderLink: {
    alignSelf: "flex-start",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  orderLinkText: {
    fontSize: 9.5,
    fontWeight: "900",
    color: colors.primary,
  },

  notificationActions: {
    width: 24,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 2,
  },

  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F43F5E",
  },

  emptyCard: {
    minHeight: 310,
    marginTop: 8,
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 25,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyIllustrationWrap: {
    width: 220,
    height: 170,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  emptyIllustration: {
    width: "100%",
    height: "100%",
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },

  emptyMessage: {
    maxWidth: 290,
    marginTop: 7,
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },

  refreshButton: {
    marginTop: 17,
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  refreshButtonText: {
    fontSize: 10.5,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  bottomSpace: {
    height: 20,
  },

  loadingContent: {
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 30,
  },

  heroSkeleton: {
    minHeight: 96,
    padding: 16,
    borderRadius: 25,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonFilterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 7,
    marginTop: 14,
    marginBottom: 2,
  },

  notificationSkeleton: {
    minHeight: 118,
    marginTop: 10,
    padding: 13,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  skeleton: {
    backgroundColor: "#E8EDF5",
  },

  skeletonCircle: {
    width: 55,
    height: 55,
    borderRadius: 19,
  },

  skeletonCircleSmall: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },

  skeletonTextWrap: {
    flex: 1,
    marginLeft: 12,
  },

  skeletonTitle: {
    width: "65%",
    height: 14,
    borderRadius: 7,
  },

  skeletonTitleSmall: {
    width: "42%",
    height: 11,
    borderRadius: 6,
  },

  skeletonLine: {
    width: "82%",
    height: 9,
    borderRadius: 5,
    marginTop: 9,
  },

  skeletonLineShort: {
    width: "56%",
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },

  deleteModalRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  deleteModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.56)",
  },

  deleteDialog: {
    width: "100%",
    maxWidth: 380,
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 20,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },

  deleteIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FFE4E6",
    marginBottom: 15,
  },

  deleteDialogTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    color: "#172033",
    textAlign: "center",
  },

  deleteDialogMessage: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    textAlign: "center",
  },

  deletePreview: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 17,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E9EEF5",
  },

  deletePreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4F46E5",
    marginRight: 9,
  },

  deletePreviewText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    color: "#334155",
  },

  deleteDialogActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },

  deleteCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  deleteCancelText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#475569",
  },

  deleteConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#E11D48",
    shadowColor: "#E11D48",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },

  deleteConfirmText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.46)",
  },

  settingsSheet: {
    maxHeight: "86%",
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    backgroundColor: colors.background,
    paddingTop: 9,
    overflow: "hidden",
  },

  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    marginBottom: 13,
  },

  sheetHeader: {
    paddingHorizontal: 17,
    paddingBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sheetTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },

  sheetSubtitle: {
    marginTop: 3,
    maxWidth: 290,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textMuted,
  },

  sheetClose: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },

  settingsContent: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },

  settingRow: {
    minHeight: 70,
    marginTop: 8,
    padding: 11,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },

  settingText: {
    flex: 1,
    marginHorizontal: 10,
  },

  settingTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: colors.text,
  },

  settingDescription: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 13,
    color: colors.textMuted,
  },

  settingsDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 17,
  },

  settingsSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.text,
    marginBottom: 3,
  },

  saveSettingsButton: {
    minHeight: 48,
    marginTop: 17,
    borderRadius: 15,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  saveSettingsDisabled: {
    opacity: 0.7,
  },

  saveSettingsText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
  },

  settingsBottomSpace: {
    height: 15,
  },
});
