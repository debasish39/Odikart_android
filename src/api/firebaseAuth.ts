import {
  getAuth,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "@react-native-firebase/auth";

import api from "./api";

const auth = getAuth();

type SafeErrorDetails = {
  name: string | null;
  code: string | null;
  message: string;
  nativeErrorCode: string | number | null;
  httpStatus: number | null;
  backendMessage: string | null;
};

const debug = (stage: string, details: Record<string, unknown> = {}) => {
  if (__DEV__) {
    console.log("[ODIKART PHONE AUTH]", {
      time: new Date().toISOString(),
      stage,
      ...details,
    });
  }
};

const errorDetails = (error: any): SafeErrorDetails => ({
  name: error?.name ?? null,
  code: error?.code ?? null,
  message: error?.message ?? String(error),
  nativeErrorCode: error?.nativeErrorCode ?? null,
  httpStatus: error?.response?.status ?? null,
  backendMessage: error?.response?.data?.message ?? null,
});

const debugError = (stage: string, error: any) => {
  if (__DEV__) {
    // Never log OTP digits, full phone numbers, Firebase ID tokens, or backend tokens.
    console.error("[ODIKART PHONE AUTH ERROR]", {
      time: new Date().toISOString(),
      stage,
      ...errorDetails(error),
    });
  }
};

const normalizePhone = (phone: string) => phone.trim();

export const sendPhoneOTP = async (
  phoneNumber: string,
): Promise<ConfirmationResult> => {
  const cleanPhone = normalizePhone(phoneNumber);
  const startedAt = Date.now();

  debug("send requested", {
    phoneLength: cleanPhone.length,
    hasPlusPrefix: cleanPhone.startsWith("+"),
    phoneFormatValid: /^\+[1-9]\d{7,14}$/.test(cleanPhone),
    platformAuthUserPresent: Boolean(auth.currentUser),
    // Do not log the actual phone number.
  });

  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
    const error = new Error(
      "Enter a valid phone number with country code, e.g. +917XXXXXXXXX.",
    );
    debugError("phone validation failed", error);
    throw error;
  }

  try {
    debug("calling signInWithPhoneNumber");
    const confirmation = await signInWithPhoneNumber(auth, cleanPhone);

    const validConfirmation =
      Boolean(confirmation) && typeof confirmation.confirm === "function";

    debug("signInWithPhoneNumber resolved", {
      elapsedMs: Date.now() - startedAt,
      confirmationReturned: Boolean(confirmation),
      confirmFunctionAvailable: typeof confirmation?.confirm === "function",
      validConfirmation,
      platformAuthUserPresentAfterSend: Boolean(auth.currentUser),
    });

    if (!validConfirmation) {
      throw new Error("Firebase did not return a valid confirmation session.");
    }

    return confirmation;
  } catch (error: any) {
    debugError("send failed", error);
    debug("send failure context", {
      elapsedMs: Date.now() - startedAt,
      platformAuthUserPresent: Boolean(auth.currentUser),
    });
    throw error;
  }
};

export const verifyPhoneOTP = async (
  confirmation: ConfirmationResult,
  otp: string,
  expectedPhoneNumber: string,
) => {
  const cleanOtp = otp.replace(/\D/g, "");
  const cleanPhone = normalizePhone(expectedPhoneNumber);
  const startedAt = Date.now();

  debug("verify requested", {
    otpLength: cleanOtp.length,
    confirmationPresent: Boolean(confirmation),
    confirmFunctionAvailable: typeof confirmation?.confirm === "function",
    expectedPhoneLength: cleanPhone.length,
    expectedPhoneFormatValid: /^\+[1-9]\d{7,14}$/.test(cleanPhone),
    currentFirebaseUserPresent: Boolean(auth.currentUser),
    currentFirebaseUserHasPhone: Boolean(auth.currentUser?.phoneNumber),
    currentFirebaseUserMatchesExpectedPhone:
      auth.currentUser?.phoneNumber === cleanPhone,
  });

  if (!confirmation || typeof confirmation.confirm !== "function") {
    const error = new Error(
      "Phone verification session is missing. Request a new OTP.",
    );
    debugError("confirmation validation failed", error);
    throw error;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
    const error = new Error("The expected phone number is invalid.");
    debugError("expected phone validation failed", error);
    throw error;
  }

  if (!/^\d{6}$/.test(cleanOtp)) {
    const error = new Error("Please enter the complete 6-digit OTP.");
    debugError("OTP format validation failed", error);
    throw error;
  }

  let firebaseUser;

  try {
    debug("calling confirmation.confirm", {
      elapsedMs: Date.now() - startedAt,
    });

    // Important: do not skip confirmation merely because auth.currentUser
    // matches the phone. A pre-existing user is not proof that this OTP
    // attempt has been verified. Always verify the active confirmation.
    const result = await confirmation.confirm(cleanOtp);
    firebaseUser = result?.user ?? null;

    debug("confirmation.confirm resolved", {
      elapsedMs: Date.now() - startedAt,
      userReturned: Boolean(firebaseUser),
      uidPresent: Boolean(firebaseUser?.uid),
      returnedPhonePresent: Boolean(firebaseUser?.phoneNumber),
      returnedPhoneMatchesExpected: firebaseUser?.phoneNumber === cleanPhone,
    });

    if (!firebaseUser) {
      throw new Error("Firebase user was not returned.");
    }

    if (firebaseUser.phoneNumber && firebaseUser.phoneNumber !== cleanPhone) {
      throw new Error(
        "The authenticated Firebase user does not match the requested phone number.",
      );
    }
  } catch (error: any) {
    debugError("Firebase OTP confirmation failed", error);
    throw error;
  }

  let firebaseToken: string;

  try {
    debug("requesting Firebase ID token");
    firebaseToken = await firebaseUser.getIdToken(true);

    debug("Firebase ID token result", {
      elapsedMs: Date.now() - startedAt,
      tokenReceived: Boolean(firebaseToken),
    });

    if (!firebaseToken) {
      throw new Error("Firebase ID token was not returned.");
    }
  } catch (error: any) {
    debugError("Firebase ID token failed", error);
    throw error;
  }

  try {
    debug("calling Odikart backend", {
      endpointPath: "/auth/firebase-phone-login",
      appType: "customer",
      authorizationHeaderPresent: Boolean(firebaseToken),
    });

    const response = await api.post(
      "/auth/firebase-phone-login",
      { app: "customer" },
      {
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
        },
      },
    );

    debug("backend response received", {
      elapsedMs: Date.now() - startedAt,
      httpStatus: response.status,
      success: Boolean(response.data?.success),
      tokenPresent: Boolean(response.data?.token),
      userPresent: Boolean(response.data?.user),
      isNewUser: Boolean(response.data?.isNewUser),
    });

    if (!response.data?.success || !response.data?.token) {
      const error = new Error(
        response.data?.message || "Odikart backend login failed.",
      );
      (error as any).code = "backend/invalid-login-response";
      throw error;
    }

    debug("phone login completed successfully", {
      elapsedMs: Date.now() - startedAt,
    });

    return response.data;
  } catch (error: any) {
    debugError("Odikart backend login failed", error);
    throw error;
  }
};
