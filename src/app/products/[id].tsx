import { Redirect, useLocalSearchParams } from "expo-router";
import React from "react";

export default function SharedProductRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // Wait until Expo Router provides the product ID.
  if (!id || typeof id !== "string") {
    return null;
  }

  // Reuse the existing product details screen.
  return <Redirect href={`/product/${encodeURIComponent(id)}` as any} />;
}
