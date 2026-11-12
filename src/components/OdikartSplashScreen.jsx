import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

export default function OdikartSplashScreen() {
  const { width, height } = useWindowDimensions();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.025)).current;

  useEffect(() => {
    const entrance = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    entrance.start();
    return () => entrance.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.container}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <Animated.Image
        source={require("../../assets/images/odikart-splash-reference.png")}
        resizeMode="stretch"
        accessibilityLabel="OdiKart splash screen"
        style={[
          styles.artwork,
          {
            width,
            height,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: "#3020A8",
  },
  artwork: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
