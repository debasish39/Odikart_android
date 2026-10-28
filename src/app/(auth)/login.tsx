// app/(auth)/login.tsx
// Keep the old /login route working, but send users into the phone OTP flow.
// The actual OTP implementation remains in app/(auth)/phone-login.tsx.

import { Redirect } from "expo-router";

export default function LoginScreen() {
  return <Redirect href={"/login-modal" as any} />;
}

