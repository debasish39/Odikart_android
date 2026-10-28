import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors } from "../theme/colors";

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* UFO Not Found Illustration */}
        <View style={styles.illustrationWrap}>
          <Image
            source={require("../../assets/images/not-found.webp")}
            style={styles.illustration}
            resizeMode="contain"
            accessibilityLabel="UFO searching for a missing package"
          />
        </View>

        {/* 404 */}
        <Text style={styles.code}>404</Text>

        <Text style={styles.title}>
          Oops! Page not found
        </Text>

        <Text style={styles.description}>
          Looks like this page has disappeared into space.
          Let's get you back to shopping on OdiKart!
        </Text>

        {/* Back to Home */}
        <Pressable
          style={({ pressed }) => [
            styles.homeButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.replace("/(tabs)")}
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
        >
          <Ionicons
            name="home-outline"
            size={20}
            color={colors.textWhite}
          />

          <Text style={styles.homeButtonText}>
            Back to Home
          </Text>

          <Ionicons
            name="arrow-forward"
            size={19}
            color={colors.textWhite}
          />
        </Pressable>

        {/* Go Back */}
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressedLight,
          ]}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          accessibilityRole="button"
          accessibilityLabel="Go Back"
        >
          <Ionicons
            name="arrow-back-outline"
            size={18}
            color={colors.primary}
          />

          <Text style={styles.backButtonText}>
            Go Back
          </Text>
        </Pressable>

        {/* Branding */}
        <View style={styles.brand}>
          <Ionicons
            name="bag-handle"
            size={17}
            color={colors.primary}
          />

          <Text style={styles.brandText}>
            OdiKart
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  illustrationWrap: {
    width: "100%",
    maxWidth: 310,
    height: 245,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  illustration: {
    width: "100%",
    height: "100%",
  },

  code: {
    marginTop: 8,
    fontSize: 58,
    lineHeight: 66,
    fontWeight: "900",
    color: colors.primary,
    letterSpacing: 3,
  },

  title: {
    marginTop: 5,
    fontSize: 23,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
  },

  description: {
    marginTop: 10,
    maxWidth: 330,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: colors.textSecondary,
  },

  homeButton: {
    width: "100%",
    height: 54,
    marginTop: 27,
    borderRadius: 17,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 4,
  },

  homeButtonText: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textWhite,
  },

  backButton: {
    height: 48,
    paddingHorizontal: 20,
    marginTop: 11,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  backButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },

  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },

  pressedLight: {
    backgroundColor: colors.blueSoft,
  },

  brand: {
    position: "absolute",
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  brandText: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.primary,
  },
});