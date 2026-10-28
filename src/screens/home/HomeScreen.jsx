import React from "react";
import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "700" }}>
        Odikart 🟠
      </Text>

      <Text style={{ marginTop: 10 }}>
        Home
      </Text>
    </View>
  );
}