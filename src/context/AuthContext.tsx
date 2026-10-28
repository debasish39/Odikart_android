import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AppState } from "react-native";

import { clearAuth, getToken, getUser, saveAuth } from "../api/authStorage";

import { setUnauthorizedHandler } from "../api/api";

import {
  registerForNativePushNotifications,
  unregisterNativePushNotifications,
} from "../api/pushNotifications";

type User = any;

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (token: string, user?: User | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/*
 * JWT HELPERS
 *
 * This checks the token's expiry for client-side session management.
 * The backend must still verify every protected request.
 */

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split(".");

    if (parts.length !== 3 || !parts[1]) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");

    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

    if (typeof atob !== "function") {
      return null;
    }

    const decoded = atob(padded);
    const payload = JSON.parse(decoded);

    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getTokenExpiryMs(jwt: string): number | null {
  const payload = decodeJwtPayload(jwt);

  if (
    !payload ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp)
  ) {
    return null;
  }

  return payload.exp * 1000;
}

function isTokenExpired(jwt: string): boolean {
  const expiryMs = getTokenExpiryMs(jwt);

  // Fail closed if the token cannot be decoded or has no valid expiry.
  if (expiryMs === null) {
    return true;
  }

  // Five-second safety margin to avoid requests at the expiry boundary.
  return expiryMs <= Date.now() + 5000;
}

function safeLog(message: string, error?: unknown) {
  if (__DEV__) {
    console.warn(message, error ?? "");
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Prevent simultaneous logout operations from running repeatedly.
  const logoutPromiseRef = useRef<Promise<void> | null>(null);

  // Prevent duplicate expiry handling for the current session.
  const expiryLogoutRef = useRef(false);

  /*
   * LOGOUT
   *
   * Immediately invalidate the in-memory session, clear persistent
   * credentials, then attempt push-notification cleanup.
   */
  const logout = useCallback(async (): Promise<void> => {
    if (logoutPromiseRef.current) {
      return logoutPromiseRef.current;
    }

    const cleanupPromise = (async () => {
      // Block authenticated UI immediately.
      setToken(null);
      setUser(null);

      try {
        await clearAuth();

        if (__DEV__) {
          console.log("AUTH LOGOUT: SESSION CLEARED");
        }
      } catch (error) {
        safeLog("AUTH CLEAR ERROR:", error);
        throw error;
      } finally {
        // Push cleanup must not prevent the local logout attempt.
        try {
          await unregisterNativePushNotifications();
        } catch (error) {
          safeLog("ODIKART FCM UNREGISTER ERROR:", error);
        }
      }
    })();

    logoutPromiseRef.current = cleanupPromise;

    try {
      await cleanupPromise;
    } finally {
      logoutPromiseRef.current = null;
    }
  }, []);

  /*
   * CENTRALIZED UNAUTHORIZED HANDLER
   *
   * api.ts calls this when the backend reports an expired JWT.
   */
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      if (__DEV__) {
        console.warn("AUTH CONTEXT: Expired JWT detected; logging out");
      }

      await logout();
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [logout]);

  /*
   * RESTORE AUTHENTICATION
   *
   * Runs on initial app startup and whenever refreshAuth is called.
   */
  const refreshAuth = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const storedToken = await getToken();

      if (!storedToken || isTokenExpired(storedToken)) {
        setToken(null);
        setUser(null);

        if (storedToken) {
          safeLog("AUTH RESTORE: TOKEN INVALID OR EXPIRED");
        } else if (__DEV__) {
          console.log("AUTH RESTORE: NO TOKEN");
        }

        try {
          await clearAuth();
        } catch (error) {
          safeLog("AUTH RESTORE CLEAR ERROR:", error);
        }

        return;
      }

      const storedUser = await getUser();

      setToken(storedToken);
      setUser(storedUser ?? null);

      if (__DEV__) {
        console.log("AUTH RESTORE: TOKEN VALID");
      }
    } catch (error) {
      safeLog("AUTH RESTORE ERROR:", error);

      setToken(null);
      setUser(null);

      try {
        await clearAuth();
      } catch (clearError) {
        safeLog("AUTH RESTORE CLEAR ERROR:", clearError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * INITIAL AUTH CHECK
   */
  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  /*
   * AUTOMATIC JWT EXPIRY
   *
   * Logs out at expiry, even if the user makes no API requests.
   * Rechecks when the app returns to the foreground.
   */
  useEffect(() => {
    if (loading || !token) {
      expiryLogoutRef.current = false;
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let checkingExpiry = false;

    const enforceExpiry = async () => {
      if (cancelled || checkingExpiry) {
        return;
      }

      checkingExpiry = true;

      try {
        if (isTokenExpired(token)) {
          if (!expiryLogoutRef.current) {
            expiryLogoutRef.current = true;

            if (__DEV__) {
              console.warn("AUTH SESSION: JWT expired or invalid; logging out");
            }

            await logout();
          }

          return;
        }

        const expiryMs = getTokenExpiryMs(token);

        if (expiryMs === null) {
          expiryLogoutRef.current = true;
          await logout();
          return;
        }

        const remainingMs = expiryMs - Date.now();

        // Wake shortly before expiry; isTokenExpired includes a
        // five-second safety margin. Recheck rather than trusting
        // the timer as the final authority.
        const delayMs = Math.max(
          1000,
          Math.min(remainingMs - 5000, 2_000_000_000),
        );

        timer = setTimeout(() => {
          void enforceExpiry();
        }, delayMs);
      } catch (error) {
        safeLog("AUTH EXPIRY CHECK ERROR:", error);

        // Fail closed if expiry cannot be evaluated safely.
        expiryLogoutRef.current = true;

        try {
          await logout();
        } catch (logoutError) {
          safeLog("AUTH EXPIRY LOGOUT ERROR:", logoutError);
        }
      } finally {
        checkingExpiry = false;
      }
    };

    void enforceExpiry();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && !cancelled) {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }

        void enforceExpiry();
      }
    });

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      subscription.remove();
    };
  }, [token, loading, logout]);

  /*
   * REGISTER NATIVE PUSH NOTIFICATIONS
   */
  useEffect(() => {
    if (loading || !token || isTokenExpired(token)) {
      return;
    }

    let cancelled = false;

    const registerPushToken = async () => {
      try {
        await registerForNativePushNotifications();

        if (!cancelled && __DEV__) {
          console.log("ODIKART PUSH: Registration completed");
        }
      } catch (error: any) {
        if (!cancelled) {
          safeLog(
            "ODIKART FCM REGISTRATION ERROR:",
            error?.response?.data || error?.message || error,
          );
        }
      }
    };

    void registerPushToken();

    return () => {
      cancelled = true;
    };
  }, [token, loading]);

  /*
   * LOGIN
   *
   * Only accept a token that has a readable, unexpired exp claim.
   */
  const login = useCallback(
    async (newToken: string, newUser?: User | null): Promise<void> => {
      if (!newToken || isTokenExpired(newToken)) {
        throw new Error(
          "The authentication token is invalid or expired. Please sign in again.",
        );
      }

      // Save credentials before declaring the session authenticated.
      await saveAuth(newToken, newUser ?? null);

      expiryLogoutRef.current = false;

      setUser(newUser ?? null);
      setToken(newToken);

      if (__DEV__) {
        console.log("AUTH LOGIN: SUCCESS");
      }
    },
    [],
  );

  /*
   * AUTH STATE
   *
   * This also immediately evaluates expiry during rendering.
   */
  const isAuthenticated = Boolean(token) && !isTokenExpired(token as string);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated,
      login,
      logout,
      refreshAuth,
    }),
    [user, token, loading, isAuthenticated, login, logout, refreshAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/*
 * USE AUTH HOOK
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
