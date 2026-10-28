
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      initialRouteName="login-modal"
      screenOptions={{
        headerShown: false,
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen
        name="login-modal"
        options={{ presentation: "card" }}
      />
      <Stack.Screen
        name="login"
        options={{ presentation: "card" }}
      />
    </Stack>
  );
}
