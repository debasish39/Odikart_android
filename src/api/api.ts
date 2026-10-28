import axios from "axios";
import { getToken } from "./authStorage";
export const BACKEND_URL = "https://eshop-backend-y0e7.onrender.com";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// AuthContext registers the handler.
// Axios itself must not call React hooks.
let unauthorizedHandler: (() => Promise<void>) | null = null;
let handlingExpiredSession = false;

export function setUnauthorizedHandler(handler: (() => Promise<void>) | null) {
  unauthorizedHandler = handler;
}

api.interceptors.request.use(
  async (config) => {
    // Preserve credentials explicitly provided by the caller.
    // Firebase phone login supplies a Firebase ID token here.
    const hasExplicitAuthorization =
      Boolean(config.headers?.get?.("Authorization")) ||
      Boolean(config.headers?.Authorization);

    if (hasExplicitAuthorization) {
      return config;
    }

    try {
      const token = await getToken();

      if (token) {
        config.headers.set("Authorization", `Bearer ${token}`);
      } else {
        config.headers.delete("Authorization");
      }
    } catch (error) {
      console.warn("AUTH TOKEN READ ERROR:", error);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || "").toLowerCase();

    const isExpiredJwt =
      status === 401 &&
      (message.includes("jwt expired") ||
        message.includes("token expired") ||
        message.includes("expired token"));

    if (isExpiredJwt && !handlingExpiredSession) {
      handlingExpiredSession = true;

      try {
        console.warn("AUTH SESSION: Backend rejected expired JWT");

        if (unauthorizedHandler) {
          await unauthorizedHandler();
        } else {
          console.warn("AUTH SESSION: No expiry handler registered");
        }
      } catch (handlerError) {
        console.error("AUTH SESSION CLEANUP ERROR:", handlerError);
      } finally {
        handlingExpiredSession = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
