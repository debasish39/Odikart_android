
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import api from "../../api/api";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../theme/colors";
type IconName = keyof typeof Ionicons.glyphMap;

const PROFILE_CACHE_KEY = "odikart:profile:v1";

type User = {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  avatar?: string;
};

type MenuItem = {
  icon: IconName;
  title: string;
  subtitle?: string;
  rightText?: string;
  route?: string;
};

const normalizeImageUrl = (image?: string | null) => {
  if (!image) return null;

  const value = String(image).trim();
  if (!value) return null;

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  return value;
};

function SkeletonBlock({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.skeletonBlock,
        {
          width,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

function ProfileSkeleton() {
  const opacity = React.useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 750,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const Skeleton = ({
    width,
    height,
    radius = 8,
    style,
  }: {
    width: number | `${number}%`;
    height: number;
    radius?: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        styles.skeletonBlock,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );

  const SectionHeading = () => (
    <View style={styles.skeletonSectionHeader}>
      <Skeleton width="42%" height={13} radius={5} />
    </View>
  );

  const SettingRow = ({ last = false }: { last?: boolean }) => (
    <View style={[styles.settingRow, !last && styles.settingRowDivider]}>
      <Skeleton width={43} height={43} radius={14} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton width="48%" height={11} radius={5} />
        <Skeleton width="72%" height={8} radius={4} />
      </View>
      <Skeleton width={8} height={13} radius={4} />
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F6FF"
        translucent={false}
      />
      {/* Match the real fixed header: logo and notification button only. */}
      <View style={styles.fixedHeaderContainer}>
        <View style={styles.brandHeader}>
          <View style={styles.brandHeaderLeft}>
            <Skeleton width={36} height={36} radius={11} />
            <Skeleton width={92} height={25} radius={6} />
          </View>
          <Skeleton width={40} height={40} radius={13} />
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.referenceContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        {/* Account identity card */}
        <View style={styles.identityCard}>
          <Skeleton width={78} height={78} radius={39} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="78%" height={17} radius={5} />
            <Skeleton width="92%" height={10} radius={4} />
            <Skeleton width="58%" height={10} radius={4} />
            <Skeleton width={126} height={22} radius={12} />
          </View>
          <Skeleton width={9} height={16} radius={4} />
        </View>

        {/* OdiKart Plus banner */}
        <View style={styles.plusBanner}>
          <Skeleton width={45} height={45} radius={15} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={110} height={16} radius={5} />
            <Skeleton width="95%" height={8} radius={4} />
            <Skeleton width="68%" height={8} radius={4} />
          </View>
          <Skeleton width={9} height={16} radius={4} />
        </View>

        {/* Four shortcuts: Orders, Wishlist, Cart and Coupons */}
        <View style={styles.shortcutGrid}>
          {[1, 2, 3, 4].map((item) => (
            <View key={item} style={styles.shortcutCard}>
              <Skeleton width={48} height={48} radius={16} />
              <Skeleton
                width="58%"
                height={10}
                radius={4}
                style={{ marginTop: 7 }}
              />
              <Skeleton
                width="72%"
                height={7}
                radius={4}
                style={{ marginTop: 5 }}
              />
            </View>
          ))}
        </View>

        {/* Coupon promotional image banner */}
        <Skeleton
          width="100%"
          height={104}
          radius={19}
          style={{ marginTop: 16 }}
        />

        <SectionHeading />
        <View style={styles.settingsCard}>
          {[1, 2, 3, 4, 5, 6].map((item, index) => (
            <SettingRow key={item} last={index === 5} />
          ))}
        </View>

        <SectionHeading />
        {/* Seller promotional image banner */}
        <Skeleton
          width="100%"
          height={104}
          radius={19}
          style={{ marginTop: 14 }}
        />

        {/* Logout and brand footer */}
        <Skeleton
          width="100%"
          height={54}
          radius={17}
          style={{ marginTop: 22 }}
        />
        <View style={styles.skeletonBrand}>
          <Skeleton width={50} height={50} radius={16} />
          <Skeleton
            width={72}
            height={15}
            radius={6}
            style={{ marginTop: 10 }}
          />
          <Skeleton
            width={135}
            height={8}
            radius={4}
            style={{ marginTop: 7 }}
          />
          <Skeleton
            width={175}
            height={8}
            radius={4}
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { logout } = useAuth();
  const loadProfile = useCallback(async () => {
    try {
      const response = await api.get("/auth/me");
      const data = response?.data;

      const currentUser = data?.user || data?.data?.user || data?.data || data;

      if (currentUser && typeof currentUser === "object") {
        setUser(currentUser);
        // Cache only profile display data. Never cache auth tokens here.
        await AsyncStorage.setItem(
          PROFILE_CACHE_KEY,
          JSON.stringify(currentUser),
        );
      }
    } catch (error) {
      console.log("PROFILE LOAD ERROR:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const hydrateAndRefresh = async () => {
      try {
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (active && cached) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === "object") {
            setUser(parsed);
            setLoading(false);
          }
        }
      } catch (error) {
        console.log("PROFILE CACHE READ ERROR:", error);
      }

      // Fetch current profile after showing cached data, if available.
      if (active) void loadProfile();
    };

    void hydrateAndRefresh();
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  const firstName = useMemo(() => {
    if (user?.firstName) return user.firstName;

    if (user?.name) {
      return user.name.split(" ")[0];
    }

    return "User";
  }, [user]);

  const fullName = useMemo(() => {
    if (user?.firstName || user?.lastName) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim();
    }

    return user?.name || "User";
  }, [user]);

  const profileImage = normalizeImageUrl(user?.image || user?.avatar);

  const navigate = (route?: string) => {
    if (!route) return;

    try {
      router.push(route as any);
    } catch (error) {
      console.log("NAVIGATION ERROR:", error);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await logout();
      setLogoutModalVisible(false);
      router.replace("/(auth)/login-modal" as any);
    } catch (error) {
      console.error("LOGOUT ERROR:", error);
    } finally {
      setLoggingOut(false);
    }
  };

  const renderSectionHeader = (
    title: string,
    rightText?: string,
    onPress?: () => void,
  ) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>

      {rightText ? (
        <Pressable
          onPress={onPress}
          hitSlop={8}
          style={({ pressed }) => [
            styles.sectionRightButton,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.sectionRightText}>{rightText}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderMenuItem = (item: MenuItem, index: number) => (
    <Pressable
      key={`${item.title}-${index}`}
      onPress={() => navigate(item.route)}
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
    >
      <View style={styles.menuIconBox}>
        <Ionicons name={item.icon} size={17} color={colors.primary} />
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{item.title}</Text>

        {item.subtitle ? (
          <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
        ) : null}
      </View>

      {item.rightText ? (
        <Text style={styles.menuRightText} numberOfLines={1}>
          {item.rightText}
        </Text>
      ) : null}

      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );

  // These are the profile/settings features already relevant
  // to the current Odikart app.
  const profileItems: MenuItem[] = [
    {
      icon: "person-outline",
      title: "Edit profile",
      route: "/profile/edit",
    },
    {
      icon: "location-outline",
      title: "Saved addresses",
      route: "/checkout/address",
    },
    {
      icon: "notifications-outline",
      title: "Notification settings",
      route: "/profile/notifications",
    },
  ];

  const supportItems: MenuItem[] = [
    {
      icon: "help-circle-outline",
      title: "Help & Support",
      subtitle: "Get help with orders, payments and account",
      route: "/help",
    },
    {
      icon: "information-circle-outline",
      title: "About Odikart",
      subtitle: "Learn more about Odikart",
      route: "/about",
    },
    {
      icon: "document-text-outline",
      title: "Terms & Policies",
      subtitle: "Terms, privacy and important policies",
      route: "/terms",
    },
  ];

  if (loading) {
    return <ProfileSkeleton />;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#F4F6FF"
        translucent={false}
      />
      <View style={styles.fixedHeaderContainer}>
        <View style={styles.brandHeader}>
          <View style={styles.brandHeaderLeft}>
            <View style={styles.brandBag}>
              <Ionicons name="bag-handle" size={24} color="#3730A3" />
            </View>
            <Text style={styles.brandHeaderTitle}>OdiKart</Text>
          </View>
          <Pressable
            style={styles.headerIconButton}
            onPress={() => navigate("/notifications")}
          >
            <Ionicons name="notifications-outline" size={23} color="#11154D" />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>
      </View>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.referenceContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Pressable
          style={({ pressed }) => [
            styles.identityCard,
            pressed && { opacity: 0.92 },
          ]}
          onPress={() => navigate("/profile/edit")}
        >
          <View style={styles.identityAvatar}>
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.identityAvatarImage}
              />
            ) : (
              <Text style={styles.identityAvatarText}>
                {firstName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.identityDetails}>
            <Text style={styles.identityName} numberOfLines={1}>
              {fullName}
            </Text>
            <Text style={styles.identityMeta} numberOfLines={1}>
              {user?.email || "Add your email address"}
            </Text>
            {user?.phone ? (
              <Text style={styles.identityMeta}>{user.phone}</Text>
            ) : null}
            <View style={styles.verifiedPill}>
              <Ionicons name="checkmark-circle" size={16} color="#059669" />
              <Text style={styles.verifiedText}>Your OdiKart account</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={21} color="#647099" />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.plusBanner,
            pressed && { opacity: 0.9 },
          ]}
          onPress={() => navigate("/profile/coupons")}
        >
          <LinearGradient
            colors={["#2563EB", "#4F46E5", "#7C3AED"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.plusBannerGradient}
          >
            <View style={styles.plusCrown}>
              <Ionicons name="trophy" size={27} color="#FFE08A" />
            </View>
            <View style={styles.plusCopy}>
              <Text style={styles.plusTitle}>OdiKart Plus</Text>
              <Text style={styles.plusSubtitle}>
                Shop more. Save more. Discover great deals.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>

        <View style={styles.shortcutGrid}>
          {[
            {
              title: "Orders",
              subtitle: "My orders",
              icon: "bag-check" as IconName,
              tint: "#4F46E5",
              bg: "#EEEAFE",
              route: "/orders/orders",
            },
            {
              title: "Wishlist",
              subtitle: "Saved items",
              icon: "heart" as IconName,
              tint: "#DB2777",
              bg: "#FCE7F3",
              route: "/wishlist",
            },
            {
              title: "Cart",
              subtitle: "View cart",
              icon: "cart" as IconName,
              tint: "#2563EB",
              bg: "#DBEAFE",
              route: "/cart",
            },
            {
              title: "Coupons",
              subtitle: "My offers",
              icon: "ticket" as IconName,
              tint: "#C026D3",
              bg: "#FAE8FF",
              route: "/profile/coupons",
            },
          ].map((item) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.shortcutCard,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => navigate(item.route)}
            >
              <View style={[styles.shortcutIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={23} color={item.tint} />
              </View>
              <Text style={styles.shortcutTitle}>{item.title}</Text>
              <Text style={styles.shortcutSubtitle}>{item.subtitle}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View OdiKart special offers"
          style={({ pressed }) => [
            styles.imageBannerPressable,
            pressed && styles.imageBannerPressed,
          ]}
          onPress={() => navigate("/profile/coupons")}
        >
          <ImageBackground
            source={require("../../../assets/images/coupon.webp")}
            style={styles.imageBanner}
            imageStyle={styles.imageBannerImage}
            resizeMode="cover"
          />
        </Pressable>

        {renderSectionHeader("Account & Settings")}
        <View style={styles.settingsCard}>
          {[
            {
              icon: "location" as IconName,
              title: "My Addresses",
              subtitle: "Manage your delivery addresses",
              tint: "#2563EB",
              bg: "#DBEAFE",
              route: "/checkout/address",
            },
            {
              icon: "card" as IconName,
              title: "Payment Methods",
              subtitle: "Manage your payment options",
              tint: "#2563EB",
              bg: "#DBEAFE",
              route: "/checkout/*",
            },
            {
              icon: "wallet" as IconName,
              title: "My UPI & Wallet",
              subtitle: "View your payment options",
              tint: "#D97706",
              bg: "#FEF3C7",
              route: "/checkout/*",
            },
            {
              icon: "notifications" as IconName,
              title: "Notifications",
              subtitle: "Manage your preferences",
              tint: "#E11D48",
              bg: "#FFE4E6",
              route: "/notifications",
            },
            {
              icon: "headset" as IconName,
              title: "Help & Support",
              subtitle: "We're here to help",
              tint: "#2563EB",
              bg: "#DBEAFE",
              route: "/help",
            },
            {
              icon: "information-circle" as IconName,
              title: "About OdiKart",
              subtitle: "App version and information",
              tint: "#7C3AED",
              bg: "#EDE9FE",
              route: "/about",
            },
          ].map((item, index, all) => (
            <Pressable
              key={item.title}
              style={({ pressed }) => [
                styles.settingRow,
                index < all.length - 1 && styles.settingRowDivider,
                pressed && { backgroundColor: "#F8FAFF" },
              ]}
              onPress={() => navigate(item.route)}
            >
              <View style={[styles.settingIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={21} color={item.tint} />
              </View>
              <View style={styles.settingCopy}>
                <Text style={styles.settingTitle}>{item.title}</Text>
                <Text style={styles.settingSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color="#647099" />
            </Pressable>
          ))}
        </View>

        {renderSectionHeader("Grow with OdiKart")}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Become a seller on OdiKart"
          style={({ pressed }) => [
            styles.imageBannerPressable,
            styles.sellerBannerSpacing,
            pressed && styles.imageBannerPressed,
          ]}
          onPress={() => navigate("/seller")}
        >
          <ImageBackground
            source={require("../../../assets/images/seller.webp")}
            style={styles.imageBanner}
            imageStyle={styles.imageBannerImage}
            resizeMode="cover"
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutPressed,
          ]}
          onPress={() => setLogoutModalVisible(true)}
        >
          <Ionicons name="log-out-outline" size={19} color="#E11D48" />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
        <Text style={styles.versionText}>OdiKart • v1.0.0</Text>
        <View style={styles.brandFooter}>
          <View style={styles.brandMark}>
            <Ionicons
              name="bag-handle-outline"
              size={24}
              color={colors.primary}
            />
          </View>
          <Text style={styles.brandName}>OdiKart</Text>
          <Text style={styles.brandTagline}>Shop local. Shop smarter.</Text>
          <Text style={styles.footerText}>
            Thank you for shopping with OdiKart
          </Text>
        </View>
        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.logoutModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLogoutModalVisible(false)}
            accessibilityLabel="Close logout confirmation"
          />
          <View style={styles.logoutModalCard}>
            <View style={styles.logoutModalIcon}>
              <Ionicons name="log-out-outline" size={28} color="#E11D48" />
            </View>
            <Text style={styles.logoutModalTitle}>Log out?</Text>
            <Text style={styles.logoutModalMessage}>
              Are you sure you want to log out of your OdiKart account?
            </Text>
            <View style={styles.logoutModalActions}>
              <Pressable
                accessibilityRole="button"
                disabled={loggingOut}
                onPress={() => setLogoutModalVisible(false)}
                style={({ pressed }) => [
                  styles.logoutCancelButton,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={styles.logoutCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={loggingOut}
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.logoutConfirmButton,
                  pressed && { opacity: 0.85 },
                  loggingOut && { opacity: 0.65 },
                ]}
              >
                <Text style={styles.logoutConfirmText}>
                  {loggingOut ? "Logging out..." : "Yes, log out"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F6FF",
  },

  container: {
    flex: 1,
    backgroundColor: "#F4F6FF",
  },

  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 30,
  },

  /* ==========================================================
     SKELETON
  ========================================================== */

  skeletonBlock: {
    backgroundColor: "#E5EAF1",
  },

  skeletonHeader: {
    minHeight: 62,
    paddingHorizontal: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  skeletonHeaderUser: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonHeaderText: {
    flex: 1,
    marginLeft: 10,
  },

  skeletonProfileCard: {
    marginTop: 5,
    backgroundColor: colors.surface,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },

  skeletonProfileTop: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonProfileText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  skeletonProfileFooter: {
    minHeight: 35,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonQuickActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },

  skeletonQuickAction: {
    flex: 1,
    minHeight: 53,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonSectionHeader: {
    minHeight: 43,
    paddingHorizontal: 2,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  skeletonSimpleCard: {
    minHeight: 59,
    paddingHorizontal: 11,
    backgroundColor: colors.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonOfferText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },

  skeletonMenuRow: {
    minHeight: 50,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonMenuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  skeletonMenuText: {
    flex: 1,
    marginLeft: 10,
  },

  skeletonBrand: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 10,
  },

  /* ==========================================================
     HEADER
  ========================================================== */

  topHeader: {
    minHeight: 76,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  headerUser: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
  },

  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },

  headerText: {
    flex: 1,
    marginLeft: 10,
  },

  helloText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },

  accountText: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.textMuted,
  },

  helpButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  helpText: {
    fontSize: 10.5,
    color: colors.primary,
    fontWeight: "800",
  },

  /* ==========================================================
     PROFILE CARD
  ========================================================== */

  profileCard: {
    marginTop: 5,
    backgroundColor: colors.surface,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },

  profileCardTop: {
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  profileSummaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  profileSummaryText: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  profileName: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  profileDetail: {
    marginTop: 3,
    fontSize: 9,
    color: colors.textSecondary,
  },

  profileCardFooter: {
    minHeight: 35,
    paddingHorizontal: 12,
    backgroundColor: "#F8FAFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
  },

  profileFooterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  profileFooterText: {
    fontSize: 8.5,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  profileFooterDivider: {
    width: 1,
    height: 14,
    marginHorizontal: 12,
    backgroundColor: "#DCE3EC",
  },

  /* ==========================================================
     QUICK ACTIONS
  ========================================================== */

  quickActions: {
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
  },

  quickAction: {
    flex: 1,
    minHeight: 64,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  quickActionPressed: {
    backgroundColor: colors.blueSoft,
  },

  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  quickText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 11.5,
    color: colors.text,
    fontWeight: "700",
  },

  /* ==========================================================
     SECTION HEADER
  ========================================================== */

  sectionHeader: {
    minHeight: 43,
    paddingHorizontal: 2,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  sectionTitle: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "800",
  },

  sectionRightButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },

  sectionRightText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: "800",
  },

  /* ==========================================================
     COMMON CARD
  ========================================================== */

  whiteCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
  },

  /* ==========================================================
     COUPONS
  ========================================================== */

  offerCard: {
    minHeight: 82,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9D5FF",
    backgroundColor: "#FAF5FF",
    flexDirection: "row",
    alignItems: "center",
  },

  offerPressed: {
    opacity: 0.72,
  },

  offerIcon: {
    width: 35,
    height: 35,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },

  offerContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  offerImage: {
    width: 58,
    height: 48,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#EDE9FE",
  },

  offerTitle: {
    fontSize: 11,
    color: colors.text,
    fontWeight: "800",
  },

  offerSubtitle: {
    marginTop: 3,
    fontSize: 8.5,
    color: colors.textSecondary,
  },

  /* ==========================================================
     REVIEWS
  ========================================================== */

  reviewCard: {
    minHeight: 78,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  reviewPressed: {
    backgroundColor: "#FAFAFA",
  },

  reviewIcon: {
    width: 37,
    height: 37,
    borderRadius: 10,
    backgroundColor: "#FFF7E6",
    alignItems: "center",
    justifyContent: "center",
  },

  reviewInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  reviewTitle: {
    fontSize: 11,
    color: colors.text,
    fontWeight: "800",
  },

  reviewSubtitle: {
    marginTop: 4,
    fontSize: 8.5,
    color: colors.textSecondary,
  },

  /* ==========================================================
     MENU
  ========================================================== */

  menuItem: {
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  menuItemPressed: {
    backgroundColor: "#F8FAFC",
  },

  menuIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  menuContent: {
    flex: 1,
    marginLeft: 10,
  },

  menuTitle: {
    fontSize: 10.5,
    color: colors.text,
    fontWeight: "600",
  },

  menuSubtitle: {
    marginTop: 2,
    fontSize: 8,
    color: colors.textMuted,
  },

  menuRightText: {
    maxWidth: 110,
    marginRight: 7,
    fontSize: 8.5,
    color: colors.textSecondary,
    textAlign: "right",
  },

  /* ==========================================================
     BECOME A SELLER
  ========================================================== */

  sellerCard: {
    minHeight: 82,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blueSoft,
    flexDirection: "row",
    alignItems: "center",
  },

  sellerPressed: {
    opacity: 0.72,
  },

  sellerIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  sellerContent: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  sellerTitle: {
    fontSize: 11.5,
    color: colors.text,
    fontWeight: "900",
  },

  sellerSubtitle: {
    marginTop: 4,
    fontSize: 8.5,
    color: colors.textSecondary,
    lineHeight: 12,
  },

  sellerImage: {
    width: 54,
    height: 48,
    borderRadius: 10,
    marginRight: 8,
    backgroundColor: "#DBEAFE",
  },

  sellerArrow: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ==========================================================
     LOGOUT
  ========================================================== */

  logoutButton: {
    height: 44,
    marginTop: 22,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },

  logoutPressed: {
    backgroundColor: colors.blueSoft,
  },

  logoutText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "800",
  },

  versionText: {
    marginTop: 9,
    textAlign: "center",
    fontSize: 8,
    color: colors.textMuted,
  },

  /* ==========================================================
     BRAND FOOTER
  ========================================================== */

  brandFooter: {
    alignItems: "center",
    paddingTop: 32,
    paddingBottom: 10,
  },

  brandMark: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  brandName: {
    marginTop: 9,
    fontSize: 18,
    fontWeight: "900",
    color: colors.primary,
  },

  brandTagline: {
    marginTop: 3,
    fontSize: 9,
    color: colors.textMuted,
  },

  footerLine: {
    width: "55%",
    height: 1,
    marginTop: 17,
    backgroundColor: "#E5E7EB",
  },

  footerText: {
    marginTop: 10,
    fontSize: 8.5,
    color: colors.textMuted,
  },

  bottomSpace: {
    height: 25,
  },

  /* Wide, locally bundled promotional banners matching the reference UI */
  imageBannerPressable: {
    width: "100%",
    marginTop: 16,
    borderRadius: 19,
    overflow: "hidden",
    backgroundColor: "#E8EAFE",
  },
  sellerBannerSpacing: {
    marginTop: 14,
  },
  imageBanner: {
    width: "100%",
    aspectRatio: 3.55,
    justifyContent: "center",
  },
  imageBannerImage: {
    borderRadius: 19,
  },
  imageBannerPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.995 }],
  },

  /* Reference-inspired OdiKart profile layout */
  fixedHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "#F4F6FF",
  },
  referenceContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 30 },
  brandHeader: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  brandHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandBag: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7FF",
  },
  brandHeaderTitle: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.8,
    color: "#11154D",
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "#E7E9F7",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#F43F5E",
  },
  identityCard: {
    minHeight: 126,
    padding: 15,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EAECF8",
    gap: 12,
    shadowColor: "#343B85",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  identityAvatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#E3E5FF",
    borderWidth: 4,
    borderColor: "#F2F2FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  identityAvatarImage: { width: "100%", height: "100%" },
  identityAvatarText: { fontSize: 31, fontWeight: "900", color: "#4338CA" },
  identityDetails: { flex: 1, minWidth: 0 },
  identityName: {
    fontSize: 19,
    fontWeight: "900",
    color: "#11154D",
    marginBottom: 4,
  },
  identityMeta: { fontSize: 12, color: "#68739A", marginTop: 2 },
  verifiedPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E3F8EF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  verifiedText: { color: "#047857", fontSize: 10, fontWeight: "800" },
  plusBanner: {
    minHeight: 86,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 19,
    backgroundColor: "transparent",
    padding: 0,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 0,
    overflow: "hidden",
  },
  plusBannerGradient: {
    minHeight: 86,
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  plusCrown: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
  },
  plusCopy: { flex: 1 },
  plusTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  plusSubtitle: {
    color: "#F0EFFF",
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  shortcutGrid: { flexDirection: "row", gap: 9, marginTop: 16 },
  shortcutCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 112,
    paddingVertical: 12,
    paddingHorizontal: 3,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECEEFA",
  },
  shortcutIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  shortcutTitle: { color: "#171A4D", fontSize: 12, fontWeight: "900" },
  shortcutSubtitle: {
    color: "#7B83A6",
    fontSize: 9,
    marginTop: 4,
    textAlign: "center",
  },
  promoBanner: {
    minHeight: 142,
    marginTop: 18,
    marginBottom: 9,
    borderRadius: 19,
    padding: 15,
    backgroundColor: "#E3EDFF",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  promoCopy: { flex: 1, paddingRight: 5, zIndex: 1 },
  promoTitle: {
    color: "#11154D",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 22,
  },
  promoSubtitle: {
    color: "#35416D",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
    maxWidth: 190,
  },
  promoButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "#5B35F5",
    borderRadius: 22,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  promoButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  promoImage: {
    width: 105,
    height: 105,
    borderRadius: 16,
    marginLeft: -3,
    backgroundColor: "#D5DFFF",
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#EAECF8",
    overflow: "hidden",
  },
  settingRow: {
    minHeight: 72,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  settingRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8EAF4",
  },
  settingIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  settingCopy: { flex: 1, minWidth: 0 },
  settingTitle: { color: "#171A4D", fontSize: 13, fontWeight: "800" },
  settingSubtitle: { color: "#7B83A6", fontSize: 10.5, marginTop: 4 },
  sellerFeature: {
    minHeight: 120,
    borderRadius: 19,
    padding: 14,
    backgroundColor: "#E6ECFF",
    borderWidth: 1,
    borderColor: "#D9E0FF",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  sellerFeatureCopy: { flex: 1, paddingRight: 8 },
  sellerFeatureTitle: { color: "#171A4D", fontSize: 16, fontWeight: "900" },
  sellerFeatureSubtitle: {
    color: "#536087",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  sellerFeatureLink: {
    color: "#4F46E5",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 9,
  },
  sellerFeatureImage: {
    width: 96,
    height: 88,
    borderRadius: 15,
    backgroundColor: "#D3DBFF",
  },
  logoutButton: {
    height: 54,
    marginTop: 22,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#FDA4AF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  logoutText: { fontSize: 14, color: "#E11D48", fontWeight: "900" },
  logoutModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(12, 16, 45, 0.45)",
  },
  logoutModalCard: {
    width: "100%",
    maxWidth: 360,
    padding: 24,
    borderRadius: 22,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  logoutModalIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F2",
    marginBottom: 15,
  },
  logoutModalTitle: {
    color: "#11154D",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  logoutModalMessage: {
    marginTop: 9,
    color: "#68739A",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  logoutModalActions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginTop: 23,
  },
  logoutCancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E3E6F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  logoutCancelText: {
    color: "#343B60",
    fontSize: 13,
    fontWeight: "800",
  },
  logoutConfirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E11D48",
  },
  logoutConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
