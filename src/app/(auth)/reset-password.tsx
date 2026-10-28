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
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { resetPassword } from "../../api/auth_forgot_password";
import { colors } from "../../theme/colors";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    otp?: string;
  }>();

  const email =
    typeof params.email === "string" ? params.email : "";

  const otp =
    typeof params.otp === "string" ? params.otp : "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!email || !otp) {
      Alert.alert(
        "Session expired",
        "Please start the password reset process again."
      );
      router.replace("/(auth)/forgot-password");
      return;
    }

    if (!password) {
      Alert.alert(
        "Password required",
        "Please enter a new password."
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Weak password",
        "Password must contain at least 8 characters."
      );
      return;
    }

    if (!/[a-z]/.test(password)) {
      Alert.alert(
        "Weak password",
        "Password must contain at least one lowercase letter."
      );
      return;
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert(
        "Weak password",
        "Password must contain at least one uppercase letter."
      );
      return;
    }

    if (!/[0-9]/.test(password)) {
      Alert.alert(
        "Weak password",
        "Password must contain at least one number."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        "Passwords don't match",
        "Please make sure both passwords are the same."
      );
      return;
    }

    try {
      setLoading(true);

      const data = await resetPassword(
        email,
        otp,
        password
      );

      if (!data?.success) {
        throw new Error(
          data?.message || "Password reset failed."
        );
      }

      Alert.alert(
        "Password Reset Successful",
        "Your password has been changed successfully. Please login with your new password.",
        [
          {
            text: "Login",
            onPress: () =>
              router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (error: any) {
      console.log(
        "RESET PASSWORD ERROR:",
        error?.response?.data || error
      );

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to reset your password.";

      Alert.alert("Reset Password", message);
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
            New Password
          </Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.content}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="lock-closed-outline"
              size={42}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>
            Create new password
          </Text>

          <Text style={styles.description}>
            Choose a strong password for your Odikart
            account.
          </Text>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              New Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <Pressable
                onPress={() =>
                  setShowPassword(!showPassword)
                }
                hitSlop={10}
              >
                <Ionicons
                  name={
                    showPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={21}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Confirm Password
            </Text>

            <View style={styles.inputContainer}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.textMuted}
              />

              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <Pressable
                onPress={() =>
                  setShowConfirmPassword(
                    !showConfirmPassword
                  )
                }
                hitSlop={10}
              >
                <Ionicons
                  name={
                    showConfirmPassword
                      ? "eye-off-outline"
                      : "eye-outline"
                  }
                  size={21}
                  color={colors.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          {/* Requirements */}
          <View style={styles.requirements}>
            <Text style={styles.requirementTitle}>
              Password must contain:
            </Text>

            <Text style={styles.requirement}>
              • At least 8 characters
            </Text>

            <Text style={styles.requirement}>
              • One uppercase letter
            </Text>

            <Text style={styles.requirement}>
              • One lowercase letter
            </Text>

            <Text style={styles.requirement}>
              • One number
            </Text>
          </View>

          {/* Reset Button */}
          <Pressable
            style={[
              styles.button,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleResetPassword}
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
                  Reset Password
                </Text>

                <Ionicons
                  name="checkmark-circle-outline"
                  size={21}
                  color={colors.textWhite}
                />
              </>
            )}
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
    paddingTop: 30,
  },

  iconContainer: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 20,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },

  description: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 26,
  },

  inputGroup: {
    marginBottom: 16,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },

  inputContainer: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
  },

  input: {
    flex: 1,
    height: "100%",
    marginLeft: 10,
    fontSize: 15,
    color: colors.text,
  },

  requirements: {
    backgroundColor: colors.blueSoft,
    borderRadius: 12,
    padding: 14,
    marginTop: 2,
    marginBottom: 20,
  },

  requirementTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 6,
  },

  requirement: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 3,
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
    fontSize: 16,
    fontWeight: "700",
    color: colors.textWhite,
  },
});