



import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../api/api";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../theme/colors";

type ToastType = "success" | "error";

export default function EditProfileScreen() {
  const { user } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [toast, setToast] = useState<{
    type: ToastType;
    title: string;
    message: string;
  } | null>(null);

  const applyProfileToForm = useCallback((profile: any) => {
    if (!profile) return;

    setFirstName(profile.firstName || "");
    setLastName(profile.lastName || "");
    setPhone(profile.phone || "");
    setEmail(profile.email || "");

    // The backend's safe user response uses `image`. Keep fallbacks for
    // older account shapes used by other parts of the app.
    const nextImage =
      profile.image ||
      profile.profileImage ||
      profile.avatar ||
      profile.profileImageUrl ||
      null;

    setImageUri(nextImage);
  }, []);

  // Load the latest saved profile every time this screen gains focus.
  // `useAuth().user` can be stale after a profile update, so it should only
  // be used as an immediate fallback while /auth/me refreshes from the DB.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (user) {
        applyProfileToForm(user);
      }

      const loadLatestProfile = async () => {
        try {
          console.log("[PROFILE-DEBUG] Refreshing profile from /auth/me");
          const response = await api.get("/auth/me");
          const latestUser =
            response.data?.user ||
            response.data?.data?.user ||
            response.data?.data ||
            null;

          if (active && latestUser) {
            console.log("[PROFILE-DEBUG] Latest profile loaded:", {
              hasEmail: Boolean(latestUser.email),
              hasImage: Boolean(
                latestUser.image ||
                  latestUser.profileImage ||
                  latestUser.avatar ||
                  latestUser.profileImageUrl,
              ),
            });
            applyProfileToForm(latestUser);
          } else if (active) {
            console.warn(
              "[PROFILE-DEBUG] /auth/me returned no user; using auth context fallback.",
            );
          }
        } catch (error: any) {
          console.error("[PROFILE-DEBUG] Failed to refresh profile:", {
            status: error?.response?.status,
            message: error?.response?.data?.message || error?.message,
            endpoint: "/auth/me",
          });
          // Keep the values from auth context if refresh fails.
        }
      };

      void loadLatestProfile();

      return () => {
        active = false;
      };
    }, [user, applyProfileToForm]),
  );

  const initials = useMemo(() => {
    const first = firstName.trim().charAt(0);
    const last = lastName.trim().charAt(0);
    return `${first}${last}`.toUpperCase() || "O";
  }, [firstName, lastName]);

  const showToast = (type: ToastType, title: string, message: string) => {
    setToast({ type, title, message });

    setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const pickProfileImage = async () => {
    if (pickingImage) {
      console.warn("[PROFILE-DEBUG] Image picker ignored: already opening.");
      return;
    }

    try {
      console.log("[PROFILE-DEBUG] Opening image picker.");
      setPickingImage(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      console.log("[PROFILE-DEBUG] Media permission:", {
        granted: permission.granted,
        canAskAgain: permission.canAskAgain,
        status: permission.status,
      });

      if (!permission.granted) {
        showToast(
          "error",
          "Permission needed",
          "Allow photo access to choose a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      console.log("[PROFILE-DEBUG] Image selected:", {
        hasUri: Boolean(asset.uri),
        fileName: asset.fileName ?? null,
        fileSize: asset.fileSize ?? null,
        mimeType: asset.mimeType ?? null,
        width: asset.width,
        height: asset.height,
      });

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        showToast(
          "error",
          "Image too large",
          "Please select an image smaller than 5 MB.",
        );
        return;
      }

      setImageUri(asset.uri);
      console.log("[PROFILE-DEBUG] Image URI placed in state.");
    } catch (error) {
      console.error("[PROFILE-DEBUG] Image picker failed:", error);
      showToast("error", "Image error", "Unable to select this image.");
    } finally {
      setPickingImage(false);
    }
  };

  const validate = () => {
    if (!firstName.trim()) {
      showToast(
        "error",
        "First name required",
        "Please enter your first name.",
      );
      return false;
    }

    if (firstName.trim().length < 2) {
      showToast(
        "error",
        "Invalid first name",
        "First name must contain at least 2 characters.",
      );
      return false;
    }

    const cleanEmail = email.trim();

    if (
      cleanEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      showToast(
        "error",
        "Invalid email",
        "Please enter a valid email address.",
      );
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    console.log("[PROFILE-DEBUG] Save tapped:", {
      alreadySaving: saving,
      firstNameLength: firstName.trim().length,
      lastNameLength: lastName.trim().length,
      emailProvided: Boolean(email.trim()),
      hasSelectedImage: Boolean(imageUri),
    });

    if (saving) {
      console.warn(
        "[PROFILE-DEBUG] Save ignored: request already in progress.",
      );
      return;
    }

    if (!validate()) {
      console.warn("[PROFILE-DEBUG] Validation failed; API request not sent.");
      return;
    }

    try {
      setSaving(true);

      const formData = new FormData();

      formData.append("firstName", firstName.trim());
      formData.append("lastName", lastName.trim());
      formData.append("email", email.trim());

      const originalImage =
        (user as any)?.image ||
        (user as any)?.profileImage ||
        (user as any)?.avatar ||
        null;

      const shouldUploadImage = Boolean(
        imageUri &&
        imageUri !== originalImage &&
        !imageUri.startsWith("http://") &&
        !imageUri.startsWith("https://"),
      );

      console.log("[PROFILE-DEBUG] Preparing request:", {
        baseURL: api.defaults.baseURL ?? "(not set)",
        endpoint: "/auth/update-profile",
        method: "PUT",
        // These are the fields actually sent below. Phone is intentionally excluded.
        fields: ["firstName", "lastName", "email"],
        shouldUploadImage,
        imageUriType: !imageUri
          ? "none"
          : imageUri.startsWith("http://") || imageUri.startsWith("https://")
            ? "remote-url"
            : "local-file-uri",
        contentType: "multipart/form-data",
        // Never log auth headers or tokens here.
      });

      // Only upload when the selected image is different from the
      // server image. Remote URLs should never be appended as files.
      if (shouldUploadImage && imageUri) {
        const pathWithoutQuery = imageUri.split("?")[0];
        const extension =
          pathWithoutQuery.split(".").pop()?.toLowerCase() || "jpg";
        const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension)
          ? extension
          : "jpg";
        const mimeType =
          safeExtension === "png"
            ? "image/png"
            : safeExtension === "webp"
              ? "image/webp"
              : "image/jpeg";

        formData.append("image", {
          uri: imageUri,
          name: `profile-${Date.now()}.${safeExtension}`,
          type: mimeType,
        } as any);

        console.log("[PROFILE-DEBUG] Image attached to multipart request:", {
          name: `profile-upload.${safeExtension}`,
          mimeType,
        });
      } else {
        console.log("[PROFILE-DEBUG] No image file attached.");
      }

      console.log("[PROFILE-DEBUG] Sending PUT request.");
      const response = await api.put("/auth/update-profile", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("[PROFILE-DEBUG] Response received:", {
        status: response.status,
        success: response.data?.success,
        message: response.data?.message,
        returnedUser: Boolean(response.data?.user),
        returnedFields: response.data?.user
          ? {
              firstName: Boolean(response.data.user.firstName),
              lastName: Boolean(response.data.user.lastName),
              email: Boolean(response.data.user.email),
              phoneIncluded: Object.prototype.hasOwnProperty.call(
                response.data.user,
                "phone",
              ),
              imageIncluded: Boolean(
                response.data.user.image ||
                  response.data.user.profileImage ||
                  response.data.user.avatar,
              ),
            }
          : null,
      });

      const data = response.data;

      if (data?.success === false) {
        throw new Error(data?.message || "Unable to update profile.");
      }

      if (data?.user) {
        applyProfileToForm(data.user);
      }

      showToast(
        "success",
        "Profile updated",
        "Your account information has been saved.",
      );

      setTimeout(() => {
        // The screen may have been opened directly, with no back history.
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)" as any);
        }
      }, 700);
    } catch (error: any) {
      console.error("[PROFILE-DEBUG] Update request failed:", {
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        responseData: error?.response?.data,
        responseHeaders: error?.response?.headers,
        requestUrl: error?.config?.url,
        requestMethod: error?.config?.method,
        baseURL: error?.config?.baseURL ?? api.defaults.baseURL,
        // Deliberately do not print request headers; they may contain tokens.
      });

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Unable to update your profile.";

      showToast("error", "Update failed", message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.emptyState}>
          <Ionicons
            name="person-circle-outline"
            size={54}
            color={colors.textMuted}
          />
          <Text style={styles.emptyTitle}>Please sign in</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)" as any);
              }
            }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Text style={styles.headerSubtitle}>
              Keep your account information up to date
            </Text>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {/* PROFILE PHOTO */}
          <View style={styles.photoSection}>
            <Pressable
              onPress={pickProfileImage}
              disabled={pickingImage || saving}
              style={({ pressed }) => [
                styles.avatarButton,
                pressed && styles.avatarPressed,
              ]}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              )}

              <View style={styles.cameraButton}>
                {pickingImage ? (
                  <ActivityIndicator size="small" color={colors.textWhite} />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.textWhite} />
                )}
              </View>
            </Pressable>

            <Text style={styles.photoTitle}>Profile photo</Text>
            <Text style={styles.photoSubtitle}>
              Tap the photo to choose a new one
            </Text>
          </View>

          {/* PERSONAL INFORMATION */}
          <Text style={styles.sectionTitle}>Personal information</Text>

          <View style={styles.formCard}>
            <InputField
              label="First name"
              icon="person-outline"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
              editable={!saving}
              autoCapitalize="words"
            />

            <InputField
              label="Last name"
              icon="person-outline"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
              editable={!saving}
              autoCapitalize="words"
              last
            />
          </View>

          {/* CONTACT */}
          <Text style={styles.sectionTitle}>Contact information</Text>

          <View style={styles.formCard}>
            <InputField
              label="Email address"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="Your email address"
              editable={!saving}
              keyboardType="email-address"
              autoCapitalize="none"
              last={false}
              helper="You can update your email address here"
            />

            <InputField
              label="Phone number"
              icon="call-outline"
              value={phone}
              placeholder="Phone number cannot be changed here"
              editable={false}
              keyboardType="phone-pad"
              last
              helper="Your phone number is kept unchanged for account security"
            />
          </View>

          {/* SECURITY NOTE */}
          <View style={styles.securityCard}>
            <View style={styles.securityIcon}>
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.primary}
              />
            </View>

            <View style={styles.securityContent}>
              <Text style={styles.securityTitle}>
                Your information is secure
              </Text>
              <Text style={styles.securityText}>
                Your profile information is used to manage your OdiKart account
                and orders.
              </Text>
            </View>
          </View>

          {/* SAVE */}
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !saving && styles.savePressed,
              saving && styles.saveDisabled,
            ]}
          >
            <LinearGradient
              colors={["#2563EB", "#4F46E5", "#7C3AED"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.saveButtonGradient}
            >
              {saving ? (
                <>
                  <ActivityIndicator color={colors.textWhite} size="small" />
                  <Text style={styles.saveText}>Saving changes...</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color={colors.textWhite}
                  />
                  <Text style={styles.saveText}>Save Changes</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          <Text style={styles.footerText}>
            Changes will be applied to your OdiKart account.
          </Text>

          <View style={styles.bottomSpace} />
        </ScrollView>

        {/* TOAST */}
        {toast ? (
          <View
            pointerEvents="none"
            style={[
              styles.toast,
              toast.type === "success"
                ? styles.successToast
                : styles.errorToast,
            ]}
          >
            <View
              style={[
                styles.toastIcon,
                toast.type === "success"
                  ? styles.successToastIcon
                  : styles.errorToastIcon,
              ]}
            >
              <Ionicons
                name={toast.type === "success" ? "checkmark" : "alert"}
                size={17}
                color={colors.textWhite}
              />
            </View>

            <View style={styles.toastContent}>
              <Text style={styles.toastTitle}>{toast.title}</Text>
              <Text style={styles.toastMessage}>{toast.message}</Text>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InputField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType,
  autoCapitalize,
  helper,
  last = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder: string;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  helper?: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.inputBlock, !last && styles.inputBorder]}>
      <Text style={styles.inputLabel}>{label}</Text>

      <View style={[styles.inputWrapper, !editable && styles.inputDisabled]}>
        <Ionicons
          name={icon}
          size={19}
          color={editable ? colors.primary : colors.textMuted}
        />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={styles.input}
          selectionColor={colors.primary}
        />

        {!editable ? (
          <Ionicons
            name="lock-closed-outline"
            size={16}
            color={colors.textMuted}
          />
        ) : null}
      </View>

      {helper ? <Text style={styles.helperText}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboard: {
    flex: 1,
  },

  header: {
    minHeight: 70,
    paddingHorizontal: 17,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  headerText: {
    flex: 1,
    marginHorizontal: 12,
  },

  headerTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: colors.text,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
  },

  headerSpacer: {
    width: 42,
  },

  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  photoSection: {
    alignItems: "center",
    paddingTop: 7,
    paddingBottom: 25,
  },

  avatarButton: {
    position: "relative",
  },

  avatarPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.97 }],
  },

  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.surface,
  },

  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 4,
    borderColor: colors.surface,
  },

  avatarText: {
    fontSize: 31,
    fontWeight: "900",
    color: colors.textWhite,
  },

  cameraButton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
  },

  photoTitle: {
    marginTop: 11,
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
  },

  photoSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textSecondary,
  },

  sectionTitle: {
    marginTop: 3,
    marginBottom: 9,
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
  },

  formCard: {
    overflow: "hidden",
    marginBottom: 21,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  inputBlock: {
    paddingHorizontal: 14,
    paddingVertical: 13,
  },

  inputBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  inputLabel: {
    marginBottom: 7,
    fontSize: 11,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  inputWrapper: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 13,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  inputDisabled: {
    opacity: 0.72,
  },

  input: {
    flex: 1,
    minHeight: 44,
    marginLeft: 9,
    paddingVertical: 0,
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },

  helperText: {
    marginTop: 5,
    fontSize: 10,
    color: colors.textMuted,
  },

  securityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 13,
    marginBottom: 19,
    borderRadius: 17,
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },

  securityIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  securityContent: {
    flex: 1,
    marginLeft: 10,
  },

  securityTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.text,
  },

  securityText: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
  },

  saveButton: {
    height: 54,
    borderRadius: 16,
    overflow: "hidden",
  },

  saveButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingHorizontal: 16,
  },

  savePressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },

  saveDisabled: {
    opacity: 0.65,
  },

  saveText: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textWhite,
  },

  footerText: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 10,
    color: colors.textMuted,
  },

  bottomSpace: {
    height: 35,
  },

  pressed: {
    opacity: 0.7,
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },

  toast: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    minHeight: 64,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },

  successToast: {
    borderColor: "#BBF7D0",
  },

  errorToast: {
    borderColor: "#FECACA",
  },

  toastIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  successToastIcon: {
    backgroundColor: colors.success,
  },

  errorToastIcon: {
    backgroundColor: colors.error,
  },

  toastContent: {
    flex: 1,
    marginLeft: 10,
  },

  toastTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  toastMessage: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
  },
});
