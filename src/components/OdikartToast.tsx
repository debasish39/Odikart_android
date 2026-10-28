import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

type ToastType =
  | "success"
  | "error"
  | "warning"
  | "info"
  | "action";

type ToastAction = {
  label: string;
  onPress: () => void;
};

type ShowToastOptions = {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: ToastAction;
};

type ToastContextType = {
  showToast: (options: ShowToastOptions) => void;
  hideToast: () => void;
};

const ToastContext = createContext<ToastContextType | undefined>(
  undefined
);

export function OdikartToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [toast, setToast] = useState<
    (ShowToastOptions & { id: number }) | null
  >(null);

  const translateY = useRef(new Animated.Value(-130)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -130,
        duration: 220,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [opacity, translateY]);

  const showToast = useCallback(
    (options: ShowToastOptions) => {
      setToast({
        ...options,
        id: Date.now(),
      });

      translateY.setValue(-130);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 180,
          mass: 0.8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    },
    [opacity, translateY]
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

    const duration = toast.duration ?? 2600;

    const timer = setTimeout(() => {
      hideToast();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, hideToast]);

  const getToastConfig = () => {
    switch (toast?.type) {
      case "success":
        return {
          icon: "checkmark-circle" as const,
          iconColor: "#16A34A",
          iconBackground: "#DCFCE7",
          accent: "#16A34A",
        };

      case "error":
        return {
          icon: "close-circle" as const,
          iconColor: "#DC2626",
          iconBackground: "#FEE2E2",
          accent: "#DC2626",
        };

      case "warning":
        return {
          icon: "warning" as const,
          iconColor: "#D97706",
          iconBackground: "#FEF3C7",
          accent: "#D97706",
        };

      case "info":
        return {
          icon: "information-circle" as const,
          iconColor: "#2563EB",
          iconBackground: "#DBEAFE",
          accent: "#2563EB",
        };

      case "action":
        return {
          icon: "flash" as const,
          iconColor: "#7C3AED",
          iconBackground: "#EDE9FE",
          accent: "#7C3AED",
        };

      default:
        return {
          icon: "information-circle" as const,
          iconColor: "#2563EB",
          iconBackground: "#DBEAFE",
          accent: "#2563EB",
        };
    }
  };

  const config = getToastConfig();

  return (
    <ToastContext.Provider
      value={{
        showToast,
        hideToast,
      }}
    >
      {children}

      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.toastShadow}>
            <View style={styles.toast}>
              {/* Accent line */}
              <View
                style={[
                  styles.accent,
                  {
                    backgroundColor: config.accent,
                  },
                ]}
              />

              {/* Icon */}
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: config.iconBackground,
                  },
                ]}
              >
                <Ionicons
                  name={config.icon}
                  size={23}
                  color={config.iconColor}
                />
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text
                  style={styles.title}
                  numberOfLines={1}
                >
                  {toast.title}
                </Text>

                {toast.message ? (
                  <Text
                    style={styles.message}
                    numberOfLines={2}
                  >
                    {toast.message}
                  </Text>
                ) : null}
              </View>

              {/* Action */}
              {toast.action ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.actionButton,
                    pressed && styles.actionPressed,
                  ]}
                  onPress={() => {
                    toast.action?.onPress();
                    hideToast();
                  }}
                >
                  <Text style={styles.actionText}>
                    {toast.action.label}
                  </Text>
                </Pressable>
              ) : null}

              {/* Close */}
              {!toast.action && (
                <Pressable
                  style={styles.closeButton}
                  onPress={hideToast}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close"
                    size={17}
                    color="#9CA3AF"
                  />
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useOdikartToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error(
      "useOdikartToast must be used inside OdikartToastProvider"
    );
  }

  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 999999,
  },

  toastShadow: {
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
  },

  toast: {
    width: "100%",
    minHeight: 72,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",

    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1,
    borderColor: "#E5E7EB",

    overflow: "hidden",
  },

  accent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },

  iconContainer: {
    width: 44,
    height: 44,
    marginLeft: 4,

    borderRadius: 14,

    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flex: 1,
    marginLeft: 11,
    marginRight: 6,
  },

  title: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
  },

  message: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: "#6B7280",
  },

  actionButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 10,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F3F4F6",
  },

  actionPressed: {
    opacity: 0.65,
  },

  actionText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563EB",
  },

  closeButton: {
    width: 28,
    height: 28,

    borderRadius: 10,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor: "#F9FAFB",
  },
});