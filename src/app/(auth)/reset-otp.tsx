import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { verifyResetOTP } from "../../api/auth_forgot_password";
import { colors } from "../../theme/colors";

export default function ResetOTPScreen() {
  const params = useLocalSearchParams<{ email?: string }>();

  const email =
    typeof params.email === "string" ? params.email : "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  }, []);

  const handleVerifyOTP = async () => {
    const cleanOTP = otp.replace(/\D/g, "").slice(0, 6);

    if (cleanOTP.length !== 6) {
      Alert.alert(
        "Invalid OTP",
        "Please enter the 6-digit OTP sent to your email."
      );
      return;
    }

    if (!email) {
      Alert.alert(
        "Session expired",
        "Please request a new password reset OTP."
      );
      router.replace("/(auth)/forgot-password");
      return;
    }

    try {
      setLoading(true);

      const data = await verifyResetOTP(email, cleanOTP);

      if (!data?.success) {
        throw new Error(
          data?.message || "OTP verification failed."
        );
      }

      Alert.alert(
        "OTP Verified",
        "Your OTP has been verified successfully."
      );

      router.push({
        pathname: "/(auth)/reset-password",
        params: {
          email,
          otp: cleanOTP,
        },
      });
    } catch (error: any) {
      console.log(
        "RESET OTP ERROR:",
        error?.response?.data || error
      );

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Invalid or expired OTP.";

      Alert.alert("OTP Verification", message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeOTP = (value: string) => {
    const cleanValue = value
      .replace(/\D/g, "")
      .slice(0, 6);

    setOtp(cleanValue);

    if (cleanValue.length === 6) {
      // Small delay so the final digit is visible
      setTimeout(() => {
        handleVerifyOTPWithValue(cleanValue);
      }, 150);
    }
  };

  const handleVerifyOTPWithValue = async (value: string) => {
    if (loading || !email || value.length !== 6) {
      return;
    }

    try {
      setLoading(true);

      const data = await verifyResetOTP(email, value);

      if (!data?.success) {
        throw new Error(
          data?.message || "OTP verification failed."
        );
      }

      router.push({
        pathname: "/(auth)/reset-password",
        params: {
          email,
          otp: value,
        },
      });
    } catch (error: any) {
      console.log(
        "AUTO VERIFY OTP ERROR:",
        error?.response?.data || error
      );

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Invalid or expired OTP.";

      Alert.alert("OTP Verification", message);
      setOtp("");
    } finally {
      setLoading(false);
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.text}
            />
          </Pressable>

          <Text style={styles.headerTitle}>
            Verify OTP
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="shield-checkmark-outline"
              size={42}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>
            Enter verification code
          </Text>

          <Text style={styles.description}>
            We've sent a 6-digit OTP to
          </Text>

          <Text style={styles.email}>
            {email}
          </Text>

          {/* OTP */}
          <View style={styles.otpContainer}>
            <TextInput
              ref={inputRef}
              value={otp}
              onChangeText={handleChangeOTP}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInput}
              editable={!loading}
              textContentType="oneTimeCode"
              autoComplete="sms-otp"
              placeholder="------"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <Text style={styles.helperText}>
            Enter the 6-digit code from your email
          </Text>

          {/* Verify */}
          <Pressable
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleVerifyOTP}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.textWhite}
              />
            ) : (
              <>
                <Text style={styles.buttonText}>
                  Verify OTP
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={colors.textWhite}
                />
              </>
            )}
          </Pressable>

          {/* Change Email */}
          <Pressable
            style={styles.changeEmailButton}
            onPress={() =>
              router.replace("/(auth)/forgot-password")
            }
            disabled={loading}
          >
            <Text style={styles.changeEmailText}>
              Use a different email
            </Text>
          </Pressable>
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

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },

  headerSpacer: {
    width: 42,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 45,
    alignItems: "center",
  },

  iconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },

  description: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },

  email: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },

  otpContainer: {
    width: "100%",
    marginTop: 32,
  },

  otpInput: {
    height: 64,
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 12,
    color: colors.text,
    textAlign: "center",
  },

  helperText: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
  },

  button: {
    width: "100%",
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 28,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "700",
  },

  changeEmailButton: {
    marginTop: 22,
    padding: 8,
  },

  changeEmailText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});