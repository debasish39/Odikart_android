import React, { useCallback, useEffect, useRef, useState } from "react";

import {
  Animated,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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

import { useFocusEffect, useRouter } from "expo-router";

import api from "../api/api";

import { colors } from "../theme/colors";

type WishlistProduct = {
  _id: string;

  name: string;

  image?: string;

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
  const cardImageSize = Math.min(
    190,
    Math.max(112, (screenWidth - 42) * 0.485),
  );
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

        <Pressable
          style={({ pressed }) => [
            styles.imageContainer,

            pressed && styles.pressed,
          ]}
          onPress={() => openProduct(item._id)}
        >
          {item.image ? (
            <Image
              source={{
                uri: item.image,
              }}
              style={styles.productImage}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={36}
                color={colors.textMuted}
              />

              <Text style={styles.placeholderText}>No image</Text>
            </View>
          )}

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
        </Pressable>

        {/* =================================================

            PRODUCT INFO

        ================================================= */}

        <View style={styles.productInfo}>
          <Pressable onPress={() => openProduct(item._id)}>
            {/* PRODUCT NAME */}

            <Text style={styles.productName} numberOfLines={2}>
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

          {/* ADD TO CART */}

          {/* <View style={styles.cartActionRow}>
            <Text style={styles.cartHint}>Add to cart</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to cart`}
              style={({ pressed }) => [
                styles.cartButton,
                pressed && styles.cartButtonPressed,
              ]}
              onPress={() => addToCart(item)}
              disabled={addingToCartId !== null}
              hitSlop={6}
            >
              {addingToCartId === item._id ? (
                <Animated.View style={styles.buttonPulse}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={colors.textWhite} />
                </Animated.View>
              ) : (
                <Ionicons name="add" size={23} color={colors.textWhite} />
              )}
            </Pressable>
          </View> */}
        </View>
      </View>
    );
  };

  /* =========================================================

     EMPTY WISHLIST

  ========================================================= */

  const WishlistSkeletonCard = () => (
    <View style={[styles.card, styles.skeletonCard]}>
      <View style={styles.skeletonImage}>
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
        <View style={styles.skeletonImageDot}>
          <Ionicons name="sparkles" size={17} color="#8A82FF" />
        </View>
      </View>

      <View style={styles.skeletonInfo}>
        <View style={[styles.skeletonLine, styles.skeletonLineLong]} />
        <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />

        <View style={styles.skeletonRatingRow}>
          <View style={styles.skeletonRating} />
          <View style={styles.skeletonReview} />
        </View>

        <View style={styles.skeletonPrice} />
        <View style={styles.skeletonCartRow}>
          <View style={styles.skeletonPriceSmall} />
          <View style={styles.skeletonButton}>
            <Ionicons name="add" size={20} color="#FFFFFF" />
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
        <Pressable
          style={styles.toolbarButton}
          onPress={() => setSelectedCategory("All")}
        >
          <Ionicons name="options-outline" size={18} color="#312E81" />
          <Text style={styles.toolbarButtonText}>Filter</Text>
        </Pressable>
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
    height: 120,

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

  productImage: {
    width: "99%",

    height: "92%",
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
    padding: 9,
  },

  productName: {
    // minHeight: 38,

    fontSize: 14,

    // lineHeight: 19,

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
    minHeight: 22,

    flexDirection: "row",

    alignItems: "center",

    gap: 3,

    paddingHorizontal: 7,

    paddingVertical: 4,

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
    fontSize: 17,

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
    minHeight: 36,
    marginTop: 7,
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
    width: 36,
    height: 34,
    zIndex: 2,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: Platform.OS === "ios" ? 0.16 : 0,
    shadowRadius: 6,
    elevation: Platform.OS === "android" ? 2 : 0,
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
    shadowOpacity: Platform.OS === "ios" ? 0.09 : 0,
    shadowRadius: 14,
    elevation: Platform.OS === "android" ? 3 : 0,
  },

  skeletonImage: {
    height: 120,
    backgroundColor: "#EEF1FF",
    overflow: "hidden",
    position: "relative",
  },

  skeletonImageGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F8F9FF",
    opacity: 0.75,
  },

  skeletonShine: {
    position: "absolute",
    top: -18,
    bottom: -18,
    left: 0,
    width: 62,
    backgroundColor: "rgba(255,255,255,0.92)",
    opacity: 0.9,
  },

  skeletonImageDot: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 13,
    top: 9,
    right: 9,
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.98)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#6B63FF",
    shadowOpacity: 0.22,
    shadowRadius: 9,
    elevation: 2,
  },

  skeletonInfo: {
    padding: 11,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#FFFFFF",
  },

  skeletonInfoShine: {
    position: "absolute",
    top: -20,
    bottom: -20,
    left: 0,
    width: 52,
    backgroundColor: "rgba(255,255,255,0.78)",
    opacity: 0.9,
  },

  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceSoft,
    marginBottom: 8,
  },

  skeletonLineLong: {
    width: "88%",
  },

  skeletonLineMedium: {
    width: "62%",
  },

  skeletonRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 10,
  },

  skeletonRating: {
    width: 46,
    height: 20,
    borderRadius: 7,
    backgroundColor: colors.surfaceSoft,
  },

  skeletonReview: {
    width: 48,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.surfaceSoft,
    marginLeft: 7,
  },

  skeletonPrice: {
    width: 72,
    height: 17,
    borderRadius: 6,
    backgroundColor: colors.surfaceSoft,
    marginBottom: 11,
  },

  skeletonCartRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },

  skeletonPriceSmall: {
    width: 62,
    height: 17,
    borderRadius: 6,
    backgroundColor: "#E5E7FF",
  },

  skeletonButton: {
    width: 36,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C7CBFF",
    borderWidth: 1,
    borderColor: "#B4BAFF",
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
