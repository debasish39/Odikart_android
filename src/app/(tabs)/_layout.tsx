import React, {
  useEffect,
  useRef,
} from "react";

import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  Tabs,
  router,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { colors } from "../../theme/colors";
import { useAuth } from "../../hooks/useAuth";


// ====================================================
// SHINING TAB ICON
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
  const scale = useRef(
    new Animated.Value(1)
  ).current;

  const glowOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const glowScale = useRef(
    new Animated.Value(0.8)
  ).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null =
      null;

    if (focused) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1.08,
              duration: 700,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0.28,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(glowScale, {
              toValue: 1.15,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 1,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(glowOpacity, {
              toValue: 0,
              duration: 700,
              useNativeDriver: true,
            }),
            Animated.timing(glowScale, {
              toValue: 0.8,
              duration: 700,
              useNativeDriver: true,
            }),
          ]),
        ])
      );

      animation.start();
    } else {
      scale.stopAnimation();
      glowOpacity.stopAnimation();
      glowScale.stopAnimation();

      scale.setValue(1);
      glowOpacity.setValue(0);
      glowScale.setValue(0.8);
    }

    return () => {
      animation?.stop();
    };
  }, [
    focused,
    scale,
    glowOpacity,
    glowScale,
  ]);

  return (
    <View style={styles.iconWrapper}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.iconGlow,
          {
            backgroundColor: colors.primary,
            opacity: glowOpacity,
            transform: [
              {
                scale: glowScale,
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={{
          transform: [
            {
              scale,
            },
          ],
        }}
      >
        <Ionicons
          name={iconName}
          size={focused ? 22 : 21}
          color={color}
        />
      </Animated.View>
    </View>
  );
}


// ====================================================
// CUSTOM ANIMATED TAB BAR
// ====================================================

function AnimatedTabBar({
  state,
  descriptors,
  navigation,
}: any) {
  const insets = useSafeAreaInsets();

  const translateY = useRef(
    new Animated.Value(0)
  ).current;

  const currentRoute =
    state.routes[state.index];

  const hideTabBar =
    currentRoute?.params?.hideTabBar === true;

  useEffect(() => {
    Animated.timing(
      translateY,
      {
        toValue: hideTabBar ? 120 : 0,
        duration: hideTabBar ? 170 : 230,
        easing: hideTabBar
          ? Easing.in(Easing.cubic)
          : Easing.out(Easing.cubic),
        useNativeDriver: true,
      }
    ).start();
  }, [
    hideTabBar,
    translateY,
  ]);

  const tabBarHeight =
    Platform.OS === "ios"
      ? 68 + insets.bottom
      : 68;

  return (
    <Animated.View
      style={[
        styles.tabBarContainer,
        {
          height: tabBarHeight,
          paddingBottom:
            Platform.OS === "ios"
              ? insets.bottom
              : 7,
          transform: [
            {
              translateY,
            },
          ],
        },
      ]}
    >
      <View
        style={styles.tabButtonsContainer}
      >
        {state.routes.map(
          (
            route: any,
            index: number
          ) => {
            const descriptor =
              descriptors[route.key];

            const options =
              descriptor.options;

            const isFocused =
              state.index === index;

            let iconName:
              keyof typeof Ionicons.glyphMap;

            if (route.name === "index") {
              iconName = isFocused
                ? "home"
                : "home-outline";
            } else if (
              route.name === "categories"
            ) {
              iconName = isFocused
                ? "grid"
                : "grid-outline";
            } else if (
              route.name === "profile"
            ) {
              iconName = isFocused
                ? "person"
                : "person-outline";
            } else {
              iconName =
                "ellipse-outline";
            }

            const label =
              options.tabBarLabel ??
              options.title ??
              route.name;

            const onPress = () => {
              const event =
                navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });

              if (
                !isFocused &&
                !event.defaultPrevented
              ) {
                navigation.navigate(
                  route.name
                );
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: "tabLongPress",
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{
                  selected: isFocused,
                }}
                accessibilityLabel={
                  options.tabBarAccessibilityLabel ??
                  `${label} tab`
                }
                testID={
                  options.tabBarButtonTestID
                }
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                  styles.tabButton,
                  pressed &&
                    styles.tabButtonPressed,
                ]}
              >
                <View
                  style={[
                    styles.iconContainer,
                    isFocused &&
                      styles.activeIconContainer,
                  ]}
                >
                  <ShiningTabIcon
                    focused={isFocused}
                    color={
                      isFocused
                        ? colors.primary
                        : colors.textMuted
                    }
                    iconName={iconName}
                  />
                </View>

                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isFocused
                        ? colors.primary
                        : colors.textMuted,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>
    </Animated.View>
  );
}


// ====================================================
// TABS LAYOUT
// ====================================================

export default function TabsLayout() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor:
          colors.primary,

        tabBarInactiveTintColor:
          colors.textMuted,

        tabBarHideOnKeyboard: true,
      }}
      tabBar={(props) => (
        <AnimatedTabBar {...props} />
      )}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      {/* CATEGORIES */}
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
        }}
      />

      {/* PROFILE */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
        listeners={{
          tabPress: (event) => {
            if (authLoading) {
              return;
            }

            if (!user) {
              event.preventDefault();

              router.push(
                "/login-modal"
              );

              return;
            }
          },
        }}
      />
    </Tabs>
  );
}


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",

    left: 0,
    right: 0,
    bottom: 0,

    width: "100%",

    backgroundColor: "#FFFFFF",

    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,

    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,

    borderTopWidth: 1,
    borderTopColor: "#EEF0FF",

    shadowColor: "#4338CA",

    shadowOffset: {
      width: 0,
      height: -4,
    },

    shadowOpacity: 0.12,

    shadowRadius: 20,

    elevation: 10,

    overflow: "visible",

    zIndex: 9999,
  },

  tabButtonsContainer: {
    flex: 1,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-around",

    paddingHorizontal: 8,
    paddingTop: 7,
  },

  tabButton: {
    flex: 1,

    height: 58,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: 16,
  },

  tabButtonPressed: {
    opacity: 0.72,
  },

  iconContainer: {
    width: 34,
    height: 30,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,
  },

  activeIconContainer: {
    width: 38,
    height: 32,

    backgroundColor: "#EEF0FF",

    borderRadius: 12,
  },

  iconWrapper: {
    width: 28,
    height: 28,

    alignItems: "center",
    justifyContent: "center",
  },

  iconGlow: {
    position: "absolute",

    width: 25,
    height: 25,

    borderRadius: 20,
  },

  tabLabel: {
    fontSize: 10,

    fontWeight: "700",

    marginTop: 2,

    textAlign: "center",
  },
});
