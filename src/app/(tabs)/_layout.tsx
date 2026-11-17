import { Ionicons } from "@expo/vector-icons";
import { Tabs, router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/useAuth";
import {
  getWishlistFlyTarget,
  setWishlistFlyTarget,
  subscribeWishlistFly,
  type WishlistFlySource,
} from "../utils/wishlistFly";

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
        ]),
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
    fallbackPath: "/profile/coupons",
  },
];

function WishlistFlyOverlay() {
  const [visible, setVisible] = useState(false);
  const [imageUri, setImageUri] = useState("");
  const left = useRef(new Animated.Value(0)).current;
  const top = useRef(new Animated.Value(0)).current;
  const width = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return subscribeWishlistFly((source: WishlistFlySource) => {
      const target = getWishlistFlyTarget();
      if (!target || !source.imageUri) return;

      left.stopAnimation();
      top.stopAnimation();
      width.stopAnimation();
      height.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();

      left.setValue(source.x);
      top.setValue(source.y);
      width.setValue(Math.max(38, Math.min(source.width, 116)));
      height.setValue(Math.max(38, Math.min(source.height, 116)));
      opacity.setValue(1);
      scale.setValue(1);
      setImageUri(source.imageUri);
      setVisible(true);

      Animated.parallel([
        Animated.timing(left, {
          toValue: target.x - 15,
          duration: 680,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(top, {
          toValue: target.y - 15,
          duration: 680,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(width, {
          toValue: 30,
          duration: 680,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(height, {
          toValue: 30,
          duration: 680,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(430),
          Animated.timing(opacity, {
            toValue: 0.25,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.delay(520),
          Animated.spring(scale, {
            toValue: 0.55,
            speed: 24,
            bounciness: 5,
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    });
  }, [height, left, opacity, scale, top, width]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => setVisible(false)}
    >
      <View pointerEvents="none" style={styles.flyOverlay}>
        <Animated.View
          style={[
            styles.flyImageFrame,
            {
              left,
              top,
              width,
              height,
              opacity,
              transform: [{ scale }],
            },
          ]}
        >
          <Animated.Image
            source={{ uri: imageUri }}
            resizeMode="contain"
            style={styles.flyImage}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

function FloatingTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const wishlistTabRef = useRef<View>(null);
  const currentRoute = state.routes[state.index];
  const hideTabBar = currentRoute?.params?.hideTabBar === true;

  const measureWishlistTarget = () => {
    requestAnimationFrame(() => {
      wishlistTabRef.current?.measureInWindow((x, y, width, height) => {
        setWishlistFlyTarget({
          x: x + width / 2,
          y: y + height / 2,
        });
      });
    });
  };

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: hideTabBar ? 110 : 0,
      duration: hideTabBar ? 170 : 230,
      easing: hideTabBar ? Easing.in(Easing.cubic) : Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (!hideTabBar) measureWishlistTarget();
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
    <>
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
                ref={item.name === "wishlist" ? wishlistTabRef : undefined}
                onLayout={item.name === "wishlist" ? measureWishlistTarget : undefined}
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
      <WishlistFlyOverlay />
    </>
  );
}

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
  flyOverlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  flyImageFrame: {
    position: "absolute",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "#E0E7FF",
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 12,
  },
  flyImage: {
    width: "100%",
    height: "100%",
  },
});
