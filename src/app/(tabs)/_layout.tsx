import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/useAuth";

// OdiKart indigo / purple palette
const NAV = {
  primary: "#4F46E5",
  primaryDark: "#3730A3",
  activeBg: "#EEF0FF",
  activeBorder: "#D9D6FE",
  inactive: "#6B7280",
  pill: "rgba(255,255,255,0.97)",
  border: "#E8E7FF",
  shadow: "#312E81",
};

type NavItem = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  fallbackPath: string;
};

// ====================================================
// ANIMATED TAB ICON
// ====================================================

function ShiningTabIcon({
  focused,
  color,
  iconName,
}: {
  focused: boolean;
  color: string;
  iconName: keyof typeof Ionicons.glyphMap;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;

    if (focused) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.06,
              duration: 650,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.16,
              duration: 650,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0,
              duration: 650,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animation.start();
    } else {
      scale.stopAnimation();
      glowOpacity.stopAnimation();
      scale.setValue(1);
      glowOpacity.setValue(0);
    }

    return () => animation?.stop();
  }, [focused, scale, glowOpacity]);

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.iconGlow,
          { backgroundColor: NAV.primary, opacity: glowOpacity },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={iconName} size={21} color={color} />
      </Animated.View>
    </View>
  );
}

// ====================================================
// FIVE-ITEM FLOATING NAVBAR
// Home | Categories | Trending | Wishlist | Offers
// ====================================================

const NAV_ITEMS: NavItem[] = [
  {
    name: "index",
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
    fallbackPath: "/(tabs)",
  },
  {
    name: "categories",
    label: "Categories",
    icon: "grid-outline",
    activeIcon: "grid",
    fallbackPath: "/(tabs)/categories",
  },
  {
    name: "trending",
    label: "Trending",
    icon: "flame-outline",
    activeIcon: "flame",
    fallbackPath: "/(tabs)/trending",
  },
  {
    name: "wishlist",
    label: "Wishlist",
    icon: "heart-outline",
    activeIcon: "heart",
    fallbackPath: "/(tabs)/wishlist",
  },
  {
    name: "offers",
    label: "Offers",
    icon: "pricetag-outline",
    activeIcon: "pricetag",
    fallbackPath: "/(tabs)/offers",
  },
];

function FloatingTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const currentRoute = state.routes[state.index];
  const hideTabBar = currentRoute?.params?.hideTabBar === true;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hideTabBar ? 110 : 0,
      duration: hideTabBar ? 170 : 230,
      easing: hideTabBar
        ? Easing.in(Easing.cubic)
        : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hideTabBar, translateY]);

  const handleTabPress = (item: NavItem) => {
    const route = state.routes.find((r: any) => r.name === item.name);

    if (route) {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });

      if (route.name !== currentRoute?.name && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
      return;
    }

    router.push(item.fallbackPath as any);
  };

  return (
    <Animated.View
      pointerEvents={hideTabBar ? "none" : "box-none"}
      style={[
        styles.floatingWrapper,
        {
          bottom: Math.max(insets.bottom, 8) + 5,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.navPill}>
        {NAV_ITEMS.map((item) => {
          const focused = currentRoute?.name === item.name;
          const color = focused ? NAV.primary : NAV.inactive;

          return (
            <Pressable
              key={item.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={`${item.label} tab`}
              onPress={() => handleTabPress(item)}
              style={({ pressed }) => [
                styles.tabButton,
                focused && styles.activeTabButton,
                pressed && styles.tabPressed,
              ]}
            >
              <ShiningTabIcon
                focused={focused}
                color={color}
                iconName={focused ? item.activeIcon : item.icon}
              />
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
                style={[
                  styles.tabLabel,
                  {
                    color,
                    fontWeight: focused ? "800" : "600",
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ====================================================
// EXPO ROUTER TABS
// ====================================================

export default function TabsLayout() {
  const { user, loading: authLoading } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: NAV.primary,
        tabBarInactiveTintColor: NAV.inactive,
        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="categories" options={{ title: "Categories" }} />
      <Tabs.Screen name="trending" options={{ title: "Trending" }} />
      <Tabs.Screen name="wishlist" options={{ title: "Wishlist" }} />
      <Tabs.Screen name="offers" options={{ title: "Offers" }} />

      <Tabs.Screen
        name="profile"
        options={{ href: null, title: "Profile" }}
        listeners={{
          tabPress: (event) => {
            if (authLoading) return;

            if (!user) {
              event.preventDefault();
              router.push("/login-modal");
            }
          },
        }}
      />
    </Tabs>
  );
}

// ====================================================
// MODERN COMPACT FLOATING NAVBAR STYLES
// ====================================================

const styles = StyleSheet.create({
  floatingWrapper: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 16,
  },

  navPill: {
    minHeight: 62,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 34,
    backgroundColor: NAV.pill,
    borderWidth: 1,
    borderColor: NAV.border,
    shadowColor: NAV.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.13,
    shadowRadius: 14,
    elevation: 11,
  },

  tabButton: {
    flex: 1,
    minWidth: 0,
    height: 52,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    paddingHorizontal: 1,
  },

  activeTabButton: {
    backgroundColor: NAV.activeBg,
    borderWidth: 1,
    borderColor: NAV.activeBorder,
  },

  tabPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.96 }],
  },

  iconWrap: {
    width: 27,
    height: 25,
    alignItems: "center",
    justifyContent: "center",
  },

  iconGlow: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 14,
  },

  tabLabel: {
    fontSize: 9,
    lineHeight: 12,
    textAlign: "center",
    letterSpacing: 0,
  },
});
