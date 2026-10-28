import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";

import { router } from "expo-router";

import { StatusBar } from "expo-status-bar";

import { Ionicons } from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";

import { useSafeAreaInsets } from "react-native-safe-area-context";

import { sendPhoneOTP, verifyPhoneOTP } from "../../api/firebaseAuth";

import { useAuth } from "../../hooks/useAuth";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* =========================================================

   TOKENS (same palette as the Home screen)

\========================================================= */

const C = {
  brand: "#3A2FB8",

  brandBright: "#5B4BFF",

  brandDark: "#241C85",

  brandSoft: "#EEF0FF",

  saffron: "#F59E0B",

  bg: "#F6F7FB",

  surface: "#FFFFFF",

  ink: "#12142B",

  inkSoft: "#555A78",

  inkMuted: "#8A8FA8",

  line: "#E1E4F0",

  success: "#15803D",

  danger: "#DC2626",

  dangerSoft: "#FEE9E9",
};

const RESEND_SECONDS = 30;

const OTP_LENGTH = 6;

const HERO_HEIGHT = 340;

const HERO_HEIGHT_COMPACT = 180;

// Local hero illustration. To load a hero from your backend instead, set HERO_REMOTE to its URL;

// the local image is used automatically if the remote one fails to load.

const HERO_LOCAL = require("../../../assets/images/login-header-3.webp");
const BRAND_LOGO = require("../../../assets/images/logo.webp");

const HERO_REMOTE: string | null = null;

const formatPhone = (digits: string) =>
  digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;

const formatTimer = (seconds: number) =>
  `0:${String(seconds).padStart(2, "0")}`;

const debugLog = (stage: string, details?: Record<string, unknown>) => {
  if (__DEV__) {
    console.log("[ODIKART AUTH DEBUG]", {
      timestamp: new Date().toISOString(),
      stage,
      ...(details ?? {}),
    });
  }
};

const debugError = (stage: string, error: any) => {
  if (__DEV__) {
    console.error(`[ODIKART AUTH DEBUG] ${stage}`, {
      name: error?.name ?? null,
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      nativeErrorCode: error?.nativeErrorCode ?? null,
      httpStatus: error?.response?.status ?? null,
      backendMessage: error?.response?.data?.message ?? null,
      stack: error?.stack ?? null,
    });
  }
};

const errorCodeMessage = (code?: string) => {
  switch (code) {
    case "auth/invalid-verification-code":
      return "Firebase rejected the OTP. Check that it belongs to this latest verification session.";
    case "auth/session-expired":
    case "auth/code-expired":
      return "This OTP session expired. Go back and request a fresh code when Firebase allows it.";
    case "auth/too-many-requests":
      return "Firebase temporarily blocked verification requests. Stop retrying and try again later.";
    case "auth/invalid-app-credential":
    case "auth/missing-client-identifier":
      return "Firebase could not verify this app. Check Firebase Android configuration and signing fingerprints.";
    case "auth/network-request-failed":
      return "Network request failed. Check your internet connection.";
    case "auth/invalid-phone-number":
      return "Enter a valid Indian mobile number.";
    case "auth/quota-exceeded":
      return "Firebase SMS quota was exceeded. Try again later.";
    default:
      return null;
  }
};

/* =========================================================

   SCREEN

\========================================================= */

export default function PhoneLogin() {
  const insets = useSafeAreaInsets();

  const { login } = useAuth();

  const [phone, setPhone] = useState("");

  const [otp, setOtp] = useState("");

  const [confirmation, setConfirmation] = useState<any>(null);
  // Keep the newest Firebase confirmation synchronously available to the verify handler.
  const confirmationRef = useRef<any>(null);
  // Local diagnostic IDs let us tell whether a verification uses the latest request.
  // These IDs are for logs only; they are not Firebase credentials.
  const requestAttemptRef = useRef(0);
  const confirmationVersionRef = useRef(0);
  const activeConfirmationIdRef = useRef<number | null>(null);
  const confirmationCreatedAtRef = useRef<number | null>(null);
  const sendInProgressRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const [loading, setLoading] = useState(false);

  const [resendSeconds, setResendSeconds] = useState(0);

  const [error, setError] = useState("");
  const [diagnostic, setDiagnostic] = useState("");

  const [phoneFocused, setPhoneFocused] = useState(false);

  const [otpFocused, setOtpFocused] = useState(false);

  const [keyboardUp, setKeyboardUp] = useState(false);

  const [heroFailed, setHeroFailed] = useState(false);

  const otpRef = useRef<TextInput>(null);

  const verifyingRef = useRef(false);

  const stepAnim = useRef(new Animated.Value(1)).current;

  const shakeX = useRef(new Animated.Value(0)).current;

  const phoneValid = /^[6-9]\d{9}$/.test(phone);

  const inOtpStep = !!confirmation;

  const heroSource =
    HERO_REMOTE && !heroFailed ? { uri: HERO_REMOTE } : HERO_LOCAL;

  useEffect(() => {
    debugLog("PhoneLogin mounted", {
      platform: Platform.OS,
      developmentBuild: __DEV__,
    });
    debugLog("initial runtime state", {
      appState: AppState.currentState,
      hasFirebaseConfirmation: Boolean(confirmationRef.current),
    });

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        debugLog("app state changed", {
          previousState: appStateRef.current,
          nextState,
          hasConfirmation: Boolean(confirmationRef.current),
          activeConfirmationId: activeConfirmationIdRef.current,
        });
        appStateRef.current = nextState;
      },
    );

    return () => {
      appStateSubscription.remove();
      debugLog("PhoneLogin unmounted", {
        hasConfirmation: Boolean(confirmationRef.current),
        activeConfirmationId: activeConfirmationIdRef.current,
      });
    };
  }, []);

  /* ---------- resend timer ---------- */

  useEffect(() => {
    if (resendSeconds === 0) {
      debugLog("resend countdown is ready", {
        hasConfirmation: Boolean(confirmationRef.current),
        activeConfirmationId: activeConfirmationIdRef.current,
      });
      return;
    }

    const timer = setTimeout(
      () => setResendSeconds((n) => Math.max(0, n - 1)),
      1000,
    );

    return () => clearTimeout(timer);
  }, [resendSeconds]);

  /* ---------- shrink the hero while typing so the form stays in view ---------- */

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        setKeyboardUp(true);
      },
    );

    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        setKeyboardUp(false);
      },
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /* ---------- soft transition between the two steps + focus the code field ---------- */

  useEffect(() => {
    stepAnim.setValue(0);

    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (inOtpStep) {
      const t = setTimeout(() => otpRef.current?.focus(), 350);

      return () => clearTimeout(t);
    }
  }, [inOtpStep]);

  const shake = () =>
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: 10,
        duration: 55,
        useNativeDriver: true,
      }),

      Animated.timing(shakeX, {
        toValue: -10,
        duration: 55,
        useNativeDriver: true,
      }),

      Animated.timing(shakeX, {
        toValue: 7,
        duration: 55,
        useNativeDriver: true,
      }),

      Animated.timing(shakeX, {
        toValue: 0,
        duration: 55,
        useNativeDriver: true,
      }),
    ]).start();

  /* =======================================================

     ACTIONS

  ======================================================= */

  const handleSendOTP = async (isResend = false) => {
    if (sendInProgressRef.current || loading) {
      debugLog("send OTP ignored: request already in progress");
      return;
    }

    const digits = phone.replace(/\D/g, "").slice(0, 10);
    setError("");
    setDiagnostic("");

    debugLog("send OTP started", {
      phoneLength: digits.length,
      phoneFormatValid: /^[6-9]\d{9}$/.test(digits),
      currentStep: inOtpStep ? "otp" : "phone",
      hasPreviousConfirmation: Boolean(confirmation),
      isResend,
    });

    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      setDiagnostic(
        `Stage: VALIDATE_PHONE\nCode: invalid-phone-format\nMessage: Expected 10 digits starting with 6-9; received ${digits.length} digits.`,
      );
      return;
    }

    if (isResend && resendSeconds > 0) {
      debugLog("resend ignored: countdown active", { resendSeconds });
      return;
    }

    const attemptId = ++requestAttemptRef.current;
    const startedAt = Date.now();
    const diagnosticStage = "SEND_PHONE_OTP";

    try {
      sendInProgressRef.current = true;
      setLoading(true);

      // Invalidate the previous session before requesting a new one.
      confirmationRef.current = null;
      activeConfirmationIdRef.current = null;
      confirmationCreatedAtRef.current = null;
      setConfirmation(null);
      setOtp("");

      debugLog("send OTP: calling helper", {
        attemptId,
        isResend,
        countryCode: "+91",
        phoneDigitsCount: digits.length,
        appState: appStateRef.current,
        previousSessionCleared: true,
      });

      debugLog("send OTP: calling sendPhoneOTP helper", {
        attemptId,
        phoneDigitsCount: digits.length,
        appStateAtCall: appStateRef.current,
      });
      const result = await sendPhoneOTP(`+91${digits}`);

      if (!result || typeof result.confirm !== "function") {
        throw new Error(
          "sendPhoneOTP did not return a valid Firebase confirmation object.",
        );
      }

      // Save the exact confirmation returned by this successful request.
      const confirmationId = ++confirmationVersionRef.current;
      confirmationRef.current = result;
      activeConfirmationIdRef.current = confirmationId;
      confirmationCreatedAtRef.current = Date.now();
      setConfirmation(result);
      setOtp("");
      setResendSeconds(RESEND_SECONDS);

      debugLog("send OTP succeeded; confirmation stored", {
        attemptId,
        confirmationId,
        elapsedMs: Date.now() - startedAt,
        confirmationReceived: true,
        confirmFunctionAvailable: typeof result.confirm === "function",
        confirmationAgeMs: 0,
        appState: appStateRef.current,
      });

      if (isResend) otpRef.current?.focus();
    } catch (err: any) {
      debugError("send OTP failed", err);
      debugLog("send OTP failure context", {
        attemptId,
        elapsedMs: Date.now() - startedAt,
        isResend,
        appState: appStateRef.current,
        confirmationCleared: !confirmationRef.current,
      });
      const codeName = err?.code ?? "no-code";
      const message = err?.message ?? String(err);
      setDiagnostic(
        `Stage: ${diagnosticStage}\nCode: ${codeName}\nMessage: ${message}`,
      );
      setError(
        errorCodeMessage(codeName) ||
          err?.response?.data?.message ||
          message ||
          "We couldn't send the code. Please try again later.",
      );
    } finally {
      sendInProgressRef.current = false;
      setLoading(false);
      debugLog("send OTP finished", {
        attemptId,
        elapsedMs: Date.now() - startedAt,
      });
    }
  };

  const handleVerifyOTP = async (code: string = otp) => {
    if (verifyingRef.current || loading) {
      debugLog("verify OTP ignored: verification already in progress");
      return;
    }

    const cleanOtp = code.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setError("");
    setDiagnostic("");

    const activeConfirmation = confirmationRef.current;
    const verificationStartedAt = Date.now();
    const confirmationIdAtStart = activeConfirmationIdRef.current;

    debugLog("OTP verification started", {
      enteredCodeLength: cleanOtp.length,
      // Never log the OTP, full phone number, Firebase ID token, or confirmation object.
      hasConfirmation: Boolean(activeConfirmation),
      hasConfirmFunction: typeof activeConfirmation?.confirm === "function",
      confirmationId: confirmationIdAtStart,
      confirmationVersion: confirmationVersionRef.current,
      confirmationAgeMs: confirmationCreatedAtRef.current
        ? Date.now() - confirmationCreatedAtRef.current
        : null,
      requestAttemptCount: requestAttemptRef.current,
      appState: appStateRef.current,
      currentStep: inOtpStep ? "otp" : "phone",
    });

    if (
      !activeConfirmation ||
      typeof activeConfirmation.confirm !== "function"
    ) {
      const message =
        "No active Firebase confirmation session exists. Request a fresh OTP.";
      setError(message);
      setDiagnostic(
        `Stage: PREPARE_CONFIRMATION\nCode: missing-confirmation\nMessage: ${message}`,
      );
      confirmationRef.current = null;
      setConfirmation(null);
      setOtp("");
      return;
    }

    if (cleanOtp.length !== OTP_LENGTH) {
      setError("Enter the complete 6-digit code.");
      setDiagnostic(
        `Stage: VALIDATE_OTP\nCode: invalid-code-length\nMessage: Expected 6 digits; received ${cleanOtp.length}.`,
      );
      shake();
      return;
    }

    verifyingRef.current = true;
    let diagnosticStage = "VERIFY_PHONE_OTP_HELPER";

    try {
      setLoading(true);
      debugLog("verify OTP: calling helper", {
        confirmationId: confirmationIdAtStart,
        confirmationStillCurrent:
          confirmationRef.current === activeConfirmation &&
          activeConfirmationIdRef.current === confirmationIdAtStart,
        confirmationAgeMs: confirmationCreatedAtRef.current
          ? Date.now() - confirmationCreatedAtRef.current
          : null,
        codeLength: cleanOtp.length,
        appState: appStateRef.current,
      });

      // Verify using the latest session ref, never a previous render’s value.
      const expectedPhoneNumber = `+91${phone.replace(/\D/g, "").slice(0, 10)}`;

      const data = await verifyPhoneOTP(
        activeConfirmation,
        cleanOtp,
        expectedPhoneNumber,
      );

      debugLog("verify OTP helper resolved", {
        confirmationId: confirmationIdAtStart,
        elapsedMs: Date.now() - verificationStartedAt,
        responseReceived: Boolean(data),
        appState: appStateRef.current,
      });

      debugLog("verifyPhoneOTP helper returned", {
        hasResponse: Boolean(data),
        success: Boolean(data?.success),
        hasToken: Boolean(data?.token),
        hasUser: Boolean(data?.user),
        isNewUser: Boolean(data?.isNewUser),
      });

      diagnosticStage = "VALIDATE_BACKEND_RESPONSE";
      if (!data?.success || !data?.token) {
        const err: any = new Error(
          "Backend login did not return a valid token.",
        );
        err.code = "backend/invalid-login-response";
        throw err;
      }

      diagnosticStage = "SAVE_APP_SESSION";
      const saveSessionStartedAt = Date.now();
      debugLog("saving backend session through AuthContext", {
        stage: diagnosticStage,
        hasToken: Boolean(data.token),
        hasUser: Boolean(data.user),
      });
      await login(data.token, data.user ?? null);

      debugLog("backend token saved to AuthContext", {
        saveSessionElapsedMs: Date.now() - saveSessionStartedAt,
        hasToken: Boolean(data.token),
        hasUser: Boolean(data.user),
      });

      confirmationRef.current = null;
      activeConfirmationIdRef.current = null;
      confirmationCreatedAtRef.current = null;
      setConfirmation(null);
      if (data.isNewUser) {
        debugLog("new user detected; navigating to profile completion");
        router.replace("/(auth)/complete-profile");
      } else {
        debugLog("login successful; navigating to tabs");
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      debugError("OTP verification failed", err);
      debugLog("OTP verification failure context", {
        confirmationId: confirmationIdAtStart,
        confirmationStillCurrent:
          confirmationRef.current === activeConfirmation &&
          activeConfirmationIdRef.current === confirmationIdAtStart,
        elapsedMs: Date.now() - verificationStartedAt,
        requestAttemptCount: requestAttemptRef.current,
        confirmationVersion: confirmationVersionRef.current,
        appState: appStateRef.current,
      });
      const codeName = err?.code ?? "no-code";
      const message =
        err?.response?.data?.message || err?.message || String(err);

      setDiagnostic(
        `Stage: ${diagnosticStage}\nCode: ${codeName}\nMessage: ${message}`,
      );

      setError(
        errorCodeMessage(codeName) ||
          err?.response?.data?.message ||
          err?.message ||
          "Verification failed. Check the diagnostic details.",
      );

      if (
        codeName === "auth/session-expired" ||
        codeName === "auth/code-expired"
      ) {
        confirmationRef.current = null;
        activeConfirmationIdRef.current = null;
        confirmationCreatedAtRef.current = null;
        setConfirmation(null);
        setOtp("");
        debugLog("expired confirmation cleared", {
          confirmationId: confirmationIdAtStart,
          reason: codeName,
        });
      } else {
        setOtp("");
      }

      shake();
      setTimeout(() => otpRef.current?.focus(), 150);
    } finally {
      verifyingRef.current = false;
      setLoading(false);
      debugLog("OTP verification finished", {
        confirmationId: confirmationIdAtStart,
        elapsedMs: Date.now() - verificationStartedAt,
      });
    }
  };

  const handleChangeNumber = () => {
    const previousConfirmationId = activeConfirmationIdRef.current;
    confirmationRef.current = null;
    activeConfirmationIdRef.current = null;
    confirmationCreatedAtRef.current = null;
    setConfirmation(null);

    debugLog("user chose change number; confirmation cleared", {
      previousConfirmationId,
    });

    setOtp("");

    setError("");
    setDiagnostic("");
    setResendSeconds(0);
  };

  /* =======================================================

     UI PIECES

  ======================================================= */

  const renderButton = (
    label: string,
    onPress: () => void,
    enabled: boolean,
    icon?: keyof typeof Ionicons.glyphMap,
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!enabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled || loading, busy: loading }}
      style={({ pressed }) => [
        s.btnWrap,
        (!enabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <LinearGradient
        colors={[C.brand, C.brandBright]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.btn}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={s.btnText}>{label}</Text>

            {icon ? <Ionicons name={icon} size={20} color="#fff" /> : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );

  const errorRow = error ? (
    <View style={s.errorRow} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle" size={18} color={C.danger} />

      <Text style={s.errorText}>{error}</Text>
    </View>
  ) : null;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" translucent />

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ---------- HERO ---------- */}

        <View
          style={[
            s.hero,
            { height: keyboardUp ? HERO_HEIGHT_COMPACT : HERO_HEIGHT },
          ]}
        >
          <Image
            source={heroSource}
            style={s.heroImage}
            resizeMode="cover"
            onError={() => setHeroFailed(true)}
          />

          <LinearGradient
            colors={[
              "rgba(18,12,80,0.75)",
              "rgba(18,12,80,0.15)",
              "rgba(18,12,80,0)",
            ]}
            style={StyleSheet.absoluteFill}
          />

          <View
            style={[
              s.brandRow,
              { paddingTop: insets.top + 14, flexDirection: "row-reverse" },
            ]}
          >
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Skip login and continue browsing"
              style={({ pressed }) => [
                s.skipButton,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text style={s.skipText}>Skip</Text>
              <Ionicons name="arrow-forward" size={15} color="#fff" />
            </Pressable>
          </View>

          {!keyboardUp ? (
            <View style={s.heroCopy}>
              <Text style={s.heroTitle}>
                Made in Odisha,{"\n"}delivered to you
              </Text>
            </View>
          ) : null}
        </View>

        {/* ---------- SHEET ---------- */}

        <View style={s.sheet}>
          <Animated.View
            style={{
              opacity: stepAnim,
              transform: [
                {
                  translateY: stepAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            {!inOtpStep ? (
              <>
                <Text style={s.title}>Welcome to Odikart</Text>

                <Text style={s.subtitle}>
                  Log in or create an account with your mobile number.
                </Text>

                <Text style={s.label}>Mobile number</Text>

                <View
                  style={[
                    s.phoneBox,

                    phoneFocused && s.boxFocused,

                    !!error && s.boxError,
                  ]}
                >
                  <Text style={s.flag}>🇮🇳</Text>

                  <Text style={s.countryCode}>+91</Text>

                  <View style={s.divider} />

                  <TextInput
                    style={s.phoneInput}
                    value={formatPhone(phone)}
                    onChangeText={(text) => {
                      const nextPhone = text.replace(/\D/g, "").slice(0, 10);
                      setPhone(nextPhone);
                      debugLog("phone input changed", {
                        digitCount: nextPhone.length,
                        validFormat: /^[6-9]\d{9}$/.test(nextPhone),
                      });

                      if (error) setError("");
                    }}
                    onFocus={() => setPhoneFocused(true)}
                    onBlur={() => setPhoneFocused(false)}
                    onSubmitEditing={() => handleSendOTP(false)}
                    placeholder="70778 62714"
                    placeholderTextColor={C.inkMuted}
                    keyboardType="phone-pad"
                    maxLength={11}
                    editable={!loading}
                    returnKeyType="done"
                    selectionColor={C.brand}
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    accessibilityLabel="Mobile number"
                  />

                  {phoneValid ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={C.success}
                    />
                  ) : null}
                </View>

                {errorRow ?? (
                  <Text style={s.helper}>
                    We'll send a 6-digit code by SMS. Standard rates may apply.
                  </Text>
                )}

                {__DEV__ && diagnostic ? (
                  <View
                    style={s.diagnosticBox}
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={s.diagnosticTitle}>AUTH DIAGNOSTICS</Text>
                    <Text selectable style={s.diagnosticText}>
                      {diagnostic}
                    </Text>
                  </View>
                ) : null}

                <View style={{ height: 22 }} />

                {renderButton(
                  "Get OTP",
                  () => handleSendOTP(false),
                  phoneValid,
                  "arrow-forward",
                )}
              </>
            ) : (
              <>
                <Pressable
                  onPress={handleChangeNumber}
                  disabled={loading}
                  hitSlop={10}
                  style={s.backRow}
                  accessibilityRole="button"
                  accessibilityLabel="Change number"
                >
                  <Ionicons name="arrow-back" size={18} color={C.brand} />

                  <Text style={s.backText}>Change number</Text>
                </Pressable>

                <Text style={s.title}>Enter the code</Text>

                <Text style={s.subtitle}>
                  We sent a 6-digit code to{"\n"}
                  <Text style={s.subtitleStrong}>+91 {formatPhone(phone)}</Text>
                </Text>

                {/* Six boxes drawn on top of one real input, so paste and SMS auto-fill still work. */}

                <Animated.View
                  style={[s.otpWrap, { transform: [{ translateX: shakeX }] }]}
                >
                  <View style={s.otpRow} pointerEvents="none">
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                      const digit = otp[i] ?? "";

                      const active =
                        otpFocused &&
                        i === Math.min(otp.length, OTP_LENGTH - 1);

                      return (
                        <View
                          key={i}
                          style={[
                            s.otpBox,
                            active && s.boxFocused,
                            !!digit && s.otpBoxFilled,
                            !!error && s.boxError,
                          ]}
                        >
                          <Text style={s.otpDigit}>{digit}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <TextInput
                    ref={otpRef}
                    style={s.otpHiddenInput}
                    value={otp}
                    onChangeText={(text) => {
                      const nextOtp = text
                        .replace(/\D/g, "")
                        .slice(0, OTP_LENGTH);
                      setOtp(nextOtp);
                      debugLog("OTP input changed", {
                        digitCount: nextOtp.length,
                        complete: nextOtp.length === OTP_LENGTH,
                        // Intentionally do not log the OTP digits.
                      });

                      if (error) setError("");
                    }}
                    onFocus={() => setOtpFocused(true)}
                    onBlur={() => setOtpFocused(false)}
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    editable={!loading}
                    autoComplete="sms-otp"
                    textContentType="oneTimeCode"
                    caretHidden
                    selectionColor="transparent"
                    accessibilityLabel="6-digit verification code"
                  />
                </Animated.View>

                {errorRow}

                {__DEV__ && diagnostic ? (
                  <View
                    style={s.diagnosticBox}
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={s.diagnosticTitle}>AUTH DIAGNOSTICS</Text>
                    <Text selectable style={s.diagnosticText}>
                      {diagnostic}
                    </Text>
                  </View>
                ) : null}

                <View style={s.resendRow}>
                  {loading ? (
                    <View style={s.verifyingRow}>
                      <ActivityIndicator size="small" color={C.brand} />

                      <Text style={s.resendText}>Verifying…</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={s.resendText}>Didn't get the code?</Text>

                      <Pressable
                        onPress={() => handleSendOTP(true)}
                        disabled={resendSeconds > 0}
                        hitSlop={10}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: resendSeconds > 0 }}
                      >
                        <Text
                          style={[
                            s.resendAction,
                            resendSeconds > 0 && { color: C.inkMuted },
                          ]}
                        >
                          {resendSeconds > 0
                            ? `Resend in ${formatTimer(resendSeconds)}`
                            : "Resend code"}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>

                <View style={{ height: 20 }} />

                {renderButton(
                  "Verify & Continue",
                  () => handleVerifyOTP(),
                  otp.length === OTP_LENGTH,
                  "checkmark",
                )}
              </>
            )}
          </Animated.View>

          {/* ---------- FOOTER ---------- */}

          <View style={s.securityNote}>
            <Ionicons name="lock-closed" size={14} color={C.inkSoft} />

            <Text style={s.securityText}>
              Your number is only used to securely access your account.
            </Text>
          </View>

          <Text style={s.footer}>
            By continuing, you agree to Odikart's{" "}
            <Text style={s.footerLink}>Terms</Text> &{" "}
            <Text style={s.footerLink}>Privacy Policy</Text>.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* =========================================================

   STYLES

\========================================================= */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.brandDark },

  scroll: { flexGrow: 1 },

  /* hero */

  hero: { width: "100%", backgroundColor: C.brandDark, overflow: "hidden" },

  // Explicit 100% size: local images otherwise default to their file size and ignore the container.

  heroImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },

  brandRow: {
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandLogo: { width: 142, height: 44 },
  skipButton: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.48)",
    backgroundColor: "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  skipText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  heroCopy: { position: "absolute", left: 22, right: 22, bottom: 56 },

  heroTitle: {
    color: "#fff",
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    textShadowColor: "rgba(18,12,80,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },

  /* sheet */

  sheet: {
    flexGrow: 1,
    marginTop: -30,
    backgroundColor: C.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 28,
  },

  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 26,
    fontSize: 15,
    lineHeight: 22,
    color: C.inkSoft,
  },

  subtitleStrong: { color: C.ink, fontWeight: "800" },

  label: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: 0.2,
  },

  /* phone input */

  phoneBox: {
    height: 58,
    borderRadius: 16,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  boxFocused: { borderColor: C.brand, backgroundColor: C.surface },

  boxError: { borderColor: C.danger, backgroundColor: C.dangerSoft },

  flag: { fontSize: 20, marginRight: 8 },

  countryCode: { fontSize: 16, fontWeight: "800", color: C.ink },

  divider: {
    width: 1,
    height: 24,
    backgroundColor: C.line,
    marginHorizontal: 12,
  },

  phoneInput: {
    flex: 1,
    height: "100%",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: C.ink,
    paddingVertical: 0,
  },

  helper: { marginTop: 12, fontSize: 12.5, lineHeight: 18, color: C.inkMuted },

  errorRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },

  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: C.danger,
  },

  diagnosticBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },

  diagnosticTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: "#92400E",
    marginBottom: 6,
  },

  diagnosticText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#78350F",
  },

  /* otp */

  backRow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    marginBottom: 14,
    paddingRight: 10,
  },

  backText: { fontSize: 14, fontWeight: "800", color: C.brand },

  otpWrap: { height: 60 },

  otpRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  otpBox: {
    width: 48,
    height: 60,
    borderRadius: 14,
    backgroundColor: C.bg,
    borderWidth: 1.5,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },

  otpBoxFilled: { backgroundColor: C.brandSoft, borderColor: C.brandSoft },

  otpDigit: { fontSize: 24, fontWeight: "900", color: C.ink },

  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    fontSize: 1,
    backgroundColor: "transparent",
  },

  resendRow: {
    marginTop: 20,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  verifyingRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  resendText: { fontSize: 14, color: C.inkSoft },

  resendAction: { fontSize: 14, fontWeight: "800", color: C.brand },

  /* button */

  btnWrap: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 4,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },

  btn: {
    minHeight: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },

  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  /* footer */

  securityNote: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 8,
  },

  securityText: {
    flexShrink: 1,
    fontSize: 12,
    color: C.inkSoft,
    textAlign: "center",
  },

  footer: {
    marginTop: 14,
    fontSize: 11.5,
    lineHeight: 18,
    textAlign: "center",
    color: C.inkMuted,
  },

  footerLink: { color: C.brand, fontWeight: "700" },
});
