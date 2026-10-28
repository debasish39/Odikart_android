import React, { useState } from "react";
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { forgotPassword } from "../../api/auth_forgot_password";
import { colors } from "../../theme/colors";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOTP = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert("Email required", "Please enter your email address.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      setLoading(true);

      const data = await forgotPassword(cleanEmail);

      if (!data?.success) {
        throw new Error(
          data?.message || "Unable to send password reset OTP."
        );
      }

      Alert.alert(
        "OTP Sent",
        "A password reset OTP has been sent to your email."
      );

      router.push({
        pathname: "/(auth)/reset-otp",
        params: {
          email: cleanEmail,
        },
      });
    } catch (error: any) {
      console.log("FORGOT PASSWORD ERROR:", error);

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Something went wrong. Please try again.";

      Alert.alert("Forgot Password", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.text}
            />
          </Pressable>

          <Text style={styles.headerTitle}>Forgot Password</Text>

          <View style={styles.headerSpacer} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="lock-open-outline"
              size={42}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>Reset your password</Text>

          <Text style={styles.description}>
            Enter the email address associated with your Odikart account.
            We'll send you an OTP to reset your password.
          </Text>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>

            <View style={styles.inputWrapper}>
              <Ionicons
                name="mail-outline"
                size={21}
                color={colors.textMuted}
              />

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                style={styles.input}
                returnKeyType="done"
                onSubmitEditing={handleSendOTP}
              />
            </View>
          </View>

          {/* Button */}
          <Pressable
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleSendOTP}
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
                  Send OTP
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={colors.textWhite}
                />
              </>
            )}
          </Pressable>

          {/* Login */}
          <Pressable
            style={styles.loginButton}
            onPress={() => router.replace("/(auth)/login")}
            disabled={loading}
          >
            <Text style={styles.loginText}>
              Remember your password?{" "}
              <Text style={styles.loginLink}>Login</Text>
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
    paddingTop: 40,
  },

  iconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 12,
  },

  description: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
  },

  inputContainer: {
    marginBottom: 22,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },

  inputWrapper: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: colors.text,
  },

  button: {
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "700",
  },

  loginButton: {
    alignItems: "center",
    marginTop: 24,
  },

  loginText: {
    color: colors.textSecondary,
    fontSize: 14,
  },

  loginLink: {
    color: colors.primary,
    fontWeight: "700",
  },
});