import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors } from "../theme/colors";
import { useCart } from "../context/CartContext"; // change path if yours is different

export default function FloatingCart() {
  const { cartItem, cartCount } = useCart();

  const scale = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0)).current;

  /*
   * Small animation whenever cart quantity changes
   */
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.04,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, [cartCount]);

  /*
   * Continuous subtle shine
   */
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(shine, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(shine, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, []);

  if (!cartCount) {
    return null;
  }

  const previewImages = cartItem
    .map((item: any) => {
      return (
        item.image ||
        item.productImage ||
        item.product?.image ||
        item.product?.media?.thumbnail ||
        ""
      );
    })
    .filter(Boolean)
    .slice(0, 3);

  const shineTranslate = shine.interpolate({
    inputRange: [0, 1],
    outputRange: [-220, 220],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale }],
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.cartBar,
          pressed && styles.pressed,
        ]}
        onPress={() => router.push("/(tabs)/cart")}
      >
        {/* Product images */}
        <View style={styles.images}>
          {previewImages.length > 0 ? (
            previewImages.map((image: string, index: number) => (
              <View
                key={`${image}-${index}`}
                style={[
                  styles.imageWrap,
                  index > 0 && styles.imageOverlap,
                ]}
              >
                <Image
                  source={{ uri: image }}
                  style={styles.image}
                  resizeMode="cover"
                />
              </View>
            ))
          ) : (
            <View style={styles.fallback}>
              <Ionicons
                name="bag-handle-outline"
                size={19}
                color="#FFFFFF"
              />
            </View>
          )}
        </View>

        {/* Text */}
        <View style={styles.textWrap}>
          <Text style={styles.title}>View cart</Text>

          <Text style={styles.subtitle}>
            {cartCount} {cartCount === 1 ? "item" : "items"}
          </Text>
        </View>

        {/* Arrow */}
        <Ionicons
          name="chevron-forward"
          size={20}
          color="#FFFFFF"
        />

        {/* Shine */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.shine,
            {
              transform: [
                {
                  translateX: shineTranslate,
                },
                {
                  rotate: "18deg",
                },
              ],
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 92,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },

  cartBar: {
    width: "72%",
    maxWidth: 320,
    minHeight: 50,

    paddingLeft: 7,
    paddingRight: 12,

    borderRadius: 17,

    backgroundColor: colors.primary,

    flexDirection: "row",
    alignItems: "center",

    overflow: "hidden",

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,

    elevation: 16,
  },

  pressed: {
    transform: [
      {
        scale: 0.97,
      },
    ],
  },

  images: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 58,
  },

  imageWrap: {
    width: 38,
    height: 38,

    borderRadius: 12,

    overflow: "hidden",

    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  imageOverlap: {
    marginLeft: -14,
  },

  image: {
    width: "100%",
    height: "100%",
  },

  fallback: {
    width: 38,
    height: 38,

    borderRadius: 12,

    backgroundColor: "rgba(255,255,255,0.18)",

    alignItems: "center",
    justifyContent: "center",
  },

  textWrap: {
    flex: 1,
    marginLeft: 9,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  subtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },

  shine: {
    position: "absolute",

    width: 55,
    height: 90,

    backgroundColor: "rgba(255,255,255,0.20)",

    left: -30,

    top: -20,
  },
});