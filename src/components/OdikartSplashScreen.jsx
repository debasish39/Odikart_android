import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

export default function OdikartSplashScreen() {
  const { width, height } = useWindowDimensions();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const floatY = useRef(new Animated.Value(0)).current;
  const artDrift = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0.35)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(180),
        Animated.parallel([
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(contentY, {
            toValue: 0,
            duration: 650,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]);

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -5,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const artLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(artDrift, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(artDrift, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0.35,
          duration: 950,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    entrance.start();
    floatLoop.start();
    artLoop.start();
    pulseLoop.start();

    return () => {
      entrance.stop();
      floatLoop.stop();
      artLoop.stop();
      pulseLoop.stop();
    };
  }, [
    logoOpacity,
    logoScale,
    floatY,
    artDrift,
    dotPulse,
    contentOpacity,
    contentY,
  ]);

  const logoSize = Math.min(width * 0.63, height * 0.69, 300);
  const compact = height < 700;
  const driftY = artDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const driftX = artDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 7],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={["#FFFFFF", "#F2F4FF", "#EDE9FE"]}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Soft side artwork in OdiKart indigo, purple and blue tones, kept away from the logo. */}
        <View style={[styles.sideGlow, styles.glowTopLeft]} />
        <View style={[styles.sideGlow, styles.glowBottomRight]} />
        <View style={[styles.sideRing, styles.ringLeft]} />
        <View style={[styles.sideRing, styles.ringRight]} />

        <Animated.View
          style={[
            styles.artCluster,
            styles.artLeft,
            { transform: [{ translateY: driftY }, { translateX: driftX }] },
          ]}
        >
          <View style={[styles.artBlob, styles.blobBlue]} />
          <View style={[styles.artBlob, styles.blobLavender]} />
          <View style={styles.artLine} />
          <View style={[styles.artDot, styles.dotBlue]} />
          <View style={[styles.artDot, styles.dotViolet]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.artCluster,
            styles.artRight,
            { transform: [{ translateY: Animated.multiply(driftY, -1) }, { translateX: Animated.multiply(driftX, -1) }] },
          ]}
        >
          <View style={[styles.artBlob, styles.blobPeach]} />
          <View style={[styles.artBlob, styles.blobMint]} />
          <View style={styles.artLineRight} />
          <View style={[styles.artDot, styles.dotMint]} />
          <View style={[styles.artDot, styles.dotPeach]} />
        </Animated.View>

        <Animated.View style={[styles.pulseDot, { opacity: dotPulse }]} />
        <Animated.View style={[styles.pulseDotSmall, { opacity: dotPulse }]} />
      </View>

      <View style={styles.content}>
        <Animated.View
          style={[
            styles.eyebrow,
            { opacity: contentOpacity, transform: [{ translateY: contentY }] },
          ]}
        >
          <View style={styles.eyebrowLine} />
          {/* <Text style={styles.eyebrowText}>A BETTER WAY TO SHOP</Text> */}
          <View style={styles.eyebrowLine} />
        </Animated.View>

        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: floatY }],
            },
          ]}
        >
          <Image
            source={require("../../assets/images/odikart-splash.png")}
            style={{ width: logoSize, height: logoSize }}
            resizeMode="contain"
            accessibilityLabel="Odikart logo"
          />
        </Animated.View>

      </View>

      {/* Footer brand logo */}
      <Animated.View
        style={[
          styles.footerBrand,
          {
            opacity: contentOpacity,
            transform: [{ translateY: contentY }],
            paddingBottom: compact ? 18 : 26,
          },
        ]}
      >
        <Image
          source={require("../../assets/images/logo.webp")}
          style={{
            width: Math.min(width * 0.42, 190),
            height: compact ? 42 : 50,
          }}
          resizeMode="contain"
          accessibilityLabel="Odikart footer logo"
        />
        <Text style={styles.tagline}>Everything you love, all in one place.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingTop: 12,
    paddingBottom: 20,
  },
  sideGlow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  glowTopLeft: {
    top: -90,
    left: -100,
    backgroundColor: "rgba(59,130,246,0.10)",
  },
  glowBottomRight: {
    bottom: -75,
    right: -100,
    backgroundColor: "rgba(124,58,237,0.11)",
  },
  sideRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.15)",
  },
  ringLeft: {
    left: -130,
    top: "32%",
  },
  ringRight: {
    right: -130,
    top: "54%",
    width: 220,
    height: 220,
    borderRadius: 110,
    borderColor: "rgba(59,130,246,0.13)",
  },
  artCluster: {
    position: "absolute",
    width: 115,
    height: 145,
  },
  artLeft: {
    left: -23,
    top: "19%",
  },
  artRight: {
    right: -24,
    bottom: "21%",
  },
  artBlob: {
    position: "absolute",
    borderRadius: 26,
  },
  blobBlue: {
    width: 58,
    height: 76,
    left: 18,
    top: 16,
    backgroundColor: "rgba(59,130,246,0.15)",
    transform: [{ rotate: "-18deg" }],
  },
  blobLavender: {
    width: 42,
    height: 56,
    left: 48,
    top: 48,
    borderRadius: 22,
    backgroundColor: "rgba(124,58,237,0.17)",
    transform: [{ rotate: "24deg" }],
  },
  blobPeach: {
    width: 55,
    height: 70,
    left: 22,
    top: 20,
    backgroundColor: "rgba(79,70,229,0.14)",
    transform: [{ rotate: "16deg" }],
  },
  blobMint: {
    width: 43,
    height: 58,
    left: 48,
    top: 54,
    borderRadius: 22,
    backgroundColor: "rgba(99,102,241,0.16)",
    transform: [{ rotate: "-22deg" }],
  },
  artLine: {
    position: "absolute",
    left: 20,
    top: 105,
    width: 70,
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(59,130,246,0.28)",
    transform: [{ rotate: "-25deg" }],
  },
  artLineRight: {
    position: "absolute",
    right: 10,
    top: 110,
    width: 68,
    height: 2,
    borderRadius: 2,
    backgroundColor: "rgba(124,58,237,0.25)",
    transform: [{ rotate: "22deg" }],
  },
  artDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotBlue: {
    top: 7,
    left: 78,
    backgroundColor: "#3B82F6",
  },
  dotViolet: {
    bottom: 12,
    left: 20,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#7C3AED",
  },
  dotMint: {
    top: 9,
    right: 20,
    backgroundColor: "#6366F1",
  },
  dotPeach: {
    bottom: 8,
    right: 25,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#4F46E5",
  },
  pulseDot: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#3B82F6",
    top: "27%",
    right: "18%",
  },
  pulseDotSmall: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#7C3AED",
    bottom: "30%",
    left: "17%",
  },
  eyebrow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 25,
  },
  eyebrowLine: {
    width: 20,
    height: 1,
    backgroundColor: "#C7D2FE",
  },
  eyebrowText: {
    color: "#6366A1",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  footerBrand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  tagline: {
    marginTop: 4,
    color: "#4B4F78",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  benefits: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginTop: 22,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  benefitDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  benefitText: {
    color: "#62658A",
    fontSize: 11,
    fontWeight: "600",
  },
  benefitDivider: {
    width: 1,
    height: 12,
    backgroundColor: "#DFE0EB",
  },
  bottom: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingTrack: {
    width: 112,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#E0E7FF",
    overflow: "hidden",
  },
  loadingFill: {
    width: "100%",
    height: "100%",
    borderRadius: 4,
    overflow: "hidden",
  },
  footer: {
    marginTop: 15,
    color: "#999BB0",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.7,
    textAlign: "center",
  },
});
