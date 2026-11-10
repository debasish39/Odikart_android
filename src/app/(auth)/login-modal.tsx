import React, { useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
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

import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { LinearGradient } from "expo-linear-gradient";

import { router } from "expo-router";

import {
  getAuth,
  onAuthStateChanged,
  signInWithPhoneNumber,
} from "@react-native-firebase/auth";

import {
  isAvailableAsync as isPhoneHintAvailable,
  showPhoneNumberHintAsync,
} from "expo-phone-number-hint";

import { BACKEND_URL } from "../../api/api";

import { useAuth } from "../../hooks/useAuth";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* =========================================================

   TOKENS (same palette as Home and the full-screen login)

========================================================= */

const C = {
  brand: "#2563EB",

  brandBright: "#7C3AED",

  brandDark: "#312E81",

  brandSoft: "#EEF2FF",

  bg: "#F6F7FB",

  surface: "#FFFFFF",

  ink: "#12142B",

  inkSoft: "#555A78",

  inkMuted: "#8A8FA8",

  line: "#E1E4F0",

  success: "#15803D",

  successSoft: "#E8F7EE",

  danger: "#DC2626",

  dangerSoft: "#FEE9E9",
};

const OTP_LENGTH = 6;

const RESEND_SECONDS = 30;

const HEADER_HEIGHT = 76;

const HEADER_HEIGHT_COMPACT = 64;

// OdiKart logo only — no separate login header image is required.
const BRAND_LOGO = require("../../../assets/images/logo.webp");

type Step = "phone" | "otp" | "completeProfile";

const normalizePhone = (value: string) => value.replace(/\D/g, "").slice(0, 10);

const displayPhone = (value: string) => {
  const digits = normalizePhone(value);

  return digits.length > 5
    ? `${digits.slice(0, 5)} ${digits.slice(5)}`
    : digits;
};

const formatTimer = (seconds: number) =>
  `0:${String(seconds).padStart(2, "0")}`;

const getErrorMessage = (error: any, fallback: string) => {
  const code = error?.code;

  if (code === "auth/invalid-phone-number")
    return "Enter a valid Indian mobile number.";

  if (code === "auth/too-many-requests")
    return "Too many attempts. Please try again later.";

  if (code === "auth/quota-exceeded")
    return "SMS quota exceeded. Please try again later.";

  if (code === "auth/operation-not-allowed")
    return "Phone authentication is not enabled.";

  if (code === "auth/invalid-verification-code")
    return "Incorrect OTP. Please check the code.";

  if (code === "auth/session-expired" || code === "auth/code-expired")
    return "This OTP has expired. Please request a new one.";

  if (code === "auth/missing-client-identifier")
    return "Firebase could not verify this app. Check Android SHA fingerprints and Firebase app configuration.";

  if (code === "auth/network-request-failed")
    return "Network request failed. Check your internet connection and try again later.";

  return error?.response?.data?.message || error?.message || fallback;
};

const debugLog = (stage: string, details?: Record<string, unknown>) => {
  // Never pass OTPs, full phone numbers, Firebase ID tokens, or backend tokens here.
  if (__DEV__) {
    console.log(`[ODIKART AUTH DEBUG] ${stage}`, details ?? {});
  }
};

const debugError = (stage: string, error: any) => {
  // Intentionally log only error metadata, never credentials or response tokens.
  if (__DEV__) {
    console.error(`[ODIKART AUTH DEBUG] ${stage}`, {
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      httpStatus: error?.response?.status ?? null,
      backendMessage: error?.response?.data?.message ?? null,
    });
  }
};

/* =========================================================

   SCREEN

========================================================= */

export default function LoginModal() {
  const { login } = useAuth();

  useEffect(() => {
    debugLog("login modal mounted", {
      platform: Platform.OS,
      developmentBuild: __DEV__,
      backendConfigured: Boolean(BACKEND_URL),
      // Do not log phone numbers, tokens, or the full backend URL.
    });
    return () => {
      otpFlowActiveRef.current = false;
      autoVerifiedPendingRef.current = false;
      phoneBeingVerifiedRef.current = "";
      debugLog("login modal unmounted");
    };
  }, []);

  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("");

  const [otp, setOtp] = useState("");

  const [confirmation, setConfirmation] = useState<any>(null);

  const [timer, setTimer] = useState(0);

  const [loading, setLoading] = useState(false);

  const [phoneHintLoading, setPhoneHintLoading] = useState(false);
  const autoSendPhoneRef = useRef("");
  const otpSendingRef = useRef(false);
  // Prevent the native Google phone-number picker from opening more than once
  // during this LoginModal screen instance.
  const phoneHintAutoOpened = useRef(false);

  const [error, setError] = useState("");

  // Development-only diagnostics shown on-screen to identify the exact failing stage.
  const [diagnostic, setDiagnostic] = useState("");

  const [temporaryPhoneToken, setTemporaryPhoneToken] = useState("");

  const [profile, setProfile] = useState({ firstName: "", lastName: "" });

  const [focused, setFocused] = useState<
    "phone" | "otp" | "first" | "last" | null
  >(null);

  const [keyboardUp, setKeyboardUp] = useState(false);

  const otpInputRef = useRef<TextInput | null>(null);

  const lastNameRef = useRef<TextInput | null>(null);

  const verifyingRef = useRef(false);

  // Firebase Android can verify an incoming OTP in the background. These refs
  // let the auth-state listener identify that verification belongs to the
  // phone number currently being entered in this login flow.
  const otpFlowActiveRef = useRef(false);
  const phoneBeingVerifiedRef = useRef("");
  const verifyPhoneOtpRef = useRef<((value?: string) => Promise<void>) | null>(
    null,
  );
  const loadingRef = useRef(loading);
  const autoVerifiedPendingRef = useRef(false);
  loadingRef.current = loading;

  const stepAnim = useRef(new Animated.Value(1)).current;

  const shakeX = useRef(new Animated.Value(0)).current;

  const phoneValid = /^[6-9]\d{9}$/.test(normalizePhone(phone));

  /* ---------- Google Phone Number Hint ---------- */

  const choosePhoneNumber = async () => {
    if (phoneHintLoading || loading) return;

    if (Platform.OS !== "android") {
      setError(
        "Automatic phone number selection is available on Android only. Please enter your number manually.",
      );
      return;
    }

    Keyboard.dismiss();
    setError("");
    setDiagnostic("");
    setPhoneHintLoading(true);

    try {
      const available = await isPhoneHintAvailable();

      if (!available) {
        setError(
          "Phone number selection is unavailable on this device. Please enter your number manually.",
        );
        return;
      }

      // Opens Google's native SIM phone-number chooser.
      const result = await showPhoneNumberHintAsync();

      // Closing the Google picker is not an error; keep the current input.
      if (result.canceled || !result.hint) return;

      const rawNumber = result.hint.e164 || result.hint.number || "";
      let digits = rawNumber.replace(/\D/g, "");

      // The OdiKart phone field stores only the 10-digit Indian mobile number.
      if (digits.length === 12 && digits.startsWith("91")) {
        digits = digits.slice(2);
      } else if (digits.length === 11 && digits.startsWith("0")) {
        digits = digits.slice(1);
      }

      if (!/^[6-9]\d{9}$/.test(digits)) {
        setError(
          "The selected number doesn't look like a valid 10-digit Indian mobile number. Please enter it manually.",
        );
        return;
      }

      setPhone(digits);
      setFocused(null);
      debugLog("Google phone number hint selected", {
        phoneLength: digits.length,
        regionCode: result.hint.regionCode ?? null,
      });
    } catch (err: any) {
      debugError("Google phone number hint failed", err);
      setError(
        "Couldn't open phone number selection. You can still enter your mobile number manually.",
      );
    } finally {
      setPhoneHintLoading(false);
    }
  };

  /* ---------- automatically offer the Google phone-number picker ---------- */

  useEffect(() => {
    if (Platform.OS !== "android") return;

    // Let the login modal finish appearing before opening Google's native UI.
    // The ref also prevents repeated prompts during this screen instance.
    const timeout = setTimeout(() => {
      if (phoneHintAutoOpened.current) return;

      phoneHintAutoOpened.current = true;
      void choosePhoneNumber();
    }, 700);

    return () => clearTimeout(timeout);
  }, []);

  /* ---------- resend timer ---------- */

  useEffect(() => {
    if (timer <= 0) return;

    const timeout = setTimeout(
      () => setTimer((value) => Math.max(0, value - 1)),
      1000,
    );

    return () => clearTimeout(timeout);
  }, [timer]);

  /* ---------- collapse the header art while the keyboard is open ---------- */

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

  /* ---------- soft transition between steps ---------- */

  useEffect(() => {
    stepAnim.setValue(0);

    Animated.timing(stepAnim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step]);

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

     ACTIONS (same backend + Firebase flow as before)

  ======================================================= */

  const sendPhoneOtp = async () => {
    // State updates are asynchronous. This ref closes the small window in
    // which manual Continue and automatic OTP sending could run together.
    if (loadingRef.current || otpSendingRef.current) {
      debugLog("send OTP ignored: request already in progress");
      return;
    }

    Keyboard.dismiss();
    setError("");
    setDiagnostic("");

    const digits = normalizePhone(phone);

    debugLog("send OTP started", {
      phoneLength: digits.length,
      phoneFormatValid: /^[6-9]\d{9}$/.test(digits),
      currentStep: step,
      hasPreviousConfirmation: Boolean(confirmation),
      firebaseAppInitialized: Boolean(getAuth()),
    });

    if (!/^[6-9]\d{9}$/.test(digits)) {
      debugLog("send OTP stopped: invalid phone format");
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    // Share the duplicate-request guard between the manual button and
    // automatic 10-digit trigger.
    autoSendPhoneRef.current = digits;
    otpSendingRef.current = true;

    // A new send attempt must never reuse an old confirmation session.
    // Keep the expected number so Firebase's Android auto-verification can
    // safely complete the matching login without requiring a typed code.
    // Start a fresh verification attempt. Clear any deferred callback from a
    // previous attempt so it cannot trigger a second backend login.
    autoVerifiedPendingRef.current = false;
    otpFlowActiveRef.current = true;
    phoneBeingVerifiedRef.current = `+91${digits}`;
    setLoading(true);
    setConfirmation(null);
    setOtp("");

    try {
      debugLog("calling Firebase signInWithPhoneNumber", {
        countryCode: "+91",
        phoneDigitsCount: digits.length,
      });

      const nextConfirmation = await signInWithPhoneNumber(
        getAuth(),
        `+91${digits}`,
      );

      if (!nextConfirmation || typeof nextConfirmation.confirm !== "function") {
        debugLog("Firebase returned an unexpected confirmation object", {
          hasConfirmation: Boolean(nextConfirmation),
          hasConfirmFunction: typeof nextConfirmation?.confirm === "function",
        });
        throw new Error(
          "Firebase did not return a valid OTP confirmation session.",
        );
      }

      setConfirmation(nextConfirmation);
      setOtp("");
      setTimer(RESEND_SECONDS);
      setStep("otp");

      debugLog("Firebase OTP request succeeded", {
        confirmationReceived: true,
        confirmFunctionAvailable: true,
        nextStep: "otp",
      });

      setTimeout(() => otpInputRef.current?.focus(), 350);
    } catch (err: any) {
      debugError("Firebase OTP send failed", err);
      setDiagnostic(
        `Stage: SEND_OTP\nCode: ${err?.code ?? "no-code"}\nMessage: ${err?.message ?? String(err)}`,
      );
      setConfirmation(null);
      otpFlowActiveRef.current = false;
      autoVerifiedPendingRef.current = false;
      phoneBeingVerifiedRef.current = "";

      if (err?.code === "auth/too-many-requests") {
        setError(
          "Firebase has temporarily blocked OTP requests for unusual activity. Stop retrying and try again later.",
        );
      } else {
        setError(getErrorMessage(err, "Unable to send OTP."));
      }
    } finally {
      otpSendingRef.current = false;
      setLoading(false);
      debugLog("send OTP finished", { loadingWillBeCleared: true });
    }
  };
  /* ---------- AUTO SEND OTP AFTER 10 DIGITS ---------- */

  useEffect(() => {
    const digits = normalizePhone(phone);

    // Reset the guard if the user edits or clears the number.
    if (!/^[6-9]\d{9}$/.test(digits)) {
      autoSendPhoneRef.current = "";
      return;
    }

    // Wait until the Google picker has finished and the phone screen is idle.
    if (step !== "phone" || loading || phoneHintLoading) return;

    // Prevent duplicate requests for the same number.
    if (autoSendPhoneRef.current === digits) return;

    const timeout = setTimeout(() => {
      // The user may have started another action while this timer was pending.
      if (
        loadingRef.current ||
        otpSendingRef.current ||
        step !== "phone" ||
        phoneHintLoading
      ) {
        return;
      }

      autoSendPhoneRef.current = digits;
      debugLog("Automatic OTP triggered after 10 digits", {
        phoneLength: digits.length,
      });
      void sendPhoneOtp();
    }, 350);

    return () => clearTimeout(timeout);
  }, [phone, step, loading, phoneHintLoading]);

  const verifyPhoneOtp = async (value: string = otp) => {
    if (verifyingRef.current || loading) {
      debugLog("verify OTP ignored: verification already in progress");
      return;
    }

    const code = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    const auth = getAuth();
    const expectedPhone = `+91${normalizePhone(phone)}`;
    const alreadyVerifiedUser = auth.currentUser;
    const isAlreadyAutoVerified = Boolean(
      alreadyVerifiedUser && alreadyVerifiedUser.phoneNumber === expectedPhone,
    );

    setError("");
    setDiagnostic("");

    // Log only safe metadata. Never log the OTP or authentication tokens.
    debugLog("OTP verification started", {
      enteredCodeLength: code.length,
      hasConfirmation: Boolean(confirmation),
      hasConfirmFunction: typeof confirmation?.confirm === "function",
      currentStep: step,
      firebaseAlreadyVerified: isAlreadyAutoVerified,
    });

    // Firebase Android auto-verification supplies an authenticated user rather
    // than exposing the SMS digits. In that case, skip manual code entry.
    if (code.length !== OTP_LENGTH && !isAlreadyAutoVerified) {
      setError("Enter the complete 6-digit OTP.");
      shake();
      return;
    }

    if (
      !isAlreadyAutoVerified &&
      (!confirmation || typeof confirmation.confirm !== "function")
    ) {
      debugLog("OTP verification stopped: no valid confirmation session");

      setError(
        "Your verification session is unavailable. Please return to the phone screen and request a new OTP when Firebase allows it.",
      );

      setConfirmation(null);
      otpFlowActiveRef.current = false;
      phoneBeingVerifiedRef.current = "";
      setOtp("");
      setStep("phone");
      return;
    }

    Keyboard.dismiss();
    verifyingRef.current = true;
    setLoading(true);
    let diagnosticStage = "PREPARING_CONFIRMATION";

    try {
      diagnosticStage = "FIREBASE_CONFIRM_CODE";
      debugLog("Calling Firebase confirmation.confirm");

      // STAGE 1: Resolve Firebase phone verification.
      // On Android, Firebase can automatically verify the SMS and sign the
      // user in before they press "Verify & Login". In that case, confirming
      // the same SMS code again can return auth/session-expired.
      let firebaseUser = null;

      if (isAlreadyAutoVerified) {
        firebaseUser = alreadyVerifiedUser;
        debugLog("Firebase phone was already auto-verified", {
          currentUserMatchesEnteredPhone: true,
          skippedDuplicateCodeConfirmation: true,
        });
      } else {
        const result = await confirmation.confirm(code);
        firebaseUser = result?.user ?? null;
      }

      if (!firebaseUser) {
        throw new Error(
          "Firebase confirmation returned no authenticated user.",
        );
      }

      debugLog("Firebase OTP verification succeeded", {
        hasFirebaseUser: true,
        hasUid: Boolean(firebaseUser.uid),
        automaticAndroidVerification: isAlreadyAutoVerified,
      });
      otpFlowActiveRef.current = false;
      autoVerifiedPendingRef.current = false;

      // STAGE 2: Obtain the Firebase ID token.
      diagnosticStage = "GET_FIREBASE_ID_TOKEN";
      const firebaseIdToken = await firebaseUser.getIdToken(true);

      if (!firebaseIdToken) {
        throw new Error("Firebase ID token was not received.");
      }

      debugLog("Firebase token received; calling backend", {
        endpointPath: "/api/auth/firebase-phone-login",
      });

      // STAGE 3: Authenticate with the existing Odikart backend.
      diagnosticStage = "BACKEND_PHONE_LOGIN";
      const response = await fetch(
        `${BACKEND_URL}/api/auth/firebase-phone-login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${firebaseIdToken}`,
          },
          body: JSON.stringify({ app: "customer" }),
        },
      );

      const data = await response.json().catch(() => null);

      debugLog("Backend login response", {
        httpStatus: response.status,
        success: Boolean(data?.success),
        hasToken: Boolean(data?.token),
        hasUser: Boolean(data?.user),
        isNewUser: Boolean(data?.isNewUser),
      });

      if (!response.ok || !data?.success || !data?.token) {
        throw new Error(
          data?.message || `Backend login failed with HTTP ${response.status}.`,
        );
      }

      if (data.isNewUser) {
        setTemporaryPhoneToken(data.token);
        setProfile({
          firstName: data.user?.firstName || "",
          lastName: data.user?.lastName || "",
        });
        setConfirmation(null);
        setStep("completeProfile");

        debugLog("New user requires profile completion");
        return;
      }

      diagnosticStage = "SAVE_APP_SESSION";
      await login(data.token, data.user ?? null);

      otpFlowActiveRef.current = false;
      phoneBeingVerifiedRef.current = "";
      setConfirmation(null);
      debugLog("Login successful; navigating to tabs");
      router.replace("/(tabs)");
    } catch (err: any) {
      debugError("OTP verification or backend login failed", err);
      const codeName = err?.code ?? "no-code";
      const errorMessage = err?.message ?? String(err);
      setDiagnostic(
        `Stage: ${diagnosticStage}\nCode: ${codeName}\nMessage: ${errorMessage}`,
      );

      // Keep Firebase errors distinguishable from backend errors.
      if (codeName === "auth/invalid-verification-code") {
        setError(
          "Incorrect OTP. Please enter the correct 6-digit code. Make sure you're using the latest SMS code.",
        );
      } else if (
        codeName === "auth/session-expired" ||
        codeName === "auth/code-expired"
      ) {
        setConfirmation(null);
        otpFlowActiveRef.current = false;
        autoVerifiedPendingRef.current = false;
        phoneBeingVerifiedRef.current = "";
        setOtp("");
        setStep("phone");
        setError(
          "This verification code has expired. Return to the phone screen and request a fresh code.",
        );
      } else if (codeName === "auth/too-many-requests") {
        setError(
          "Firebase has temporarily blocked verification requests. Stop retrying and try again later.",
        );
      } else if (codeName === "auth/invalid-app-credential") {
        setError(
          "Firebase rejected the app verification credential. Check the Android Firebase configuration and signing fingerprints.",
        );
      } else if (codeName === "auth/network-request-failed") {
        setError("Network request failed. Check your internet connection.");
      } else if (codeName === "auth/credential-already-in-use") {
        setError("This phone credential is already linked to another account.");
      } else {
        setError(
          err?.message ||
            "Verification failed. Check the OTP verification logs.",
        );
      }

      setOtp("");
      shake();
    } finally {
      verifyingRef.current = false;
      setLoading(false);
      debugLog("OTP verification finished");
    }
  };

  // Keep the latest verifier available to the one-time Firebase listener.
  verifyPhoneOtpRef.current = verifyPhoneOtp;

  // On Android, Firebase may automatically resolve the SMS and sign in before
  // the user types anything. Route that verified Firebase user through the
  // same existing Odikart backend-login flow used by manual OTP confirmation.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getAuth(), (user) => {
      if (!user || !otpFlowActiveRef.current) return;

      const expectedPhone = phoneBeingVerifiedRef.current;
      if (!expectedPhone || user.phoneNumber !== expectedPhone) return;

      debugLog("Firebase Android OTP auto-verification detected", {
        matchingPhone: true,
        backendLoginWillStart: true,
      });

      if (loadingRef.current) {
        // The SMS can be auto-verified before the send request finishes.
        // Defer backend login until the send operation releases its loading lock.
        autoVerifiedPendingRef.current = true;
        return;
      }

      void verifyPhoneOtpRef.current?.("");
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (loading || !autoVerifiedPendingRef.current) return;

    autoVerifiedPendingRef.current = false;
    if (otpFlowActiveRef.current) {
      void verifyPhoneOtpRef.current?.("");
    }
  }, [loading]);

  const completePhoneProfile = async () => {
    if (loading) {
      debugLog("complete profile ignored: request already in progress");
      return;
    }

    Keyboard.dismiss();
    setError("");

    debugLog("complete profile started", {
      firstNamePresent: Boolean(profile.firstName.trim()),
      lastNamePresent: Boolean(profile.lastName.trim()),
      temporaryTokenPresent: Boolean(temporaryPhoneToken),
    });

    if (!profile.firstName.trim()) {
      setError("First name is required.");

      return;
    }

    if (!profile.lastName.trim()) {
      setError("Last name is required.");

      return;
    }

    if (!temporaryPhoneToken) {
      setError("Your signup session expired. Please login again.");

      return;
    }

    try {
      setLoading(true);
      debugLog("calling complete-profile backend endpoint");

      const response = await fetch(`${BACKEND_URL}/api/auth/complete-profile`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${temporaryPhoneToken}`,
        },

        body: JSON.stringify({
          firstName: profile.firstName.trim(),

          lastName: profile.lastName.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      debugLog("complete-profile backend response received", {
        httpStatus: response.status,
        responseParsed: Boolean(data),
        hasToken: Boolean(data?.token),
        hasUser: Boolean(data?.user),
      });

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Unable to complete your profile (HTTP ${response.status}).`,
        );
      }

      if (!data?.token) {
        throw new Error(
          "Account created but authentication token was not received.",
        );
      }

      await login(data.token, data.user ?? null);

      setTemporaryPhoneToken("");
      debugLog("profile completed; login saved; navigating to tabs");
      router.replace("/(tabs)");
    } catch (err: any) {
      debugError("complete profile failed", err);
      setDiagnostic(
        `Stage: COMPLETE_PROFILE\nCode: ${err?.code ?? "no-code"}\nMessage: ${err?.message ?? String(err)}`,
      );
      setError(getErrorMessage(err, "Unable to complete your profile."));
    } finally {
      setLoading(false);
      debugLog("complete profile finished", { loadingWillBeCleared: true });
    }
  };

  const goBack = () => {
    debugLog("back action", { currentStep: step });
    Keyboard.dismiss();

    setError("");

    if (step === "otp") {
      // Ignore late Firebase auto-verification from the abandoned OTP step.
      otpFlowActiveRef.current = false;
      autoVerifiedPendingRef.current = false;
      phoneBeingVerifiedRef.current = "";

      setStep("phone");
      setConfirmation(null);
      setOtp("");
      setTimer(0);
      return;
    }

    if (step === "completeProfile") {
      setStep("phone");

      setConfirmation(null);

      setTemporaryPhoneToken("");

      setOtp("");

      return;
    }

    if (router.canGoBack()) router.back();
  };

  const closeModal = () => {
    debugLog("close login modal pressed");
    Keyboard.dismiss();

    otpFlowActiveRef.current = false;
    autoVerifiedPendingRef.current = false;
    phoneBeingVerifiedRef.current = "";

    if (router.canGoBack()) {
      router.back();
    } else {
      debugLog("close modal skipped: router has no back history");
    }
  };

  const title =
    step === "phone"
      ? "Welcome to OdiKart"
      : step === "otp"
        ? "Enter the code"
        : "Almost there!";

  /* =======================================================

     RENDER

  ======================================================= */

  return (
    <View style={s.overlay}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={closeModal}
        accessibilityLabel="Close login"
      />

      <KeyboardAvoidingView
        style={s.positioner}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        pointerEvents="box-none"
      >
        <SafeAreaView style={s.sheet} edges={["bottom"]}>
          <View style={s.sheetHandleWrap} pointerEvents="none">
            <View style={s.sheetHandle} />
          </View>

          {/* ---------- ODIKART LOGO HEADER ---------- */}
          <View
            style={[
              s.header,
              { height: keyboardUp ? HEADER_HEIGHT_COMPACT : HEADER_HEIGHT },
            ]}
          >
            <View style={s.headerTop}>
              {step === "phone" ? (
                <Image
                  source={BRAND_LOGO}
                  style={s.brandLogoImage}
                  resizeMode="contain"
                  accessibilityLabel="OdiKart logo"
                />
              ) : (
                <Pressable
                  onPress={goBack}
                  disabled={loading}
                  style={s.headerAction}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Ionicons name="arrow-back" size={23} color="#333847" />
                </Pressable>
              )}
              <Pressable
                onPress={closeModal}
                style={s.headerAction}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={27} color="#454545" />
              </Pressable>
            </View>
          </View>

          {/* ---------- CONTENT ---------- */}

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={{
                opacity: stepAnim,
                transform: [
                  {
                    translateY: stepAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              }}
            >
              {step === "completeProfile" ? (
                <View style={s.verifiedChip}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={C.success}
                  />

                  <Text style={s.verifiedText}>
                    +91 {displayPhone(phone)} verified
                  </Text>
                </View>
              ) : null}

              <Text style={[s.title, step === "phone" && s.phoneTitle]}>
                {step === "phone" ? "Log in or Sign up" : title}
              </Text>

              {step !== "phone" ? (
                <Text style={s.subtitle}>
                  {step === "otp" ? (
                    <>
                      We sent a 6-digit code to{" "}
                      <Text style={s.subtitleStrong}>
                        +91 {displayPhone(phone)}
                      </Text>
                    </>
                  ) : null}

                  {step === "completeProfile"
                    ? "Add your name to finish setting up your account."
                    : null}
                </Text>
              ) : null}

              {/* ----- STEP 1: PHONE ----- */}

              {step === "phone" ? (
                <>
                  <View
                    style={[
                      s.field,
                      focused === "phone" && s.fieldFocused,
                      !!error && s.fieldError,
                    ]}
                  >
                    <Text style={s.countryCode}>+91</Text>

                    <TextInput
                      style={s.fieldInput}
                      value={displayPhone(phone)}
                      onChangeText={(value) => {
                        setPhone(normalizePhone(value));
                        setError("");
                      }}
                      onFocus={() => setFocused("phone")}
                      onBlur={() => setFocused(null)}
                      onSubmitEditing={sendPhoneOtp}
                      placeholder="Enter your mobile number"
                      placeholderTextColor={C.inkMuted}
                      keyboardType="phone-pad"
                      maxLength={11}
                      editable={!loading}
                      autoCorrect={false}
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      importantForAutofill="yes"
                      selectionColor={C.brand}
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
                </>
              ) : null}

              {/* ----- STEP 2: OTP ----- */}

              {step === "otp" ? (
                <>
                  <View style={s.otpInfoRow}>
                    <View style={s.otpInfoIcon}>
                      <Ionicons
                        name="chatbubble-ellipses"
                        size={17}
                        color={C.brand}
                      />
                    </View>
                    <View style={s.otpInfoCopy}>
                      <Text style={s.otpInfoTitle}>
                        6-digit verification code
                      </Text>
                      <Text style={s.otpInfoSubtitle}>
                        Check your SMS. You can tap the code suggestion or paste
                        it here.
                      </Text>
                    </View>
                  </View>

                  <Animated.View
                    onTouchStart={() => {
                      if (!loading) otpInputRef.current?.focus();
                    }}
                    style={[s.otpWrap, { transform: [{ translateX: shakeX }] }]}
                  >
                    <View style={s.otpRow} pointerEvents="none">
                      {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                        const digit = otp[i] ?? "";

                        const active =
                          focused === "otp" &&
                          i === Math.min(otp.length, OTP_LENGTH - 1);

                        return (
                          <View
                            key={i}
                            style={[
                              s.otpBox,
                              !!digit && s.otpBoxFilled,
                              active && s.fieldFocused,
                              !!error && s.fieldError,
                            ]}
                          >
                            <Text style={s.otpDigit}>{digit}</Text>
                          </View>
                        );
                      })}
                    </View>

                    <TextInput
                      ref={otpInputRef}
                      style={s.otpHiddenInput}
                      value={otp}
                      onChangeText={(value) => {
                        const nextOtp = value
                          .replace(/\D/g, "")
                          .slice(0, OTP_LENGTH);

                        setOtp(nextOtp);
                        setError("");

                        // Verify immediately when all 6 digits are entered
                        // (including SMS autofill). The ref prevents duplicate requests.
                        if (
                          nextOtp.length === OTP_LENGTH &&
                          !verifyingRef.current &&
                          !loadingRef.current
                        ) {
                          // SMS autofill, keyboard suggestion, and paste all
                          // reach this same handler. Verify once the full code
                          // has been inserted into the controlled input.
                          void verifyPhoneOtp(nextOtp);
                        }
                      }}
                      onFocus={() => setFocused("otp")}
                      onBlur={() => setFocused(null)}
                      showSoftInputOnFocus={true}
                      keyboardType="number-pad"
                      maxLength={OTP_LENGTH}
                      editable={!loading}
                      // Android SMS OTP autofill: when the device keyboard
                      // offers the detected code, it is inserted into this
                      // controlled input and the existing 6-digit handler
                      // verifies it automatically.
                      // Android uses the sms-otp autofill hint; iOS uses
                      // oneTimeCode. The platform-specific hint helps the OS
                      // offer the code without giving the app permission to
                      // read the user's entire SMS inbox.
                      autoComplete={
                        Platform.OS === "android" ? "sms-otp" : "one-time-code"
                      }
                      textContentType="oneTimeCode"
                      importantForAutofill="yes"
                      autoCorrect={false}
                      spellCheck={false}
                      contextMenuHidden={false}
                      caretHidden
                      selectionColor="transparent"
                      accessibilityLabel="6-digit verification code"
                      accessibilityHint="The code may be suggested automatically when the verification SMS arrives. You can also paste the code."
                    />
                  </Animated.View>
                </>
              ) : null}

              {/* ----- STEP 3: PROFILE ----- */}

              {step === "completeProfile" ? (
                <>
                  <Text style={s.label}>First name</Text>

                  <View
                    style={[s.field, focused === "first" && s.fieldFocused]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={19}
                      color={focused === "first" ? C.brand : C.inkMuted}
                    />

                    <TextInput
                      style={[s.fieldInput, { marginLeft: 10 }]}
                      value={profile.firstName}
                      onChangeText={(value) => {
                        setProfile((current) => ({
                          ...current,
                          firstName: value,
                        }));

                        setError("");
                      }}
                      onFocus={() => setFocused("first")}
                      onBlur={() => setFocused(null)}
                      onSubmitEditing={() => lastNameRef.current?.focus()}
                      placeholder="Enter first name"
                      placeholderTextColor={C.inkMuted}
                      autoCapitalize="words"
                      autoComplete="given-name"
                      textContentType="givenName"
                      returnKeyType="next"
                      editable={!loading}
                      selectionColor={C.brand}
                    />
                  </View>

                  <Text style={[s.label, { marginTop: 14 }]}>Last name</Text>

                  <View style={[s.field, focused === "last" && s.fieldFocused]}>
                    <Ionicons
                      name="person-outline"
                      size={19}
                      color={focused === "last" ? C.brand : C.inkMuted}
                    />

                    <TextInput
                      ref={lastNameRef}
                      style={[s.fieldInput, { marginLeft: 10 }]}
                      value={profile.lastName}
                      onChangeText={(value) => {
                        setProfile((current) => ({
                          ...current,
                          lastName: value,
                        }));

                        setError("");
                      }}
                      onFocus={() => setFocused("last")}
                      onBlur={() => setFocused(null)}
                      onSubmitEditing={completePhoneProfile}
                      placeholder="Enter last name"
                      placeholderTextColor={C.inkMuted}
                      autoCapitalize="words"
                      autoComplete="family-name"
                      textContentType="familyName"
                      returnKeyType="done"
                      editable={!loading}
                      selectionColor={C.brand}
                    />
                  </View>
                </>
              ) : null}

              {/* ----- ERROR ----- */}

              {!!error ? (
                <View style={s.errorBox} accessibilityLiveRegion="polite">
                  <Ionicons name="alert-circle" size={19} color={C.danger} />

                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}

              {__DEV__ && !!diagnostic ? (
                <View style={s.diagnosticBox} accessibilityLiveRegion="polite">
                  <Text style={s.diagnosticTitle}>
                    DEBUG DETAILS (development only)
                  </Text>
                  <Text selectable style={s.diagnosticText}>
                    {diagnostic}
                  </Text>
                  <Pressable
                    onPress={() => {
                      debugLog(
                        "diagnostic copied manually; use the visible text",
                      );
                    }}
                  >
                    <Text style={s.diagnosticHint}>
                      Copy these details from the screen or Metro logs. Do not
                      share OTPs or tokens.
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* ----- PRIMARY ACTION ----- */}

              <View style={{ height: 20 }} />

              {step === "phone" ? (
                <PrimaryButton
                  title="Log in using OTP"
                  icon="arrow-forward"
                  loading={loading}
                  enabled={phoneValid}
                  onPress={() => {
                    debugLog("Continue with Phone pressed");
                    sendPhoneOtp();
                  }}
                />
              ) : null}

              {step === "phone" ? (
                <Text style={s.termsText}>
                  By continuing, you agree to OdiKart's Terms & Conditions and
                  Privacy Policy.
                </Text>
              ) : null}

              {step === "otp" ? (
                <PrimaryButton
                  title="Verify & Login"
                  icon="checkmark"
                  loading={loading}
                  enabled={otp.length === OTP_LENGTH}
                  onPress={() => {
                    debugLog("Verify & Login pressed");
                    verifyPhoneOtp();
                  }}
                />
              ) : null}

              {step === "completeProfile" ? (
                <PrimaryButton
                  title="Create My Account"
                  icon="checkmark-circle"
                  loading={loading}
                  enabled={
                    !!profile.firstName.trim() && !!profile.lastName.trim()
                  }
                  onPress={completePhoneProfile}
                />
              ) : null}

              {/* ----- RESEND ----- */}

              {step === "otp" ? (
                <View style={s.resendRow}>
                  <Text style={s.resendText}>Didn't receive the code?</Text>

                  <Pressable
                    onPress={sendPhoneOtp}
                    disabled={timer > 0 || loading}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: timer > 0 || loading }}
                  >
                    <Text
                      style={[s.link, (timer > 0 || loading) && s.linkDisabled]}
                    >
                      {timer > 0
                        ? `Resend in ${formatTimer(timer)}`
                        : "Resend OTP"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </Animated.View>

            {/* ----- SECURITY NOTE ----- */}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

/* =========================================================

   PRIMARY BUTTON

========================================================= */

function PrimaryButton({
  title,

  icon,

  loading,

  enabled = true,

  onPress,
}: {
  title: string;

  icon: keyof typeof Ionicons.glyphMap;

  loading: boolean;

  enabled?: boolean;

  onPress: () => void;
}) {
  const disabled = loading || !enabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled, busy: loading }}
      style={({ pressed }) => [
        s.btnWrap,
        pressed && !disabled && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <LinearGradient
        colors={
          disabled ? ["#A3A3A3", "#A3A3A3"] : ["#2563EB", "#4F46E5", "#7C3AED"]
        }
        locations={disabled ? [0, 1] : [0, 0.52, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.btn}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={s.btnText}>{title}</Text>
            {title !== "Log in using OTP" ? (
              <Ionicons name={icon} size={19} color="#fff" />
            ) : null}
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/* =========================================================

   STYLES

========================================================= */

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    // Transparent route lets the actual previous screen remain visible.
    backgroundColor: "rgba(12, 18, 45, 0.42)",
  },

  positioner: { flex: 1, width: "100%", justifyContent: "flex-end" },

  sheet: {
    flexShrink: 1,
    maxHeight: "94%",
    overflow: "hidden",
    backgroundColor: C.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    elevation: 28,
    shadowColor: "#101944",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },

  sheetHandleWrap: {
    position: "absolute",
    zIndex: 5,
    top: 7,
    left: 0,
    right: 0,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  scroll: { flexShrink: 1 },

  /* header art */

  header: { width: "100%", backgroundColor: "#FFFFFF", overflow: "hidden" },
  headerTop: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandLogoImage: { width: 120, height: 63 },

  brandPill: {
    height: 40,
    paddingLeft: 5,
    paddingRight: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  logoBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  logoMark: { color: C.brand, fontSize: 18, fontWeight: "900" },

  brandText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  headerAction: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  /* content */

  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 26 },

  verifiedChip: {
    alignSelf: "flex-start",
    marginBottom: 14,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: C.successSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  verifiedText: { fontSize: 12.5, fontWeight: "800", color: C.success },

  title: {
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "800",
    color: "#202124",
    letterSpacing: -0.35,
  },
  phoneTitle: {
    textAlign: "center",
    marginTop: 2,
    marginBottom: 32,
  },

  subtitle: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14.5,
    lineHeight: 21,
    color: C.inkSoft,
  },

  subtitleStrong: { color: C.ink, fontWeight: "800" },

  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: 0.2,
  },

  /* fields */

  field: {
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.4,
    borderColor: "#784ce7",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },

  fieldFocused: { borderColor: C.brand, backgroundColor: C.surface },

  fieldError: { borderColor: C.danger, backgroundColor: C.dangerSoft },

  fieldInput: {
    flex: 1,
    minHeight: 56,
    fontSize: 16,
    fontWeight: "500",
    color: C.ink,
    paddingVertical: 0,
  },

  flag: { fontSize: 20, marginRight: 8 },

  countryCode: { fontSize: 16, fontWeight: "800", color: C.ink },

  divider: {
    width: 1,
    height: 24,
    marginHorizontal: 12,
    backgroundColor: C.line,
  },

  phoneHintButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 13,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },

  phoneHintButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: C.brand,
  },

  helper: { marginTop: 7, fontSize: 12.5, color: C.inkMuted },

  /* otp */

  otpInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 18,
    borderRadius: 16,
    backgroundColor: "#F4F6FF",
    borderWidth: 1,
    borderColor: "#E8EBFF",
    gap: 10,
  },

  otpInfoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#E7EBFF",
    alignItems: "center",
    justifyContent: "center",
  },

  otpInfoCopy: { flex: 1 },

  otpInfoTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: C.ink,
  },

  otpInfoSubtitle: {
    marginTop: 3,
    fontSize: 11.5,
    lineHeight: 16,
    color: C.inkSoft,
  },

  otpWrap: { height: 64 },

  otpRow: {
    ...StyleSheet.absoluteFill,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  otpBox: {
    flex: 1,
    maxWidth: 52,
    height: 62,
    marginHorizontal: 3,
    borderRadius: 15,
    backgroundColor: "#F7F8FC",
    borderWidth: 1.5,
    borderColor: "#E5E8F2",
    alignItems: "center",
    justifyContent: "center",
  },

  otpBoxFilled: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },

  otpDigit: { fontSize: 25, fontWeight: "800", color: C.ink },

  otpHiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    fontSize: 16,
    backgroundColor: "transparent",
    opacity: 0.015,
    zIndex: 2,
  },

  resendRow: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },

  resendText: { fontSize: 13.5, color: C.inkSoft },

  link: { fontSize: 13.5, fontWeight: "800", color: C.brand },

  linkDisabled: { color: C.inkMuted },

  /* Development-only auth diagnostics */
  diagnosticBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
  },
  diagnosticTitle: {
    color: "#7d24fa",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 6,
  },
  diagnosticText: {
    color: "#F9FAFB",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  diagnosticHint: {
    color: "#D1D5DB",
    fontSize: 10,
    marginTop: 8,
  },

  /* error */

  errorBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.dangerSoft,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: C.danger,
  },

  /* button */

  btnWrap: {
    borderRadius: 12,
    overflow: "hidden",
  },

  btn: {
    minHeight: 60,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },

  btnText: {
    color: "#fff",
    fontSize: 15.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  termsText: {
    marginTop: 30,
    paddingHorizontal: 18,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: "#929292",
  },

  /* footer */

  securityNote: {
    marginTop: 22,
    padding: 12,
    borderRadius: 12,
    backgroundColor: C.successSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  securityText: { flex: 1, fontSize: 12, lineHeight: 17, color: C.success },
});
