import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  resendSignupOTP,
  verifySignupOTP,
} from "../../api/auth_signup_api";

import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

export default function OTP() {
  const params = useLocalSearchParams<{
    email?: string;
    purpose?: string;
  }>();

  const email = String(params.email || "").trim();

  const { login } = useAuth();

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    if (timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async () => {
    const cleanOtp = otp.replace(/\D/g, "").slice(0, 6);

    if (!email) {
      Alert.alert("Error", "Email address is missing.");
      return;
    }

    if (cleanOtp.length !== 6) {
      Alert.alert("Invalid OTP", "Please enter the 6-digit OTP.");
      return;
    }

    try {
      setLoading(true);

      const data = await verifySignupOTP(email, cleanOtp);

      if (!data?.success || !data?.token) {
        throw new Error(
          data?.message || "OTP verification failed."
        );
      }

      await login(data.token, data.user || null);

      Alert.alert(
        "Account Created 🎉",
        "Your Odikart account has been created successfully.",
        [
          {
            text: "Continue",
            onPress: () => router.replace("/(tabs)"),
          },
        ]
      );
    } catch (error: any) {
      console.log("VERIFY SIGNUP OTP ERROR:", error);

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to verify OTP.";

      Alert.alert("Verification Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      Alert.alert("Error", "Email address is missing.");
      return;
    }

    if (timer > 0 || resending) return;

    try {
      setResending(true);

      const data = await resendSignupOTP(email);

      if (!data?.success) {
        throw new Error(
          data?.message || "Unable to resend OTP."
        );
      }

      setOtp("");
      setTimer(30);

      Alert.alert(
        "OTP Sent",
        "A new OTP has been sent to your email."
      );
    } catch (error: any) {
      console.log("RESEND SIGNUP OTP ERROR:", error);

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to resend OTP.";

      Alert.alert("Resend Failed", message);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Text style={styles.icon}>✉</Text>
          </View>

          <Text style={styles.title}>Verify your email</Text>

          <Text style={styles.subtitle}>
            We've sent a 6-digit OTP to
          </Text>

          <Text style={styles.email}>
            {email || "your email"}
          </Text>

          <TextInput
            value={otp}
            onChangeText={(value) =>
              setOtp(
                value.replace(/\D/g, "").slice(0, 6)
              )
            }
            placeholder="Enter 6-digit OTP"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            style={styles.input}
          />

          <TouchableOpacity
            style={[
              styles.verifyButton,
              loading && styles.disabledButton,
            ]}
            disabled={loading}
            onPress={handleVerify}
          >
            {loading ? (
              <ActivityIndicator
                color={colors.textWhite}
              />
            ) : (
              <Text style={styles.verifyText}>
                Verify OTP
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>
              Didn't receive the OTP?
            </Text>

            <TouchableOpacity
              disabled={timer > 0 || resending}
              onPress={handleResend}
            >
              <Text
                style={[
                  styles.resendText,
                  (timer > 0 || resending) &&
                    styles.resendDisabled,
                ]}
              >
                {resending
                  ? "Sending..."
                  : timer > 0
                  ? ` Resend in ${timer}s`
                  : " Resend OTP"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 35,
  },

  backText: {
    fontSize: 32,
    lineHeight: 34,
    color: colors.text,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 22,
  },

  icon: {
    fontSize: 30,
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },

  email: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 30,
  },

  input: {
    height: 58,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
    color: colors.text,
    marginBottom: 18,
  },

  verifyButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.7,
  },

  verifyText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "700",
  },

  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 25,
  },

  resendLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  resendText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },

  resendDisabled: {
    color: colors.textMuted,
  },
});