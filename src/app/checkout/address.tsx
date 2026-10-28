import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { router, useFocusEffect } from "expo-router";

import { deleteAddress, getMyAddresses, type Address } from "../../api/address";

import { colors } from "../../theme/colors";

const getLabelIcon = (
  label?: string,
): "home-outline" | "briefcase-outline" | "location-outline" => {
  const value = String(label || "").toLowerCase();

  if (value === "work") {
    return "briefcase-outline";
  }

  if (value === "home") {
    return "home-outline";
  }

  return "location-outline";
};

const getAddressImage = (label?: string) => {
  const value = String(label || "").toLowerCase();
  if (value === "work") {
    return require("../../../assets/images/OdikartWorkAddress.png");
  }
  if (value === "home") {
    return require("../../../assets/images/OdikartHomeAddress.png");
  }
  return require("../../../assets/images/OdikartOtherAddress.png");
};

const getLabelColor = (label?: string) => {
  const value = String(label || "").toLowerCase();

  if (value === "work") {
    return "#7C3AED";
  }

  if (value === "home") {
    return colors.primary;
  }

  return "#EA580C";
};

const formatAddress = (address: Address) => {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.landmark,
    address.area,
    address.village,
    address.city,
    address.district,
    address.state,
    address.postalCode,
  ].filter(Boolean);

  return parts.join(", ");
};

function SkeletonBox({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.skeletonBox,
        {
          width,
          height,
          borderRadius: radius,
        },
        style,
      ]}
    />
  );
}

function AddressSkeleton() {
  const opacity = useRef(new Animated.Value(0.42)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.88,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.42,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const Skeleton = ({
    width,
    height,
    radius = 8,
    style,
  }: {
    width: number | `${number}%`;
    height: number;
    radius?: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        styles.skeletonBox,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );

  // The parent AddressScreen owns the SafeAreaView in both loading and
  // loaded states. Keeping that wrapper stable prevents the header from
  // briefly jumping while the skeleton is replaced by real content.
  return (
    <>
      <View style={styles.header}>
        <Skeleton width={40} height={40} radius={13} />
        <View style={{ flex: 1, marginLeft: 12, gap: 7 }}>
          <Skeleton width={150} height={17} radius={6} />
          <Skeleton width={190} height={9} radius={4} />
        </View>
        <Skeleton width={40} height={40} radius={13} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.skeletonContent}
      >
        {/* Banner skeleton matches the real promotional image */}
        <Skeleton width={"100%"} height={126} radius={16} />

        {/* Delivery location summary */}
        <View style={styles.skeletonLocationCard}>
          <Skeleton width={43} height={43} radius={22} />
          <View style={{ flex: 1, marginLeft: 10, gap: 7 }}>
            <Skeleton width={70} height={8} radius={4} />
            <Skeleton width={"78%"} height={13} radius={5} />
            <Skeleton width={"54%"} height={8} radius={4} />
          </View>
          <Skeleton width={66} height={31} radius={10} />
        </View>

        <View style={styles.skeletonSectionHeading}>
          <Skeleton width={150} height={18} radius={5} />
          <Skeleton width={48} height={10} radius={4} />
        </View>

        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.skeletonCard}>
            <View style={styles.skeletonCardTop}>
              <Skeleton width={64} height={68} radius={12} />
              <View style={styles.skeletonCardHeading}>
                <Skeleton width={item === 1 ? 66 : 78} height={13} radius={5} />
                <Skeleton
                  width={100}
                  height={8}
                  radius={4}
                  style={{ marginTop: 7 }}
                />
                <Skeleton
                  width={"88%"}
                  height={8}
                  radius={4}
                  style={{ marginTop: 7 }}
                />
                <Skeleton
                  width={"68%"}
                  height={8}
                  radius={4}
                  style={{ marginTop: 6 }}
                />
              </View>
              <Skeleton width={22} height={22} radius={7} />
            </View>
            <View style={styles.skeletonActions}>
              <Skeleton width={"46%"} height={31} radius={9} />
              <Skeleton width={"46%"} height={31} radius={9} />
            </View>
          </View>
        ))}
        <Skeleton
          width={"100%"}
          height={46}
          radius={13}
          style={{ marginTop: 2 }}
        />
      </ScrollView>
    </>
  );
}

export default function AddressScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [addressPendingDelete, setAddressPendingDelete] =
    useState<Address | null>(null);

  const shineProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shineLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(shineProgress, {
          toValue: 1,
          duration: 1050,
          useNativeDriver: true,
        }),
        Animated.timing(shineProgress, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    shineLoop.start();
    return () => shineLoop.stop();
  }, [shineProgress]);

  const shineTranslateX = shineProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-150, 360],
  });

  const loadAddresses = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const response = await getMyAddresses();

      if (!response?.success) {
        throw new Error(response?.message || "Could not load your addresses.");
      }

      setAddresses(response.addresses || []);
    } catch (error: any) {
      console.log("LOAD ADDRESSES ERROR:", error);

      Toast.show({
        type: "error",
        text1: "Couldn’t load addresses",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please check your connection and try again.",
        position: "bottom",
        visibilityTime: 2500,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses]),
  );

  const handleRefresh = useCallback(() => {
    loadAddresses(true);
  }, [loadAddresses]);

  const handleDelete = (address: Address) => {
    setAddressPendingDelete(address);
  };

  const confirmDeleteAddress = async () => {
    if (!addressPendingDelete) return;

    const addressToDelete = addressPendingDelete;
    setAddressPendingDelete(null);

    try {
      setDeletingId(addressToDelete._id);
      const response = await deleteAddress(addressToDelete._id);

      if (!response?.success) {
        throw new Error(response?.message || "Could not delete this address.");
      }

      setAddresses((previous) =>
        previous.filter((item) => item._id !== addressToDelete._id),
      );

      Toast.show({
        type: "success",
        text1: "Address deleted",
        text2: `${addressToDelete.label || "Your address"} has been removed.`,
        position: "bottom",
        visibilityTime: 2000,
      });
    } catch (error: any) {
      console.log("DELETE ADDRESS ERROR:", error);
      Toast.show({
        type: "error",
        text1: "Couldn’t delete address",
        text2:
          error?.response?.data?.message ||
          error?.message ||
          "Please check your connection and try again.",
        position: "bottom",
        visibilityTime: 2500,
      });
    } finally {
      setDeletingId(null);
    }
  };

  const goBackSafely = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fall back to the app's actual tab route if opened directly.
      router.replace("/(tabs)");
    }
  };

  const openAddAddress = () => {
    router.push("/checkout/add-address");
  };

  const openEditAddress = (address: Address) => {
    router.push({
      pathname: "/checkout/add-address",
      params: {
        addressId: address._id,
      },
    });
  };

  const renderAddress = ({ item }: { item: Address }) => {
    const isDeleting = deletingId === item._id;

    const iconColor = getLabelColor(item.label);

    return (
      <View style={styles.addressCard}>
        <View style={styles.cardAccent} />

        <View style={styles.cardTop}>
          <View style={styles.labelSection}>
            <Image
              source={getAddressImage(item.label)}
              style={styles.addressTypeImage}
              resizeMode="cover"
              accessible
              accessibilityLabel={`${item.label || "Other"} address illustration`}
            />

            <View>
              <View style={styles.labelTitleRow}>
                <Text style={styles.label}>{item.label || "Home"}</Text>

                {item.isDefault ? (
                  <View style={styles.defaultBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={12}
                      color={colors.success}
                    />

                    <Text style={styles.defaultText}>Default</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.deliveryText}>Delivery address</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.actionPressed,
            ]}
            onPress={() => openEditAddress(item)}
            hitSlop={5}
          >
            <Ionicons name="create-outline" size={17} color={colors.primary} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.recipientRow}>
          <Text style={styles.name}>{item.fullName}</Text>

          <View style={styles.phonePill}>
            <Ionicons
              name="call-outline"
              size={11}
              color={colors.textSecondary}
            />
            <Text style={styles.phone}>{item.phone}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={4}>
          {formatAddress(item)}
        </Text>

        {item.alternatePhone ? (
          <View style={styles.alternateRow}>
            <Ionicons name="call-outline" size={12} color={colors.textMuted} />

            <Text style={styles.alternatePhone}>
              Alternate phone: {item.alternatePhone}
            </Text>
          </View>
        ) : null}

        <View style={styles.cardDivider} />

        <View style={styles.cardActions}>
          <Pressable
            style={({ pressed }) => [
              styles.cardAction,
              pressed && styles.actionPressed,
            ]}
            disabled={isDeleting}
            onPress={() => handleDelete(item)}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={15} color={colors.error} />

                <Text style={styles.deleteText}>Delete</Text>
              </>
            )}
          </Pressable>

          <View style={styles.actionDivider} />

          <Pressable
            style={({ pressed }) => [
              styles.cardAction,
              pressed && styles.actionPressed,
            ]}
            onPress={() => openEditAddress(item)}
          >
            <Ionicons name="create-outline" size={15} color={colors.primary} />

            <Text style={styles.editActionText}>Edit address</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <AddressSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          onPress={goBackSafely}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.actionPressed,
          ]}
        >
          <Ionicons name="arrow-back" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Addresses</Text>

          <Text style={styles.headerSubtitle}>
            Manage your saved delivery addresses
          </Text>
        </View>

        <Pressable
          onPress={openAddAddress}
          style={({ pressed }) => [
            styles.headerButton,
            styles.headerAddButton,
            pressed && styles.actionPressed,
          ]}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList
        data={addresses}
        keyExtractor={(item) => item._id}
        renderItem={renderAddress}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          addresses.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View style={styles.listHeaderWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add an Odikart delivery address"
              onPress={openAddAddress}
              style={({ pressed }) => [
                styles.promoBannerWrap,
                pressed && styles.actionPressed,
              ]}
            >
              <Image
                source={require("../../../assets/images/OdikartDeliveryBanner.png")}
                style={styles.promoBanner}
                resizeMode="cover"
                accessible={false}
              />
            </Pressable>

            <View style={styles.deliveryLocationCard}>
              <View style={styles.deliveryPin}>
                <Ionicons name="location" size={23} color={colors.primary} />
              </View>
              <View style={styles.deliveryLocationCopy}>
                <Text style={styles.deliveryEyebrow}>Delivering to</Text>
                <Text style={styles.deliveryLocationTitle} numberOfLines={1}>
                  {addresses.find((address) => address.isDefault)?.city ||
                    addresses[0]?.city ||
                    "Choose your location"}
                  {addresses.find((address) => address.isDefault)?.state ||
                  addresses[0]?.state
                    ? `, ${addresses.find((address) => address.isDefault)?.state || addresses[0]?.state}`
                    : ""}
                </Text>
                <Text style={styles.deliveryEta}>
                  Your current delivery location
                </Text>
              </View>
              <Pressable
                onPress={openAddAddress}
                accessibilityRole="button"
                accessibilityLabel="Change delivery location"
                style={({ pressed }) => [
                  styles.locationChangeButton,
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons
                  name="navigate-circle-outline"
                  size={19}
                  color={colors.primary}
                />
                <Text style={styles.locationChangeText}>Change</Text>
              </Pressable>
            </View>

            <View style={styles.savedHeadingRow}>
              <Text style={styles.savedHeading}>
                Saved addresses ({addresses.length})
              </Text>
              <Text style={styles.savedSortLabel}>Your locations</Text>
            </View>

            <View style={styles.intro}>
              <Text style={styles.introSubtitle}>
                Keep your delivery details up to date for a quicker checkout.
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Image
              source={require("../../../assets/images/OdikartNoAddress.png")}
              style={styles.emptyIllustration}
              resizeMode="contain"
              accessible
              accessibilityLabel="Odikart delivery illustration for an empty address list"
            />

            <Text style={styles.emptyTitle}>No saved addresses yet</Text>

            <Text style={styles.emptyText}>
              Add a delivery address to make checkout quicker and get your
              orders delivered to the right place.
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add a new delivery address"
              style={({ pressed }) => [
                styles.emptyButton,
                pressed && styles.addButtonPressed,
              ]}
              onPress={openAddAddress}
            >
              <Ionicons name="add" size={19} color={colors.textWhite} />

              <Text style={styles.emptyButtonText}>Add a new address</Text>
            </Pressable>
          </View>
        }
      />

      {addresses.length > 0 ? (
        <View style={styles.bottomActionWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.bottomAddButton,
              pressed && styles.addButtonPressed,
            ]}
            onPress={openAddAddress}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.buttonShine,
                {
                  transform: [
                    { translateX: shineTranslateX },
                    { skewX: "-22deg" },
                  ],
                },
              ]}
            />
            <Ionicons name="add" size={19} color={colors.textWhite} />

            <Text style={styles.bottomAddText}>Add a new address</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal
        visible={!!addressPendingDelete}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setAddressPendingDelete(null)}
      >
        <View style={styles.deleteModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setAddressPendingDelete(null)}
            accessibilityRole="button"
            accessibilityLabel="Close delete confirmation"
          />
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIconWrap}>
              <Image
                source={require("../../../assets/images/OdikartNoAddress.png")}
                style={styles.deleteModalIllustration}
                resizeMode="contain"
                accessible
                accessibilityLabel="Address illustration"
              />
            </View>
            <Text style={styles.deleteModalTitle}>Delete this address?</Text>
            <Text style={styles.deleteModalDescription}>
              This address will be removed from your saved locations. You can’t
              undo this action.
            </Text>

            {addressPendingDelete ? (
              <View style={styles.deleteAddressPreview}>
                <View style={styles.deleteAddressPreviewIcon}>
                  <Ionicons
                    name={getLabelIcon(addressPendingDelete.label)}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.deleteAddressPreviewText}>
                  <Text style={styles.deleteAddressPreviewLabel}>
                    {addressPendingDelete.label || "Saved address"}
                  </Text>
                  <Text
                    style={styles.deleteAddressPreviewName}
                    numberOfLines={1}
                  >
                    {addressPendingDelete.fullName}
                  </Text>
                  <Text
                    style={styles.deleteAddressPreviewAddress}
                    numberOfLines={2}
                  >
                    {formatAddress(addressPendingDelete)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.deleteModalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAddressPendingDelete(null)}
                style={({ pressed }) => [
                  styles.deleteCancelButton,
                  pressed && styles.actionPressed,
                ]}
              >
                <Text style={styles.deleteCancelText}>Keep address</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirmDeleteAddress}
                style={({ pressed }) => [
                  styles.deleteConfirmButton,
                  pressed && styles.actionPressed,
                ]}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.deleteConfirmText}>Delete address</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: colors.background,
  },

  actionPressed: {
    opacity: 0.62,
  },

  /* ==========================================================
     HEADER
  ========================================================== */

  header: {
    minHeight: 62,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  headerAddButton: {
    backgroundColor: colors.blueSoft,
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 8.5,
    color: colors.textMuted,
  },

  /* ==========================================================
     LIST
  ========================================================== */

  listContent: {
    paddingHorizontal: 11,
    paddingTop: 12,
    paddingBottom: 100,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  /* ==========================================================
     PROMOTIONAL BANNER + INTRO
  ========================================================== */

  listHeaderWrap: {
    marginBottom: 5,
  },

  promoBannerWrap: {
    width: "100%",
    aspectRatio: 3.05,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  promoBanner: {
    width: "100%",
    height: "100%",
  },

  deliveryLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 15,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  deliveryPin: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  deliveryLocationCopy: { flex: 1, minWidth: 0 },
  deliveryEyebrow: {
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 3,
  },
  deliveryLocationTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },
  deliveryEta: {
    marginTop: 4,
    fontSize: 9,
    color: colors.textSecondary,
  },
  locationChangeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  locationChangeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
  },
  savedHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 2,
  },
  savedHeading: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },
  savedSortLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "700",
  },
  addressTypeImage: {
    width: 64,
    height: 68,
    borderRadius: 12,
    marginRight: 11,
    backgroundColor: colors.blueSoft,
  },
  intro: {
    marginBottom: 13,
  },

  introTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 13,
  },

  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  introText: {
    flex: 1,
    marginLeft: 10,
  },

  introTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },

  introSubtitle: {
    marginTop: 4,
    fontSize: 9.5,
    lineHeight: 14,
    color: colors.textSecondary,
  },

  addButton: {
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
  },

  addButtonPressed: {
    opacity: 0.78,
  },

  addButtonIcon: {
    width: 31,
    height: 31,
    borderRadius: 9,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  addButtonText: {
    flex: 1,
    marginLeft: 9,
    color: colors.textWhite,
    fontSize: 11.5,
    fontWeight: "800",
  },

  /* ==========================================================
     ADDRESS CARD
  ========================================================== */

  addressCard: {
    position: "relative",
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 13,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: colors.shadow,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  cardAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.primary,
  },

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  labelSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  labelIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  labelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  label: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  deliveryText: {
    marginTop: 3,
    fontSize: 8,
    color: colors.textMuted,
  },

  defaultBadge: {
    marginLeft: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  defaultText: {
    fontSize: 7.5,
    fontWeight: "800",
    color: colors.success,
  },

  editButton: {
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: colors.blueSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  editText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.primary,
  },

  /* ==========================================================
     RECIPIENT
  ========================================================== */

  recipientRow: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  name: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },

  phonePill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  phone: {
    fontSize: 8.5,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  address: {
    marginTop: 9,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  alternateRow: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  alternatePhone: {
    fontSize: 8.5,
    color: colors.textMuted,
  },

  /* ==========================================================
     CARD ACTIONS
  ========================================================== */

  cardDivider: {
    height: 1,
    marginTop: 12,
    marginBottom: 7,
    backgroundColor: colors.borderLight,
  },

  cardActions: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
  },

  cardAction: {
    flex: 1,
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },

  actionDivider: {
    width: 1,
    height: 17,
    backgroundColor: colors.borderLight,
  },

  deleteText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.error,
  },

  editActionText: {
    fontSize: 8.5,
    fontWeight: "800",
    color: colors.primary,
  },

  /* ==========================================================
     EMPTY STATE
  ========================================================== */

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
    paddingBottom: 65,
  },

  emptyIllustration: {
    width: "100%",
    maxWidth: 330,
    height: 205,
    alignSelf: "center",
    marginBottom: 8,
  },

  emptyIconOuter: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyIcon: {
    width: 67,
    height: 67,
    borderRadius: 23,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    marginTop: 17,
    fontSize: 18,
    fontWeight: "900",
    color: colors.text,
  },

  emptyText: {
    marginTop: 7,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  emptyButton: {
    height: 43,
    paddingHorizontal: 18,
    marginTop: 17,
    borderRadius: 11,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  emptyButtonText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.textWhite,
  },

  /* ==========================================================
     BOTTOM ACTION
  ========================================================== */

  bottomActionWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 9,
    backgroundColor: "rgba(248,250,252,0.96)",
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  bottomAddButton: {
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    overflow: "hidden",
    position: "relative",
  },

  buttonShine: {
    position: "absolute",
    top: -10,
    bottom: -10,
    left: 0,
    width: 48,
    backgroundColor: "rgba(255,255,255,0.30)",
    borderRadius: 18,
    zIndex: 1,
  },

  bottomAddText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.textWhite,
    zIndex: 2,
  },

  /* ==========================================================
     CUSTOM DESTRUCTIVE CONFIRMATION MODAL
  ========================================================== */

  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 18, 55, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  deleteModalCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    shadowColor: "#17134D",
    shadowOpacity: 0.22,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  deleteModalIconWrap: {
    width: 104,
    height: 88,
    borderRadius: 20,
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  deleteModalIllustration: {
    width: "100%",
    height: "100%",
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.35,
  },
  deleteModalDescription: {
    marginTop: 9,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  deleteAddressPreview: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  deleteAddressPreviewIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  deleteAddressPreviewText: { flex: 1 },
  deleteAddressPreviewLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.text,
  },
  deleteAddressPreviewName: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  deleteAddressPreviewAddress: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textMuted,
  },
  deleteModalActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  deleteCancelButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  deleteCancelText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 10,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: "#DC2626",
  },
  deleteConfirmText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* ==========================================================
     SKELETON
  ========================================================== */

  skeletonBox: {
    backgroundColor: "#E5EAF1",
  },

  skeletonContent: {
    padding: 11,
    paddingTop: 14,
    paddingBottom: 30,
  },

  skeletonAddButton: {
    marginTop: 17,
    marginBottom: 13,
  },

  skeletonLocationCard: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginTop: 12,
    marginBottom: 18,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  skeletonSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 11,
    marginTop: 2,
  },

  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 13,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  skeletonCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonCardHeading: {
    marginLeft: 9,
  },

  skeletonDivider: {
    height: 1,
    marginTop: 13,
    marginBottom: 9,
    backgroundColor: colors.borderLight,
  },

  skeletonActions: {
    minHeight: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
});
