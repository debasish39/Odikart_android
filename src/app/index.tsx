import { useRouter } from "expo-router";
import { useEffect } from "react";
import OdikartSplashScreen from "../components/OdikartSplashScreen.jsx";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(tabs)");
    }, 2800);

    return () => clearTimeout(timer);
  }, [router]);

  return <OdikartSplashScreen />;
}
