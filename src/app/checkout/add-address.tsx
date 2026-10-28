import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Home,
  MapPin,
  Save,
  Search,
  X,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import {
  addAddress,
  getMyAddresses,
  updateAddress,
  type Address,
  type AddressPayload,
} from "../../api/address";
import { colors } from "../../theme/colors";

type AddressLabel = "Home" | "Work" | "Other";

type FormState = {
  label: AddressLabel;
  fullName: string;
  email: string;
  phone: string;
  alternatePhone: string;
  houseNumber: string;
  street: string;
  area: string;
  landmark: string;
  city: string;
  postalCode: string;
  postOffice: string;
  district: string;
  state: string;
  country: string;
  deliveryInstructions: string;
  isDefault: boolean;
};

// Session-level caches avoid repeating address-list and PIN lookups while navigating.
let cachedAddresses: Address[] | null = null;
const pinOfficeCache = new Map<string, PostOffice[]>();

type PostOffice = {
  Name?: string;
  BranchType?: string;
  DeliveryStatus?: string;
  District?: string;
  State?: string;
  Country?: string;
  Pincode?: string;
};

const EMPTY_FORM: FormState = {
  label: "Home",
  fullName: "",
  email: "",
  phone: "",
  alternatePhone: "",
  houseNumber: "",
  street: "",
  area: "",
  landmark: "",
  city: "",
  postalCode: "",
  postOffice: "",
  district: "",
  state: "",
  country: "India",
  deliveryInstructions: "",
  isDefault: false,
};

export default function AddAddressScreen() {
  const { addressId } = useLocalSearchParams<{ addressId?: string }>();
  const isEditMode = Boolean(addressId);

  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [loadingAddress, setLoadingAddress] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [postOffices, setPostOffices] = useState<PostOffice[]>([]);
  const [postOfficeOpen, setPostOfficeOpen] = useState(false);
  const [postOfficeSearch, setPostOfficeSearch] = useState("");

  const updateField = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  useEffect(() => {
    if (isEditMode && addressId) {
      loadAddress(String(addressId));
    }
  }, [addressId, isEditMode]);

  const loadAddress = async (id: string) => {
    try {
      setLoadingAddress(true);
      let addresses = cachedAddresses;

      if (!addresses) {
        const response = await getMyAddresses();
        addresses = Array.isArray(response?.addresses)
          ? response.addresses
          : Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.data?.addresses)
              ? response.data.addresses
              : [];
        cachedAddresses = addresses;
      }

      const existing = addresses.find(
        (item) => String(item?._id || "") === String(id),
      );

      if (!existing) {
        Toast.show({
          type: "error",
          text1: "Address not found",
          text2: "Please select the address again.",
          position: "bottom",
        });
        goBackSafely();
        return;
      }

      setForm({
        label:
          existing.label === "Work"
            ? "Work"
            : existing.label === "Other"
              ? "Other"
              : "Home",
        fullName: existing.fullName || "",
        email: existing.email || "",
        phone: existing.phone || "",
        alternatePhone: existing.alternatePhone || "",
        houseNumber: existing.houseNumber || "",
        street: existing.street || "",
        area: existing.area || "",
        landmark: existing.landmark || "",
        city: existing.city || "",
        postalCode: existing.postalCode || "",
        postOffice: existing.postOffice || "",
        district: existing.district || "",
        state: existing.state || "",
        country: existing.country || "India",
        deliveryInstructions: existing.deliveryInstructions || "",
        isDefault: Boolean(existing.isDefault),
      });

      // Render saved fields immediately. PIN metadata is refreshed in the
      // background so a slow postal API cannot block the edit form.
      setLoadingAddress(false);
      if (existing.postalCode) {
        void fetchPinDetails(
          String(existing.postalCode),
          false,
          existing.postOffice || "",
        );
      }
    } catch (error) {
      console.log("LOAD ADDRESS ERROR:", error);
      Toast.show({
        type: "error",
        text1: "Couldn't load address",
        text2: "Please try again.",
        position: "bottom",
      });
      goBackSafely();
    } finally {
      setLoadingAddress(false);
    }
  };

  const fetchPinDetails = async (
    pin: string,
    autoSelect = true,
    preferredOffice = form.postOffice,
  ) => {
    if (!/^[1-9][0-9]{5}$/.test(pin)) return;

    const cachedOffices = pinOfficeCache.get(pin);
    if (cachedOffices) {
      setPostOffices(cachedOffices);
      const existingOffice = cachedOffices.find(
        (office) => office.Name === preferredOffice,
      );
      const selected =
        existingOffice ||
        (autoSelect && cachedOffices.length === 1
          ? cachedOffices[0]
          : undefined);

      setForm((previous) => ({
        ...previous,
        postOffice: selected?.Name || previous.postOffice || "",
        district:
          selected?.District || cachedOffices[0]?.District || previous.district,
        state: selected?.State || cachedOffices[0]?.State || previous.state,
        country:
          selected?.Country ||
          cachedOffices[0]?.Country ||
          previous.country ||
          "India",
      }));
      setPostOfficeOpen(autoSelect && cachedOffices.length > 1);
      return;
    }

    try {
      setPinLoading(true);
      const response = await fetch(
        `https://api.postalpincode.in/pincode/${pin}`,
      );

      if (!response.ok) throw new Error("PIN lookup failed");

      const data = await response.json();

      if (
        !Array.isArray(data) ||
        !data[0] ||
        data[0].Status !== "Success" ||
        !Array.isArray(data[0].PostOffice) ||
        data[0].PostOffice.length === 0
      ) {
        setForm((previous) => ({
          ...previous,
          postOffice: "",
          district: "",
          state: "",
          country: "India",
        }));
        setPostOffices([]);
        setPostOfficeOpen(false);

        Toast.show({
          type: "error",
          text1: "PIN not found",
          text2: "Please check your 6-digit PIN code.",
          position: "bottom",
        });
        return;
      }

      const offices: PostOffice[] = data[0].PostOffice;
      pinOfficeCache.set(pin, offices);
      setPostOffices(offices);

      // Preserve the previously selected office while editing. For a new
      // address, select automatically only when there is exactly one option.
      const existingOffice = offices.find(
        (office) => office.Name === preferredOffice,
      );
      const selected =
        existingOffice ||
        (autoSelect && offices.length === 1 ? offices[0] : undefined);

      setForm((previous) => ({
        ...previous,
        postOffice: selected?.Name || "",
        district: selected?.District || offices[0]?.District || "",
        state: selected?.State || offices[0]?.State || "",
        country: selected?.Country || offices[0]?.Country || "India",
      }));

      // If several offices match this PIN, open the picker so the user
      // can explicitly choose one instead of silently selecting the first.
      setPostOfficeOpen(autoSelect && offices.length > 1);
    } catch (error) {
      console.log("PIN LOOKUP ERROR:", error);
      setPostOffices([]);
      setPostOfficeOpen(false);

      Toast.show({
        type: "error",
        text1: "Couldn't detect location",
        text2: "Check your internet connection and PIN.",
        position: "bottom",
      });
    } finally {
      setPinLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    const pin = value.replace(/\D/g, "").slice(0, 6);

    setForm((previous) => ({
      ...previous,
      postalCode: pin,
      ...(pin.length < 6
        ? {
            postOffice: "",
            district: "",
            state: "",
            country: "India",
          }
        : {}),
    }));

    if (pin.length < 6) {
      setPostOffices([]);
      setPostOfficeOpen(false);
      return;
    }

    fetchPinDetails(pin);
  };

  const selectPostOffice = (office: PostOffice) => {
    setForm((previous) => ({
      ...previous,
      postOffice: office.Name || "",
      district: office.District || previous.district,
      state: office.State || previous.state,
      country: office.Country || "India",
    }));
    setPostOfficeOpen(false);
  };

  const filteredPostOffices = postOffices.filter((office) => {
    const query = postOfficeSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      office.Name,
      office.BranchType,
      office.DeliveryStatus,
      office.District,
      office.State,
      office.Country,
      office.Pincode,
    ].some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    );
  });

  const locationReady =
    form.postalCode.length === 6 &&
    Boolean(form.postOffice) &&
    Boolean(form.district) &&
    Boolean(form.state);

  const showError = (text1: string, text2: string) => {
    Toast.show({
      type: "error",
      text1,
      text2,
      position: "bottom",
      visibilityTime: 2200,
    });
    return false;
  };

  const validateForm = () => {
    if (!form.fullName.trim())
      return showError(
        "Enter your name",
        "Please enter the receiver's full name.",
      );

    const email = form.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return showError("Invalid email", "Please enter a valid email address.");

    const phone = form.phone.replace(/\D/g, "");
    if (!/^[6-9][0-9]{9}$/.test(phone))
      return showError(
        "Invalid mobile number",
        "Enter a valid 10-digit mobile number.",
      );

    const alternate = form.alternatePhone.replace(/\D/g, "");
    if (alternate && !/^[6-9][0-9]{9}$/.test(alternate))
      return showError(
        "Invalid alternate number",
        "Enter a valid 10-digit mobile number or leave it empty.",
      );

    if (!form.houseNumber.trim())
      return showError(
        "Enter house / flat",
        "Please enter your house or flat number.",
      );

    if (!form.street.trim())
      return showError(
        "Enter street / road",
        "Please enter your street or road.",
      );

    if (!form.area.trim())
      return showError(
        "Enter your area",
        "Please enter your area or locality.",
      );

    if (!form.city.trim())
      return showError("Enter your city", "Please enter your city or town.");

    if (!/^[1-9][0-9]{5}$/.test(form.postalCode))
      return showError(
        "Enter your PIN",
        "Please enter a valid 6-digit PIN code.",
      );

    if (!form.district || !form.state)
      return showError(
        "Location not detected",
        "Please enter a valid PIN code and wait for the location.",
      );

    return true;
  };

  const handleSave = async () => {
    if (saving || !validateForm()) return;

    try {
      setSaving(true);

      const payload: AddressPayload = {
        label: form.label,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.replace(/\D/g, "").slice(0, 10),
        alternatePhone: form.alternatePhone.replace(/\D/g, "").slice(0, 10),
        houseNumber: form.houseNumber.trim(),
        street: form.street.trim(),
        area: form.area.trim(),
        landmark: form.landmark.trim(),
        postOffice: form.postOffice.trim(),
        city: form.city.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim() || "India",
        deliveryInstructions: form.deliveryInstructions.trim(),
        location: {
          latitude: null,
          longitude: null,
        },
        isDefault: Boolean(form.isDefault),
      };

      if (isEditMode && addressId) {
        await updateAddress(String(addressId), payload);
      } else {
        await addAddress(payload);
      }

      // Force the address list to refresh after a successful mutation.
      cachedAddresses = null;

      Toast.show({
        type: "success",
        text1: isEditMode ? "Address updated" : "Address saved",
        text2: "Your delivery address is ready.",
        position: "bottom",
        visibilityTime: 1800,
      });

      setTimeout(goBackSafely, 500);
    } catch (error: any) {
      console.log(
        "SAVE ADDRESS ERROR:",
        error?.response?.data || error?.message || error,
      );

      Toast.show({
        type: "error",
        text1: "Couldn't save address",
        text2:
          error?.response?.data?.message ||
          "Please check the details and try again.",
        position: "bottom",
        visibilityTime: 2500,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingAddress) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <View style={styles.loading}>
          <View style={styles.loadingIcon}>
            <MapPin size={24} color={colors.primary} />
          </View>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading address...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Pressable
              onPress={goBackSafely}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.pressed,
              ]}
            >
              <ArrowLeft size={21} color={colors.text} />
            </Pressable>

            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>
                {isEditMode ? "Edit Address" : "Add Address"}
              </Text>
              <Text style={styles.headerSub}>
                Enter your details for a smooth delivery
              </Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Odikart delivery illustration banner */}
          <View style={styles.addressBannerWrap}>
            <Image
              source={require("../../../assets/images/OdikartAddressIllustration.png")}
              style={styles.addressBanner}
              resizeMode="cover"
              accessible
              accessibilityLabel="Odikart delivery and location illustration"
            />
          </View>

          {/* PIN */}
          <View style={styles.pinCard}>
            <View style={styles.pinGlow} />
            <View style={styles.pinTop}>
              <View style={styles.pinIcon}>
                <MapPin size={19} color={colors.primary} />
              </View>

              <View style={styles.pinCopy}>
                <Text style={styles.pinTitle}>PIN code & post office</Text>
                <Text style={styles.pinSub}>Detect your delivery location</Text>
              </View>

              {locationReady && (
                <View style={styles.successCircle}>
                  <Check size={13} color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.pinInputWrap}>
              <TextInput
                value={form.postalCode}
                onChangeText={handlePinChange}
                placeholder="6-digit PIN code"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.pinInput}
                returnKeyType="done"
              />

              {pinLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : locationReady ? (
                <Check size={19} color={colors.success} />
              ) : (
                <Text style={styles.pinCount}>{form.postalCode.length}/6</Text>
              )}
            </View>

            {locationReady && (
              <View style={styles.locationPill}>
                <Check size={13} color="#B9F3C8" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {form.district} · {form.state}
                </Text>
              </View>
            )}
          </View>

          {/* POST OFFICE SELECTOR — inline expansion avoids Android Modal touch issues */}
          {form.postalCode.length === 6 && postOffices.length > 0 && (
            <View style={styles.dropdownSection}>
              <Text style={styles.fieldLabel}>Post office</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: postOfficeOpen }}
                onPress={() => {
                  setPostOfficeSearch("");
                  setPostOfficeOpen((open) => !open);
                }}
                style={({ pressed }) => [
                  styles.dropdownButton,
                  postOfficeOpen && styles.dropdownButtonOpen,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.dropdownLeft}>
                  <View style={styles.dropdownIcon}>
                    <MapPin size={16} color={colors.primary} />
                  </View>
                  <View style={styles.dropdownCopy}>
                    <Text style={styles.dropdownValue} numberOfLines={1}>
                      {form.postOffice || "Select post office"}
                    </Text>
                    <Text style={styles.dropdownHint}>
                      {postOffices.length} offices found · Tap to choose
                    </Text>
                  </View>
                </View>
                <ChevronDown
                  size={19}
                  color={colors.textSecondary}
                  style={
                    postOfficeOpen
                      ? { transform: [{ rotate: "180deg" }] }
                      : undefined
                  }
                />
              </Pressable>

              {postOfficeOpen && (
                <View style={styles.inlineOfficePanel}>
                  <View style={styles.officeSearchWrap}>
                    <Search size={17} color={colors.textSecondary} />
                    <TextInput
                      value={postOfficeSearch}
                      onChangeText={setPostOfficeSearch}
                      placeholder="Search post offices..."
                      placeholderTextColor={colors.textMuted}
                      style={styles.officeSearchInput}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="search"
                    />
                    {!!postOfficeSearch && (
                      <Pressable
                        onPress={() => setPostOfficeSearch("")}
                        hitSlop={8}
                      >
                        <X size={16} color={colors.textSecondary} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={styles.officeResultCount}>
                    Showing {filteredPostOffices.length} of {postOffices.length}{" "}
                    offices
                  </Text>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="always"
                    showsVerticalScrollIndicator
                    style={styles.inlineOfficeList}
                  >
                    {filteredPostOffices.map((office, index) => {
                      const active = form.postOffice === office.Name;
                      return (
                        <Pressable
                          key={`${office.Name || "office"}-${office.Pincode || "pin"}-${index}`}
                          onPress={() => selectPostOffice(office)}
                          style={({ pressed }) => [
                            styles.officeItem,
                            active && styles.officeItemActive,
                            pressed && styles.pressed,
                          ]}
                        >
                          <View
                            style={[styles.radio, active && styles.radioActive]}
                          >
                            {active && <View style={styles.radioInner} />}
                          </View>
                          <View style={styles.officeCopy}>
                            <Text style={styles.officeName}>
                              {office.Name || "Post Office"}
                            </Text>
                            <Text style={styles.officeMeta}>
                              {[office.BranchType, office.DeliveryStatus]
                                .filter(Boolean)
                                .join(" · ") || "Post Office"}
                            </Text>
                            <Text style={styles.officeDetails}>
                              {[
                                office.District,
                                office.State,
                                office.Country,
                                office.Pincode,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </Text>
                          </View>
                          {active && <Check size={18} color={colors.primary} />}
                        </Pressable>
                      );
                    })}
                    {filteredPostOffices.length === 0 && (
                      <View style={styles.officeEmpty}>
                        <MapPin size={22} color={colors.textMuted} />
                        <Text style={styles.officeEmptyTitle}>
                          No matching post office
                        </Text>
                        <Text style={styles.officeEmptyText}>
                          Try a different search.
                        </Text>
                      </View>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>
          )}

          {form.postalCode.length === 6 &&
            !pinLoading &&
            postOffices.length === 0 && (
              <View style={styles.officeUnavailable}>
                <MapPin size={17} color={colors.textSecondary} />
                <Text style={styles.officeUnavailableText}>
                  Post office options unavailable. Re-enter the PIN code or
                  check your connection.
                </Text>
              </View>
            )}

          {/* CONTACT */}
          <Section
            title="Contact details"
            subtitle="Who should receive this order?"
          >
            <Input
              label="Full name"
              required
              value={form.fullName}
              onChangeText={(value) => updateField("fullName", value)}
              placeholder="Your full name"
              autoCapitalize="words"
            />

            <Input
              label="Mobile number"
              required
              value={form.phone}
              onChangeText={(value) =>
                updateField("phone", value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Input
              label="Alternate mobile"
              value={form.alternatePhone}
              onChangeText={(value) =>
                updateField(
                  "alternatePhone",
                  value.replace(/\D/g, "").slice(0, 10),
                )
              }
              placeholder="Optional"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <Input
              label="Email"
              required
              value={form.email}
              onChangeText={(value) => updateField("email", value.trimStart())}
              placeholder="Your email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Section>

          {/* ADDRESS */}
          <Section
            title="Delivery address"
            subtitle="Where should we deliver it?"
          >
            <Input
              label="House / Flat / Building"
              required
              value={form.houseNumber}
              onChangeText={(value) => updateField("houseNumber", value)}
              placeholder="Flat 304, House 12/A"
            />

            <Input
              label="Street / Road"
              required
              value={form.street}
              onChangeText={(value) => updateField("street", value)}
              placeholder="Street or road name"
            />

            <Input
              label="Area / Locality"
              required
              value={form.area}
              onChangeText={(value) => updateField("area", value)}
              placeholder="Area or locality"
            />

            <Input
              label="Landmark"
              value={form.landmark}
              onChangeText={(value) => updateField("landmark", value)}
              placeholder="Optional — near temple, school, ATM..."
            />

            <Input
              label="City / Town"
              required
              value={form.city}
              onChangeText={(value) => updateField("city", value)}
              placeholder="City or town"
            />
          </Section>

          {/* AUTO LOCATION */}
          <View style={styles.detectedCard}>
            <View style={styles.detectedHeader}>
              <View style={styles.detectedIcon}>
                <Check size={15} color={colors.success} />
              </View>
              <View style={styles.detectedCopy}>
                <Text style={styles.detectedTitle}>Location from PIN</Text>
                <Text style={styles.detectedSub}>
                  These details are filled automatically
                </Text>
              </View>
            </View>

            <LocationRow
              label="Post office"
              value={form.postOffice || "Waiting for PIN"}
            />
            <LocationRow
              label="District"
              value={form.district || "Waiting for PIN"}
            />
            <LocationRow
              label="State"
              value={form.state || "Waiting for PIN"}
              last
            />
          </View>

          {/* LABEL */}
          <Section
            title="Save this address as"
            subtitle="Choose a label for faster checkout"
          >
            <View style={styles.labelRow}>
              <LabelButton
                title="Home"
                active={form.label === "Home"}
                icon={
                  <Home
                    size={17}
                    color={
                      form.label === "Home"
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                }
                onPress={() => updateField("label", "Home")}
              />
              <LabelButton
                title="Work"
                active={form.label === "Work"}
                icon={
                  <BriefcaseBusiness
                    size={17}
                    color={
                      form.label === "Work"
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                }
                onPress={() => updateField("label", "Work")}
              />
              <LabelButton
                title="Other"
                active={form.label === "Other"}
                icon={
                  <MapPin
                    size={17}
                    color={
                      form.label === "Other"
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                }
                onPress={() => updateField("label", "Other")}
              />
            </View>
          </Section>

          {/* OPTIONAL NOTE */}
          <Section
            title="Delivery note"
            subtitle="Helpful for the delivery partner"
            optional
          >
            <TextInput
              value={form.deliveryInstructions}
              onChangeText={(value) =>
                updateField("deliveryInstructions", value.slice(0, 200))
              }
              placeholder="Anything the delivery partner should know"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={200}
              textAlignVertical="top"
              style={styles.textArea}
            />
          </Section>

          {/* DEFAULT */}
          <View style={styles.defaultCard}>
            <View style={styles.defaultIcon}>
              <Check size={15} color={colors.primary} />
            </View>
            <View style={styles.defaultCopy}>
              <Text style={styles.defaultTitle}>Use as default address</Text>
              <Text style={styles.defaultSub}>
                Use automatically at checkout
              </Text>
            </View>
            <Switch
              value={form.isDefault}
              onValueChange={(value) => updateField("isDefault", value)}
              trackColor={{ false: "#D8DDE7", true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            disabled={saving || pinLoading}
            onPress={handleSave}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !saving && styles.savePressed,
              (saving || pinLoading) && styles.disabled,
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Save size={18} color="#FFFFFF" />
            )}
            <Text style={styles.saveText}>
              {saving
                ? "Saving..."
                : isEditMode
                  ? "Update Address"
                  : "Save Address"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({
  title,
  subtitle,
  optional = false,
  children,
}: {
  title: string;
  subtitle?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeadingCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
        {optional && <Text style={styles.optional}>Optional</Text>}
      </View>
      {children}
    </View>
  );
}

function Input({
  label,
  required = false,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  maxLength,
  autoCapitalize = "sentences",
  autoCorrect = true,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "phone-pad" | "number-pad" | "email-address";
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        style={styles.input}
      />
    </View>
  );
}

function LabelButton({
  title,
  active,
  icon,
  onPress,
}: {
  title: string;
  active: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.labelButton,
        active && styles.labelButtonActive,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      <Text
        style={[styles.labelButtonText, active && styles.labelButtonTextActive]}
      >
        {title}
      </Text>
      {active && (
        <View style={styles.labelCheck}>
          <Check size={9} color="#FFFFFF" />
        </View>
      )}
    </Pressable>
  );
}

function LocationRow({
  label,
  value,
  last = false,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.locationRow, !last && styles.locationBorder]}>
      <Text style={styles.locationLabel}>{label}</Text>
      <Text
        style={[
          styles.locationValue,
          value.startsWith("Waiting") && styles.locationPending,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7FB" },
  flex: { flex: 1 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },

  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#EAF0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  loadingText: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 12,
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#ECEEF3",
  },
  headerTop: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
  },
  progressTrack: {
    height: 3,
    marginTop: 5,
    borderRadius: 99,
    backgroundColor: "#ECEFF5",
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    borderRadius: 99,
    backgroundColor: colors.primary,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F6F7FA",
    borderWidth: 1,
    borderColor: "#E8EAF0",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.35,
    color: colors.text,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },

  addressBannerWrap: {
    // Extend beyond ScrollView content padding so the banner spans the screen.
    alignSelf: "stretch",
    marginHorizontal: -16,
    height: 150,
    marginBottom: 13,
    borderRadius: 0,
    overflow: "hidden",
    backgroundColor: "#FFF7ED",
  },
  addressBanner: {
    width: "100%",
    height: "100%",
  },

  pinCard: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    marginBottom: 13,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  pinGlow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    right: -45,
    top: -65,
    backgroundColor: "rgba(99,102,241,0.16)",
  },
  pinTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  pinIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E9EDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  pinCopy: {
    flex: 1,
    marginLeft: 10,
  },
  pinTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  pinSub: {
    marginTop: 3,
    fontSize: 10,
    color: colors.textSecondary,
  },
  successCircle: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  pinInputWrap: {
    height: 56,
    marginTop: 15,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  pinInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 2,
  },
  pinCount: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
  },
  locationPill: {
    marginTop: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
  },
  locationText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },

  dropdownSection: {
    marginBottom: 12,
  },
  officeUnavailable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF0",
  },
  officeUnavailableText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  dropdownButton: {
    minHeight: 60,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownCopy: {
    flex: 1,
    marginLeft: 9,
  },
  dropdownValue: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.text,
  },
  dropdownHint: {
    marginTop: 2,
    fontSize: 9.5,
    color: colors.textSecondary,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EAECF1",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 12,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionHeadingCopy: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.15,
    color: colors.text,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  optional: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  input: {
    height: 58,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#F8F9FC",
    borderWidth: 1,
    borderColor: "#E6E9EF",
    color: colors.text,
    fontSize: 14,
  },
  required: {
    color: colors.error,
  },

  detectedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8EAEF",
    marginBottom: 13,
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  detectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    backgroundColor: "#F6FBF7",
  },
  detectedIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: "#DDF3E3",
    alignItems: "center",
    justifyContent: "center",
  },
  detectedCopy: {
    flex: 1,
    marginLeft: 9,
  },
  detectedTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#166534",
  },
  detectedSub: {
    marginTop: 2,
    fontSize: 9.5,
    color: "#4B7A59",
  },
  locationRow: {
    minHeight: 43,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  locationBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F4",
  },
  locationLabel: {
    width: 88,
    fontSize: 10.5,
    color: colors.textSecondary,
  },
  locationValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 11.5,
    fontWeight: "700",
    color: colors.text,
  },
  locationPending: {
    color: colors.textMuted,
    fontWeight: "500",
  },

  labelRow: {
    flexDirection: "row",
    gap: 8,
  },
  labelButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E5EB",
    backgroundColor: "#FAFBFD",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative",
  },
  labelButtonActive: {
    backgroundColor: "#EFF4FF",
    borderColor: colors.primary,
  },
  labelButtonText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  labelButtonTextActive: {
    color: colors.primary,
  },
  labelCheck: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  textArea: {
    minHeight: 92,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 12,
    backgroundColor: "#F8F9FC",
    borderWidth: 1,
    borderColor: "#E4E7ED",
    color: colors.text,
    fontSize: 13,
  },

  defaultCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  defaultIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    marginRight: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
  },
  defaultCopy: {
    flex: 1,
  },
  defaultTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },
  defaultSub: {
    marginTop: 3,
    fontSize: 10,
    color: colors.textSecondary,
  },

  bottomBar: {
    paddingHorizontal: 14,
    paddingTop: 9,
    paddingBottom: Platform.OS === "ios" ? 14 : 10,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#E8EAF0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 8,
  },
  bottomHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  bottomHintText: {
    marginLeft: 5,
    fontSize: 9.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  saveButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  savePressed: {
    transform: [{ scale: 0.985 }],
  },
  saveText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingHorizontal: 15,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    maxHeight: "72%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingTop: 2,
  },
  modalHandle: {
    position: "absolute",
    top: 7,
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 99,
    backgroundColor: "#D9DDE5",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  modalSub: {
    marginTop: 3,
    fontSize: 10,
    color: colors.textSecondary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#F3F5F8",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  dropdownButtonOpen: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  inlineOfficePanel: {
    marginTop: 7,
    padding: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DDE3F5",
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  inlineOfficeList: {
    maxHeight: 280,
    flexGrow: 0,
  },
  officeSearchWrap: {
    minHeight: 46,
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: "#F5F6FA",
    borderWidth: 1,
    borderColor: "#E8EAF0",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  officeSearchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.text,
  },
  officeResultCount: {
    marginTop: 9,
    marginBottom: 7,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  officeList: {
    marginTop: 2,
  },
  officeDetails: {
    marginTop: 3,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textMuted,
  },
  officeEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  officeEmptyTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  officeEmptyText: {
    marginTop: 4,
    fontSize: 11,
    textAlign: "center",
    color: colors.textSecondary,
  },
  officeItem: {
    minHeight: 62,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#EEF0F4",
    backgroundColor: "#FFFFFF",
  },
  officeItemActive: {
    backgroundColor: "#F2F6FF",
    borderColor: "#C9D8FF",
  },
  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#C7CCD6",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  officeCopy: {
    flex: 1,
    marginLeft: 10,
  },
  officeName: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  officeMeta: {
    marginTop: 3,
    fontSize: 9.5,
    color: colors.textSecondary,
  },
});
