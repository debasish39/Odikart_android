import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { useFocusEffect, useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "../hooks/useAuth";

import {
  clearCart,
  decreaseCartItem,
  getCart,
  increaseCartItem,
  removeCartItem,
  type CartItem,
} from "../api/cart";

import { colors } from "../theme/colors";

const normalizeProductId = (id: any): string => {
  if (!id) return "";

  if (typeof id === "string") return id.trim();

  if (typeof id === "object") {
    if (typeof id.$oid === "string") return id.$oid.trim();

    if (id._id) return normalizeProductId(id._id);
  }

  return "";
};

function SkeletonBlock({
  width = "100%",

  height = 14,

  radius = 8,

  style,
}: {
  width?: number | string;

  height?: number;

  radius?: number;

  style?: any;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,

          duration: 650,

          easing: Easing.inOut(Easing.ease),

          useNativeDriver: true,
        }),

        Animated.timing(opacity, {
          toValue: 0.45,

          duration: 650,

          easing: Easing.inOut(Easing.ease),

          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBlock,

        {
          width,

          height,

          borderRadius: radius,

          opacity,
        },

        style,
      ]}
    />
  );
}

function CartSkeleton() {
  return (
    <SafeAreaView style={styles.skeletonScreen} edges={["top", "bottom"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />

      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonHeaderLeft}>
          <SkeletonBlock width={42} height={42} radius={14} />

          <View style={{ marginLeft: 11 }}>
            <SkeletonBlock width={95} height={17} radius={6} />

            <SkeletonBlock
              width={118}
              height={9}
              radius={4}
              style={{ marginTop: 7 }}
            />
          </View>
        </View>

        <SkeletonBlock width={72} height={38} radius={12} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.skeletonContent}
      >
        <View style={styles.skeletonDeliveryCard}>
          <SkeletonBlock width={40} height={40} radius={13} />

          <View style={{ flex: 1, marginLeft: 10 }}>
            <SkeletonBlock width={105} height={12} radius={5} />

            <SkeletonBlock
              width={180}
              height={9}
              radius={4}
              style={{ marginTop: 7 }}
            />
          </View>

          <SkeletonBlock width={21} height={21} radius={11} />
        </View>

        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.skeletonProductCard}>
            <View style={styles.skeletonProductTop}>
              <SkeletonBlock width={112} height={125} radius={16} />

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.skeletonTitleRow}>
                  <View style={{ flex: 1 }}>
                    <SkeletonBlock width="92%" height={13} radius={5} />

                    <SkeletonBlock
                      width="68%"
                      height={13}
                      radius={5}
                      style={{ marginTop: 7 }}
                    />
                  </View>

                  <SkeletonBlock width={30} height={30} radius={10} />
                </View>

                <SkeletonBlock
                  width={62}
                  height={22}
                  radius={7}
                  style={{ marginTop: 9 }}
                />

                <View style={styles.skeletonPriceRow}>
                  <SkeletonBlock width={70} height={18} radius={5} />

                  <SkeletonBlock width={54} height={11} radius={4} />
                </View>

                <SkeletonBlock
                  width={116}
                  height={9}
                  radius={4}
                  style={{ marginTop: 9 }}
                />

                <SkeletonBlock
                  width={145}
                  height={9}
                  radius={4}
                  style={{ marginTop: 8 }}
                />
              </View>
            </View>

            <View style={styles.skeletonProductFooter}>
              <View>
                <SkeletonBlock width={76} height={9} radius={4} />

                <SkeletonBlock
                  width={82}
                  height={13}
                  radius={5}
                  style={{ marginTop: 6 }}
                />
              </View>

              <SkeletonBlock width={108} height={38} radius={12} />
            </View>
          </View>
        ))}

        <View style={styles.skeletonContinue}>
          <SkeletonBlock width={40} height={40} radius={13} />

          <View style={{ flex: 1, marginLeft: 10 }}>
            <SkeletonBlock width={128} height={12} radius={5} />

            <SkeletonBlock
              width={166}
              height={9}
              radius={4}
              style={{ marginTop: 7 }}
            />
          </View>

          <SkeletonBlock width={20} height={20} radius={10} />
        </View>

        <View style={styles.skeletonSavings}>
          <SkeletonBlock width={38} height={38} radius={12} />

          <View style={{ flex: 1, marginLeft: 10 }}>
            <SkeletonBlock width={170} height={11} radius={5} />

            <SkeletonBlock
              width="92%"
              height={9}
              radius={4}
              style={{ marginTop: 7 }}
            />

            <SkeletonBlock
              width="72%"
              height={9}
              radius={4}
              style={{ marginTop: 5 }}
            />
          </View>

          <SkeletonBlock width={58} height={30} radius={10} />
        </View>

        <View style={styles.skeletonSummary}>
          <SkeletonBlock width={105} height={16} radius={6} />

          <SkeletonBlock
            width="100%"
            height={10}
            radius={5}
            style={{ marginTop: 18 }}
          />

          <SkeletonBlock
            width="100%"
            height={10}
            radius={5}
            style={{ marginTop: 13 }}
          />

          <View style={styles.skeletonTotalRow}>
            <SkeletonBlock width={65} height={16} radius={6} />

            <SkeletonBlock width={82} height={21} radius={7} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.skeletonCheckoutBar}>
        <View>
          <SkeletonBlock width={48} height={9} radius={4} />

          <SkeletonBlock
            width={88}
            height={19}
            radius={6}
            style={{ marginTop: 6 }}
          />
        </View>

        <SkeletonBlock width="57%" height={52} radius={16} />
      </View>
    </SafeAreaView>
  );
}

function showNativeToast(title: string, message: string) {
  const text = message ? `${title}: ${message}` : title;

  ToastAndroid.showWithGravity(
    text,

    ToastAndroid.SHORT,

    ToastAndroid.BOTTOM,
  );
}

export default function CartScreen() {
  const router = useRouter();

  const { user, logout } = useAuth();

  const [items, setItems] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [updating, setUpdating] = useState<string | null>(null);
  // Show the full-screen skeleton only on the first visit when no cached cart exists.
  const hasLoadedOnce = useRef(false);
  const cacheKey = useMemo(() => {
    const accountId =
      normalizeProductId((user as any)?._id || (user as any)?.id) ||
      String((user as any)?.email || "account")
        .trim()
        .toLowerCase();
    return `odikart_cart_cache_v1_${accountId}`;
  }, [user]);

  const loadCart = useCallback(
    async (showLoader = true) => {
      // Do not flash the skeleton every time the user returns to this screen.
      const shouldShowSkeleton = showLoader && !hasLoadedOnce.current;
      let hasCachedCart = false;

      if (shouldShowSkeleton) {
        try {
          const cachedValue = await AsyncStorage.getItem(cacheKey);
          if (cachedValue) {
            const cachedItems = JSON.parse(cachedValue);
            if (Array.isArray(cachedItems)) {
              setItems(cachedItems);
              hasCachedCart = true;
            }
          }
        } catch (cacheError) {
          console.log("CART CACHE READ ERROR:", cacheError);
        }

        // Cached content can be shown immediately; otherwise show skeleton
        // while the first network request is in progress.
        if (hasCachedCart) setLoading(false);
        else setLoading(true);
      }

      try {
        const cartItems = await getCart();
        const freshItems = Array.isArray(cartItems) ? cartItems : [];
        setItems(freshItems);

        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(freshItems));
        } catch (cacheError) {
          console.log("CART CACHE WRITE ERROR:", cacheError);
        }
      } catch (error: any) {
        console.log(
          "LOAD CART ERROR:",
          error?.response?.data || error?.message || error,
        );

        if (error?.response?.status === 401) {
          console.log("CART: SESSION EXPIRED");
          try {
            await logout();
          } catch (logoutError) {
            console.log("CART LOGOUT ERROR:", logoutError);
          }

          showNativeToast("Session expired", "Please login again.");
          setTimeout(() => {
            router.push("/login-modal");
          }, 300);
          return;
        }

        // Keep cached cart visible when the network is unavailable.
        if (!hasCachedCart && !items.length) {
          showNativeToast(
            "Cart Error",
            error?.response?.data?.message || "Unable to load your cart.",
          );
        }
      } finally {
        hasLoadedOnce.current = true;
        setLoading(false);
      }
    },
    [cacheKey, router, logout],
  );

  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [loadCart]),
  );

  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);

      await loadCart(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadCart]);

  const getItemKey = (item: CartItem) =>
    `${normalizeProductId(item.productId)}_${item.variantSku || ""}`;

  const getProductName = (item: CartItem) =>
    item.name ||
    item.title ||
    item.product?.name ||
    item.product?.title ||
    "Product";

  const getProductImage = (item: CartItem) => {
    if (item.image) return item.image;

    if (item.variant?.image) return item.variant.image;

    if (item.product?.media?.thumbnail) return item.product.media.thumbnail;

    if (item.product?.media?.images?.length) {
      return item.product.media.images[0];
    }

    return undefined;
  };

  const getItemProductId = (item: CartItem) => {
    const id = normalizeProductId(item.productId);

    if (!id) {
      console.log("INVALID CART PRODUCT ID:", item.productId);

      return "";
    }

    return id;
  };

  const handleIncrease = async (item: CartItem) => {
    const key = getItemKey(item);

    const productId = getItemProductId(item);

    if (!productId) {
      showNativeToast(
        "Unable to update",
        "This product has an invalid ID. Please refresh your cart.",
      );

      return;
    }

    try {
      setUpdating(key);

      await increaseCartItem({
        productId,

        variantSku: item.variantSku || "",
      });

      await loadCart(false);
    } catch (error: any) {
      console.log(
        "INCREASE ERROR:",

        error?.response?.data || error?.message || error,
      );

      showNativeToast(
        "Unable to update",
        error?.response?.data?.message || "Could not increase quantity.",
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleDecrease = async (item: CartItem) => {
    const key = getItemKey(item);

    const productId = getItemProductId(item);

    if (!productId) {
      showNativeToast(
        "Unable to update",
        "This product has an invalid ID. Please refresh your cart.",
      );

      return;
    }

    try {
      setUpdating(key);

      await decreaseCartItem({
        productId,

        variantSku: item.variantSku || "",
      });

      await loadCart(false);
    } catch (error: any) {
      console.log(
        "DECREASE ERROR:",

        error?.response?.data || error?.message || error,
      );

      showNativeToast(
        "Unable to update",
        error?.response?.data?.message || "Could not decrease quantity.",
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (item: CartItem) => {
    const key = getItemKey(item);

    const productId = getItemProductId(item);

    if (!productId) {
      showNativeToast(
        "Unable to remove",
        "This product has an invalid ID. Please refresh your cart.",
      );

      return;
    }

    try {
      setUpdating(key);

      await removeCartItem({
        productId,

        variantSku: item.variantSku || "",
      });

      await loadCart(false);

      showNativeToast(
        "Removed from cart",
        `${getProductName(item)} was removed.`,
      );
    } catch (error: any) {
      console.log(
        "REMOVE ERROR:",

        error?.response?.data || error?.message || error,
      );

      showNativeToast(
        "Unable to remove",
        error?.response?.data?.message || "Could not remove item.",
      );
    } finally {
      setUpdating(null);
    }
  };

  const handleClearCart = async () => {
    if (!items.length) {
      return;
    }

    try {
      setLoading(true);

      await clearCart();

      setItems([]);
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify([]));
      } catch (cacheError) {
        console.log("CART CACHE CLEAR ERROR:", cacheError);
      }

      showNativeToast(
        "Cart cleared",
        "All products have been removed from your cart.",
      );
    } catch (error: any) {
      console.log(
        "CLEAR CART ERROR:",

        error?.response?.data || error?.message || error,
      );

      showNativeToast(
        "Unable to clear cart",
        error?.response?.data?.message || "Could not clear your cart.",
      );
    } finally {
      setLoading(false);
    }
  };

  const totalItems = useMemo(
    () =>
      items.reduce(
        (total, item) => total + Number(item.quantity || 0),

        0,
      ),

    [items],
  );

  const subtotal = useMemo(
    () =>
      items.reduce(
        (total, item) =>
          total + Number(item.price || 0) * Number(item.quantity || 0),

        0,
      ),

    [items],
  );

  /*

   * IMPORTANT PRICING RULE

   * -----------------------

   * The backend is the source of truth for product/seller/variant offers.

   *

   * The cart receives the ACTUAL SELLING PRICE in item.price.

   * We do NOT calculate product discounts here.

   *

   * We only READ discount/offer fields supplied by the backend so the

   * customer can clearly see that an offer has already been applied.

   */

  const getSelectedVariant = (item: CartItem) => {
    const variants = item?.product?.variants || item?.variants || [];

    if (!Array.isArray(variants) || variants.length === 0) {
      return item?.variant || item?.selectedVariant || null;
    }

    const sku = String(item?.variantSku || "").trim();

    return (
      variants.find(
        (variant: any) => String(variant?.sku || "").trim() === sku,
      ) ||
      item?.variant ||
      item?.selectedVariant ||
      null
    );
  };

  const getOfferInfo = (item: CartItem) => {
    const variant = getSelectedVariant(item);

    const percentage = Number(
      item?.discountPercentage ?? variant?.discountPercentage ?? 0,
    );

    const offer = item?.offer || item?.product?.offer || null;

    const offerEnabled = offer?.enabled === true;

    const offerType = String(offer?.discountType || "").toLowerCase();

    const offerValue = Number(offer?.value || 0);

    const originalPrice = Number(
      item?.originalPrice ?? variant?.originalPrice ?? 0,
    );

    return {
      percentage:
        Number.isFinite(percentage) && percentage > 0 ? percentage : 0,

      offerEnabled,

      offerType,

      offerValue:
        Number.isFinite(offerValue) && offerValue > 0 ? offerValue : 0,

      originalPrice:
        Number.isFinite(originalPrice) && originalPrice > 0 ? originalPrice : 0,
    };
  };

  /*

   * This is the amount currently stored in the cart.

   * It is already the backend's selling price.

   */

  const payableSubtotal = subtotal;

  if (loading) {
    return <CartSkeleton />;
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />

        <View style={styles.emptyHeader}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <Text style={styles.emptyHeaderTitle}>Cart</Text>

          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.emptyContainer}>
          <View style={styles.emptyOrb}>
            <View style={styles.emptyOrbInner}>
              <Ionicons
                name="bag-handle-outline"
                size={54}
                color={colors.primary}
              />
            </View>
          </View>

          <Text style={styles.emptyTitle}>Your cart is waiting</Text>

          <Text style={styles.emptyText}>
            Looks like you haven't added anything yet. Discover something
            special from Odikart.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,

              pressed && styles.pressed,
            ]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.primaryButtonText}>Explore products</Text>

            <Ionicons name="arrow-forward" size={19} color={colors.textWhite} />
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View>
            <Text style={styles.headerTitle}>Your cart</Text>

            <Text style={styles.headerSubtitle}>
              {totalItems} {totalItems === 1 ? "item" : "items"} ready to go
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.clearButton}
          onPress={handleClearCart}
          disabled={!!updating}
        >
          <Ionicons name="trash-outline" size={17} color={colors.error} />

          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item, index) => `${getItemKey(item)}_${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.deliveryCard}>
            <View style={styles.deliveryIcon}>
              <Ionicons name="flash-outline" size={21} color={colors.primary} />
            </View>

            <View style={styles.deliveryContent}>
              <Text style={styles.deliveryTitle}>Free delivery</Text>

              <Text style={styles.deliveryText}>
                Fast delivery available on your order
              </Text>
            </View>

            <Ionicons
              name="checkmark-circle"
              size={21}
              color={colors.success}
            />
          </View>
        }
        renderItem={({ item }) => {
          const key = getItemKey(item);

          const isUpdating = updating === key;

          const image = getProductImage(item);

          const name = getProductName(item);

          const price = Number(item.price || 0);

          const quantity = Number(item.quantity || 0);

          const offerInfo = getOfferInfo(item);

          const hasPercentageOffer = offerInfo.percentage > 0;

          const hasOriginalPrice = offerInfo.originalPrice > price;

          const hasOffer =
            hasPercentageOffer || offerInfo.offerEnabled || hasOriginalPrice;

          return (
            <View style={styles.productCard}>
              <View style={styles.productTop}>
                <View style={styles.productImageWrap}>
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons
                        name="image-outline"
                        size={35}
                        color={colors.textMuted}
                      />
                    </View>
                  )}

                  {hasOffer && (
                    <View style={styles.discountBadge}>
                      <Ionicons
                        name="pricetag"
                        size={11}
                        color={colors.textWhite}
                      />

                      <Text style={styles.discountText}>
                        {hasPercentageOffer
                          ? `${Math.round(offerInfo.percentage)}% OFF`
                          : offerInfo.offerType === "fixed" &&
                              offerInfo.offerValue > 0
                            ? `₹${offerInfo.offerValue.toLocaleString("en-IN")} OFF`
                            : "OFFER"}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.productInfo}>
                  <View style={styles.productTitleRow}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {name}
                    </Text>

                    <Pressable
                      style={styles.removeIcon}
                      disabled={isUpdating}
                      onPress={() => handleRemove(item)}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>

                  {item.variantSku ? (
                    <View style={styles.variantPill}>
                      <Text style={styles.variantText}>{item.variantSku}</Text>
                    </View>
                  ) : null}

                  <View style={styles.priceRow}>
                    <Text style={styles.price}>
                      ₹
                      {price.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,

                        maximumFractionDigits: 2,
                      })}
                    </Text>

                    {hasOriginalPrice && (
                      <Text style={styles.oldPrice}>
                        ₹
                        {offerInfo.originalPrice.toLocaleString("en-IN", {
                          minimumFractionDigits: 0,

                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    )}
                  </View>

                  {hasOffer && (
                    <View style={styles.offerAppliedRow}>
                      <View style={styles.offerAppliedIcon}>
                        <Ionicons
                          name="checkmark"
                          size={11}
                          color={colors.success}
                        />
                      </View>

                      <Text style={styles.offerAppliedText}>
                        {hasPercentageOffer
                          ? `${Math.round(offerInfo.percentage)}% offer applied`
                          : offerInfo.offerType === "fixed" &&
                              offerInfo.offerValue > 0
                            ? `₹${offerInfo.offerValue.toLocaleString("en-IN")} offer applied`
                            : "Special offer price applied"}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.deliveryMini}>
                    <Ionicons
                      name="cube-outline"
                      size={13}
                      color={colors.success}
                    />{" "}
                    In stock · Free delivery
                  </Text>
                </View>
              </View>

              <View style={styles.productFooter}>
                <Text style={styles.itemTotalLabel}>
                  Item total{" "}
                  <Text style={styles.itemTotal}>
                    ₹{(price * quantity).toFixed(2)}
                  </Text>
                </Text>

                <View style={styles.quantityControl}>
                  <Pressable
                    style={styles.quantityButton}
                    disabled={isUpdating}
                    onPress={() => handleDecrease(item)}
                  >
                    <Ionicons
                      name="remove"
                      size={17}
                      color={quantity <= 1 ? colors.textMuted : colors.primary}
                    />
                  </Pressable>

                  <Text style={styles.quantity}>{quantity}</Text>

                  <Pressable
                    style={styles.quantityButton}
                    disabled={isUpdating}
                    onPress={() => handleIncrease(item)}
                  >
                    <Ionicons name="add" size={17} color={colors.primary} />
                  </Pressable>
                </View>
              </View>

              {isUpdating && (
                <View style={styles.updateOverlay}>
                  <View style={styles.updateBubble}>
                    <ActivityIndicator size="small" color={colors.primary} />

                    <Text style={styles.updateText}>Updating...</Text>
                  </View>
                </View>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View>
            <Pressable
              style={({ pressed }) => [
                styles.continueShopping,

                pressed && styles.pressedLight,
              ]}
              onPress={() => router.replace("/(tabs)")}
            >
              <View style={styles.continueIcon}>
                <Ionicons name="add" size={18} color={colors.primary} />
              </View>

              <View style={styles.continueContent}>
                <Text style={styles.continueTitle}>Add more products</Text>

                <Text style={styles.continueSubtitle}>
                  Continue exploring Odikart
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>

            <View style={styles.savingsCard}>
              <View style={styles.savingsIcon}>
                <Ionicons name="pricetag" size={20} color={colors.success} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.savingsTitle}>
                  🎉 Offer prices already applied
                </Text>

                <Text style={styles.savingsSubtitle}>
                  You're seeing the latest selling price after applicable
                  product and seller offers.
                </Text>
              </View>

              <View style={styles.offerAppliedBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={colors.success}
                />

                <Text style={styles.offerAppliedBadgeText}>Applied</Text>
              </View>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Price details</Text>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Items ({totalItems})</Text>

                <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
              </View>

              <View style={styles.offerSummaryNote}>
                <Ionicons name="sparkles" size={15} color={colors.primary} />

                <Text style={styles.offerSummaryNoteText}>
                  Offer discounts are already included in the item prices above.
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>

                <Text style={styles.freeValue}>FREE</Text>
              </View>

              <View style={styles.summaryDivider} />

              <View style={styles.totalRow}>
                <View>
                  <Text style={styles.totalLabel}>Total</Text>

                  <Text style={styles.totalSubtext}>
                    Inclusive of applicable charges
                  </Text>
                </View>

                <Text style={styles.totalValue}>
                  ₹{payableSubtotal.toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.bottomSpace} />
          </View>
        }
      />

      <View style={styles.checkoutBar}>
        <View style={styles.checkoutPrice}>
          <Text style={styles.checkoutSmall}>Total</Text>

          <Text style={styles.checkoutAmount}>
            ₹{payableSubtotal.toFixed(2)}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.checkoutButton,

            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/checkout")}
        >
          <Text style={styles.checkoutButtonText}>Proceed to checkout</Text>

          <Ionicons name="arrow-forward" size={20} color={colors.textWhite} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /* =========================

     CART SKELETON

  ========================= */

  skeletonScreen: {
    flex: 1,

    backgroundColor: colors.background,
  },

  skeletonBlock: {
    backgroundColor: "#E5EAF2",
  },

  skeletonHeader: {
    paddingHorizontal: 16,

    paddingTop: 10,

    paddingBottom: 14,

    backgroundColor: colors.surface,

    borderBottomWidth: 1,

    borderBottomColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  skeletonHeaderLeft: {
    flexDirection: "row",

    alignItems: "center",
  },

  skeletonContent: {
    padding: 14,

    paddingBottom: 155,
  },

  skeletonDeliveryCard: {
    minHeight: 68,

    paddingHorizontal: 13,

    paddingVertical: 11,

    marginBottom: 12,

    borderRadius: 17,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",
  },

  skeletonProductCard: {
    marginBottom: 12,

    padding: 12,

    borderRadius: 20,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,
  },

  skeletonProductTop: {
    flexDirection: "row",
  },

  skeletonTitleRow: {
    flexDirection: "row",

    alignItems: "flex-start",
  },

  skeletonPriceRow: {
    marginTop: 10,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  skeletonProductFooter: {
    marginTop: 12,

    paddingTop: 11,

    borderTopWidth: 1,

    borderTopColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  skeletonContinue: {
    minHeight: 68,

    padding: 12,

    marginTop: 3,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",
  },

  skeletonSavings: {
    marginTop: 12,

    padding: 13,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",
  },

  skeletonSummary: {
    marginTop: 12,

    padding: 16,

    borderRadius: 20,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,
  },

  skeletonTotalRow: {
    marginTop: 17,

    paddingTop: 13,

    borderTopWidth: 1,

    borderTopColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  skeletonCheckoutBar: {
    position: "absolute",

    left: 0,

    right: 0,

    bottom: 0,

    paddingHorizontal: 15,

    paddingTop: 11,

    paddingBottom: 20,

    backgroundColor: colors.surface,

    borderTopWidth: 1,

    borderTopColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    gap: 12,
  },

  screen: {
    flex: 1,

    backgroundColor: colors.background,
  },

  loadingScreen: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.background,

    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 64,

    height: 64,

    borderRadius: 22,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.blueSoft,
  },

  loader: {
    marginTop: 22,
  },

  loadingTitle: {
    marginTop: 12,

    fontSize: 18,

    fontWeight: "800",

    color: colors.text,
  },

  loadingSubtitle: {
    marginTop: 5,

    fontSize: 13,

    textAlign: "center",

    color: colors.textSecondary,
  },

  header: {
    paddingHorizontal: 16,

    paddingTop: 10,

    paddingBottom: 14,

    backgroundColor: colors.surface,

    borderBottomWidth: 1,

    borderBottomColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  headerLeft: {
    flexDirection: "row",

    alignItems: "center",

    gap: 11,
  },

  iconButton: {
    width: 42,

    height: 42,

    borderRadius: 14,

    backgroundColor: colors.surfaceSoft,

    alignItems: "center",

    justifyContent: "center",
  },

  headerTitle: {
    fontSize: 21,

    fontWeight: "900",

    color: colors.text,
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 12,

    color: colors.textSecondary,
  },

  clearButton: {
    height: 38,

    paddingHorizontal: 12,

    borderRadius: 12,

    backgroundColor: "#FEF2F2",

    flexDirection: "row",

    alignItems: "center",

    gap: 5,
  },

  clearButtonText: {
    fontSize: 12,

    fontWeight: "800",

    color: colors.error,
  },

  listContent: {
    padding: 14,

    paddingBottom: 155,
  },

  deliveryCard: {
    minHeight: 68,

    paddingHorizontal: 13,

    paddingVertical: 11,

    marginBottom: 12,

    borderRadius: 17,

    backgroundColor: colors.blueSoft,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "center",
  },

  deliveryIcon: {
    width: 40,

    height: 40,

    borderRadius: 13,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  deliveryContent: {
    flex: 1,

    marginLeft: 10,
  },

  deliveryTitle: {
    fontSize: 13,

    fontWeight: "900",

    color: colors.text,
  },

  deliveryText: {
    marginTop: 2,

    fontSize: 11,

    color: colors.textSecondary,
  },

  productCard: {
    position: "relative",

    marginBottom: 12,

    padding: 12,

    borderRadius: 20,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    shadowColor: colors.shadow,

    shadowOpacity: 0.08,

    shadowRadius: 12,

    shadowOffset: { width: 0, height: 5 },

    elevation: 2,
  },

  productTop: {
    flexDirection: "row",
  },

  productImageWrap: {
    width: 112,

    height: 125,

    borderRadius: 16,

    overflow: "hidden",

    backgroundColor: colors.surfaceSoft,

    position: "relative",
  },

  productImage: {
    width: "100%",

    height: "100%",
  },

  imagePlaceholder: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",
  },

  discountBadge: {
    position: "absolute",

    left: 7,

    bottom: 7,

    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  discountText: {
    fontSize: 9,

    fontWeight: "900",

    color: colors.textWhite,
  },

  productInfo: {
    flex: 1,

    marginLeft: 12,
  },

  productTitleRow: {
    flexDirection: "row",

    alignItems: "flex-start",
  },

  productName: {
    flex: 1,

    paddingRight: 5,

    fontSize: 15,

    lineHeight: 20,

    fontWeight: "800",

    color: colors.text,
  },

  removeIcon: {
    width: 30,

    height: 30,

    borderRadius: 10,

    backgroundColor: colors.surfaceSoft,

    alignItems: "center",

    justifyContent: "center",
  },

  variantPill: {
    alignSelf: "flex-start",

    marginTop: 7,

    paddingHorizontal: 8,

    paddingVertical: 4,

    borderRadius: 7,

    backgroundColor: colors.surfaceSoft,
  },

  variantText: {
    fontSize: 10,

    fontWeight: "700",

    color: colors.textSecondary,
  },

  priceRow: {
    marginTop: 8,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,
  },

  price: {
    fontSize: 18,

    fontWeight: "900",

    color: colors.primary,
  },

  oldPrice: {
    fontSize: 12,

    color: colors.textMuted,

    textDecorationLine: "line-through",
  },

  deliveryMini: {
    marginTop: 8,

    fontSize: 10,

    color: colors.success,

    fontWeight: "700",
  },

  productFooter: {
    marginTop: 12,

    paddingTop: 11,

    borderTopWidth: 1,

    borderTopColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  itemTotalLabel: {
    fontSize: 11,

    color: colors.textSecondary,
  },

  itemTotal: {
    fontSize: 13,

    fontWeight: "800",

    color: colors.text,
  },

  quantityControl: {
    height: 38,

    paddingHorizontal: 4,

    borderRadius: 12,

    backgroundColor: colors.blueSoft,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "center",
  },

  quantityButton: {
    width: 31,

    height: 30,

    alignItems: "center",

    justifyContent: "center",

    borderRadius: 9,

    backgroundColor: colors.surface,
  },

  quantity: {
    minWidth: 32,

    textAlign: "center",

    fontSize: 13,

    fontWeight: "900",

    color: colors.text,
  },

  updateOverlay: {
    position: "absolute",

    top: 0,

    left: 0,

    right: 0,

    bottom: 0,

    borderRadius: 20,

    backgroundColor: "rgba(255,255,255,0.72)",

    alignItems: "center",

    justifyContent: "center",
  },

  updateBubble: {
    paddingHorizontal: 13,

    paddingVertical: 9,

    borderRadius: 12,

    backgroundColor: colors.surface,

    flexDirection: "row",

    alignItems: "center",

    gap: 8,

    elevation: 3,
  },

  updateText: {
    fontSize: 11,

    fontWeight: "800",

    color: colors.text,
  },

  continueShopping: {
    minHeight: 68,

    padding: 12,

    marginTop: 3,

    borderRadius: 18,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",
  },

  continueIcon: {
    width: 40,

    height: 40,

    borderRadius: 13,

    backgroundColor: colors.blueSoft,

    alignItems: "center",

    justifyContent: "center",
  },

  continueContent: {
    flex: 1,

    marginLeft: 10,
  },

  continueTitle: {
    fontSize: 13,

    fontWeight: "800",

    color: colors.text,
  },

  continueSubtitle: {
    marginTop: 2,

    fontSize: 10,

    color: colors.textSecondary,
  },

  savingsCard: {
    marginTop: 12,

    padding: 13,

    borderRadius: 18,

    backgroundColor: "#F0FDF4",

    borderWidth: 1,

    borderColor: "#DCFCE7",

    flexDirection: "row",

    alignItems: "center",
  },

  savingsIcon: {
    width: 38,

    height: 38,

    borderRadius: 12,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",
  },

  savingsTitle: {
    fontSize: 12,

    fontWeight: "900",

    color: "#166534",
  },

  savingsSubtitle: {
    marginTop: 3,

    fontSize: 10,

    lineHeight: 14,

    color: "#4D7C5A",
  },

  offerAppliedRow: {
    marginTop: 6,

    alignSelf: "flex-start",

    flexDirection: "row",

    alignItems: "center",

    gap: 5,
  },

  offerAppliedIcon: {
    width: 17,

    height: 17,

    borderRadius: 9,

    backgroundColor: "#DCFCE7",

    alignItems: "center",

    justifyContent: "center",
  },

  offerAppliedText: {
    fontSize: 10,

    fontWeight: "800",

    color: "#166534",
  },

  offerAppliedBadge: {
    minHeight: 30,

    paddingHorizontal: 8,

    borderRadius: 10,

    backgroundColor: "#ECFDF5",

    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  offerAppliedBadgeText: {
    fontSize: 9,

    fontWeight: "900",

    color: "#166534",
  },

  offerSummaryNote: {
    marginBottom: 12,

    padding: 10,

    borderRadius: 12,

    backgroundColor: colors.blueSoft,

    borderWidth: 1,

    borderColor: colors.border,

    flexDirection: "row",

    alignItems: "flex-start",

    gap: 7,
  },

  offerSummaryNoteText: {
    flex: 1,

    fontSize: 10,

    lineHeight: 15,

    fontWeight: "700",

    color: colors.primaryDark,
  },

  summaryCard: {
    marginTop: 12,

    padding: 16,

    borderRadius: 20,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,
  },

  summaryTitle: {
    marginBottom: 14,

    fontSize: 16,

    fontWeight: "900",

    color: colors.text,
  },

  summaryRow: {
    marginBottom: 10,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  summaryLabel: {
    fontSize: 12,

    color: colors.textSecondary,
  },

  summaryValue: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.text,
  },

  discountValue: {
    fontSize: 12,

    fontWeight: "800",

    color: colors.success,
  },

  freeValue: {
    fontSize: 11,

    fontWeight: "900",

    color: colors.success,
  },

  summaryDivider: {
    height: 1,

    marginVertical: 4,

    backgroundColor: colors.borderLight,
  },

  totalRow: {
    marginTop: 12,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  totalLabel: {
    fontSize: 16,

    fontWeight: "900",

    color: colors.text,
  },

  totalSubtext: {
    marginTop: 2,

    fontSize: 9,

    color: colors.textMuted,
  },

  totalValue: {
    fontSize: 21,

    fontWeight: "900",

    color: colors.primary,
  },

  bottomSpace: {
    height: 25,
  },

  checkoutBar: {
    position: "absolute",

    left: 0,

    right: 0,

    bottom: 0,

    paddingHorizontal: 15,

    paddingTop: 11,

    paddingBottom: 20,

    backgroundColor: colors.surface,

    borderTopWidth: 1,

    borderTopColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    gap: 12,
  },

  checkoutPrice: {
    minWidth: 88,
  },

  checkoutSmall: {
    fontSize: 10,

    fontWeight: "700",

    color: colors.textSecondary,
  },

  checkoutAmount: {
    marginTop: 1,

    fontSize: 18,

    fontWeight: "900",

    color: colors.text,
  },

  checkoutButton: {
    flex: 1,

    minHeight: 52,

    paddingHorizontal: 17,

    borderRadius: 16,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 8,

    shadowColor: colors.primary,

    shadowOpacity: 0.22,

    shadowRadius: 10,

    shadowOffset: { width: 0, height: 5 },

    elevation: 4,
  },

  checkoutButtonText: {
    fontSize: 13,

    fontWeight: "900",

    color: colors.textWhite,
  },

  emptyHeader: {
    paddingHorizontal: 16,

    paddingTop: 10,

    paddingBottom: 12,

    backgroundColor: colors.surface,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    borderBottomWidth: 1,

    borderBottomColor: colors.borderLight,
  },

  emptyHeaderTitle: {
    fontSize: 18,

    fontWeight: "900",

    color: colors.text,
  },

  headerSpacer: {
    width: 42,
  },

  emptyContainer: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 34,
  },

  emptyOrb: {
    width: 154,

    height: 154,

    borderRadius: 77,

    backgroundColor: colors.blueSoft,

    alignItems: "center",

    justifyContent: "center",
  },

  emptyOrbInner: {
    width: 104,

    height: 104,

    borderRadius: 34,

    backgroundColor: colors.surface,

    alignItems: "center",

    justifyContent: "center",

    shadowColor: colors.primary,

    shadowOpacity: 0.12,

    shadowRadius: 18,

    shadowOffset: { width: 0, height: 8 },

    elevation: 4,
  },

  emptyTitle: {
    marginTop: 28,

    fontSize: 23,

    fontWeight: "900",

    color: colors.text,

    textAlign: "center",
  },

  emptyText: {
    marginTop: 9,

    fontSize: 13,

    lineHeight: 20,

    textAlign: "center",

    color: colors.textSecondary,
  },

  primaryButton: {
    minHeight: 52,

    marginTop: 25,

    paddingHorizontal: 22,

    borderRadius: 16,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 9,

    shadowColor: colors.primary,

    shadowOpacity: 0.2,

    shadowRadius: 12,

    shadowOffset: { width: 0, height: 5 },

    elevation: 4,
  },

  primaryButtonText: {
    fontSize: 14,

    fontWeight: "900",

    color: colors.textWhite,
  },

  pressed: {
    opacity: 0.86,

    transform: [{ scale: 0.985 }],
  },

  pressedLight: {
    opacity: 0.72,
  },
});
