
import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  addToCart as addCartItem,
  decreaseCartItem,
  getCart,
  increaseCartItem,
} from "../api/cart";

import { useFocusEffect, useRouter } from "expo-router";

import api from "../api/api";

import { colors } from "../theme/colors";

type WishlistProduct = {
  _id: string;

  name: string;

  image?: string;
  images?: string[];
  gallery?: string[];

  price: number;

  originalPrice?: number;

  discount?: number;

  rating?: number;

  reviewCount?: number;
  variantSku?: string;
  variantAttributes?: Record<string, string>;
};

const MOCK_WISHLIST: WishlistProduct[] = [];
const WISHLIST_CACHE_KEY = "@odikart:wishlist:products:v1";

type CustomAlertAction = {
  text: string;
  style?: "cancel" | "destructive" | "primary";
  onPress?: () => void | Promise<void>;
};

type CustomAlertState = {
  title: string;
  message: string;
  kind?: "success" | "error" | "warning" | "info";
  buttons?: CustomAlertAction[];
} | null;

export default function WishlistScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardImageSize = (screenWidth - 28) * 0.485;
  const cardImageHeight = Math.max(96, Math.min(120, cardImageSize * 0.62));
  const bannerShine = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(bannerShine, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(bannerShine, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [bannerShine]);

  const [products, setProducts] = useState<WishlistProduct[]>(MOCK_WISHLIST);
  const [activeImageIndexes, setActiveImageIndexes] = useState<
    Record<string, number>
  >({});

  // State for the search field and category chips.
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [refreshing, setRefreshing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const productsRef = useRef<WishlistProduct[]>([]);
  const hasLoadedRef = useRef(false);
  const requestRef = useRef(0);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(WISHLIST_CACHE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            productsRef.current = parsed;
            setProducts(parsed);
            hasLoadedRef.current = true;
          }
        }
      })
      .catch((error) => console.log("WISHLIST CACHE READ ERROR:", error))
      .finally(() => {
        if (active) setCacheReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(
    {},
  );
  const cartBusyRef = useRef(false);
  const [customAlert, setCustomAlert] = useState<CustomAlertState>(null);
  const alertScale = useRef(new Animated.Value(0.92)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;

  const showCustomAlert = (alert: NonNullable<CustomAlertState>) => {
    setCustomAlert(alert);
    alertScale.setValue(0.92);
    alertOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(alertScale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 16,
        stiffness: 180,
      }),
      Animated.timing(alertOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeCustomAlert = () => setCustomAlert(null);

  /* =========================================================

     LOAD WISHLIST

  ========================================================= */

  const loadWishlist = async (showSkeleton = false) => {
    const requestId = ++requestRef.current;
    try {
      if (showSkeleton && !hasLoadedRef.current) setLoading(true);

      console.log("========== WISHLIST LOAD ==========");

      const response = await api.get("/wishlist");

      console.log("WISHLIST RESPONSE:", response?.data);

      const rawItems =
        response?.data?.items || response?.data?.wishlist?.items || [];

      console.log("WISHLIST ITEMS:", rawItems);

      const mappedProducts: WishlistProduct[] = rawItems

        .map((item: any) => {
          const product =
            item?.productId && typeof item.productId === "object"
              ? item.productId
              : null;

          const variants = Array.isArray(product?.variants)
            ? product.variants.filter(
                (variant: any) => variant?.isActive !== false,
              )
            : [];

          const selectedVariant =
            variants.find(
              (variant: any) =>
                variant?.isDefault === true ||
                variant?.isDefaultVariant === true,
            ) ||
            [...variants].sort(
              (a: any, b: any) =>
                Number(a?.price ?? Infinity) - Number(b?.price ?? Infinity),
            )[0];

          const variantPrices = variants

            .map((variant: any) => Number(variant?.price))

            .filter((value: number) => Number.isFinite(value) && value >= 0);

          const variantOriginalPrices = variants

            .map((variant: any) => Number(variant?.originalPrice))

            .filter((value: number) => Number.isFinite(value) && value > 0);

          const variantImages = variants

            .flatMap((variant: any) =>
              Array.isArray(variant?.images) ? variant.images : [],
            )

            .filter(Boolean);

          const image =
            item?.image ||
            product?.media?.thumbnail ||
            product?.media?.images?.[0] ||
            variantImages[0];

          const productId = String(
            product?._id || item?.productId || item?._id || "",
          );

          if (!productId) {
            return null;
          }

          const itemPrice = Number(item?.price);

          const itemOriginalPrice = Number(item?.originalPrice);

          return {
            _id: productId,

            name: item?.title || product?.title || product?.name || "Product",

            image,
            images: Array.from(
              new Set(
                [
                  ...(Array.isArray(product?.media?.images)
                    ? product.media.images
                    : []),
                  ...variantImages,
                  image,
                ].filter(
                  (uri): uri is string =>
                    typeof uri === "string" && uri.trim().length > 0,
                ),
              ),
            ),

            variantSku: String(
              selectedVariant?.sku || selectedVariant?.variantSku || "",
            ),
            variantAttributes: selectedVariant?.attributes || {},

            price:
              Number.isFinite(itemPrice) && itemPrice > 0
                ? itemPrice
                : variantPrices.length
                  ? Math.min(...variantPrices)
                  : 0,

            originalPrice:
              Number.isFinite(itemOriginalPrice) && itemOriginalPrice > 0
                ? itemOriginalPrice
                : variantOriginalPrices.length
                  ? Math.min(...variantOriginalPrices)
                  : undefined,

            discount: Number(item?.discount) || 0,

            rating: Number(product?.rating || item?.rating || 0),

            reviewCount: Number(product?.numReviews || item?.reviewCount || 0),
          };
        })

        .filter(Boolean) as WishlistProduct[];

      console.log(
        "MAPPED WISHLIST PRODUCTS:",

        mappedProducts,
      );

      if (requestId !== requestRef.current) return;
      productsRef.current = mappedProducts;
      setProducts(mappedProducts);
      hasLoadedRef.current = true;
      await AsyncStorage.setItem(
        WISHLIST_CACHE_KEY,
        JSON.stringify(mappedProducts),
      ).catch((error) => console.log("WISHLIST CACHE WRITE ERROR:", error));
    } catch (error: any) {
      if (requestId !== requestRef.current) return;
      console.log(
        "WISHLIST ERROR:",

        error?.response?.data || error?.message || error,
      );

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        showCustomAlert({
          title: "Login required",
          message: "Please login to view your wishlist.",
          kind: "warning",
          buttons: [
            { text: "Not now", style: "cancel" },
            {
              text: "Login",
              style: "primary",
              onPress: () => router.push("/(auth)/login" as any),
            },
          ],
        });
      } else {
        showCustomAlert({
          title: "Wishlist unavailable",
          message: "We couldn't load your wishlist. Please try again.",
          kind: "error",
          buttons: [{ text: "Okay", style: "primary" }],
        });
      }

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        productsRef.current = [];
        setProducts([]);
        hasLoadedRef.current = false;
        await AsyncStorage.removeItem(WISHLIST_CACHE_KEY).catch(() => {});
      }
      // Keep cached products visible for temporary network failures.
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  };

  /* =========================================================

     SCREEN FOCUS

  ========================================================= */

  useFocusEffect(
    useCallback(() => {
      if (cacheReady) void loadWishlist(!hasLoadedRef.current);
    }, [cacheReady]),
  );

  /* =========================================================

     REFRESH

  ========================================================= */

  const onRefresh = async () => {
    setRefreshing(true);

    await loadWishlist(false);

    setRefreshing(false);
  };

  /* =========================================================

     REMOVE WISHLIST

  ========================================================= */

  const removeFromWishlist = (productId: string) => {
    showCustomAlert({
      title: "Remove from Wishlist",
      message: "Do you want to remove this product from your wishlist?",
      kind: "warning",
      buttons: [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const previousProducts = productsRef.current;
            const updatedProducts = previousProducts.filter(
              (item) => String(item._id) !== String(productId),
            );
            productsRef.current = updatedProducts;
            setProducts(updatedProducts);
            await AsyncStorage.setItem(
              WISHLIST_CACHE_KEY,
              JSON.stringify(updatedProducts),
            ).catch(() => {});

            try {
              await api.delete("/wishlist/remove", {
                data: { productId },
              });

              console.log("WISHLIST REMOVE SUCCESS:", productId);
            } catch (error: any) {
              console.log(
                "WISHLIST REMOVE ERROR:",
                error?.response?.data || error?.message || error,
              );

              productsRef.current = previousProducts;
              setProducts(previousProducts);
              await AsyncStorage.setItem(
                WISHLIST_CACHE_KEY,
                JSON.stringify(previousProducts),
              ).catch(() => {});

              if (
                error?.response?.status === 401 ||
                error?.response?.status === 403
              ) {
                showCustomAlert({
                  title: "Login required",
                  message: "Please login to update your wishlist.",
                  kind: "warning",
                  buttons: [
                    { text: "Not now", style: "cancel" },
                    {
                      text: "Login",
                      style: "primary",
                      onPress: () => router.push("/(auth)/login" as any),
                    },
                  ],
                });
              } else {
                showCustomAlert({
                  title: "Could not remove",
                  message:
                    "The product could not be removed from your wishlist.",
                  kind: "error",
                  buttons: [{ text: "Okay", style: "primary" }],
                });
              }
            }
          },
        },
      ],
    });
  };

  /* =========================================================
      OPEN PRODUCT

  ========================================================= */

  const openProduct = (productId: string) => {
    router.push(`/product/${productId}` as any);
  };

  /* =========================================================

     ADD TO CART

  ========================================================= */

  const addToCart = async (product: WishlistProduct) => {
    if (addingToCartId) return;

    setAddingToCartId(product._id);
    try {
      let variantSku = product.variantSku;

      // Some wishlist responses contain only a product ID. Fetch the product
      // before adding so the cart receives the SKU required by the backend.
      if (!variantSku) {
        const productResponse = await api.get(`/products/${product._id}`);
        const fullProduct =
          productResponse?.data?.product ||
          productResponse?.data?.data ||
          productResponse?.data;

        const variants = Array.isArray(fullProduct?.variants)
          ? fullProduct.variants.filter(
              (variant: any) => variant?.isActive !== false,
            )
          : [];

        const selectedVariant =
          variants.find(
            (variant: any) =>
              variant?.isDefault === true || variant?.isDefaultVariant === true,
          ) ||
          [...variants].sort(
            (a: any, b: any) =>
              Number(a?.price ?? Infinity) - Number(b?.price ?? Infinity),
          )[0];

        variantSku = selectedVariant?.sku || selectedVariant?.variantSku;
      }

      if (!variantSku) {
        showCustomAlert({
          title: "Choose an option",
          message:
            "Please choose a size, colour, or other available option before adding this product.",
          kind: "warning",
          buttons: [
            { text: "Not now", style: "cancel" },
            {
              text: "Choose options",
              style: "primary",
              onPress: () => router.push(`/product/${product._id}` as any),
            },
          ],
        });
        return;
      }

      await api.post("/cart/add", {
        productId: product._id,
        variantSku,
        quantity: 1,
        image: product.image,
      });

      showCustomAlert({
        title: "Added to cart!",
        message: `${product.name} was added to your cart.`,
        kind: "success",
        buttons: [{ text: "Lovely!", style: "primary" }],
      });
    } catch (error: any) {
      console.log(
        "WISHLIST ADD TO CART ERROR:",
        error?.response?.data || error?.message || error,
      );

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        showCustomAlert({
          title: "Login required",
          message: "Please login to add products to your cart.",
          kind: "warning",
          buttons: [
            { text: "Not now", style: "cancel" },
            {
              text: "Login",
              style: "primary",
              onPress: () => router.push("/(auth)/login" as any),
            },
          ],
        });
      } else {
        const message =
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          "We couldn't add this product. Please try again.";
        showCustomAlert({
          title: "Couldn't add this item",
          message,
          kind: "error",
          buttons: [
            {
              text: "Try again",
              style: "primary",
              onPress: () => addToCart(product),
            },
          ],
        });
      }
    } finally {
      setAddingToCartId(null);
    }
  };

  const syncCartQuantities = useCallback(async () => {
    try {
      const response: any = await getCart();
      const items = Array.isArray(response)
        ? response
        : Array.isArray(response?.items)
          ? response.items
          : Array.isArray(response?.cartItems)
            ? response.cartItems
            : Array.isArray(response?.data?.items)
              ? response.data.items
              : [];
      const next: Record<string, number> = {};
      items.forEach((cartItem: any) => {
        const id = String(
          cartItem.productId ||
            cartItem.product?._id ||
            cartItem.product?._id ||
            "",
        );
        if (id) next[id] = Math.max(0, Number(cartItem.quantity) || 0);
      });
      setCartQuantities(next);
    } catch (error) {
      console.log("WISHLIST CART SYNC ERROR:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void syncCartQuantities();
    }, [syncCartQuantities]),
  );

  const changeWishlistCartQuantity = async (
    product: WishlistProduct,
    direction: "increase" | "decrease",
  ) => {
    if (cartBusyRef.current) return;
    const currentQuantity = cartQuantities[product._id] || 0;
    if (direction === "decrease" && currentQuantity <= 0) return;
    cartBusyRef.current = true;
    try {
      let variantSku = product.variantSku;
      if (!variantSku) {
        const response = await api.get(`/products/${product._id}`);
        const fullProduct =
          response?.data?.product || response?.data?.data || response?.data;
        const variants = Array.isArray(fullProduct?.variants)
          ? fullProduct.variants.filter((v: any) => v?.isActive !== false)
          : [];
        const selected =
          variants.find(
            (v: any) => v?.isDefault === true || v?.isDefaultVariant === true,
          ) ||
          [...variants].sort(
            (a: any, b: any) =>
              Number(a?.price ?? Infinity) - Number(b?.price ?? Infinity),
          )[0];
        variantSku = selected?.sku || selected?.variantSku;
      }
      if (!variantSku) {
        showCustomAlert({
          title: "Choose an option",
          message:
            "Please choose a size, colour, or other available option first.",
          kind: "warning",
          buttons: [
            {
              text: "Choose options",
              style: "primary",
              onPress: () => router.push(`/product/${product._id}` as any),
            },
          ],
        });
        return;
      }
      if (direction === "increase") {
        if (currentQuantity === 0) {
          await addCartItem({
            productId: product._id,
            variantSku,
            quantity: 1,
            image: product.image,
          });
        } else {
          await increaseCartItem({ productId: product._id, variantSku });
        }
      } else {
        await decreaseCartItem({ productId: product._id, variantSku });
      }
      await syncCartQuantities();
    } catch (error: any) {
      console.log(
        "WISHLIST CART QUANTITY ERROR:",
        error?.response?.data || error?.message || error,
      );
      showCustomAlert({
        title: "Cart update failed",
        message:
          error?.response?.data?.message ||
          "We couldn't update the cart. Please try again.",
        kind: "error",
        buttons: [{ text: "Okay", style: "primary" }],
      });
    } finally {
      cartBusyRef.current = false;
    }
  };

  /* =========================================================
      PRODUCT CARD

  ========================================================= */

  const renderProduct = ({ item }: { item: WishlistProduct }) => {
    const price = Number(item.price || 0);

    const originalPrice = Number(item.originalPrice || 0);

    return (
      <View style={styles.card}>
        {/* =================================================

            PRODUCT IMAGE

        ================================================= */}

        <View style={[styles.imageContainer, { height: cardImageHeight + 10 }]}>
          {(() => {
            const gallery = Array.from(
              new Set(
                [
                  ...(Array.isArray(item.images) ? item.images : []),
                  ...(Array.isArray(item.gallery) ? item.gallery : []),
                  item.image,
                ].filter(
                  (uri): uri is string =>
                    typeof uri === "string" && uri.trim().length > 0,
                ),
              ),
            );
            return gallery.length > 0 ? (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  style={styles.productImageCarousel}
                  contentContainerStyle={styles.productImageCarouselContent}
                  onMomentumScrollEnd={(event) => {
                    const nextIndex = Math.round(
                      event.nativeEvent.contentOffset.x / cardImageSize,
                    );
                    setActiveImageIndexes((previous) => ({
                      ...previous,
                      [item._id]: Math.max(
                        0,
                        Math.min(nextIndex, gallery.length - 1),
                      ),
                    }));
                  }}
                >
                  {gallery.map((uri, index) => (
                    <Pressable
                      key={`${item._id}-wishlist-image-${index}`}
                      onPress={() => openProduct(item._id)}
                      style={{ width: cardImageSize, height: cardImageHeight }}
                      accessibilityRole="image"
                      accessibilityLabel={`Open ${item.name}, image ${index + 1} of ${gallery.length}`}
                    >
                      <Image
                        source={{ uri }}
                        style={styles.productImage}
                        resizeMode="contain"
                        accessibilityLabel={`${item.name} image ${index + 1}`}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
                {gallery.length > 1 ? (
                  <View pointerEvents="none" style={styles.carouselIndicators}>
                    {gallery.map((_, index) => (
                      <View
                        key={`${item._id}-wishlist-dot-${index}`}
                        style={[
                          styles.carouselDot,
                          (activeImageIndexes[item._id] || 0) === index &&
                            styles.carouselDotActive,
                        ]}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons
                  name="image-outline"
                  size={36}
                  color={colors.textMuted}
                />
                <Text style={styles.placeholderText}>No image</Text>
              </View>
            );
          })()}

          <View pointerEvents="none" style={styles.productShineClip}>
            <Animated.View
              style={[
                styles.productShine,
                {
                  transform: [
                    {
                      translateX: bannerShine.interpolate({
                        inputRange: [-1, 1],
                        outputRange: [-70, cardImageSize + 70],
                      }),
                    },
                    { skewX: "-20deg" },
                  ],
                },
              ]}
            />
          </View>

          {/* DISCOUNT */}

          {item.discount ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{item.discount}% OFF</Text>
            </View>
          ) : null}

          {/* WISHLIST BUTTON */}

          <Pressable
            style={({ pressed }) => [
              styles.heartButton,

              pressed && styles.heartButtonPressed,
            ]}
            hitSlop={8}
            onPress={() => removeFromWishlist(item._id)}
          >
            <Ionicons name="heart" size={19} color={colors.error} />
          </Pressable>
        </View>

        {/* =================================================

            PRODUCT INFO

        ================================================= */}

        <View style={styles.productInfo}>
          <Pressable onPress={() => openProduct(item._id)}>
            {/* PRODUCT NAME */}

            <Text
              style={styles.productName}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.name}
            </Text>

            {/* RATING */}

            <View style={styles.ratingRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={10} color="#FFFFFF" />

                <Text style={styles.ratingText}>
                  {item.rating?.toFixed(1) || "4.5"}
                </Text>
              </View>

              {item.reviewCount ? (
                <Text style={styles.reviewText}>
                  {item.reviewCount} reviews
                </Text>
              ) : null}
            </View>

            {/* PRICE */}

            <View style={styles.priceRow}>
              <Text style={styles.price}>₹{price.toLocaleString("en-IN")}</Text>

              {originalPrice > price ? (
                <Text style={styles.originalPrice}>
                  ₹{originalPrice.toLocaleString("en-IN")}
                </Text>
              ) : null}
            </View>
          </Pressable>

          {/* CATEGORY-PAGE STYLE CART ACTION */}
          <View style={styles.cartActionRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cartHint}>
                {cartQuantities[item._id] > 0 ? "In your cart" : "Add to cart"}
              </Text>
            </View>
            {cartQuantities[item._id] > 0 ? (
              <LinearGradient
                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.quantityStepper}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${item.name} quantity`}
                  hitSlop={6}
                  style={styles.stepperAction}
                  onPress={() =>
                    void changeWishlistCartQuantity(item, "decrease")
                  }
                >
                  <Ionicons name="remove" size={17} color="#4F46E5" />
                </Pressable>
                <Text style={styles.cartQuantityText}>
                  {cartQuantities[item._id]}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${item.name} quantity`}
                  hitSlop={6}
                  style={styles.stepperAction}
                  onPress={() =>
                    void changeWishlistCartQuantity(item, "increase")
                  }
                >
                  <Ionicons name="add" size={17} color="#4F46E5" />
                </Pressable>
              </LinearGradient>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${item.name} to cart`}
                style={({ pressed }) => [
                  styles.cartButton,
                  pressed && styles.cartButtonPressed,
                  addingToCartId !== null && { opacity: 0.55 },
                ]}
                onPress={() =>
                  void changeWishlistCartQuantity(item, "increase")
                }
                disabled={addingToCartId !== null}
                hitSlop={6}
              >
                {addingToCartId === item._id ? (
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={20}
                    color="#FFFFFF"
                  />
                ) : (
                  <LinearGradient
                    colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.addGradient}
                  >
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={styles.addButtonText}>ADD</Text>
                  </LinearGradient>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  /* =========================================================

     EMPTY WISHLIST

  ========================================================= */

  const WishlistSkeletonCard = () => (
    <View style={[styles.card, styles.skeletonCard]}>
      {/* Match the real product card's taller image area and overlays. */}
      <View
        style={[
          styles.imageContainer,
          styles.skeletonImageContainer,
          { height: cardImageHeight + 10 },
        ]}
      >
        <View style={styles.skeletonImageGlow} />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.skeletonShine,
            {
              transform: [
                {
                  translateX: bannerShine.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-150, screenWidth * 0.7],
                  }),
                },
                { skewX: "-18deg" },
              ],
            },
          ]}
        />
        <View style={styles.skeletonDiscountBadge} />
        <View style={styles.skeletonHeartButton}>
          <Ionicons name="heart" size={17} color="#D8DDF5" />
        </View>
      </View>

      {/* Same order and compact spacing as the live product information. */}
      <View style={styles.skeletonInfo}>
        <View style={[styles.skeletonLine, styles.skeletonProductName]} />

        <View style={styles.skeletonRatingRow}>
          <View style={styles.skeletonRating} />
          <View style={styles.skeletonReview} />
        </View>

        <View style={styles.skeletonPriceRow}>
          <View style={styles.skeletonPrice} />
          <View style={styles.skeletonOriginalPrice} />
        </View>

        <View style={styles.skeletonCartRow}>
          <View style={styles.skeletonCartHint} />
          <View style={styles.skeletonButton}>
            <View style={styles.skeletonButtonPlus} />
            <View style={styles.skeletonButtonPlusVertical} />
            <View style={styles.skeletonButtonLabel} />
          </View>
        </View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.skeletonInfoShine,
            {
              transform: [
                {
                  translateX: bannerShine.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-150, screenWidth * 0.7],
                  }),
                },
                { skewX: "-18deg" },
              ],
            },
          ]}
        />
      </View>
    </View>
  );

  const EmptyWishlist = () => (
    <View style={styles.emptyContainer}>
      {/* AMBIENT GLOW */}

      <View pointerEvents="none" style={styles.emptyAmbientOne} />

      <View pointerEvents="none" style={styles.emptyAmbientTwo} />

      {/* ICON */}

      <View style={styles.emptyGlow}>
        <View style={styles.emptyGlowInner}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={48} color={colors.primary} />
          </View>
        </View>
      </View>

      {/* TITLE */}

      <Text style={styles.emptyTitle}>Your wishlist is waiting</Text>

      {/* DESCRIPTION */}

      <Text style={styles.emptyDescription}>
        Save products you love and find them here whenever you're ready to shop.
      </Text>

      {/* CTA */}

      <Pressable
        style={({ pressed }) => [
          styles.shopButton,

          pressed && styles.shopButtonPressed,
        ]}
        onPress={() => router.push("/(tabs)" as any)}
      >
        <Ionicons name="bag-outline" size={19} color={colors.textWhite} />

        <Text style={styles.shopButtonText}>Start Shopping</Text>

        <Ionicons name="arrow-forward" size={17} color={colors.textWhite} />
      </Pressable>
    </View>
  );

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());
    if (!matchesSearch) return false;
    if (selectedCategory === "All") return true;
    const name = product.name.toLowerCase();
    const categoryTerms: Record<string, string[]> = {
      Grocery: [
        "grocery",
        "pickle",
        "rice",
        "oil",
        "masala",
        "papad",
        "snack",
        "food",
        "dal",
      ],
      Snacks: ["snack", "mixture", "chips", "papad", "namkeen"],
      Home: ["home", "kitchen", "decor", "craft", "idol", "handicraft"],
      Fashion: [
        "saree",
        "shirt",
        "shoe",
        "dress",
        "fashion",
        "bag",
        "clothing",
      ],
    };
    return (categoryTerms[selectedCategory] || []).some((term) =>
      name.includes(term),
    );
  });

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.searchToolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color="#667085" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search in wishlist..."
            placeholderTextColor="#8992AB"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>
      </View>

      <View
        style={[
          styles.promoBannerFrame,
          { height: Math.min(178, Math.max(132, screenWidth * 0.39)) },
        ]}
      >
        <View pointerEvents="none" style={styles.bannerGlowOne} />
        <View pointerEvents="none" style={styles.bannerGlowTwo} />
        <View style={styles.bannerCopy}>
          <View style={styles.bannerEyebrow}>
            <Ionicons name="heart" size={11} color="#FFFFFF" />
            <Text style={styles.bannerEyebrowText}>SAVED WITH LOVE</Text>
          </View>
          <Text style={styles.bannerTitle}>
            Your favourite{"\n"}
            <Text style={styles.bannerTitleAccent}>finds are here!</Text>
          </Text>
          <Text style={styles.bannerSubtitle} numberOfLines={1}>
            Good things are worth saving.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.bannerCta,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/(tabs)" as any)}
          >
            <Text style={styles.bannerCtaText}>Continue shopping</Text>
            <Ionicons name="arrow-forward" size={15} color="#4338F5" />
          </Pressable>
        </View>
        <View style={styles.bannerArtwork} pointerEvents="none">
          <View style={styles.bannerBagHandle} />
          <View style={styles.bannerBag}>
            <Ionicons name="bag-handle" size={36} color="#4338F5" />
            <Text style={styles.bannerBagBrand}>OdiKart</Text>
            <Ionicons name="heart" size={14} color="#F43F5E" />
          </View>
          <View style={styles.bannerSparkleOne}>
            <Ionicons name="sparkles" size={19} color="#FFFFFF" />
          </View>
          <View style={styles.bannerSparkleTwo}>
            <Ionicons name="heart" size={21} color="#FF6685" />
          </View>
        </View>
        <View pointerEvents="none" style={styles.bannerShineClip}>
          <Animated.View
            style={[
              styles.bannerShine,
              {
                transform: [
                  {
                    translateX: bannerShine.interpolate({
                      inputRange: [-1, 1],
                      outputRange: [-90, screenWidth + 90],
                    }),
                  },
                  { skewX: "-20deg" },
                ],
              },
            ]}
          />
        </View>
      </View>
    </View>
  );

  /* =========================================================

     SCREEN

  ========================================================= */

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />

      <View style={styles.container}>
        {/* AMBIENT BACKGROUND */}

        <View pointerEvents="none" style={styles.ambientTop} />

        <View pointerEvents="none" style={styles.ambientBottom} />

        {/* WISHLIST HEADER */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={23} color="#111A4A" />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              My <Text style={styles.titleAccent}>Wishlist</Text>
            </Text>
            <Text style={styles.subtitle}>
              {products.length} saved {products.length === 1 ? "item" : "items"}
              <Text style={styles.subtitleHeart}> ♥</Text>
            </Text>
          </View>
        </View>

        {!cacheReady || loading ? (
          <FlatList
            data={Array.from({ length: 6 })}
            keyExtractor={(_, index) => `wishlist-skeleton-${index}`}
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={renderListHeader}
            renderItem={() => <WishlistSkeletonCard />}
          />
        ) : products.length === 0 ? (
          <EmptyWishlist />
        ) : (
          <FlatList
            data={filteredProducts}
            ListHeaderComponent={renderListHeader}
            keyExtractor={(item) => item._id}
            renderItem={renderProduct}
            ListEmptyComponent={
              <View style={styles.noResults}>
                <View style={styles.noResultsIcon}>
                  <Ionicons name="search-outline" size={28} color="#5145CD" />
                </View>
                <Text style={styles.noResultsTitle}>
                  No matching favourites
                </Text>
                <Text style={styles.noResultsText}>
                  Try another search or category.
                </Text>
                <Pressable
                  style={styles.resetFiltersButton}
                  onPress={() => {
                    setSearchQuery("");
                    setSelectedCategory("All");
                  }}
                >
                  <Text style={styles.resetFiltersText}>
                    Clear search & filters
                  </Text>
                </Pressable>
              </View>
            }
            numColumns={2}
            columnWrapperStyle={styles.columnWrapper}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
          />
        )}
      </View>

      <Modal
        visible={!!customAlert}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeCustomAlert}
      >
        <View style={styles.alertBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeCustomAlert}
          />
          <Animated.View
            style={[
              styles.alertCard,
              { opacity: alertOpacity, transform: [{ scale: alertScale }] },
            ]}
          >
            <View style={styles.alertGlow} />
            <View
              style={[
                styles.alertIconWrap,
                customAlert?.kind === "success"
                  ? styles.alertIconSuccess
                  : customAlert?.kind === "error"
                    ? styles.alertIconError
                    : customAlert?.kind === "warning"
                      ? styles.alertIconWarning
                      : styles.alertIconInfo,
              ]}
            >
              <Ionicons
                name={
                  customAlert?.kind === "success"
                    ? "checkmark"
                    : customAlert?.kind === "error"
                      ? "close"
                      : customAlert?.kind === "warning"
                        ? "alert"
                        : "sparkles"
                }
                size={29}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.alertTitle}>{customAlert?.title}</Text>
            <Text style={styles.alertMessage}>{customAlert?.message}</Text>
            <View style={styles.alertActions}>
              {(customAlert?.buttons?.length
                ? customAlert.buttons
                : [{ text: "Okay", style: "primary" as const }]
              ).map((action, index) => (
                <Pressable
                  key={`${action.text}-${index}`}
                  style={({ pressed }) => [
                    styles.alertButton,
                    action.style === "primary"
                      ? styles.alertButtonPrimary
                      : action.style === "destructive"
                        ? styles.alertButtonDanger
                        : styles.alertButtonSecondary,
                    customAlert?.buttons?.length === 1 &&
                      styles.alertButtonFull,
                    pressed && styles.alertButtonPressed,
                  ]}
                  onPress={() => {
                    closeCustomAlert();
                    if (action.onPress)
                      setTimeout(() => {
                        void action.onPress?.();
                      }, 120);
                  }}
                >
                  <Text
                    style={[
                      styles.alertButtonText,
                      action.style !== "primary" &&
                        action.style !== "destructive" &&
                        styles.alertButtonSecondaryText,
                    ]}
                  >
                    {action.text}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View pointerEvents="none" style={styles.alertShine} />
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================

   STYLES

\========================================================= */

const styles = StyleSheet.create({
  /* =======================================================

     ROOT

  ======================================================= */

  safeArea: {
    flex: 1,

    backgroundColor: colors.background,
  },

  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  /* =======================================================

     AMBIENT BACKGROUND

  ======================================================= */

  ambientTop: {
    position: "absolute",

    width: 260,

    height: 260,

    borderRadius: 130,

    top: -160,

    right: -100,

    backgroundColor: colors.secondary,

    opacity: 0.045,
  },

  ambientBottom: {
    position: "absolute",

    width: 280,

    height: 280,

    borderRadius: 140,

    bottom: -170,

    left: -130,

    backgroundColor: colors.primary,

    opacity: 0.04,
  },

  /* =======================================================

     HEADER

  ======================================================= */

  header: {
    minHeight: 88,

    paddingHorizontal: 20,

    paddingTop: 16,

    paddingBottom: 14,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    // Plain white header: no colored/gradient header background.
    backgroundColor: "#FFFFFF",

    borderBottomWidth: 1,
    borderBottomColor: "#F0F1F7",

    zIndex: 5,
  },

  headerText: {
    flex: 1,
  },

  eyebrow: {
    fontSize: 10,

    fontWeight: "800",

    letterSpacing: 1.6,

    color: colors.primary,

    marginBottom: 4,
  },

  title: {
    fontSize: 18,

    fontWeight: "900",

    letterSpacing: -0.7,

    color: colors.text,
  },

  subtitle: {
    marginTop: 4,

    fontSize: 13,

    color: colors.textSecondary,
  },

  headerIcon: {
    width: 46,

    height: 46,

    borderRadius: 15,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.blueSoft,

    borderWidth: 1,

    borderColor: colors.borderLight,

    shadowColor: colors.primary,

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,

    shadowRadius: 10,

    elevation: Platform.OS === "android" ? 2 : 0,
  },

  /* =======================================================

     LIST

  ======================================================= */

  listContent: {
    paddingHorizontal: 14,

    paddingTop: 1,

    paddingBottom: 35,
  },

  columnWrapper: {
    justifyContent: "space-between",
  },

  /* =======================================================

     PRODUCT CARD

  ======================================================= */

  card: {
    width: "48.5%",

    marginBottom: 12,

    borderRadius: 16,

    overflow: "hidden",

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    shadowColor: colors.shadow,

    shadowOffset: {
      width: 0,

      height: 7,
    },

    shadowOpacity: Platform.OS === "ios" ? 0.07 : 0,

    shadowRadius: 16,

    elevation: Platform.OS === "android" ? 3 : 0,
  },

  /* =======================================================

     IMAGE

  ======================================================= */

  imageContainer: {
    // Taller image area gives product photos more room while keeping two columns.
    height: 106,
    position: "relative",

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.surfaceSoft,

    overflow: "hidden",
  },

  productShineClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 1,
  },

  productShine: {
    position: "absolute",
    top: -20,
    bottom: -20,
    width: 34,
    backgroundColor: "rgba(255,255,255,0.45)",
    opacity: 0.75,
  },

  productImageCarousel: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },

  productImageCarouselContent: {
    alignItems: "center",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  carouselIndicators: {
    position: "absolute",
    bottom: 4,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.78)",
  },

  carouselDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#A5B4FC",
  },

  carouselDotActive: {
    width: 12,
    backgroundColor: "#4F46E5",
  },

  imagePlaceholder: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    // gap: 5,
  },

  placeholderText: {
    fontSize: 10,

    fontWeight: "600",

    color: colors.textMuted,
  },

  /* =======================================================

     DISCOUNT

  ======================================================= */

  discountBadge: {
    position: "absolute",

    left: 9,

    top: 9,

    paddingHorizontal: 8,

    paddingVertical: 5,

    borderRadius: 8,

    backgroundColor: colors.primary,

    shadowColor: colors.primary,

    shadowOffset: {
      width: 0,

      height: 3,
    },

    shadowOpacity: Platform.OS === "ios" ? 0.16 : 0,

    shadowRadius: 7,

    elevation: Platform.OS === "android" ? 2 : 0,
  },

  discountText: {
    fontSize: 9,

    fontWeight: "900",

    letterSpacing: 0.2,

    color: colors.textWhite,
  },

  /* =======================================================

     HEART

  ======================================================= */

  heartButton: {
    position: "absolute",

    top: 9,

    right: 9,

    width: 38,

    height: 38,

    borderRadius: 13,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    shadowColor: colors.shadow,

    shadowOffset: {
      width: 0,

      height: 4,
    },

    shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,

    shadowRadius: 8,

    elevation: Platform.OS === "android" ? 2 : 0,
  },

  heartButtonPressed: {
    transform: [
      {
        scale: 0.92,
      },
    ],

    backgroundColor: colors.blueSoft,
  },

  /* =======================================================

     PRODUCT INFO

  ======================================================= */

  productInfo: {
    padding: 8,
    backgroundColor: "#FFFFFF",
  },

  productName: {
    fontSize: 12,
    lineHeight: 16,
    height: 18,

    fontWeight: "800",

    color: colors.text,

    letterSpacing: -0.1,
  },

  /* =======================================================

     RATING

  ======================================================= */

  ratingRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 3,
  },

  ratingBadge: {
    minHeight: 18,

    flexDirection: "row",

    alignItems: "center",

    gap: 3,

    paddingHorizontal: 6,

    paddingVertical: 2,

    borderRadius: 7,

    backgroundColor: colors.success,
  },

  ratingText: {
    fontSize: 10,

    fontWeight: "800",

    color: colors.textWhite,
  },

  reviewText: {
    marginLeft: 6,

    fontSize: 10,

    fontWeight: "600",

    color: colors.textMuted,
  },

  /* =======================================================

     PRICE

  ======================================================= */

  priceRow: {
    flexDirection: "row",

    alignItems: "center",

    gap: 7,

    marginTop: 3,
  },

  price: {
    fontSize: 14,

    fontWeight: "900",

    color: colors.primary,

    letterSpacing: -0.2,
  },

  originalPrice: {
    fontSize: 11,

    fontWeight: "500",

    color: colors.textMuted,

    textDecorationLine: "line-through",
  },

  /* =======================================================

     CART BUTTON

  ======================================================= */

  cartActionRow: {
    minHeight: 30,
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },

  cartHint: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  cartButton: {
    minWidth: 68,
    height: 30,
    zIndex: 2,
    borderRadius: 11,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
  },

  addGradient: {
    width: "100%",
    height: "100%",
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: 11,
  },

  addButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },

  quantityStepper: {
    height: 30,
    minWidth: 94,
    borderRadius: 11,
    padding: 3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },

  stepperAction: {
    width: 23,
    height: 23,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  cartQuantityText: {
    minWidth: 18,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  cartButtonPressed: {
    transform: [{ scale: 0.92 }],
    backgroundColor: colors.primaryDark,
  },

  buttonPulse: {
    alignItems: "center",
    justifyContent: "center",
  },

  emptyContainer: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 34,

    overflow: "hidden",
  },

  emptyAmbientOne: {
    position: "absolute",

    width: 220,

    height: 220,

    borderRadius: 110,

    top: "18%",

    left: -150,

    backgroundColor: colors.secondary,

    opacity: 0.035,
  },

  emptyAmbientTwo: {
    position: "absolute",

    width: 240,

    height: 240,

    borderRadius: 120,

    bottom: "12%",

    right: -160,

    backgroundColor: colors.primary,

    opacity: 0.04,
  },

  emptyGlow: {
    width: 154,

    height: 154,

    borderRadius: 77,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.blueSoft,

    borderWidth: 1,

    borderColor: colors.borderLight,

    marginBottom: 24,
  },

  emptyGlowInner: {
    width: 124,

    height: 124,

    borderRadius: 62,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    shadowColor: colors.primary,

    shadowOffset: {
      width: 0,

      height: 7,
    },

    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0,

    shadowRadius: 18,

    elevation: Platform.OS === "android" ? 2 : 0,
  },

  emptyIcon: {
    width: 84,

    height: 84,

    borderRadius: 28,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.blueSoft,
  },

  emptyTitle: {
    fontSize: 23,

    lineHeight: 29,

    fontWeight: "900",

    letterSpacing: -0.5,

    textAlign: "center",

    color: colors.text,
  },

  emptyDescription: {
    maxWidth: 330,

    marginTop: 9,

    fontSize: 14,

    lineHeight: 21,

    fontWeight: "500",

    textAlign: "center",

    color: colors.textSecondary,
  },

  /* =======================================================

     SHOP BUTTON

  ======================================================= */

  shopButton: {
    minHeight: 52,

    paddingHorizontal: 22,

    marginTop: 25,

    borderRadius: 15,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 8,

    backgroundColor: colors.primary,

    shadowColor: colors.primary,

    shadowOffset: {
      width: 0,

      height: 8,
    },

    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0,

    shadowRadius: 16,

    elevation: Platform.OS === "android" ? 4 : 0,
  },

  shopButtonPressed: {
    transform: [
      {
        scale: 0.97,
      },
    ],

    backgroundColor: colors.primaryDark,
  },

  shopButtonText: {
    fontSize: 14,

    fontWeight: "800",

    color: colors.textWhite,
  },

  /* =======================================================

     LOADING

  ======================================================= */

  skeletonCard: {
    borderColor: "#E5E9FF",
    shadowColor: "#6475FF",
    shadowOpacity: Platform.OS === "ios" ? 0.07 : 0,
    shadowRadius: 16,
    elevation: Platform.OS === "android" ? 3 : 0,
  },

  skeletonImageContainer: {
    backgroundColor: "#F1F3FF",
  },

  skeletonImageGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F8F9FF",
    opacity: 0.78,
  },

  skeletonShine: {
    position: "absolute",
    top: -18,
    bottom: -18,
    left: 0,
    width: 52,
    backgroundColor: "rgba(255,255,255,0.92)",
    opacity: 0.88,
  },

  skeletonDiscountBadge: {
    position: "absolute",
    top: 9,
    left: 9,
    width: 48,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#DDE2FF",
  },

  skeletonHeartButton: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "#E8EAFA",
  },

  skeletonInfo: {
    padding: 8,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FFFFFF",
  },

  skeletonInfoShine: {
    position: "absolute",
    top: -20,
    bottom: -20,
    left: 0,
    width: 46,
    backgroundColor: "rgba(255,255,255,0.7)",
    opacity: 0.8,
  },

  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#EDF0FA",
  },

  skeletonProductName: {
    width: "88%",
    height: 12,
    marginTop: 3,
    marginBottom: 6,
  },

  skeletonRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 1,
    marginBottom: 5,
  },

  skeletonRating: {
    width: 39,
    height: 18,
    borderRadius: 7,
    backgroundColor: "#E8ECF8",
  },

  skeletonReview: {
    width: 42,
    height: 8,
    borderRadius: 5,
    backgroundColor: "#EEF0F8",
    marginLeft: 6,
  },

  skeletonPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 20,
    marginTop: 1,
  },

  skeletonPrice: {
    width: 54,
    height: 14,
    borderRadius: 5,
    backgroundColor: "#E5E9FF",
  },

  skeletonOriginalPrice: {
    width: 34,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#F0F1F8",
  },

  skeletonCartRow: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginTop: 5,
  },

  skeletonCartHint: {
    flex: 1,
    maxWidth: "48%",
    height: 8,
    borderRadius: 5,
    backgroundColor: "#EEF0F8",
  },

  skeletonButton: {
    width: 68,
    height: 30,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "#DDE2FF",
  },

  skeletonButtonPlus: {
    width: 9,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#B8C0F6",
  },

  skeletonButtonPlusVertical: {
    position: "absolute",
    left: 26,
    width: 2,
    height: 9,
    borderRadius: 1,
    backgroundColor: "#B8C0F6",
  },

  skeletonButtonLabel: {
    width: 20,
    height: 6,
    borderRadius: 3,
    marginLeft: 3,
    backgroundColor: "#B8C0F6",
  },

  loadingContainer: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 58,

    height: 58,

    borderRadius: 20,

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.blueSoft,

    borderWidth: 1,

    borderColor: colors.borderLight,
  },

  loadingTitle: {
    marginTop: 16,

    fontSize: 16,

    fontWeight: "800",

    color: colors.text,
  },

  loadingText: {
    marginTop: 5,

    fontSize: 13,

    fontWeight: "500",

    color: colors.textSecondary,
  },

  alertBackdrop: {
    flex: 1,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 19, 55, 0.48)",
  },
  alertCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 27,
    paddingBottom: 20,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E5FF",
    overflow: "hidden",
    shadowColor: "#3F36C9",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0,
    shadowRadius: 24,
    elevation: 14,
  },
  alertGlow: {
    position: "absolute",
    width: 230,
    height: 120,
    top: -76,
    borderRadius: 100,
    backgroundColor: "#E8E8FF",
    opacity: 0.9,
  },
  alertIconWrap: {
    width: 66,
    height: 66,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#5A50EE",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0,
    shadowRadius: 12,
    elevation: 4,
  },
  alertIconSuccess: { backgroundColor: "#22C875" },
  alertIconError: { backgroundColor: "#F04460" },
  alertIconWarning: { backgroundColor: "#F5A524" },
  alertIconInfo: { backgroundColor: "#5145F5" },
  alertTitle: {
    color: "#171B48",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  alertMessage: {
    color: "#6B718D",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 21,
  },
  alertActions: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  alertButton: {
    minHeight: 45,
    flex: 1,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  alertButtonFull: { flex: 0, width: "100%" },
  alertButtonPrimary: {
    backgroundColor: "#5145F5",
    shadowColor: "#5145F5",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: Platform.OS === "ios" ? 0.18 : 0,
    shadowRadius: 8,
    elevation: 3,
  },
  alertButtonDanger: { backgroundColor: "#F04460" },
  alertButtonSecondary: {
    backgroundColor: "#F1F2FF",
    borderWidth: 1,
    borderColor: "#E3E5FF",
  },
  alertButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  alertButtonSecondaryText: { color: "#4B5074" },
  alertButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  alertShine: {
    position: "absolute",
    top: -30,
    bottom: -30,
    left: -75,
    width: 28,
    backgroundColor: "rgba(255,255,255,0.25)",
    transform: [{ skewX: "-18deg" }],
  },

  /* =======================================================

     PRESS

  ======================================================= */

  pressed: {
    opacity: 0.88,
  },

  listHeader: {
    paddingTop: 14,
    paddingBottom: 12,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#F1F3FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  titleAccent: {
    color: "#4338CA",
  },
  subtitleHeart: {
    color: "#4F46E5",
    fontWeight: "900",
  },
  headerAction: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAFE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  searchToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9FB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 9,
  },
  searchInput: {
    flex: 1,
    color: "#111A4A",
    fontSize: 14,
    paddingVertical: 0,
  },
  toolbarButton: {
    minHeight: 52,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E9FB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  toolbarButtonText: {
    color: "#111A4A",
    fontSize: 12,
    fontWeight: "800",
  },
  promoBannerFrame: {
    width: "100%",
    borderRadius: 22,
    marginBottom: 15,
    backgroundColor: "#5145F5",
    overflow: "hidden",
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DAD9FF",
  },
  bannerGlowOne: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -45,
    top: -95,
    backgroundColor: "#8D8BFF",
    opacity: 0.8,
  },
  bannerGlowTwo: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    right: 52,
    bottom: -105,
    backgroundColor: "#3025C9",
    opacity: 0.7,
  },
  bannerCopy: {
    flex: 1,
    paddingLeft: 15,
    paddingVertical: 12,
    zIndex: 2,
  },
  bannerEyebrow: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 7,
  },
  bannerEyebrowText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.45,
  },
  bannerTitleAccent: {
    color: "#FFF3A6",
  },
  bannerSubtitle: {
    color: "#E8E8FF",
    fontSize: 10,
    marginTop: 4,
    marginBottom: 9,
    fontWeight: "600",
    maxWidth: 185,
  },
  bannerCta: {
    alignSelf: "flex-start",
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
  },
  bannerCtaText: {
    color: "#3730A3",
    fontSize: 10,
    fontWeight: "900",
  },
  bannerArtwork: {
    width: "35%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },
  bannerBagHandle: {
    position: "absolute",
    width: 43,
    height: 34,
    borderWidth: 4,
    borderColor: "#D8D5FF",
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    top: "17%",
  },
  bannerBag: {
    width: 82,
    height: 92,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 17,
    transform: [{ rotate: "4deg" }],
    shadowColor: "#1E1B8D",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  bannerBagBrand: {
    color: "#4338F5",
    fontSize: 13,
    fontWeight: "900",
    marginTop: -2,
  },
  bannerSparkleOne: {
    position: "absolute",
    top: "17%",
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerSparkleTwo: {
    position: "absolute",
    bottom: "17%",
    left: 0,
  },
  bannerShineClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    borderRadius: 22,
  },
  bannerShine: {
    position: "absolute",
    top: -30,
    bottom: -30,
    width: 48,
    backgroundColor: "rgba(255,255,255,0.34)",
    opacity: 0.85,
  },
  categorySection: {
    marginTop: 2,
    marginBottom: 13,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    color: "#171B48",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  sectionHint: {
    color: "#737B9B",
    fontSize: 11,
    fontWeight: "700",
  },
  noResults: {
    width: "100%",
    minHeight: 230,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  noResultsIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF0FF",
    marginBottom: 12,
  },
  noResultsTitle: {
    color: "#171B48",
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  noResultsText: {
    color: "#737B9B",
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  resetFiltersButton: {
    marginTop: 15,
    minHeight: 40,
    borderRadius: 13,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#5145F5",
  },
  resetFiltersText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  categoryRow: {
    paddingBottom: 5,
    gap: 9,
    paddingRight: 4,
  },
  categoryChip: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7F8",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: "#4338F5",
    borderColor: "#4338F5",
  },
  categoryChipText: {
    color: "#30365F",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryCount: {
    color: "#737B9B",
    fontSize: 11,
    fontWeight: "600",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
});
