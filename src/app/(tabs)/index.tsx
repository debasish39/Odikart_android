import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient"; // npx expo install expo-linear-gradient
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Share from "react-native-share";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Reanimated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

// Animate the compact-header layout changes on Android as well as iOS.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Voice search needs a development build. In Expo Go (or if the package is missing) the mic button simply stays hidden.
let SpeechModule: any = null;
let useSpeechEvent: (name: string, cb: (e: any) => void) => void = () => {};
try {
  const speech = require("expo-speech-recognition");
  SpeechModule = speech.ExpoSpeechRecognitionModule;
  useSpeechEvent = speech.useSpeechRecognitionEvent;
} catch {}
const voiceAvailable = !!SpeechModule;

/**
 * Shared image component for Odikart.
 * Expo Image caches remote images in memory and on disk, so revisiting
 * screens does not need to download the same product/category/banner again.
 */
const CachedImage = React.memo(function CachedImage({
  resizeMode = "cover",
  ...props
}: any) {
  const contentFit =
    resizeMode === "contain"
      ? "contain"
      : resizeMode === "stretch"
        ? "fill"
        : resizeMode === "center"
          ? "none"
          : "cover";

  return (
    <ExpoImage
      {...props}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={180}
    />
  );
});

import { getMyAddresses, type Address } from "../../api/address";
import api from "../../api/api";
import {
  addToCart,
  decreaseCartItem,
  getCart,
  increaseCartItem,
} from "../../api/cart";
import { getCategories } from "../../api/categories";
import {
  addRecentlyViewedProduct,
  getBestSellerProducts,
  getDealProducts,
  getFeaturedProducts,
  getFlashSaleProducts,
  getLowStockProducts,
  getNewArrivalProducts,
  getPopularProducts,
  getProducts,
  getRecentlyViewedProducts,
  getRecommendedProducts,
  getTopRatedProducts,
  getTrendingProducts,
  trackProductEvent,
} from "../../api/products";
import {
  addToWishlist,
  getWishlist,
  getWishlistProductIds,
  removeFromWishlist,
} from "../../api/wishlist";
import { useAuth } from "../../hooks/useAuth";

/* =========================================================
   DESIGN TOKENS
   Odikart blue • indigo • violet visual system.
   Cool-tinted surfaces with a consistent brand accent.
========================================================= */

const C = {
  brand: "#312E81",
  brandDark: "#3730A3",
  brandSoft: "#EEF2FF",
  accent: "#7C3AED",
  star: "#F59E0B",
  bg: "#F7F8FC",
  surface: "#FFFFFF",
  ink: "#171A2B",
  inkSoft: "#667085",
  inkMuted: "#98A2B3",
  line: "#EAECF2",
  success: "#15803D",
  danger: "#DC2626",
  dangerSoft: "#FEE9E9",
};

const GUTTER = 16;
const GRID_GAP = 12;
const SHELF_CARD_W = 164;
// Category banners are reused instantly when shoppers revisit a category.
const categoryBannerMemoryCache = new Map<string, HomeBanner>();
const categoryBannerStorageKey = (categoryId: string) =>
  `odikart:category-banner:${categoryId}:v1`;

const BANNER_INTERVAL = 4500;
const TILE_TINTS = [
  "#E0E7FF",
  "#EDE9FE",
  "#EEF2FF",
  "#DBEAFE",
  "#F3F0FF",
  "#E0E7FF",
  "#EDE9FE",
];
const PAGE_SIZE = 12;
const SEARCH_PLACEHOLDERS = [
  "Search for snacks and pickles",
  "Find bulbs and home essentials",
  "Explore Odisha specialities",
  "Search products and brands",
  "Discover deals on Odikart",
];
const VOICE_LANGS = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "or-IN", label: "ଓଡ଼ିଆ" },
];
const voiceErrorText = (code?: string) =>
  code === "no-speech"
    ? "I didn't hear anything. Tap the mic and try again."
    : code === "not-allowed"
      ? "Microphone access is off. Enable it in Settings."
      : code === "language-not-supported"
        ? "This language isn't available on your phone."
        : code === "network"
          ? "Check your internet connection and try again."
          : "Couldn't hear you. Try again.";
const SORTS = [
  { key: "relevance", label: "Relevance" },
  { key: "priceLow", label: "Price: Low to High" },
  { key: "priceHigh", label: "Price: High to Low" },
  { key: "rating", label: "Top rated" },
  { key: "discount", label: "Biggest discount" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

/* =========================================================
   TYPES
========================================================= */

type Variant = {
  [key: string]: any;
  sku?: string;
  price?: number;
  originalPrice?: number;
  discountPercentage?: number;
  stock?: number;
  images?: string[];
  isActive?: boolean;
};

type Product = {
  _id: string;
  title: string;
  brand?: any;
  category?: any;
  subCategory?: any;
  createdAt?: string;
  analytics?: { sales?: number };
  weight?: string;
  netWeight?: string;
  unit?: string;
  variants?: Variant[];
  media?: { thumbnail?: string; images?: string[] };
  rating?: number;
  numReviews?: number;
  featured?: boolean;
  trending?: boolean;
  bestSeller?: boolean;
  isNewArrival?: boolean;
  isPopular?: boolean;
  isLowStock?: boolean;
};

type Category = {
  _id: string;
  name: string;
  image?: string | { url?: string; secure_url?: string };
  icon?: string;
};

const getCategoryImageUrl = (value: Category["image"]): string | undefined => {
  const candidate =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? value.secure_url || value.url
        : undefined;
  const url = typeof candidate === "string" ? candidate.trim() : "";
  return /^https?:\/\//i.test(url) ? url : undefined;
};

function CategoryHomeTile({
  category,
  index,
  onPress,
  compact = false,
  itemWidth,
}: {
  category: Category;
  index: number;
  onPress: () => void;
  compact?: boolean;
  itemWidth?: number;
}) {
  const imageUrl = getCategoryImageUrl(category.image);
  const [imageFailed, setImageFailed] = useState(false);
  const tileScale = useSharedValue(1);
  const tileAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tileScale.value }],
  }));
  const tapGesture = Gesture.Tap()
    .maxDuration(350)
    .onBegin(() => {
      tileScale.value = withSpring(0.96, {
        damping: 16,
        stiffness: 260,
      });
    })
    .onFinalize(() => {
      tileScale.value = withSpring(1, {
        damping: 13,
        stiffness: 220,
      });
    })
    .onEnd((_event, success) => {
      if (success) runOnJS(onPress)();
    });

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <GestureDetector gesture={tapGesture}>
      <Reanimated.View
        style={[
          compact
            ? s.catItemCompact
            : [s.catItem, itemWidth ? { width: itemWidth } : null],
          tileAnimatedStyle,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Shop ${category.name}`}
      >
        <View
          style={[
            compact ? s.catTileCompact : s.catTile,
            { backgroundColor: TILE_TINTS[index % TILE_TINTS.length] },
          ]}
        >
          {imageUrl && !imageFailed ? (
            <CachedImage
              key={imageUrl}
              source={{ uri: imageUrl }}
              style={compact ? s.catImageCompact : s.catImage}
              resizeMode="cover"
              onError={() => setImageFailed(true)}
              accessibilityLabel={`${category.name} category`}
            />
          ) : (
            <CachedImage
              source={require("../../../assets/images/all-category.webp")}
              style={compact ? s.catFallbackIconCompact : s.catFallbackIcon}
              resizeMode="contain"
              accessibilityLabel="All category image"
            />
          )}
        </View>
        <Text
          style={
            compact
              ? s.catNameCompact
              : [
                  s.catName,
                  {
                    color: C.ink,
                  },
                ]
          }
          numberOfLines={compact ? 1 : 2}
          ellipsizeMode="tail"
        >
          {category.name}
        </Text>
      </Reanimated.View>
    </GestureDetector>
  );
}

type SubCategory = {
  _id: string;
  name: string;
  image?: string;
  icon?: string;
  isActive?: boolean;
};

type LocationResult = {
  place_id: number;
  display_name: string;
  address?: Record<string, string | undefined>;
};

type ToastState = {
  visible: boolean;
  message: string;
  type: "success" | "error" | "info";
};

/* =========================================================
   PURE PRODUCT HELPERS
========================================================= */

const activeVariants = (p: Product) =>
  p.variants?.filter((v) => v.isActive !== false) ?? [];

const productImage = (p: Product) =>
  p.media?.thumbnail ||
  p.media?.images?.[0] ||
  p.variants?.find((v) => v.images?.length)?.images?.[0];

// Gather unique product images for swipeable card galleries.
const productImages = (p: Product) =>
  Array.from(
    new Set(
      [
        p.media?.thumbnail,
        ...(p.media?.images ?? []),
        ...(p.variants ?? []).flatMap((v) => v.images ?? []),
      ].filter(
        (uri): uri is string =>
          typeof uri === "string" && uri.trim().length > 0,
      ),
    ),
  );

const productPrice = (p: Product) => {
  const prices = activeVariants(p)
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return prices.length ? Math.min(...prices) : 0;
};

const productOriginalPrice = (p: Product) => {
  const prices = activeVariants(p)
    .map((v) => Number(v.originalPrice))
    .filter((n) => Number.isFinite(n) && n > 0);
  return prices.length ? Math.min(...prices) : null;
};

const productDiscount = (p: Product) => {
  const d = activeVariants(p)
    .map((v) => Number(v.discountPercentage))
    .filter((n) => Number.isFinite(n) && n > 0);
  return d.length ? Math.max(...d) : 0;
};

// Missing stock info is treated as "available", not "zero".
const isOutOfStock = (p: Product) => {
  const vs = activeVariants(p);
  if (vs.length === 0) return false;
  if (!vs.some((v) => v.stock !== undefined && v.stock !== null)) return false;
  return vs.every(
    (v) => v.stock !== undefined && v.stock !== null && Number(v.stock) <= 0,
  );
};

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const sortProducts = (list: Product[], key: SortKey) => {
  const a = [...list];
  if (key === "priceLow") a.sort((x, y) => productPrice(x) - productPrice(y));
  else if (key === "priceHigh")
    a.sort((x, y) => productPrice(y) - productPrice(x));
  else if (key === "rating")
    a.sort((x, y) => (y.rating || 0) - (x.rating || 0));
  else if (key === "discount")
    a.sort((x, y) => productDiscount(y) - productDiscount(x));
  return a;
};

/* =========================================================
   SMALL COMPONENTS
========================================================= */

// One shared pulse drives every skeleton block, so they all breathe in sync and only one animation runs.
const sharedPulse = new Animated.Value(0.55);
let pulseUsers = 0;
let pulseAnim: Animated.CompositeAnimation | null = null;

function usePulse() {
  useEffect(() => {
    pulseUsers += 1;
    if (pulseUsers === 1) {
      pulseAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(sharedPulse, {
            toValue: 1,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(sharedPulse, {
            toValue: 0.55,
            duration: 750,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnim.start();
    }
    return () => {
      pulseUsers -= 1;
      if (pulseUsers === 0) {
        pulseAnim?.stop();
        pulseAnim = null;
      }
    };
  }, []);
  return sharedPulse;
}

function Skeleton({
  width = "100%",
  height = 14,
  radius = 8,
  style,
  tone = "default",
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: any;
  tone?: "default" | "light";
}) {
  const opacity = usePulse();
  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: "#E5E7EB",
          opacity,
        },
        style,
      ]}
    />
  );
}

function ShineLayer({
  value,
  phase = 0,
  from = -80,
  to = 220,
  height = 260,
}: {
  value: Animated.Value;
  phase?: number;
  from?: number;
  to?: number;
  height?: number;
}) {
  const p = Animated.modulo(Animated.add(value, phase), 1);
  const translateX = p.interpolate({
    inputRange: [0, 1],
    outputRange: [from, to],
  });
  const opacity = p.interpolate({
    inputRange: [0, 0.1, 0.3, 0.45, 0.6, 1],
    outputRange: [0, 0, 0.35, 0.6, 0, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        s.shine,
        { height, opacity, transform: [{ translateX }, { rotate: "18deg" }] },
      ]}
    />
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast.visible) return null;
  const icon =
    toast.type === "success"
      ? "checkmark-circle"
      : toast.type === "error"
        ? "alert-circle"
        : "information-circle";
  const tint =
    toast.type === "success"
      ? "#4ADE80"
      : toast.type === "error"
        ? "#F87171"
        : "#A5B4FC";
  return (
    <View
      pointerEvents="none"
      style={s.toastWrap}
      accessibilityLiveRegion="polite"
    >
      <View style={s.toast}>
        <Ionicons name={icon as any} size={20} color={tint} />
        <Text style={s.toastText} numberOfLines={1} ellipsizeMode="tail">
          {toast.message}
        </Text>
      </View>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={s.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {/* {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={10}
          style={s.seeAll}
          accessibilityRole="button"
          accessibilityLabel={`See all ${title}`}
        >
          <Text style={s.seeAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={C.brand} />
        </Pressable>
      ) : null} */}
    </View>
  );
}

function SectionTitleSkeleton() {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Skeleton width={150} height={18} radius={6} />
        <Skeleton width={110} height={11} radius={5} style={{ marginTop: 7 }} />
      </View>
      <Skeleton width={56} height={13} radius={5} />
    </View>
  );
}

function ShelfSkeleton() {
  return (
    <View style={s.shelf}>
      <SectionTitleSkeleton />

      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.shelfList}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <ProductSkeleton key={`shelf-skeleton-${i}`} width={SHELF_CARD_W} />
        ))}
      </ScrollView>
    </View>
  );
}

function GridSkeleton({
  width,
  count = 12,
}: {
  width: number;
  count?: number;
}) {
  return (
    <View style={s.grid}>
      {Array.from({ length: count }, (_, i) => (
        <ProductSkeleton key={`grid-skeleton-${i}`} width={width} />
      ))}
    </View>
  );
}

// Mirrors the real layout block for block: header, search, banner, categories, shelf, grid.
function CategoryGridSkeleton() {
  return (
    <View>
      <View style={s.categorySectionHeader}>
        <View style={{ flex: 1 }}>
          <Skeleton width={154} height={19} radius={6} />
          <Skeleton
            width={188}
            height={11}
            radius={5}
            style={{ marginTop: 7 }}
          />
        </View>
        <Skeleton width={62} height={12} radius={5} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catGrid}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: 8 }, (_, i) => i + 1).map((i) => (
          <View key={i} style={s.catItem}>
            <View style={s.skeletonCategoryTile}>
              <Skeleton width={36} height={36} radius={12} />
            </View>
            <Skeleton
              width={48 + (i % 3) * 8}
              height={10}
              radius={5}
              style={{ marginTop: 9 }}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function HomeSkeleton({
  banners = [],
}: {
  banners?: Array<{ id: string; imageUrl?: string; label?: string }>;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const categoryWidth = Math.floor((width - GUTTER * 2 - 4 * 8) / 5);
  const bannerHeight = Math.min(310, Math.max(250, Math.round(width * 0.49)));

  return (
    <View style={{ flex: 1, backgroundColor: "#312E81" }}>
      <SafeAreaView
        style={[s.root, { backgroundColor: "#312E81" }]}
        edges={["top", "left", "right"]}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: "#FFFFFF" }}
          contentContainerStyle={{
            paddingBottom: 112,
            backgroundColor: "#FFFFFF",
          }}
        >
          {/* Skeleton header mirrors the live solid-indigo delivery header. */}
          <View
            style={[
              s.headerHero,
              { paddingTop: 8, paddingBottom: 15, backgroundColor: "#312E81" },
            ]}
          >
            <View
              style={{
                minHeight: 58,
                paddingHorizontal: GUTTER,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View
                style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: "rgba(255,255,255,0.16)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 11,
                  }}
                >
                  <Skeleton width={21} height={21} radius={7} />
                </View>
                <View style={{ flex: 1 }}>
                  <Skeleton width={64} height={10} radius={4} />
                  <Skeleton
                    width="78%"
                    height={15}
                    radius={5}
                    style={{ marginTop: 7 }}
                  />
                </View>
              </View>
              {[0, 1].map((item) => (
                <View
                  key={`header-action-${item}`}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: "rgba(255,255,255,0.16)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: 9,
                  }}
                >
                  <Skeleton width={20} height={20} radius={10} />
                </View>
              ))}
            </View>
          </View>

          {/* White curved search surface */}
          <View
            style={{
              marginTop: -1,
              backgroundColor: "#FFFFFF",
              borderTopLeftRadius: 34,
              borderTopRightRadius: 34,
              paddingTop: 12,
              paddingBottom: 12,
            }}
          >
            <View style={{ paddingHorizontal: GUTTER }}>
              <View
                style={{
                  height: 54,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#ECEEF4",
                  backgroundColor: "#FFFFFF",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 18,
                }}
              >
                <Skeleton width={25} height={25} radius={13} />
                <Skeleton
                  width="65%"
                  height={17}
                  radius={6}
                  style={{ marginLeft: 18 }}
                />
                <View
                  style={{
                    marginLeft: "auto",
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    backgroundColor: "#F3F4F6",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Skeleton width={19} height={19} radius={10} />
                </View>
              </View>
            </View>

            {/* Category image and label placeholders */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: GUTTER,
                paddingTop: 20,
                gap: 8,
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {Array.from({ length: 7 }, (_, i) => (
                <View
                  key={`home-category-skeleton-${i}`}
                  style={{ width: categoryWidth, alignItems: "center" }}
                >
                  <View
                    style={{
                      width: 68,
                      height: 68,
                      borderRadius: 17,
                      backgroundColor: "#F5F6FA",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Skeleton width={47} height={47} radius={13} />
                  </View>
                  <Skeleton
                    width={i === 4 ? 66 : 54 + (i % 3) * 7}
                    height={12}
                    radius={5}
                    style={{ marginTop: 9 }}
                  />
                  {i === 0 ? (
                    <LinearGradient
                      colors={["#E5E7EB", "#E5E7EB"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: 68,
                        height: 4,
                        borderRadius: 4,
                        marginTop: 8,
                      }}
                    />
                  ) : (
                    <View style={{ height: 12 }} />
                  )}
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Show the cached first banner during product loading instead of
              hiding the carousel behind a skeleton. */}
          <View style={{ paddingHorizontal: GUTTER, paddingTop: 12 }}>
            {banners[0]?.imageUrl ? (
              <View
                style={{
                  height: bannerHeight,
                  borderRadius: 28,
                  overflow: "hidden",
                  backgroundColor: "#EEF2FF",
                }}
              >
                <ExpoImage
                  source={{ uri: banners[0].imageUrl }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  priority="high"
                  transition={120}
                />
              </View>
            ) : (
              <Skeleton height={bannerHeight} radius={28} />
            )}
          </View>

          {/* Product shelf placeholders */}
          {[176, 132, 160, 148].map((titleWidth, shelfIndex) => (
            <View
              key={`home-shelf-skeleton-${shelfIndex}`}
              style={[s.shelf, { marginTop: 24 }]}
            >
              <View style={{ paddingHorizontal: GUTTER, marginBottom: 12 }}>
                <Skeleton width={titleWidth} height={23} radius={6} />
                <Skeleton
                  width={190}
                  height={13}
                  radius={5}
                  style={{ marginTop: 8 }}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.shelfList}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <ProductSkeleton
                    key={`home-shelf-${shelfIndex}-product-${i}`}
                    width={SHELF_CARD_W}
                  />
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* =========================================================
   PRODUCT CARD
========================================================= */

function ProductSkeleton({ width }: { width: number }) {
  return (
    <View
      style={[s.card, { width }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {/* Product media area */}
      <View style={s.skeletonProductMedia}>
        <Skeleton height={108} radius={12} />
        <View style={s.skeletonWishlist}>
          <Skeleton width={27} height={27} radius={14} />
        </View>
        <View style={s.skeletonDiscount}>
          <Skeleton width={38} height={10} radius={5} />
        </View>
      </View>

      {/* Keep the same rhythm as the real product title, price and action */}
      <View style={{ paddingTop: 8 }}>
        <Skeleton width="42%" height={9} radius={5} />
        <Skeleton width="92%" height={12} radius={5} style={{ marginTop: 9 }} />
        <Skeleton width="68%" height={12} radius={5} style={{ marginTop: 6 }} />
        <View style={s.skeletonPriceRow}>
          <Skeleton width="38%" height={15} radius={5} />
          <Skeleton width="25%" height={10} radius={5} />
        </View>
        <Skeleton height={32} radius={9} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

type CardProps = {
  product: Product;
  width: number;
  quantity: number;
  wished: boolean;
  wishBusy: boolean;
  onOpen: () => void;
  onLongPress: () => void;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  onWish: () => void;
  shine: Animated.Value | null;
  index: number;
};

const ProductCard = React.memo(function ProductCard(p: CardProps) {
  const { product } = p;
  const images = productImages(product);
  const image = images[0] || productImage(product);
  const imageSize = Math.max(100, p.width - 16);
  const imageHeight = Math.min(136, Math.max(108, Math.round(imageSize * 0.8)));
  const price = productPrice(product);
  const original = productOriginalPrice(product);
  const discount = productDiscount(product);
  const out = isOutOfStock(product);
  const pop = useRef(new Animated.Value(1)).current;
  const addPop = useRef(new Animated.Value(1)).current;
  const cardScale = useSharedValue(1);
  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const cardGalleryRef = useRef<ScrollView>(null);
  const productUnit = product.weight || product.netWeight || product.unit || "";

  // Reset the gallery whenever a recycled card receives another product.
  useEffect(() => {
    setActiveImageIndex(0);
  }, [product._id]);

  // Keep the image counter in sync without causing duplicate renders.
  const updateActiveImage = useCallback(
    (offsetX: number) => {
      const nextIndex = Math.max(
        0,
        Math.min(Math.round(offsetX / imageSize), images.length - 1),
      );
      setActiveImageIndex((current) =>
        current === nextIndex ? current : nextIndex,
      );
    },
    [imageSize, images.length],
  );

  const goToCardImage = useCallback(
    (nextIndex: number) => {
      const safeIndex = Math.max(0, Math.min(nextIndex, images.length - 1));
      cardGalleryRef.current?.scrollTo({
        x: safeIndex * imageSize,
        y: 0,
        animated: true,
      });
      setActiveImageIndex(safeIndex);
    },
    [imageSize, images.length],
  );

  const imageKeyExtractor = useCallback(
    (_uri: string, index: number) => `${product._id}-card-image-${index}`,
    [product._id],
  );

  const renderCardImage = useCallback(
    ({ item: uri, index }: { item: string; index: number }) => (
      <View
        style={{
          width: imageSize,
          height: imageHeight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CachedImage
          source={{ uri }}
          style={[
            s.cardImage,
            { width: imageSize, height: imageHeight },
            out && { opacity: 0.45 },
          ]}
          resizeMode="contain"
          accessibilityLabel={`${product.title}, image ${index + 1}`}
        />
      </View>
    ),
    [imageSize, imageHeight, out, product.title],
  );

  const heartRotation = pop.interpolate({
    inputRange: [1, 1.3],
    outputRange: ["0deg", "-12deg"],
  });

  const popHeart = useCallback(() => {
    pop.setValue(1);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(pop, {
          toValue: 1.38,
          speed: 42,
          bounciness: 15,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(pop, {
        toValue: 1,
        speed: 18,
        bounciness: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop]);

  const animateAddToCart = useCallback(() => {
    addPop.setValue(0.82);
    Animated.sequence([
      Animated.spring(addPop, {
        toValue: 1.12,
        speed: 38,
        bounciness: 14,
        useNativeDriver: true,
      }),
      Animated.spring(addPop, {
        toValue: 1,
        speed: 20,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
    p.onAdd();
  }, [addPop, p.onAdd]);

  return (
    <Reanimated.View
      entering={FadeInDown.delay(Math.min(Math.max(p.index, 0), 6) * 42)
        .duration(360)
        .springify()
        .damping(18)}
      style={[{ width: p.width }, cardAnimatedStyle]}
    >
      <Pressable
        onPress={p.onOpen}
        onPressIn={() => {
          cardScale.value = withSpring(0.975, {
            damping: 16,
            stiffness: 280,
          });
        }}
        onPressOut={() => {
          cardScale.value = withSpring(1, {
            damping: 14,
            stiffness: 220,
          });
        }}
        onLongPress={p.onLongPress}
        delayLongPress={250}
        accessibilityHint="Press and hold to preview this product"
        accessibilityRole="button"
        accessibilityLabel={`${product.title}, ${money(price)}${out ? ", out of stock" : ""}`}
        style={[s.card, { width: "100%" }]}
      >
        <View
          style={[s.cardImageWrap, { width: imageSize, height: imageHeight }]}
        >
          {images.length > 0 ? (
            <ScrollView
              ref={cardGalleryRef}
              key={`${product._id}-gallery-${images.length}`}
              horizontal
              pagingEnabled
              snapToInterval={imageSize}
              snapToAlignment="start"
              decelerationRate="fast"
              directionalLockEnabled
              nestedScrollEnabled
              scrollEnabled={images.length > 1}
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(event) =>
                updateActiveImage(event.nativeEvent.contentOffset.x)
              }
              onMomentumScrollEnd={(event) =>
                updateActiveImage(event.nativeEvent.contentOffset.x)
              }
              onScrollEndDrag={(event) =>
                updateActiveImage(event.nativeEvent.contentOffset.x)
              }
              style={s.cardImageCarousel}
            >
              {images.map((uri, index) => (
                <View
                  key={`${product._id}-card-image-${index}`}
                  style={{
                    width: imageSize,
                    height: imageHeight,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CachedImage
                    source={{ uri }}
                    style={[
                      s.cardImage,
                      { width: imageSize, height: imageHeight },
                      out && { opacity: 0.45 },
                    ]}
                    resizeMode="contain"
                    accessibilityLabel={`${product.title}, image ${index + 1}`}
                  />
                </View>
              ))}
            </ScrollView>
          ) : image ? (
            <CachedImage
              source={{ uri: image }}
              style={[
                s.cardImage,
                { width: imageSize, height: imageHeight },
                out && { opacity: 0.45 },
              ]}
              resizeMode="contain"
            />
          ) : (
            <View style={s.cardImagePlaceholder}>
              <Ionicons name="image-outline" size={26} color={C.inkMuted} />
            </View>
          )}

          {images.length > 1 ? (
            <View
              pointerEvents="none"
              style={s.imageCountBadge}
              accessibilityLabel={`Image ${activeImageIndex + 1} of ${images.length}`}
            >
              <Text style={s.imageCountText}>
                {activeImageIndex + 1} / {images.length}
              </Text>
            </View>
          ) : null}

          {discount > 0 ? (
            <View style={s.discountBadge}>
              <Text style={s.discountBadgeText}>
                {Math.round(discount)}% OFF
              </Text>
            </View>
          ) : null}

          <Pressable
            hitSlop={8}
            disabled={p.wishBusy}
            onPress={(e) => {
              e.stopPropagation?.();
              if (!p.wished) popHeart();
              p.onWish();
            }}
            accessibilityRole="button"
            accessibilityLabel={
              p.wished ? "Remove from wishlist" : "Add to wishlist"
            }
            style={({ pressed }) => [
              s.wishBtn,
              pressed && { transform: [{ scale: 0.92 }] },
            ]}
          >
            <Animated.View
              style={{
                transform: [{ scale: pop }, { rotate: heartRotation }],
              }}
            >
              <Ionicons
                name={p.wished ? "heart" : "heart-outline"}
                size={20}
                color={p.wished ? C.danger : "#7B8194"}
              />
            </Animated.View>
          </Pressable>
        </View>

        <View style={s.cardBody}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {product.title}
          </Text>
          {productUnit ? (
            <Text style={s.cardUnit} numberOfLines={1}>
              {productUnit}
            </Text>
          ) : null}

          <View style={s.cardPriceRow}>
            <Text style={s.price} numberOfLines={1}>
              {money(price)}
            </Text>
            {original !== null && original > price ? (
              <Text style={s.originalPrice} numberOfLines={1}>
                {money(original)}
              </Text>
            ) : null}
          </View>

          <View style={s.cardMetaRow}>
            {typeof product.rating === "number" && product.rating > 0 ? (
              <View style={s.ratingRow}>
                <Ionicons name="star" size={13} color={C.star} />
                <Text style={s.ratingText}>{product.rating.toFixed(1)}</Text>
                {typeof product.numReviews === "number" ? (
                  <Text style={s.reviewCount}>({product.numReviews})</Text>
                ) : null}
              </View>
            ) : (
              <Text style={s.newTag}>New</Text>
            )}

            {out ? (
              <View style={s.outPill}>
                <Text style={s.outText}>Sold out</Text>
              </View>
            ) : p.quantity > 0 ? (
              <LinearGradient
                colors={["#2563EB", "#312E81", "#7C3AED"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.stepper}
              >
                <Pressable
                  hitSlop={6}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    p.onDecrease();
                  }}
                  style={s.stepBtn}
                  accessibilityLabel="Decrease quantity"
                >
                  <Ionicons name="remove" size={15} color="#fff" />
                </Pressable>
                <Text style={s.stepQty}>{p.quantity}</Text>
                <Pressable
                  hitSlop={6}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    p.onIncrease();
                  }}
                  style={s.stepBtn}
                  accessibilityLabel="Increase quantity"
                >
                  <Ionicons name="add" size={15} color="#fff" />
                </Pressable>
              </LinearGradient>
            ) : (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  animateAddToCart();
                }}
                accessibilityLabel={`Add ${product.title} to cart`}
                style={({ pressed }) => [pressed && { opacity: 0.88 }]}
              >
                <Animated.View style={{ transform: [{ scale: addPop }] }}>
                  <LinearGradient
                    colors={["#2563EB", "#312E81", "#7C3AED"]}
                    locations={[0, 0.52, 1]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={s.addBtn}
                  >
                    <Ionicons name="add" size={19} color="#fff" />
                    <Text style={s.addBtnText}>ADD</Text>
                  </LinearGradient>
                </Animated.View>
              </Pressable>
            )}
          </View>
        </View>

        {p.shine ? (
          <ShineLayer
            value={p.shine}
            phase={(p.index % 6) * 0.12}
            to={p.width + 40}
          />
        ) : null}
      </Pressable>
    </Reanimated.View>
  );
});

/* =========================================================
   HOME SCREEN DATA CACHE
   Keeps loaded home data in memory when navigating between tabs.
========================================================= */
const homeProductsCache = new Map<string, Product[]>();
let homeCategoriesCache: Category[] | null = null;
type ShelfKey =
  | "trending"
  | "bestSellers"
  | "popular"
  | "topRated"
  | "newArrivals"
  | "featured"
  | "recommended"
  | "flashSales"
  | "deals"
  | "lowStock"
  | "recentlyViewed";
type HomeShelves = Record<ShelfKey, Product[]>;
const EMPTY_HOME_SHELVES: HomeShelves = {
  trending: [],
  bestSellers: [],
  popular: [],
  topRated: [],
  newArrivals: [],
  featured: [],
  recommended: [],
  flashSales: [],
  deals: [],
  lowStock: [],
  recentlyViewed: [],
};
const homeShelfCache = new Map<ShelfKey, Product[]>();
const HOME_PRODUCTS_STORAGE_KEY = "odikart:home-products:v2";
const HOME_CATEGORIES_STORAGE_KEY = "odikart:home-categories:v1";
const HOME_SHELVES_STORAGE_KEY = "odikart:home-shelves:v2";
const HOME_BANNERS_STORAGE_KEY = "odikart:home-banners:v1";
let homeBannersMemoryCache: HomeBanner[] = [];


type PersistedCache<T> = { savedAt: number; data: T };

async function readHomeCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCache<T>;
    if (!parsed || typeof parsed.savedAt !== "number" || !("data" in parsed))
      return null;
    // Even stale data is useful for a fast first paint; refresh happens in background.
    return parsed.data ?? null;
  } catch (error) {
    console.log("HOME CACHE READ ERROR:", error);
    return null;
  }
}

// Reuse recent cached responses for 5 minutes. Pull-to-refresh bypasses this
// check so shoppers can always request fresh server data.
const HOME_CACHE_TTL_MS = 5 * 60 * 1000;

async function isHomeCacheFresh(
  key: string,
  maxAgeMs = HOME_CACHE_TTL_MS,
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as PersistedCache<unknown>;
    return (
      typeof parsed?.savedAt === "number" &&
      Date.now() - parsed.savedAt >= 0 &&
      Date.now() - parsed.savedAt < maxAgeMs &&
      "data" in parsed
    );
  } catch {
    return false;
  }
}

async function writeHomeCache<T>(key: string, data: T): Promise<void> {
  try {
    const payload: PersistedCache<T> = { savedAt: Date.now(), data };
    await AsyncStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    // Cache failures must never break shopping or API loading.
    console.log("HOME CACHE WRITE ERROR:", error);
  }
}

/* =========================================================
   HOME SCREEN
========================================================= */

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const headerSurfaceProgress = useRef(new Animated.Value(0)).current;
  const whiteSurfaceOpacity = headerSurfaceProgress.interpolate({
    inputRange: [0, 36, 84],
    outputRange: [0, 0.55, 1],
    extrapolate: "clamp",
  });
  const { isAuthenticated } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const gridCardW = Math.floor((screenWidth - GUTTER * 2 - GRID_GAP) / 2);
  const bannerHeight = Math.min(
    218,
    Math.max(174, Math.round(screenWidth * 0.49)),
  );

  const [products, setProducts] = useState<Product[]>(
    () => homeProductsCache.get("") ?? [],
  );
  const [categories, setCategories] = useState<Category[]>(
    () => homeCategoriesCache ?? [],
  );
  const [shelfProducts, setShelfProducts] = useState<HomeShelves>(() => ({
    ...EMPTY_HOME_SHELVES,
    ...Object.fromEntries(
      (Object.keys(EMPTY_HOME_SHELVES) as ShelfKey[]).map((key) => [
        key,
        homeShelfCache.get(key) ?? [],
      ]),
    ),
  }));
  const [shelvesLoading, setShelvesLoading] = useState(
    () =>
      !(Object.keys(EMPTY_HOME_SHELVES) as ShelfKey[]).some((key) =>
        homeShelfCache.has(key),
      ),
  );
  const [initialLoading, setInitialLoading] = useState(
    () => !homeProductsCache.has(""),
  );
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(
    () => homeCategoriesCache === null,
  );
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchPlaceholderIndex, setSearchPlaceholderIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<
    "category" | "subcategory" | "brand" | "price" | "sort"
  >("category");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [allProductsOffset, setAllProductsOffset] = useState(0);
  const [selectedSubCategory, setSelectedSubCategory] = useState("All");
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [minPriceInput, setMinPriceInput] = useState("0");
  const [maxPriceInput, setMaxPriceInput] = useState("5000");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Load subcategories from the backend instead of deriving them from the
  // currently loaded/paginated products.
  useEffect(() => {
    if (!filterOpen && selectedCategory === "All") return;

    let isActive = true;

    const loadSubCategories = async () => {
      setSubCategoriesLoading(true);

      try {
        const categoryIds =
          selectedCategory === "All"
            ? categories.map((item) => String(item._id)).filter(Boolean)
            : [selectedCategory];

        if (categoryIds.length === 0) {
          if (isActive) setSubCategories([]);
          return;
        }

        const responses = await Promise.all(
          categoryIds.map(async (categoryId) => {
            try {
              const response = await api.get(
                `/category/${encodeURIComponent(categoryId)}/subcategories`,
              );
              const result = response?.data;

              const list =
                result?.subCategories ??
                result?.subcategories ??
                result?.data?.subCategories ??
                result?.data?.subcategories ??
                result?.data ??
                (Array.isArray(result) ? result : []);

              return Array.isArray(list) ? list : [];
            } catch (requestError: any) {
              console.log("========== SUBCATEGORY API ERROR ==========");
              console.log("Category ID:", categoryId);
              console.log("Request URL:", requestError?.config?.baseURL);
              console.log("Request Path:", requestError?.config?.url);
              console.log("Error Message:", requestError?.message);
              console.log("Response:", requestError?.response?.data);
              console.log("Status:", requestError?.response?.status);
              console.log("============================================");

              return [];
            }
          }),
        );

        const unique = new Map<string, SubCategory>();

        responses.flat().forEach((item: any) => {
          if (item?._id && item?.name && item?.isActive !== false) {
            unique.set(String(item._id), {
              _id: String(item._id),
              name: String(item.name),
              image:
                typeof item.image === "string"
                  ? item.image
                  : typeof item.image?.url === "string"
                    ? item.image.url
                    : undefined,
              icon: typeof item.icon === "string" ? item.icon : undefined,
              isActive: item.isActive,
            });
          }
        });

        if (isActive) {
          setSubCategories(
            Array.from(unique.values()).sort((a, b) =>
              a.name.localeCompare(b.name),
            ),
          );
        }
      } catch (requestError: any) {
        console.error(
          "LOAD SUBCATEGORIES ERROR:",
          requestError?.response?.data || requestError?.message,
        );
        if (isActive) setSubCategories([]);
      } finally {
        if (isActive) setSubCategoriesLoading(false);
      }
    };

    void loadSubCategories();

    return () => {
      isActive = false;
    };
  }, [filterOpen, selectedCategory, categories]);

  // Cycle through helpful search examples while the search field is idle.
  // Pause the animation while the shopper types or focuses the input.
  useEffect(() => {
    if (searchFocused || search.trim().length > 0) return;

    const placeholderTimer = setInterval(() => {
      setSearchPlaceholderIndex(
        (current) => (current + 1) % SEARCH_PLACEHOLDERS.length,
      );
    }, 2200);

    return () => clearInterval(placeholderTimer);
  }, [searchFocused, search]);
  const mainRef = useRef<ScrollView>(null);
  const filterRowMeasureRef = useRef<View>(null);
  // Measure the actual sticky search navbar instead of relying on a fixed 74px.
  const [stickySearchHeight, setStickySearchHeight] = useState(80);
  const [headerHeroHeight, setHeaderHeroHeight] = useState(0);
  const [filterRowThreshold, setFilterRowThreshold] = useState<number | null>(
    null,
  );
  const [showStickyFilters, setShowStickyFilters] = useState(false);
  const currentScrollY = useRef(0);
  const topVisible = useRef(false);
  const [showTop, setShowTop] = useState(false);

  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: "",
    type: "info",
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the native Android toast for every app message so it matches
  // the system-style "Press again to exit" feedback. Keep the custom
  // toast UI on iOS, where ToastAndroid is not available.
  const showToast = (message: string, type: ToastState["type"] = "info") => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }

    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message, type });
    toastTimer.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      2400,
    );
  };

  /* ---------- location ---------- */
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const previewCarouselWidth = Math.max(180, Math.min(screenWidth - 84, 420));
  const [locationOpen, setLocationOpen] = useState(false);
  const [permissionPrompt, setPermissionPrompt] = useState<
    "location" | "notifications" | null
  >(null);
  const [permissionPromptBusy, setPermissionPromptBusy] = useState(false);
  const [
    showNotificationAfterLocationPicker,
    setShowNotificationAfterLocationPicker,
  ] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Select location");
  // Prevent the denied-permission Settings alert from reopening on every Home focus.
  const locationPermissionAlertShown = useRef(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Show a branded permission explanation once, before the shopper starts browsing.
  // The OS permission prompt is requested only after the shopper taps the action.
  useEffect(() => {
    let active = true;
    const initializePermissionPrompts = async () => {
      try {
        const alreadySeen = await AsyncStorage.getItem(
          "odikart:permission-intro-seen:v1",
        );
        if (alreadySeen === "1") return;

        const [locationPermission, notificationPermission] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Notifications.getPermissionsAsync(),
        ]);
        if (!active) return;

        if (locationPermission.status !== Location.PermissionStatus.GRANTED) {
          setPermissionPrompt("location");
        } else if (!notificationPermission.granted) {
          setPermissionPrompt("notifications");
        } else {
          await AsyncStorage.setItem("odikart:permission-intro-seen:v1", "1");
        }
      } catch (error) {
        console.log("PERMISSION INTRO INITIALIZATION ERROR:", error);
      }
    };

    void initializePermissionPrompts();
    return () => {
      active = false;
    };
  }, []);

  const finishPermissionIntro = async () => {
    setPermissionPrompt(null);
    try {
      await AsyncStorage.setItem("odikart:permission-intro-seen:v1", "1");
    } catch (error) {
      console.log("PERMISSION INTRO STORAGE ERROR:", error);
    }
  };

  const continueToNotificationPrompt = () => {
    setPermissionPrompt("notifications");
  };

  const handleEnableLocationFromIntro = async () => {
    if (permissionPromptBusy) return;
    setPermissionPromptBusy(true);
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status === Location.PermissionStatus.GRANTED) {
        setPermissionPrompt("notifications");
        void useCurrentLocation();
      } else {
        showToast(
          result.canAskAgain
            ? "Location permission wasn't enabled. You can try again."
            : "Enable location permission in your phone settings.",
          "info",
        );
      }
    } catch (error) {
      console.log("LOCATION INTRO PERMISSION ERROR:", error);
      showToast("Couldn't request location permission. Try again.", "error");
    } finally {
      setPermissionPromptBusy(false);
    }
  };

  const handleEnableNotificationsFromIntro = async () => {
    if (permissionPromptBusy) return;
    setPermissionPromptBusy(true);
    try {
      const current = await Notifications.getPermissionsAsync();
      const result = current.granted
        ? current
        : await Notifications.requestPermissionsAsync();

      if (result.granted) {
        await finishPermissionIntro();
      } else {
        showToast(
          "Notifications are still off. You can enable them later in Settings.",
          "info",
        );
        await finishPermissionIntro();
      }
    } catch (error) {
      console.log("NOTIFICATION INTRO PERMISSION ERROR:", error);
      showToast(
        "Couldn't request notification permission. Try again.",
        "error",
      );
    } finally {
      setPermissionPromptBusy(false);
    }
  };

  // Re-check delivery location whenever Home becomes focused.
  // If the header still has no location, retry GPS instead of attempting it only once
  // at app launch. A manually selected/saved location is never overwritten.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const ensureDeliveryLocation = async () => {
        if (selectedLocation !== "Select location") return;

        try {
          const permission = await Location.getForegroundPermissionsAsync();
          if (cancelled) return;

          if (permission.status === Location.PermissionStatus.GRANTED) {
            locationPermissionAlertShown.current = false;
            // Permission is already granted (including an active "Only this time"
            // grant). Resolve the delivery location without showing another prompt.
            requestAnimationFrame(() => {
              if (!cancelled) void useCurrentLocation();
            });
            return;
          }

          // Permission onboarding is handled by the branded modal below.
          // Do not trigger a competing native dialog or Alert from this focus effect.
          return;
        } catch (error) {
          console.log("LOCATION PERMISSION / INITIAL LOCATION ERROR:", error);
        }
      };

      void ensureDeliveryLocation();
      return () => {
        cancelled = true;
      };
    }, [selectedLocation]),
  );

  /* ---------- cart + wishlist ---------- */
  const [cartItems, setCartItems] = useState<any[]>([]);
  const cartItemsRef = useRef<any[]>([]);
  const [variantPickerProduct, setVariantPickerProduct] =
    useState<Product | null>(null);
  const [selectedPickerSku, setSelectedPickerSku] = useState("");
  const [selectedCartSkuByProduct, setSelectedCartSkuByProduct] = useState<
    Record<string, string>
  >({});
  const [cartCount, setCartCount] = useState(0);
  const [cartPreview, setCartPreview] = useState<string[]>([]);
  const cartBusy = useRef(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishBusyId, setWishBusyId] = useState<string | null>(null);

  // A cart is available only while AuthContext confirms a valid signed-in session.
  // Clear any stale cart UI immediately after logout/session expiry.
  useEffect(() => {
    if (isAuthenticated) return;
    cartItemsRef.current = [];
    setCartItems([]);
    setCartCount(0);
    setCartPreview([]);
  }, [isAuthenticated]);

  /* ---------- tab bar hide on scroll ---------- */
  const lastY = useRef(0);
  const tabHidden = useRef(false);
  const cartShift = useRef(new Animated.Value(0)).current;
  const cartIn = useRef(new Animated.Value(0)).current;

  // The cart bar springs in the first time an item is added.
  useEffect(() => {
    if (cartCount > 3)
      Animated.spring(cartIn, {
        toValue: 1,
        speed: 12,
        bounciness: 7,
        useNativeDriver: true,
      }).start();
    else cartIn.setValue(0);
  }, [cartCount > 3]);

  const shine = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const shineOn = reduceMotion ? null : shine;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  // One native-driven sweep drives every shine on the page (banner, tiles, cards).
  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(shine, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shine, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [shine, reduceMotion]);

  /* ---------- dynamic banner carousel ---------- */
  const bannerRef = useRef<ScrollView>(null);
  const bannerIndexRef = useRef(0);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const impressedBannerIds = useRef<Set<string>>(new Set());
  const [bannerIndex, setBannerIndex] = useState(0);
  const [homeBanners, setHomeBanners] = useState<HomeBanner[]>(() => homeBannersMemoryCache);
  // Products selected for a banner in the admin dashboard.
  const [bannerCollection, setBannerCollection] = useState<{
    title: string;
    imageUrl?: string;
    products: Product[];
  } | null>(null);
  // Category banners use memory + AsyncStorage for instant repeat visits.
  const [categoryBanner, setCategoryBanner] = useState<HomeBanner | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const categoryId = selectedCategory;

    const loadCategoryBanner = async () => {
      if (categoryId === "All") {
        setCategoryBanner(null);
        return;
      }

      // Paint a cached banner immediately, but start network refresh without
      // waiting for disk cache I/O. This improves cold category switches.
      const memoryCached = categoryBannerMemoryCache.get(categoryId);
      if (memoryCached?.imageUrl) {
        setCategoryBanner(memoryCached);
        void ExpoImage.prefetch(memoryCached.imageUrl);
      } else {
        setCategoryBanner(null);
        void readHomeCache<HomeBanner>(categoryBannerStorageKey(categoryId)).then(
          (diskCached) => {
            if (!isCurrent || !diskCached?.imageUrl) return;
            categoryBannerMemoryCache.set(categoryId, diskCached);
            setCategoryBanner((current) => current?.imageUrl ? current : diskCached);
            void ExpoImage.prefetch(diskCached.imageUrl);
          },
        );
      }

      // Refresh in the background; never block a cached banner on the API.
      try {
        const response = await api.get("/banners", {
          params: { placement: "category", categoryId },
        });
        const payload = response?.data;
        const list =
          payload?.banners ??
          payload?.data?.banners ??
          payload?.data?.data?.banners ??
          payload?.data ??
          payload;

        if (!Array.isArray(list)) return;

        const now = Date.now();
        const eligible = list
          .filter((item: any) => {
            if (!item?._id || item.isActive !== true) return false;
            if (item.placement && item.placement !== "category") return false;
            const itemCategoryId =
              typeof item.categoryId === "object"
                ? item.categoryId?._id
                : item.categoryId;
            if (itemCategoryId && String(itemCategoryId) !== String(categoryId))
              return false;
            const start = item.startDate
              ? new Date(item.startDate).getTime()
              : null;
            const finish = item.endDate
              ? new Date(item.endDate).getTime()
              : null;
            if (start !== null && (!Number.isFinite(start) || start > now))
              return false;
            if (finish !== null && (!Number.isFinite(finish) || finish < now))
              return false;
            return true;
          })
          .sort(
            (a: any, b: any) =>
              Number(b.priority ?? 0) - Number(a.priority ?? 0),
          );

        const item = eligible.find((banner: any) => {
          const mobile =
            typeof banner.mobileImage === "string"
              ? banner.mobileImage
              : banner.mobileImage?.url;
          const desktop =
            typeof banner.image === "string" ? banner.image : banner.image?.url;
          return Boolean(
            mobile || desktop || banner.imageUrl || banner.bannerImage,
          );
        });

        if (!item) {
          if (isCurrent) {
            setCategoryBanner(null);
          }
          return;
        }

        const mobileImageUrl =
          typeof item.mobileImage === "string"
            ? item.mobileImage
            : item.mobileImage?.url;
        const desktopImageUrl =
          typeof item.image === "string" ? item.image : item.image?.url;
        const imageUrl =
          mobileImageUrl ||
          desktopImageUrl ||
          item.imageUrl ||
          item.bannerImage;
        const normalizedBanner: HomeBanner = {
          id: String(item._id),
          title: item.title || "Explore this category",
          sub: item.subtitle || "",
          tagline: item.tagline || "",
          cta: item.buttonText || "Shop Now",
          label: `${item.title || "Category banner"}. ${item.subtitle || ""}`,
          imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
          raw: item,
        };

        if (normalizedBanner.imageUrl) {
          categoryBannerMemoryCache.set(categoryId, normalizedBanner);
          void ExpoImage.prefetch(normalizedBanner.imageUrl);
          void writeHomeCache(
            categoryBannerStorageKey(categoryId),
            normalizedBanner,
          );
        }
        if (isCurrent) {
          setCategoryBanner(normalizedBanner);
        }
      } catch (error: any) {
        console.log(
          "CATEGORY BANNER API ERROR:",
          error?.response?.data || error?.message,
        );
        if (isCurrent) {
          setCategoryBanner(categoryBannerMemoryCache.get(categoryId) ?? null);
        }
      }
    };

    void loadCategoryBanner();
    return () => {
      isCurrent = false;
    };
  }, [selectedCategory]);

  // Fetch only banners eligible for the Home main placement.
  // Show cached banners immediately; refresh the list and images in the background.
  const loadHomeBanners = useCallback(async () => {
    if (homeBannersMemoryCache.length > 0) {
      setHomeBanners(homeBannersMemoryCache);
      void ExpoImage.prefetch(
        homeBannersMemoryCache.slice(0, 2).map((item) => item.imageUrl!),
      );
    } else {
      // Hydrate disk cache in parallel with the API request, never before it.
      void readHomeCache<HomeBanner[]>(HOME_BANNERS_STORAGE_KEY).then(
        (diskCached) => {
          if (
            homeBannersMemoryCache.length === 0 &&
            Array.isArray(diskCached) &&
            diskCached.length > 0
          ) {
            homeBannersMemoryCache = diskCached;
            setHomeBanners(diskCached);
            void ExpoImage.prefetch(
              diskCached.slice(0, 2).map((item) => item.imageUrl!),
            );
          }
        },
      );
    }

    try {
      const response = await api.get("/banners", {
        params: { placement: "home_main" },
      });
      const payload = response?.data;
      const list =
        payload?.banners ??
        payload?.data?.banners ??
        payload?.data?.data?.banners ??
        payload?.data ??
        payload;

      if (!Array.isArray(list)) {
        console.log("HOME BANNERS: Unexpected API response format:", payload);
        return;
      }

      const now = Date.now();

      // Match the MongoDB banner schema and enforce eligibility on the client
      // as a safeguard. The public API should already apply these filters.
      const normalized: HomeBanner[] = list
        .filter((item: any) => {
          if (!item?._id) return false;
          if (item.isActive !== true) return false;
          if (item.placement && item.placement !== "home_main") return false;

          const startTime = item.startDate
            ? new Date(item.startDate).getTime()
            : null;
          const endTime = item.endDate
            ? new Date(item.endDate).getTime()
            : null;

          if (
            startTime !== null &&
            Number.isFinite(startTime) &&
            startTime > now
          )
            return false;
          if (endTime !== null && Number.isFinite(endTime) && endTime < now)
            return false;
          if (startTime !== null && !Number.isFinite(startTime)) return false;
          if (endTime !== null && !Number.isFinite(endTime)) return false;

          return true;
        })
        .sort(
          (a: any, b: any) => Number(b.priority ?? 0) - Number(a.priority ?? 0),
        )
        .map((item: any) => {
          const mobileImageUrl =
            typeof item.mobileImage === "string"
              ? item.mobileImage
              : item.mobileImage?.url;
          const desktopImageUrl =
            typeof item.image === "string" ? item.image : item.image?.url;
          const imageUrl =
            mobileImageUrl ||
            desktopImageUrl ||
            item.imageUrl ||
            item.bannerImage;

          const title = item.title || "Discover more on OdiKart";
          const subtitle = item.subtitle || "Explore offers picked for you";

          return {
            id: String(item._id),
            title,
            sub: subtitle,
            tagline: item.tagline || "",
            cta: item.buttonText || "Shop Now",
            label: `${title}. ${subtitle}`,
            imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
            raw: item,
          };
        })
        .filter((banner: HomeBanner) => Boolean(banner.imageUrl));

      // Cache even an empty successful result so the API remains the source of truth.
      homeBannersMemoryCache = normalized;
      setHomeBanners(normalized);
      bannerIndexRef.current = 0;
      setBannerIndex(0);
      bannerRef.current?.scrollTo({ x: 0, animated: false });

      // Prefetch the first two slides first; remaining slides can warm the cache
      // without delaying the first visible banner.
      const imageUrls = normalized.map((banner) => banner.imageUrl!).filter(Boolean);
      if (imageUrls.length > 0) {
        void ExpoImage.prefetch(imageUrls.slice(0, 2));
        if (imageUrls.length > 2) {
          void ExpoImage.prefetch(imageUrls.slice(2));
        }
      }
      void writeHomeCache(HOME_BANNERS_STORAGE_KEY, normalized);
    } catch (error: any) {
      console.log(
        "HOME BANNERS API ERROR:",
        error?.response?.data || error?.message,
      );
    }
  }, []);

  useEffect(() => {
    void loadHomeBanners();
  }, [loadHomeBanners]);

  const stopBannerAuto = () => {
    if (bannerTimer.current) clearInterval(bannerTimer.current);
    bannerTimer.current = null;
  };

  const startBannerAuto = () => {
    stopBannerAuto();
    if (reduceMotion || homeBanners.length < 2) return;
    bannerTimer.current = setInterval(() => {
      if (!bannerRef.current) return;
      const next = (bannerIndexRef.current + 1) % homeBanners.length;
      bannerIndexRef.current = next;
      setBannerIndex(next);
      bannerRef.current.scrollTo({ x: next * screenWidth, animated: true });
    }, BANNER_INTERVAL);
  };

  // Count each banner impression once per Home screen session.
  useEffect(() => {
    const banner = homeBanners[bannerIndex];
    if (!banner?.raw?._id || impressedBannerIds.current.has(banner.id)) return;

    impressedBannerIds.current.add(banner.id);
    void api.post(`/banners/${banner.id}/impression`).catch((error: any) => {
      console.log(
        "BANNER IMPRESSION ERROR:",
        error?.response?.status ?? error?.message,
      );
    });
  }, [bannerIndex, homeBanners]);

  const handleBannerPress = (banner: HomeBanner) => {
    const raw = banner.raw;

    if (raw?._id) {
      void api.post(`/banners/${banner.id}/click`).catch((error: any) => {
        console.log(
          "BANNER CLICK ERROR:",
          error?.response?.status ?? error?.message,
        );
      });
    } else {
      // Preserve the original destination for the local fallback banners.
      router.push("/(tabs)/categories");
      return;
    }

    // If the admin selected products for this banner, open those products
    // as a dedicated in-app collection. This takes priority over category
    // redirects so the customer sees the curated products, not the full category.
    const selectedProducts = Array.isArray(raw?.products)
      ? raw.products.filter(
          (item: any) =>
            item &&
            typeof item === "object" &&
            item._id &&
            item.status === "approved" &&
            item.isActive !== false &&
            item.isDeleted !== true,
        )
      : [];

    if (selectedProducts.length > 0) {
      stopBannerAuto();
      const bannerImageCandidate =
        raw?.mobileImage?.secure_url ||
        raw?.mobileImage?.url ||
        (typeof raw?.mobileImage === "string" ? raw.mobileImage : undefined) ||
        raw?.image?.secure_url ||
        raw?.image?.url ||
        (typeof raw?.image === "string" ? raw.image : undefined) ||
        raw?.imageUrl ||
        raw?.bannerImage ||
        banner.imageUrl;
      const bannerImageUrl =
        typeof bannerImageCandidate === "string" &&
        /^https?:\/\//i.test(bannerImageCandidate)
          ? bannerImageCandidate
          : undefined;

      setBannerCollection({
        title: String(raw?.title || banner.title || "Featured products"),
        imageUrl: bannerImageUrl,
        products: selectedProducts as Product[],
      });
      return;
    }

    const redirectType = raw?.redirectType || "none";
    const redirectId = raw?.redirectId ? String(raw.redirectId) : "";
    const redirectUrl = raw?.redirectUrl;

    if (redirectType === "product" && redirectId) {
      router.push({ pathname: "/products/[id]", params: { id: redirectId } });
    } else if (redirectType === "category" && redirectId) {
      router.push({
        pathname: "/(tabs)/categories",
        params: { categoryId: redirectId },
      });
    } else if (redirectType === "collection" && redirectId) {
      router.push({
        pathname: "/(tabs)/categories",
        params: { collectionId: redirectId },
      });
    } else if (redirectType === "url" && typeof redirectUrl === "string") {
      if (/^https?:\/\//i.test(redirectUrl)) {
        void Linking.openURL(redirectUrl).catch((error) =>
          console.log("BANNER REDIRECT ERROR:", error),
        );
      }
    } else if (redirectType === "none") {
      return;
    } else {
      router.push("/(tabs)/categories");
    }
  };

  useEffect(() => {
    startBannerAuto();
    return stopBannerAuto;
  }, [screenWidth, reduceMotion, homeBanners.length]);

  // The carousel unmounts while searching, so start from the first banner again.
  useEffect(() => {
    if (search.trim() || searchFocused) {
      bannerIndexRef.current = 0;
      setBannerIndex(0);
    }
  }, [search, searchFocused]);

  const setTabBarHidden = (hidden: boolean) => {
    tabHidden.current = hidden;
    router.setParams({ hideTabBar: hidden });
    cartShift.stopAnimation();
    cartShift.setValue(hidden ? 30 : 0);
  };

  const onScroll = (e: any) => {
    const y = Math.max(0, e.nativeEvent.contentOffset.y);
    headerSurfaceProgress.setValue(y);
    const diff = y - lastY.current;
    currentScrollY.current = y;
    const passedFilterRow =
      filterRowThreshold !== null && y >= filterRowThreshold;
    // Reveal the filter rail only when the shopper scrolls back upward.
    // While scrolling down, keep the product cards unobstructed. Once the
    // original filter row has crossed the search bar, it can reappear on up-scroll.
    setShowStickyFilters((visible) => {
      if (y <= 20 || !passedFilterRow) return false;
      if (diff < -2) return true;
      if (diff > 2) return false;
      return visible;
    });

    // Show the floating Back to top control only when the user scrolls
    // upward while already well down the page. Hide it when scrolling down
    // or when the user reaches the top.
    let shouldShowTop = false;
    if (y > 700 && diff < -6) shouldShowTop = true;
    if (y <= 20 || diff > 6) shouldShowTop = false;

    if (shouldShowTop !== topVisible.current) {
      topVisible.current = shouldShowTop;
      setShowTop(shouldShowTop);
    }

    // React to the first scroll movement: down hides, up shows.
    // No multi-pixel threshold, so the navbar responds immediately.
    if (y <= 20) {
      if (tabHidden.current) setTabBarHidden(false);
    } else if (diff > 0) {
      if (!tabHidden.current) setTabBarHidden(true);
    } else if (diff < 0) {
      if (tabHidden.current) setTabBarHidden(false);
    }

    lastY.current = y;
  };

  /* =======================================================
     DATA LOADING
  ======================================================= */

  const productsRequestId = useRef(0);

  const loadProducts = async (query = search, forceRefresh = false) => {
    const normalizedQuery = query.trim();
    const requestId = ++productsRequestId.current;
    const storageKey = `${HOME_PRODUCTS_STORAGE_KEY}:${normalizedQuery || "all"}`;

    // 1) Paint memory cache immediately, but still refresh from the server.
    const memoryCached = homeProductsCache.get(normalizedQuery);
    if (memoryCached) {
      setProducts(memoryCached);
      setError("");
      setInitialLoading(false);
    } else {
      // 2) On a fresh app process, hydrate from persistent device storage first.
      const persisted = await readHomeCache<Product[]>(storageKey);
      if (requestId !== productsRequestId.current) return;
      if (Array.isArray(persisted)) {
        homeProductsCache.set(normalizedQuery, persisted);
        setProducts(persisted);
        setError("");
        setInitialLoading(false);
      }
    }

    // If the local cache is recent, render it and avoid an unnecessary request.
    // Explicit pull-to-refresh and retry actions pass forceRefresh=true.
    if (!forceRefresh && (await isHomeCacheFresh(storageKey))) {
      if (requestId === productsRequestId.current) {
        setSearching(false);
        setInitialLoading(false);
      }
      return;
    }

    // Cache is missing/stale: refresh from the server while keeping cached UI visible.
    try {
      setSearching(true);
      setError("");
      const startedAt = Date.now();
      const data = await getProducts(normalizedQuery);
      const loadedProducts: Product[] = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data?.data?.products)
          ? data.data.products
          : Array.isArray(data)
            ? data
            : [];
      console.log(
        `HOME PRODUCTS API: ${Date.now() - startedAt}ms; count=${loadedProducts.length}`,
      );
      if (requestId !== productsRequestId.current) return;
      homeProductsCache.set(normalizedQuery, loadedProducts);
      setProducts(loadedProducts);
      await writeHomeCache(storageKey, loadedProducts);
    } catch (err: any) {
      console.log(
        "HOME PRODUCTS API ERROR:",
        err?.response?.status,
        err?.message || err,
      );
      if (requestId === productsRequestId.current) {
        // Keep cached products visible if Render is waking up or the network is unavailable.
        setError(products.length > 0 ? "" : "Unable to load products.");
        if (products.length === 0)
          showToast("Couldn't load products. Pull down to retry.", "error");
      }
    } finally {
      if (requestId === productsRequestId.current) {
        setSearching(false);
        setInitialLoading(false);
      }
    }
  };

  const loadHomeShelves = async (forceRefresh = false) => {
    const keys = Object.keys(EMPTY_HOME_SHELVES) as ShelfKey[];

    // Paint memory cache immediately; refresh discovery APIs in the background.
    const hasMemoryCache = keys.some((key) => homeShelfCache.has(key));
    if (hasMemoryCache) {
      setShelfProducts((current) => {
        const next = { ...current };
        keys.forEach((key) => {
          const cached = homeShelfCache.get(key);
          if (cached) next[key] = cached;
        });
        return next;
      });
      setShelvesLoading(false);
    } else {
      const persisted = await readHomeCache<Partial<HomeShelves>>(
        HOME_SHELVES_STORAGE_KEY,
      );
      if (persisted && typeof persisted === "object") {
        const hydrated: HomeShelves = { ...EMPTY_HOME_SHELVES };
        keys.forEach((key) => {
          hydrated[key] = Array.isArray(persisted[key]) ? persisted[key]! : [];
          homeShelfCache.set(key, hydrated[key]);
        });
        setShelfProducts(hydrated);
        setShelvesLoading(false);
      }
    }

    if (!forceRefresh && (await isHomeCacheFresh(HOME_SHELVES_STORAGE_KEY))) {
      setShelvesLoading(false);
      return;
    }

    const requests: Array<[ShelfKey, () => Promise<any>]> = [
      ["trending", getTrendingProducts],
      ["bestSellers", getBestSellerProducts],
      ["popular", getPopularProducts],
      ["topRated", getTopRatedProducts],
      ["newArrivals", getNewArrivalProducts],
      ["featured", getFeaturedProducts],
      ["recommended", getRecommendedProducts],
      ["flashSales", getFlashSaleProducts],
      ["deals", getDealProducts],
      ["lowStock", getLowStockProducts],
      ["recentlyViewed", getRecentlyViewedProducts],
    ];

    const results = await Promise.allSettled(
      requests.map(async ([key, request]) => {
        const response = await request();
        const data = response?.data ?? response;
        const list = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data?.data?.products)
            ? data.data.products
            : Array.isArray(data)
              ? data
              : [];
        return [key, list] as const;
      }),
    );

    const next: HomeShelves = {
      ...EMPTY_HOME_SHELVES,
      ...Object.fromEntries(
        keys.map((key) => [key, homeShelfCache.get(key) ?? []]),
      ),
    };
    let hadSuccess = false;

    results.forEach((result, index) => {
      const key = requests[index][0];
      if (result.status === "fulfilled") {
        next[key] = result.value[1];
        homeShelfCache.set(key, result.value[1]);
        hadSuccess = true;
      } else {
        console.log(
          `HOME ${key.toUpperCase()} API ERROR:`,
          result.reason?.response?.status ??
            result.reason?.message ??
            result.reason,
        );
      }
    });

    setShelfProducts(next);
    if (hadSuccess) await writeHomeCache(HOME_SHELVES_STORAGE_KEY, next);
    setShelvesLoading(false);
  };

  const loadCategories = async (forceRefresh = false) => {
    // Show cached categories immediately, then refresh them in the background.
    if (homeCategoriesCache !== null) {
      setCategories(homeCategoriesCache);
      setCategoriesLoading(false);
    } else {
      const persisted = await readHomeCache<Category[]>(
        HOME_CATEGORIES_STORAGE_KEY,
      );
      if (Array.isArray(persisted)) {
        homeCategoriesCache = persisted;
        setCategories(persisted);
        setCategoriesLoading(false);
      }
    }

    if (
      !forceRefresh &&
      (await isHomeCacheFresh(HOME_CATEGORIES_STORAGE_KEY))
    ) {
      setCategoriesLoading(false);
      return;
    }

    try {
      const data = await getCategories();
      const categoryRows = Array.isArray(data?.categories)
        ? data.categories
        : Array.isArray(data?.data?.categories)
          ? data.data.categories
          : Array.isArray(data)
            ? data
            : [];
      const loadedCategories: Category[] = categoryRows
        .filter((item: any) => item?._id && item?.name)
        .map((item: any) => ({
          _id: String(item._id),
          name: String(item.name).trim(),
          image:
            typeof item.image === "string" || item.image == null
              ? item.image
              : item.image?.secure_url || item.image?.url,
          icon: typeof item.icon === "string" ? item.icon : undefined,
        }))
        .filter((item: Category) => Boolean(item.name));
      homeCategoriesCache = loadedCategories;
      setCategories(loadedCategories);
      await writeHomeCache(HOME_CATEGORIES_STORAGE_KEY, loadedCategories);
    } catch (err: any) {
      console.log(
        "HOME CATEGORIES API ERROR:",
        err?.response?.status,
        err?.message || err,
      );
    } finally {
      setCategoriesLoading(false);
    }
  };

  const syncCart = async () => {
    if (!isAuthenticated) {
      cartItemsRef.current = [];
      setCartItems([]);
      setCartCount(0);
      setCartPreview([]);
      return;
    }

    const items: any[] = await getCart();
    cartItemsRef.current = Array.isArray(items) ? items : [];
    setCartItems(cartItemsRef.current);
    const safeItems = Array.isArray(items) ? items : [];
    setCartCount(
      safeItems.reduce((t, i) => t + Math.max(0, Number(i.quantity) || 0), 0),
    );
    setCartPreview(
      safeItems
        .map(
          (i) =>
            i.image ||
            i.variant?.image ||
            i.product?.media?.thumbnail ||
            i.product?.media?.images?.[0] ||
            i.selectedVariant?.images?.[0] ||
            "",
        )
        .filter(Boolean)
        .slice(0, 3),
    );
  };

  const loadWishlist = async () => {
    try {
      setWishlistIds(getWishlistProductIds(await getWishlist()));
    } catch {
      setWishlistIds([]); // logged-out users simply have no wishlist
    }
  };

  const loadHeaderCounts = async () => {
    if (!isAuthenticated) {
      setCartItems([]);
      setCartCount(0);
      setCartPreview([]);
    } else if (!cartBusy.current) {
      try {
        await syncCart();
      } catch (e: any) {
        console.log("CART LOAD ERROR:", e?.response?.data || e?.message || e);
      }
    }
    try {
      const d = (await api.get("/notifications/unread-count"))?.data;
      const n = Number(
        d?.unreadCount ??
          d?.count ??
          d?.data?.unreadCount ??
          d?.data?.count ??
          0,
      );
      setNotificationCount(Number.isFinite(n) ? Math.max(0, n) : 0);
    } catch {
      setNotificationCount(0);
    }
  };

  const loadSavedAddresses = async () => {
    try {
      setSavedLoading(true);

      const res = await getMyAddresses();

      console.log("RAW SAVED ADDRESS RESPONSE:", res);

      const candidates = [
        res?.addresses,
        res?.data,
        res?.data?.addresses,
        res?.data?.data?.addresses,
        res?.data?.data,
      ];

      const rawAddresses = candidates.find((item) => Array.isArray(item));

      const list: Address[] = (rawAddresses ?? []).filter(
        (address: Address) =>
          address && address._id && address.isDeleted !== true,
      );

      console.log("TOTAL ADDRESSES RECEIVED:", rawAddresses?.length ?? 0);
      console.log("TOTAL ADDRESSES DISPLAYED:", list.length);

      setSavedAddresses(list);

      if (selectedLocation === "Select location") {
        const defaultAddress = list.find((address) => address.isDefault);

        if (defaultAddress) {
          setSelectedLocation(
            formatAddressFull(defaultAddress) ||
              formatAddressShort(defaultAddress),
          );
        }
      }
    } catch (error: any) {
      console.log(
        "SAVED ADDRESS LOAD ERROR:",
        error?.response?.data || error?.message || error,
      );

      setSavedAddresses([]);
      showToast("Couldn't load saved addresses.", "error");
    } finally {
      setSavedLoading(false);
    }
  };

  useEffect(() => {
    void loadCategories();
    void loadHomeShelves();
  }, []);

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => loadProducts(search.trim()), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [search]);

  // The first focus is the initial mount (already handled by the startup
  // effects below). On later returns to Home, re-check the 5-minute cache:
  // fresh data is reused instantly; stale data stays visible while it refreshes.
  const hasCompletedFirstHomeFocus = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasCompletedFirstHomeFocus.current) {
        hasCompletedFirstHomeFocus.current = true;
        return undefined;
      }

      void loadProducts("");
      void loadCategories();
      void loadHomeShelves();
      return undefined;
    }, []),
  );

  // Refresh cart whenever Home becomes visible again.
  // Home can remain mounted behind Checkout/Order screens, so an auth-only
  // useEffect would keep showing the previous cart count after an order.
  useFocusEffect(
    useCallback(() => {
      void loadHeaderCounts();
      return undefined;
    }, [isAuthenticated]),
  );

  useEffect(() => {
    loadWishlist();
  }, [isAuthenticated]);

  // Close search and restore the normal Home feed.
  const closeSearch = () => {
    Keyboard.dismiss();
    setSearchFocused(false);
    setSearch("");
    setTabBarHidden(false);
    mainRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Android: require a second Back press within 2 seconds to exit from Home.
  // useFocusEffect ensures this handler is active only while HomeScreen is focused.
  const lastBackPress = useRef(0);
  useFocusEffect(
    useCallback(() => {
      const onHardwareBackPress = () => {
        // Let the keyboard close normally before asking to exit.
        if (keyboardVisible) {
          Keyboard.dismiss();
          return true;
        }

        // Back should leave search first, rather than exit the app.
        if (searchFocused || search.trim().length > 0) {
          closeSearch();
          return true;
        }

        const now = Date.now();
        if (now - lastBackPress.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        lastBackPress.current = now;
        if (Platform.OS === "android") {
          ToastAndroid.show("Press again to exit", ToastAndroid.SHORT);
        }
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onHardwareBackPress,
      );

      return () => {
        subscription.remove();
        lastBackPress.current = 0;
      };
    }, [keyboardVisible, searchFocused, search]),
  );

  useEffect(() => {
    const a = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true),
    );
    const b = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      a.remove();
      b.remove();
    };
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  /* =======================================================
     LOCATION SEARCH
  ======================================================= */

  useEffect(() => {
    const q = locationSearch.trim();
    if (q.length < 2) {
      setLocationResults([]);
      setLocationLoading(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setLocationLoading(true);
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&limit=8&countrycodes=in`;
        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "User-Agent": "OdiKart-Mobile-App/1.0",
          },
        });
        if (!res.ok) throw new Error(`Location search failed: ${res.status}`);
        const data = await res.json();
        setLocationResults(Array.isArray(data) ? data : []);
      } catch (e) {
        console.log("LOCATION SEARCH ERROR:", e);
        setLocationResults([]);
        showToast("Couldn't search locations. Try again.", "error");
      } finally {
        setLocationLoading(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [locationSearch]);

  const closeLocation = () => {
    Keyboard.dismiss();
    setLocationOpen(false);
    setLocationSearch("");
    setLocationResults([]);
    setLocationLoading(false);
    if (showNotificationAfterLocationPicker) {
      setShowNotificationAfterLocationPicker(false);
      setPermissionPrompt("notifications");
    }
  };

  const chooseLocation = (label: string) => {
    setSelectedLocation(label);
    closeLocation();
  };

  const formatAddressShort = (a: Address) =>
    [a.addressLine1, a.area, a.city].filter(Boolean).join(", ") ||
    a.city ||
    a.district ||
    "Selected address";

  const formatAddressFull = (a: Address) =>
    [
      a.addressLine1,
      a.addressLine2,
      a.landmark,
      a.area,
      a.village,
      a.city,
      a.district,
      a.state,
      a.postalCode,
    ]
      .filter(Boolean)
      .join(", ");

  const formatSearchResult = (r: LocationResult) => {
    const a = r.address || {};
    const area = a.neighbourhood || a.suburb || a.village;
    const city = a.city || a.town || a.village;
    if (area && city && area.toLowerCase() !== city.toLowerCase())
      return `${area}, ${city}`;
    return (
      city || area || r.display_name.split(",").slice(0, 2).join(", ").trim()
    );
  };

  const useCurrentLocation = async () => {
    try {
      setDetecting(true);

      // Ask for permission first, then check that the device location provider is enabled.
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) {
        showToast(
          "Allow location access to detect your delivery area.",
          "error",
        );
        return;
      }

      let servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled && Platform.OS === "android") {
        try {
          await Location.enableNetworkProviderAsync();
        } catch (enableError) {
          console.log("ENABLE LOCATION PROVIDER ERROR:", enableError);
        }
        servicesEnabled = await Location.hasServicesEnabledAsync();
      } else if (!servicesEnabled) {
        showToast(
          "Turn on Location Services in Settings, then try again.",
          "error",
        );
        try {
          await Linking.openSettings();
        } catch (settingsError) {
          console.log("OPEN LOCATION SETTINGS ERROR:", settingsError);
        }
        return;
      }

      if (!servicesEnabled) {
        showToast("Location is still off. Turn it on and try again.", "error");
        return;
      }

      // Fast path: reuse a very recent, reasonably precise GPS fix.
      // Otherwise request a fresh high-accuracy fix to avoid showing stale/wrong locations.
      let pos = await Location.getLastKnownPositionAsync({
        maxAge: 10_000,
        requiredAccuracy: 75,
      });

      if (!pos || pos.coords.accuracy == null || pos.coords.accuracy > 75) {
        pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });
      }

      // Reverse-geocode the GPS coordinates. Expo's native geocoder can omit
      // small villages, so also ask Nominatim for village/hamlet/locality details.
      let addr: Location.LocationGeocodedAddress | undefined;
      try {
        addr = (
          await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
        )?.[0];
      } catch (geocodeError) {
        console.log("EXPO REVERSE GEOCODE ERROR:", geocodeError);
      }

      let osmAddress: Record<string, string> = {};
      let osmDisplayName = "";
      try {
        const reverseUrl =
          `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(pos.coords.latitude)}` +
          `&lon=${encodeURIComponent(pos.coords.longitude)}&format=jsonv2&addressdetails=1`;
        const reverseResponse = await fetch(reverseUrl, {
          headers: {
            Accept: "application/json",
            "User-Agent": "OdiKart-Mobile-App/1.0",
          },
        });

        if (reverseResponse.ok) {
          const reverseData = await reverseResponse.json();
          osmAddress =
            reverseData?.address && typeof reverseData.address === "object"
              ? reverseData.address
              : {};
          osmDisplayName =
            typeof reverseData?.display_name === "string"
              ? reverseData.display_name
              : "";
        } else {
          console.log("NOMINATIM REVERSE STATUS:", reverseResponse.status);
        }
      } catch (reverseError) {
        console.log("NOMINATIM REVERSE GEOCODE ERROR:", reverseError);
      }

      // Prefer the smallest known settlement first so a village such as
      // Chingudighai is not hidden behind only its district/city name.
      const villageOrLocality =
        osmAddress.village ||
        osmAddress.hamlet ||
        osmAddress.isolated_dwelling ||
        osmAddress.locality ||
        osmAddress.neighbourhood ||
        osmAddress.suburb ||
        osmAddress.quarter ||
        osmAddress.residential ||
        osmAddress.city_district;

      const street = [addr?.streetNumber, addr?.street]
        .filter(Boolean)
        .join(" ");
      const preciseParts = [
        villageOrLocality,
        osmAddress.town,
        osmAddress.city || osmAddress.municipality,
        addr?.name,
        addr?.district || osmAddress.county,
        addr?.subregion || osmAddress.state_district,
        addr?.region || osmAddress.state,
        addr?.postalCode || osmAddress.postcode,
        street,
      ].filter(
        (value, index, values) =>
          typeof value === "string" &&
          value.trim().length > 0 &&
          values.findIndex(
            (item) =>
              typeof item === "string" &&
              item.trim().toLowerCase() === value.trim().toLowerCase(),
          ) === index,
      );
      const preciseLabel = preciseParts.join(", ") || osmDisplayName;

      if (preciseLabel) {
        chooseLocation(preciseLabel);
      } else {
        // Coordinates were found, but a readable address wasn't available from the geocoder.
        chooseLocation(
          `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
        );
      }
    } catch (e) {
      console.log("CURRENT LOCATION ERROR:", e);
      showToast(
        "Couldn't get an accurate location. Move near a window and try again.",
        "error",
      );
    } finally {
      setDetecting(false);
    }
  };

  /* =======================================================
     CART + WISHLIST ACTIONS
  ======================================================= */

  const variantSkuOf = (p: Product) => activeVariants(p)[0]?.sku || "";

  // Normalize variant attributes from the product API so shoppers can see
  // the actual selectable values (for example Size: M, Colour: Black).
  const variantAttributeEntries = (variant: Variant): [string, string][] => {
    const entries: [string, string][] = [];
    const add = (key: unknown, value: unknown) => {
      if (value === undefined || value === null || value === "") return;
      const cleanKey = String(key || "Option").trim();
      const cleanValue =
        typeof value === "object"
          ? String(
              (value as any).label ??
                (value as any).name ??
                (value as any).value ??
                "",
            ).trim()
          : String(value).trim();
      if (!cleanValue) return;
      if (
        !entries.some(
          ([existingKey]) =>
            existingKey.toLowerCase() === cleanKey.toLowerCase(),
        )
      ) {
        entries.push([cleanKey, cleanValue]);
      }
    };

    const raw = variant.attributes;
    if (Array.isArray(raw)) {
      raw.forEach((item: any, index: number) => {
        if (item && typeof item === "object") {
          add(
            item.name ?? item.key ?? item.attribute,
            item.value ?? item.label ?? item.option,
          );
        } else {
          add(`Option ${index + 1}`, item);
        }
      });
    } else if (raw && typeof raw === "object") {
      Object.entries(raw).forEach(([key, value]) => add(key, value));
    }

    // Support common flat variant schemas used by product/admin APIs.
    [
      ["Size", variant.size],
      ["Colour", variant.color ?? variant.colour],
      ["Weight", variant.weight],
      ["Pack", variant.packSize],
      ["Material", variant.material],
      ["Storage", variant.storage],
      ["Style", variant.style],
    ].forEach(([key, value]) => add(key, value));

    return entries;
  };

  const variantDisplayName = (variant: Variant, index: number) => {
    const label =
      variant.label ||
      variant.name ||
      variant.title ||
      variant.option ||
      variantAttributeEntries(variant)
        .map(([key, value]) => `${key}: ${value}`)
        .join(" · ");
    return String(label || `Option ${index + 1}`);
  };

  const openLoginModal = () => {
    router.push("/login-modal");
  };

  const openVariantPicker = (product: Product) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (isOutOfStock(product)) {
      showToast("This product is out of stock.", "error");
      return;
    }
    const variants = activeVariants(product);
    if (!variants.length) {
      showToast("This product has no available SKU.", "error");
      return;
    }
    const rememberedSku = selectedCartSkuByProduct[product._id];
    const initial =
      variants.find((variant) => variant.sku === rememberedSku) || variants[0];
    setSelectedPickerSku(String(initial.sku || ""));
    setVariantPickerProduct(product);
  };

  const quantityOf = (p: Product) => {
    if (!isAuthenticated) return 0;
    const items = cartItems.filter(
      (i) => String(i.productId ?? i.product?._id ?? "") === String(p._id),
    );
    return items.reduce(
      (total, item) => total + Math.max(0, Number(item?.quantity) || 0),
      0,
    );
  };

  // Optimistic cart UI: update the card immediately, then sync with the server
  // in a per-variant queue. Avoid a second GET /cart after every successful tap.
  const cartQueues = useRef<Record<string, Promise<void>>>({});
  const cartQuantitiesRef = useRef<Record<string, number>>({});
  const mutateProductCart = (
    p: Product,
    delta: 1 | -1,
    skuOverride?: string,
  ) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    if (isOutOfStock(p) && delta > 0) {
      showToast("This product is out of stock.", "error");
      return;
    }

    const sku =
      skuOverride || selectedCartSkuByProduct[p._id] || variantSkuOf(p);
    const key = `${p._id}:${sku}`;
    const image = productImage(p) || "";
    // Resolve the quantity for this exact SKU (not the product-wide card total).
    const renderedQuantity = cartItemsRef.current.reduce((total, item) => {
      const sameProduct =
        String(item.productId ?? item.product?._id ?? "") === String(p._id);
      const itemSku = String(
        item.variantSku || item.variant?.sku || item.selectedVariant?.sku || "",
      );
      return (
        total +
        (sameProduct && itemSku === String(sku)
          ? Math.max(0, Number(item.quantity) || 0)
          : 0)
      );
    }, 0);
    const current = cartQuantitiesRef.current[key] ?? renderedQuantity;
    if (delta < 0 && current <= 0) return;
    const next = Math.max(0, current + delta);
    cartQuantitiesRef.current[key] = next;

    // Build the next cart snapshot before scheduling React state updates. This
    // avoids nested setState calls inside a state updater and paints the count
    // and floating-cart preview in the same interaction.
    const currentItems = cartItemsRef.current;
    const index = currentItems.findIndex(
      (i) =>
        String(i.productId ?? i.product?._id ?? "") === String(p._id) &&
        String(
          i.variantSku || i.variant?.sku || i.selectedVariant?.sku || "",
        ) === String(sku),
    );
    const nextItems = [...currentItems];
    if (next === 0) {
      if (index >= 0) nextItems.splice(index, 1);
    } else if (index >= 0) {
      nextItems[index] = {
        ...nextItems[index],
        productId: p._id,
        variantSku: sku,
        quantity: next,
        image: nextItems[index].image || image,
      };
    } else {
      nextItems.push({
        productId: p._id,
        variantSku: sku,
        quantity: next,
        image,
      });
    }
    cartItemsRef.current = nextItems;
    setCartItems(nextItems);
    setCartCount(
      nextItems.reduce(
        (total, item) => total + Math.max(0, Number(item.quantity) || 0),
        0,
      ),
    );
    // Keep the three most recently added product images at the front of the
    // floating-cart preview. Quantity increases bring that product forward.
    if (delta > 0) {
      setCartPreview((currentPreview) =>
        [image, ...currentPreview.filter((uri) => uri && uri !== image)].slice(
          0,
          3,
        ),
      );
    } else if (next === 0) {
      // If a cart line is removed completely, replace its preview image with
      // another remaining cart product where possible.
      setCartPreview((currentPreview) => {
        const remaining = currentPreview.filter((uri) => uri && uri !== image);
        const fallback = nextItems
          .map(
            (item) =>
              item.image ||
              item.variant?.image ||
              item.product?.media?.thumbnail ||
              item.product?.media?.images?.[0] ||
              item.selectedVariant?.images?.[0] ||
              "",
          )
          .filter((uri) => uri && !remaining.includes(uri));
        return [...remaining, ...fallback].slice(0, 3);
      });
    }

    if (delta > 0 && current === 0)
      showToast(`${p.title} added to cart`, "success");

    const previousTask = cartQueues.current[key] ?? Promise.resolve();
    const task = previousTask
      .catch(() => undefined)
      .then(async () => {
        if (delta > 0) {
          if (current === 0)
            await addToCart({
              productId: p._id,
              variantSku: sku,
              quantity: 1,
              image,
            });
          else await increaseCartItem({ productId: p._id, variantSku: sku });
        } else {
          await decreaseCartItem({ productId: p._id, variantSku: sku });
        }
      })
      .catch(async (e: any) => {
        console.log("CART ERROR:", e?.response?.data || e?.message || e);
        // Roll back from the authoritative server state only on failure.
        cartQuantitiesRef.current[key] = renderedQuantity;
        try {
        } catch {}
        const status = e?.response?.status;
        showToast(
          status === 401 || status === 403
            ? "Log in to use your cart."
            : e?.response?.data?.message || "Couldn't update cart. Try again.",
          "error",
        );
      })
      .finally(() => {
        if (cartQueues.current[key] === task) {
          delete cartQueues.current[key];
          // Clear the ref once the queue is drained; future taps read current UI state.
          delete cartQuantitiesRef.current[key];
        }
        cartBusy.current = Object.keys(cartQueues.current).length > 0;
      });
    cartQueues.current[key] = task;
    cartBusy.current = true;
  };

  const confirmVariantAdd = () => {
    if (!variantPickerProduct || !selectedPickerSku) return;
    const product = variantPickerProduct;
    const variant = activeVariants(product).find(
      (item) => String(item.sku || "") === selectedPickerSku,
    );
    if (!variant || Number(variant.stock ?? 1) <= 0) {
      showToast("This option is out of stock.", "error");
      return;
    }
    setSelectedCartSkuByProduct((current) => ({
      ...current,
      [product._id]: selectedPickerSku,
    }));
    setVariantPickerProduct(null);
    mutateProductCart(product, 1, selectedPickerSku);
  };

  const handleAdd = (p: Product) => openVariantPicker(p);
  const cartSkuForProduct = (p: Product) =>
    selectedCartSkuByProduct[p._id] ||
    String(
      cartItemsRef.current.find(
        (item) =>
          String(item.productId ?? item.product?._id ?? "") === String(p._id),
      )?.variantSku || variantSkuOf(p),
    );

  const handleIncrease = (p: Product) =>
    mutateProductCart(p, 1, cartSkuForProduct(p));
  const handleDecrease = (p: Product) =>
    mutateProductCart(p, -1, cartSkuForProduct(p));

  // Track busy wishlist products individually so one network request doesn't
  // block heart taps on every other product.
  const wishBusyIds = useRef<Set<string>>(new Set());
  const handleWishlist = async (productId: string) => {
    if (!isAuthenticated) {
      openLoginModal();
      return;
    }
    const id = String(productId);
    if (!id || wishBusyIds.current.has(id)) return;
    const wasWished = wishlistIds.includes(id);
    wishBusyIds.current.add(id);
    setWishBusyId(id);
    setWishlistIds((current) =>
      wasWished ? current.filter((x) => x !== id) : [...current, id],
    );
    try {
      if (wasWished) await removeFromWishlist(id);
      else await addToWishlist(id);
      showToast(
        wasWished ? "Removed from wishlist" : "Saved to wishlist",
        wasWished ? "info" : "success",
      );
    } catch (e: any) {
      setWishlistIds((current) =>
        wasWished
          ? current.includes(id)
            ? current
            : [...current, id]
          : current.filter((x) => x !== id),
      );
      const status = e?.response?.status;
      showToast(
        status === 401 || status === 403
          ? "Log in to use your wishlist."
          : "Couldn't update wishlist. Try again.",
        "error",
      );
    } finally {
      wishBusyIds.current.delete(id);
      setWishBusyId((current) => (current === id ? null : current));
    }
  };

  const rememberSearch = (q: string) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    setRecent((c) =>
      [
        clean,
        ...c.filter((x) => x.toLowerCase() !== clean.toLowerCase()),
      ].slice(0, 6),
    );
  };

  /* ---------- voice search ---------- */
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const voicePulse = useRef(new Animated.Value(0)).current;

  useSpeechEvent("start", () => setListening(true));
  useSpeechEvent("end", () => setListening(false));
  useSpeechEvent("result", (e: any) => {
    const text: string = e?.results?.[0]?.transcript ?? "";
    setTranscript(text);
    if (e?.isFinal && text.trim()) {
      setSearch(text.trim());
      rememberSearch(text);
      setVoiceOpen(false);
    }
  });
  useSpeechEvent("error", (e: any) => {
    setListening(false);
    setVoiceError(voiceErrorText(e?.error));
  });

  useEffect(() => {
    if (!listening || reduceMotion) {
      voicePulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(voicePulse, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, reduceMotion]);

  useEffect(
    () => () => {
      try {
        SpeechModule?.abort();
      } catch {}
    },
    [],
  );

  const beginListening = (lang: string) => {
    setTranscript("");
    setVoiceError("");
    try {
      SpeechModule.start({
        lang,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch {
      setVoiceError("Couldn't start voice search. Try again.");
    }
  };

  const startVoice = async () => {
    if (!SpeechModule) return;
    try {
      const perm = await SpeechModule.requestPermissionsAsync();
      if (!perm?.granted) {
        showToast("Allow microphone access to use voice search.", "error");
        return;
      }
      Keyboard.dismiss();
      setVoiceOpen(true);
      beginListening(voiceLang);
    } catch {
      showToast("Voice search isn't available on this phone.", "error");
    }
  };

  const stopVoice = () => {
    try {
      SpeechModule?.stop();
    } catch {}
  };

  const closeVoice = () => {
    try {
      SpeechModule?.abort();
    } catch {}
    setListening(false);
    setVoiceOpen(false);
  };

  const changeVoiceLang = (code: string) => {
    if (code === voiceLang) return;
    setVoiceLang(code);
    try {
      SpeechModule?.abort();
    } catch {}
    setTimeout(() => beginListening(code), 250);
  };

  const renderCard = (item: Product, width: number, index = 0) => (
    <ProductCard
      key={String(item._id)}
      product={item}
      width={width}
      shine={shineOn}
      index={index}
      quantity={quantityOf(item)}
      wished={wishlistIds.includes(String(item._id))}
      wishBusy={wishBusyId === String(item._id)}
      onOpen={() => {
        const productId = String(item._id);
        void trackProductEvent(productId, "view").catch((e: any) =>
          console.log(
            "PRODUCT VIEW TRACKING ERROR:",
            e?.response?.status ?? e?.message,
          ),
        );
        void addRecentlyViewedProduct(productId).catch((e: any) =>
          console.log(
            "RECENTLY VIEWED TRACKING ERROR:",
            e?.response?.status ?? e?.message,
          ),
        );
        router.push({ pathname: "/products/[id]", params: { id: productId } });
      }}
      onLongPress={() => {
        setPreviewImageIndex(0);
        setPreviewProduct(item);
      }}
      onAdd={() => handleAdd(item)}
      onIncrease={() => handleIncrease(item)}
      onDecrease={() => handleDecrease(item)}
      onWish={() => handleWishlist(item._id)}
    />
  );

  // Each shelf is populated by its own backend discovery endpoint.
  const shelf = (key: ShelfKey, title: string, subtitle: string) => {
    const items = shelfProducts[key].slice(0, 10);
    if (items.length === 0) return null;
    return (
      <View style={s.shelf} key={key}>
        <SectionHeader
          title={title}
          subtitle={subtitle}
          onSeeAll={() => router.push("/(tabs)/categories")}
        />
        <FlatList
          horizontal
          data={items}
          keyExtractor={(item) => String(item._id)}
          renderItem={({ item, index }) =>
            renderCard(item, SHELF_CARD_W, index)
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.shelfList}
          nestedScrollEnabled
          directionalLockEnabled
          initialNumToRender={3}
          maxToRenderPerBatch={4}
          windowSize={3}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={false}
        />
      </View>
    );
  };

  /* =======================================================
     EARLY STATES
  ======================================================= */

  if (
    products.length === 0 &&
    (initialLoading || categoriesLoading || shelvesLoading)
  ) {
    return <HomeSkeleton banners={homeBanners} />;
  }

  if (error && products.length === 0) {
    return (
      <SafeAreaView
        style={s.offlineScreen}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={s.offlineContent}>
          <View style={s.offlineImageWrap}>
            <CachedImage
              source={require("../../../assets/images/no-internet.webp")}
              style={s.offlineImage}
              resizeMode="contain"
              accessibilityLabel="No internet connection illustration"
            />
          </View>
          <View style={s.offlineStatusPill}>
            <View style={s.offlineStatusDot} />
            <Text style={s.offlineStatusText}>CONNECTION ISSUE</Text>
          </View>
          <Text style={s.offlineTitle}>You're offline</Text>
          <Text style={s.offlineDescription}>
            We couldn't connect to OdiKart right now. Check your internet
            connection and try again.
          </Text>
          <Pressable
            style={({ pressed }) => [
              s.offlineRetryBtn,
              pressed && { opacity: 0.82, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              setError("");
              void Promise.allSettled([
                loadProducts(search, true),
                loadCategories(true),
                loadHomeShelves(true),
              ]);
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry connecting to OdiKart"
          >
            <LinearGradient
              colors={["#2563EB", "#312E81", "#7C3AED"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={s.offlineRetryGradient}
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={s.offlineRetryText}>Try again</Text>
            </LinearGradient>
          </Pressable>
          <Text style={s.offlineHint}>
            Your OdiKart account is safe. Please reconnect to continue shopping.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const searchActive = search.trim().length > 0;
  const suggestionsOpen = searchFocused && !searchActive;
  const contentLoading = searching && !searchActive && products.length === 0;
  const getRefId = (value: any): string =>
    value && typeof value === "object"
      ? String(value._id || "")
      : String(value || "");
  const getRefName = (value: any): string =>
    value && typeof value === "object"
      ? String(value.name || "")
      : String(value || "");
  // Build brand cards from the products currently available. If the API sends
  // a brand object, use its logo/image; otherwise use a representative product image.
  const uniqueBrands = Array.from(
    products
      .reduce((map, product) => {
        const rawBrand: any = product.brand;
        const name = String(
          rawBrand && typeof rawBrand === "object"
            ? rawBrand.name || rawBrand.title || ""
            : rawBrand || "",
        ).trim();
        if (!name) return map;
        const brandImage =
          (rawBrand &&
            typeof rawBrand === "object" &&
            (rawBrand.logo?.url ||
              rawBrand.logo ||
              rawBrand.image?.url ||
              rawBrand.image)) ||
          productImage(product);
        if (!map.has(name))
          map.set(name, {
            name,
            image: typeof brandImage === "string" ? brandImage : undefined,
          });
        return map;
      }, new Map<string, { name: string; image?: string }>())
      .values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const activeFilterCount =
    (selectedCategory !== "All" ? 1 : 0) +
    (selectedSubCategory !== "All" ? 1 : 0) +
    (selectedBrand !== "All" ? 1 : 0) +
    (priceRange[0] !== 0 || priceRange[1] !== 5000 ? 1 : 0) +
    (sort !== "relevance" ? 1 : 0);
  const filteredResults = products.filter((p) => {
    if (selectedCategory !== "All" && getRefId(p.category) !== selectedCategory)
      return false;
    if (
      selectedSubCategory !== "All" &&
      getRefId(p.subCategory) !== selectedSubCategory
    )
      return false;
    if (
      selectedBrand !== "All" &&
      String(
        p.brand && typeof p.brand === "object"
          ? p.brand.name || p.brand.title || ""
          : p.brand || "",
      ).toLowerCase() !== selectedBrand.toLowerCase()
    )
      return false;
    const price = productPrice(p);
    return price >= priceRange[0] && price <= priceRange[1];
  });
  const sortedResults = sortProducts(filteredResults, sort);

  // Open the selected category's products directly from the Home category rail.
  const openCategoryProducts = (category: Category) => {
    setSelectedCategory(String(category._id));
    setSelectedSubCategory("All");
    setSelectedBrand("All");
    setPriceRange([0, 5000]);
    setMinPriceInput("0");
    setMaxPriceInput("5000");
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
    // Category mode hides the home banners and discovery shelves, so the
    // filtered product grid now follows the category rail near the top.
    requestAnimationFrame(() => {
      mainRef.current?.scrollTo({ y: 0, animated: true });
    });
  };
  const locationLabel =
    selectedLocation === "Select location"
      ? "Choose delivery location"
      : selectedLocation;

  // Let shoppers refresh products, categories and cart counts with one familiar pull gesture.
  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([
        loadProducts(search),
        loadCategories(),
        loadHomeShelves(),
        loadHeaderCounts(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  /* =======================================================
     MAIN
  ======================================================= */

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[s.root, { backgroundColor: "#312E81" }]}>
        <SafeAreaView
          style={[s.root, { backgroundColor: "#312E81" }]}
          edges={["top", "left", "right"]}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(insets.top, 24),
              backgroundColor: "#312E81",
              opacity: whiteSurfaceOpacity,
              // Keep this tint behind the scroll content. A high zIndex here
              // can cover the sticky search field when Android pins child [1].
              zIndex: 0,
            }}
          />

          <ScrollView
            ref={mainRef}
            // Pin one combined search + category container. Keeping both inside
            // the same sticky child ensures the search input stays above the
            // existing category row on Android and iOS while scrolling.
            style={{
              backgroundColor:
                searchFocused || searchActive ? "#FFFFFF" : "transparent",
              zIndex: 1,
              elevation: 1,
            }}
            contentContainerStyle={
              searchFocused || searchActive
                ? { flexGrow: 1, backgroundColor: "#FFFFFF" }
                : undefined
            }
            stickyHeaderIndices={[1]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              !searchFocused && !searchActive ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={C.brand}
                  colors={[C.brand]}
                  progressBackgroundColor={C.surface}
                />
              ) : undefined
            }
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {/* [0] Simple white header: scrolls away naturally. */}
            <View
              style={[
                s.headerHero,
                {
                  paddingTop: 8,
                  paddingBottom: 15,
                  backgroundColor: "#312E81",
                },
              ]}
              onLayout={(event) => {
                const measuredHeight = Math.round(
                  event.nativeEvent.layout.height,
                );
                if (measuredHeight > 0) setHeaderHeroHeight(measuredHeight);
              }}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: "#FFFFFF", opacity: whiteSurfaceOpacity },
                ]}
              />
              <View style={[s.headerTop]}>
                <Pressable
                  style={s.locationBtn}
                  onPress={() => {
                    setLocationOpen(true);
                    loadSavedAddresses();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Delivery location ${locationLabel}. Change`}
                >
                  <View style={s.locationIcon}>
                    <Ionicons name="home" size={17} color="#FFFFFF" />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text
                      style={[s.deliverTo, { color: "rgba(255,255,255,0.88)" }]}
                    >
                      Deliver to
                    </Text>
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text
                        style={[s.locationText, { color: "#FFFFFF" }]}
                        numberOfLines={1}
                      >
                        {locationLabel}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color="#FFFFFF"
                        style={{ marginLeft: 5 }}
                      />
                    </View>
                  </View>
                </Pressable>
                <Pressable
                  style={s.bellBtn}
                  onPress={() => router.push("/notifications")}
                  accessibilityRole="button"
                  accessibilityLabel={`Notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={22}
                    color="#FFFFFF"
                  />
                  {notificationCount > 0 ? (
                    <View style={s.bellBadge}>
                      <Text style={s.bellBadgeText}>
                        {notificationCount > 9 ? "9+" : notificationCount}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
                {/* Profile shortcut */}
                <Pressable
                  style={s.profileHeaderBtn}
                  onPress={() => {
                    if (!isAuthenticated) {
                      router.push("/login-modal");
                      return;
                    }
                    router.push("/(tabs)/profile");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open profile"
                  hitSlop={8}
                >
                  <Ionicons name="person-outline" size={22} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>

            {/* [1] Sticky search container: the search icon, TextInput and
              action buttons remain pinned together while scrolling. */}
            <View style={[s.stickyHeaderBackdrop]}>
              <View style={s.stickyHeader}>
                <View style={s.searchWrap}>
                  <View style={s.searchBox}>
                    {searchFocused || searchActive ? (
                      <Pressable
                        onPress={closeSearch}
                        hitSlop={10}
                        style={s.searchBackBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Close search and return to Home"
                      >
                        <Ionicons name="arrow-back" size={22} color={C.brand} />
                      </Pressable>
                    ) : (
                      <Ionicons
                        name="search-outline"
                        size={23}
                        color={C.inkSoft}
                      />
                    )}
                    <TextInput
                      value={search}
                      onChangeText={setSearch}
                      placeholder={SEARCH_PLACEHOLDERS[searchPlaceholderIndex]}
                      placeholderTextColor={C.inkMuted}
                      style={s.searchInput}
                      returnKeyType="search"
                      autoCorrect={false}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      onSubmitEditing={() => rememberSearch(search)}
                      accessibilityLabel="Search products"
                    />
                    {voiceAvailable && search.length === 0 ? (
                      <Pressable
                        onPress={startVoice}
                        hitSlop={10}
                        style={s.micBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Search by voice"
                      >
                        <Ionicons name="mic" size={20} color={C.brand} />
                      </Pressable>
                    ) : null}
                    {searching && searchActive ? (
                      <Ionicons name="sync" size={16} color={C.inkMuted} />
                    ) : null}
                    {search.length > 0 ? (
                      <Pressable
                        onPress={() => setSearch("")}
                        hitSlop={10}
                        accessibilityLabel="Clear search"
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={C.inkMuted}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
                {/* Hide the whole category rail while search or suggestions are open.
              This prevents an empty white strip below the sticky search bar. */}
                {!searchActive && !suggestionsOpen ? (
                  <View style={s.categoryRailOuter}>
                    {/* Compact category navigation inspired by the screen recording. */}
                    <View style={s.visualCategorySection}>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={s.categoryRailContent}
                        keyboardShouldPersistTaps="handled"
                      >
                        <Pressable
                          onPress={() => {
                            setSelectedCategory("All");
                            setSelectedSubCategory("All");
                            setSelectedBrand("All");
                            setPriceRange([0, 5000]);
                            setMinPriceInput("0");
                            setMaxPriceInput("5000");
                            setVisibleCount(PAGE_SIZE);
                          }}
                          style={s.categoryRailItem}
                          accessibilityRole="button"
                          accessibilityLabel="Show all categories"
                          accessibilityState={{
                            selected: selectedCategory === "All",
                          }}
                        >
                          <View
                            style={[
                              s.categoryRailIcon,
                              selectedCategory === "All" &&
                                s.categoryRailIconActive,
                            ]}
                          >
                            <CachedImage
                              source={require("../../../assets/images/all-category.webp")}
                              style={s.categoryRailImage}
                              resizeMode="contain"
                            />
                          </View>
                          <Text
                            style={[
                              s.categoryRailLabel,
                              selectedCategory === "All" &&
                                s.categoryRailLabelActive,
                            ]}
                          >
                            All
                          </Text>
                          <View
                            style={[
                              s.categoryRailIndicator,
                              selectedCategory === "All" &&
                                s.categoryRailIndicatorActive,
                            ]}
                          />
                        </Pressable>
                        {categories.map((category, index) => {
                          const selected =
                            selectedCategory === String(category._id);
                          const imageUrl = getCategoryImageUrl(category.image);
                          return (
                            <Pressable
                              key={category._id}
                              onPress={() => openCategoryProducts(category)}
                              style={s.categoryRailItem}
                              accessibilityRole="button"
                              accessibilityLabel={`Shop ${category.name}`}
                              accessibilityState={{ selected }}
                            >
                              <View
                                style={[
                                  s.categoryRailIcon,
                                  selected && s.categoryRailIconActive,
                                ]}
                              >
                                {imageUrl ? (
                                  <CachedImage
                                    source={{ uri: imageUrl }}
                                    style={s.categoryRailImage}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <Ionicons
                                    name="storefront-outline"
                                    size={22}
                                    color={selected ? C.brand : C.inkSoft}
                                  />
                                )}
                              </View>
                              <Text
                                style={[
                                  s.categoryRailLabel,
                                  selected && s.categoryRailLabelActive,
                                ]}
                                numberOfLines={1}
                              >
                                {category.name}
                              </Text>
                              <View
                                style={[
                                  s.categoryRailIndicator,
                                  selected && s.categoryRailIndicatorActive,
                                ]}
                              />
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            {/* [3] White catalogue surface with image-only promotional banners. */}
            <View style={{ backgroundColor: "#FFFFFF", flex: 1 }}>
              {suggestionsOpen ? (
                <View style={s.suggestWrap}>
                  <View style={s.searchWelcomeCard}>
                    <View style={s.searchWelcomeIcon}>
                      <Ionicons name="sparkles" size={19} color={C.brand} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.searchWelcomeTitle}>
                        Find your next favourite
                      </Text>
                      <Text style={s.searchWelcomeSubtitle}>
                        Search products, brands and Odisha specialities
                      </Text>
                    </View>
                  </View>

                  {recent.length > 0 ? (
                    <View style={s.searchSection}>
                      <View style={s.searchSectionHeader}>
                        <View style={s.searchSectionHeading}>
                          <Ionicons
                            name="time-outline"
                            size={17}
                            color={C.inkSoft}
                          />
                          <Text style={s.suggestTitle}>Recent searches</Text>
                        </View>
                        <Pressable
                          onPress={() => setRecent([])}
                          hitSlop={10}
                          accessibilityRole="button"
                        >
                          <Text style={s.searchClearText}>Clear all</Text>
                        </Pressable>
                      </View>
                      <View style={s.searchRecentList}>
                        {recent.map((q) => (
                          <Pressable
                            key={q}
                            style={({ pressed }) => [
                              s.searchRecentItem,
                              pressed && { backgroundColor: C.brandSoft },
                            ]}
                            onPress={() => {
                              setSearch(q);
                              rememberSearch(q);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`Search ${q} again`}
                          >
                            <Ionicons
                              name="time-outline"
                              size={15}
                              color={C.brand}
                            />
                            <Text style={s.searchRecentText} numberOfLines={1}>
                              {q}
                            </Text>
                            <Ionicons
                              name="arrow-up-left"
                              size={14}
                              color={C.inkMuted}
                            />
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {categories.length > 0 ? (
                    <View style={s.searchSection}>
                      <View style={s.searchSectionHeader}>
                        <View style={s.searchSectionHeading}>
                          <Ionicons
                            name="grid-outline"
                            size={17}
                            color={C.inkSoft}
                          />
                          <Text style={s.suggestTitle}>Explore categories</Text>
                        </View>
                        <Text style={s.searchSectionNote}>
                          Popular on Odikart
                        </Text>
                      </View>
                      <View style={s.searchCategoryGrid}>
                        {categories.slice(0, 8).map((c, index) => {
                          const imageUrl = getCategoryImageUrl(c.image);
                          const tints = [
                            "#EEF2FF",
                            "#F3E8FF",
                            "#E0F2FE",
                            "#ECFDF5",
                          ];
                          return (
                            <Pressable
                              key={c._id}
                              style={({ pressed }) => [
                                s.searchCategoryCard,
                                pressed && {
                                  backgroundColor: "#F7F7FF",
                                  borderColor: "#C7D2FE",
                                },
                              ]}
                              onPress={() => {
                                setSearch(c.name);
                                rememberSearch(c.name);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Search ${c.name}`}
                            >
                              <View
                                style={[
                                  s.searchCategoryThumb,
                                  {
                                    backgroundColor:
                                      tints[index % tints.length],
                                  },
                                ]}
                              >
                                {imageUrl ? (
                                  <CachedImage
                                    source={{ uri: imageUrl }}
                                    style={s.searchCategoryImage}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <Ionicons
                                    name="storefront-outline"
                                    size={21}
                                    color={C.brand}
                                  />
                                )}
                              </View>
                              <Text
                                style={s.searchCategoryName}
                                numberOfLines={2}
                              >
                                {c.name}
                              </Text>
                              <Ionicons
                                name="chevron-forward"
                                size={15}
                                color={C.inkMuted}
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : (
                    <View style={s.searchEmptyHint}>
                      <Ionicons
                        name="search-outline"
                        size={19}
                        color={C.inkMuted}
                      />
                      <Text style={s.searchEmptyHintText}>
                        Start typing to search products.
                      </Text>
                    </View>
                  )}
                </View>
              ) : searchActive ? (
                <View style={{ paddingTop: 18 }}>
                  <SectionHeader
                    title="Search results"
                    subtitle={
                      searching
                        ? "Searching…"
                        : `${sortedResults.length} ${sortedResults.length === 1 ? "product" : "products"} for "${search.trim()}"`
                    }
                  />
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.sortRow}
                    keyboardShouldPersistTaps="handled"
                  >
                    {SORTS.map((o) => (
                      <Pressable
                        key={o.key}
                        onPress={() => {
                          setSort(o.key);
                          setVisibleCount(PAGE_SIZE);
                        }}
                        style={[s.sortChip, sort === o.key && s.sortChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: sort === o.key }}
                      >
                        <Text
                          style={[
                            s.sortChipText,
                            sort === o.key && s.sortChipTextActive,
                          ]}
                        >
                          {o.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  {searching ? (
                    <View style={s.grid}>
                      {Array.from({ length: 8 }, (_, i) => i + 1).map((i) => (
                        <ProductSkeleton key={i} width={gridCardW} />
                      ))}
                    </View>
                  ) : sortedResults.length > 0 ? (
                    <View style={s.grid}>
                      {sortedResults
                        .slice(0, 30)
                        .map((p, i) => renderCard(p, gridCardW, i))}
                    </View>
                  ) : (
                    <View style={s.empty}>
                      <CachedImage
                        source={require("../../../assets/images/search.webp")}
                        style={s.notFoundImage}
                        resizeMode="contain"
                        accessibilityLabel="No products found illustration"
                      />
                      <Text style={s.emptyTitle}>No matches found</Text>
                      <Text style={s.emptyText}>
                        Check the spelling or try a broader term.
                      </Text>
                      <Pressable
                        style={s.retryBtn}
                        onPress={() => setSearch("")}
                        accessibilityRole="button"
                      >
                        <LinearGradient
                          colors={["#2563EB", "#312E81", "#7C3AED"]}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={s.retryGradient}
                        >
                          <Text style={s.retryText}>Clear search</Text>
                        </LinearGradient>
                      </Pressable>
                    </View>
                  )}
                </View>
              ) : (
                <>
                  {selectedCategory === "All" ? (
                    <>
                      {/* Image-only banner carousel on the white page */}
                      {homeBanners.length > 0 ? (
                        <View style={s.bannerBackdrop}>
                          <ScrollView
                            ref={bannerRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEventThrottle={16}
                            onScrollBeginDrag={stopBannerAuto}
                            onMomentumScrollEnd={(e) => {
                              const i = Math.round(
                                e.nativeEvent.contentOffset.x / screenWidth,
                              );
                              bannerIndexRef.current = i;
                              setBannerIndex(i);
                              startBannerAuto();
                            }}
                          >
                            {homeBanners.map((b) => (
                              <View
                                key={b.id}
                                style={{
                                  width: screenWidth,
                                  paddingHorizontal: GUTTER,
                                }}
                              >
                                <Pressable
                                  style={({ pressed }) => [
                                    s.banner,
                                    { height: bannerHeight },
                                    pressed && { opacity: 0.96 },
                                  ]}
                                  onPress={() => handleBannerPress(b)}
                                  accessibilityRole="button"
                                >
                                  <CachedImage
                                    source={{ uri: b.imageUrl! }}
                                    style={s.bannerImage}
                                    priority="high"
                                    cachePolicy="memory-disk"
                                    recyclingKey={b.id}
                                    resizeMode="cover"
                                    onError={(e) =>
                                      console.log(
                                        "BANNER IMAGE ERROR:",
                                        b.id,
                                        e.nativeEvent,
                                      )
                                    }
                                  />
                                  {shineOn ? (
                                    <ShineLayer
                                      value={shineOn}
                                      from={-60}
                                      to={screenWidth}
                                      height={320}
                                    />
                                  ) : null}
                                </Pressable>
                              </View>
                            ))}
                          </ScrollView>

                          {/* <View
                          style={s.dots}
                          accessibilityLabel={`Banner ${bannerIndex + 1} of ${homeBanners.length}`}
                        >
                          {homeBanners.map((b, i) => (
                            <View
                              key={b.id}
                              style={[s.dot, i === bannerIndex && s.dotActive]}
                            />
                          ))}
                        </View> */}
                        </View>
                      ) : null}
                    </>
                  ) : null}

                  {contentLoading ? (
                    <>
                      <ShelfSkeleton />
                      <View style={s.shelf}>
                        <SectionTitleSkeleton />
                        <GridSkeleton width={gridCardW} />
                      </View>
                    </>
                  ) : (
                    <>
                      {selectedCategory === "All" ? (
                        <>
                          {/* {shelf(
                          "trending",
                          "Trending Near You",
                          "Popular in your area",
                        )} */}
                          {/* {shelf(
                          "bestSellers",
                          "Bestsellers",
                          "Loved by Odikart shoppers",
                        )} */}
                          {shelf(
                            "popular",
                            "Popular Picks",
                            "Products shoppers are exploring",
                          )}
                          {shelf(
                            "topRated",
                            "Top Rated",
                            "Highly rated by customers",
                          )}
                          {shelf("newArrivals", "New Arrivals", "Just added")}
                          {/* {shelf(
                          "featured",
                          "Featured Products",
                          "Handpicked for you",
                        )} */}
                          {shelf(
                            "recommended",
                            "Recommended for You",
                            "Discover your next favourite",
                          )}
                          {shelf(
                            "flashSales",
                            "Flash Sales",
                            "Limited-time offers",
                          )}
                          {shelf("deals", "Deals", "Save on everyday picks")}
                          {shelf(
                            "lowStock",
                            "Almost Gone",
                            "Limited stock available",
                          )}
                          {shelf(
                            "recentlyViewed",
                            "Recently Viewed",
                            "Pick up where you left off",
                          )}
                          {shelvesLoading &&
                          shelfProducts.trending.length === 0 ? (
                            <ShelfSkeleton />
                          ) : null}
                        </>
                      ) : null}

                      {selectedCategory !== "All"
                        ? (() => {
                            const activeCategory = categories.find(
                              (item) => String(item._id) === selectedCategory,
                            );
                            const categoryImage = getCategoryImageUrl(
                              activeCategory?.image,
                            );
                            return (
                              <View style={s.categoryLanding}>
                                {categoryBanner?.imageUrl ? (
                                  <View
                                    style={{
                                      marginHorizontal: GUTTER,
                                      marginBottom: 14,
                                    }}
                                  >
                                    <Pressable
                                      onPress={() =>
                                        handleBannerPress(categoryBanner)
                                      }
                                      style={({ pressed }) => [
                                        s.banner,
                                        { height: bannerHeight, width: "100%" },
                                        pressed && { opacity: 0.96 },
                                      ]}
                                      accessibilityRole="button"
                                      accessibilityLabel={categoryBanner.label}
                                    >
                                      <CachedImage
                                        source={{
                                          uri: categoryBanner.imageUrl,
                                        }}
                                        style={s.bannerImage}
                                        resizeMode="cover"
                                        priority="high"
                                        transition={80}
                                        onError={() => setCategoryBanner(null)}
                                      />
                                    </Pressable>
                                  </View>
                                ) : null}

                                <View style={s.categorySubHeader}>
                                  <View>
                                    <Text style={s.categorySubTitle}>
                                      Shop by collection
                                    </Text>
                                    <Text style={s.categorySubCaption}>
                                      Find exactly what you need
                                    </Text>
                                  </View>
                                  {subCategoriesLoading ? (
                                    <Text style={s.categorySubCaption}>
                                      Loading…
                                    </Text>
                                  ) : null}
                                </View>
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  contentContainerStyle={s.categorySubRail}
                                  keyboardShouldPersistTaps="handled"
                                >
                                  <Pressable
                                    onPress={() => {
                                      setSelectedSubCategory("All");
                                      setVisibleCount(PAGE_SIZE);
                                    }}
                                    style={[
                                      s.categorySubChip,
                                      selectedSubCategory === "All" &&
                                        s.categorySubChipActive,
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityState={{
                                      selected: selectedSubCategory === "All",
                                    }}
                                  >
                                    <Ionicons
                                      name="apps-outline"
                                      size={15}
                                      color={
                                        selectedSubCategory === "All"
                                          ? "#fff"
                                          : C.brand
                                      }
                                    />
                                    <Text
                                      style={[
                                        s.categorySubChipText,
                                        selectedSubCategory === "All" &&
                                          s.categorySubChipTextActive,
                                      ]}
                                    >
                                      All
                                    </Text>
                                  </Pressable>
                                  {subCategories.map((subCategory) => {
                                    const selected =
                                      selectedSubCategory ===
                                      String(subCategory._id);
                                    return (
                                      <Pressable
                                        key={subCategory._id}
                                        onPress={() => {
                                          setSelectedSubCategory(
                                            String(subCategory._id),
                                          );
                                          setVisibleCount(PAGE_SIZE);
                                        }}
                                        style={[
                                          s.categorySubChip,
                                          selected && s.categorySubChipActive,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                      >
                                        {subCategory.image ? (
                                          <CachedImage
                                            source={{ uri: subCategory.image }}
                                            style={[
                                              s.categorySubChipImage,
                                              selected &&
                                                s.categorySubChipImageActive,
                                            ]}
                                            resizeMode="cover"
                                          />
                                        ) : (
                                          <View
                                            style={[
                                              s.categorySubChipIcon,
                                              selected &&
                                                s.categorySubChipIconActive,
                                            ]}
                                          >
                                            <Ionicons
                                              name="layers-outline"
                                              size={14}
                                              color={
                                                selected ? "#FFFFFF" : C.brand
                                              }
                                            />
                                          </View>
                                        )}
                                        <Text
                                          style={[
                                            s.categorySubChipText,
                                            selected &&
                                              s.categorySubChipTextActive,
                                          ]}
                                          numberOfLines={1}
                                        >
                                          {subCategory.name}
                                        </Text>
                                        {selected ? (
                                          <Ionicons
                                            name="checkmark-circle"
                                            size={15}
                                            color="#FFFFFF"
                                          />
                                        ) : null}
                                      </Pressable>
                                    );
                                  })}
                                </ScrollView>
                                <View style={s.categoryQuickInfo}>
                                  <View style={s.categoryQuickInfoItem}>
                                    <Ionicons
                                      name="shield-checkmark-outline"
                                      size={15}
                                      color="#64748B"
                                    />
                                    <Text style={s.categoryQuickInfoText}>
                                      Trusted shopping
                                    </Text>
                                  </View>
                                  <View style={s.categoryQuickInfoItem}>
                                    <Ionicons
                                      name="refresh-outline"
                                      size={15}
                                      color="#64748B"
                                    />
                                    <Text style={s.categoryQuickInfoText}>
                                      Easy browsing
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            );
                          })()
                        : null}

                      {selectedCategory !== "All" &&
                      sortedResults.length > 0 ? (
                        <View style={s.shelf}>
                          <SectionHeader
                            title="Top picks for every need"
                            subtitle="Popular products in this category"
                          />
                          <FlatList
                            horizontal
                            data={sortedResults.slice(0, 10)}
                            keyExtractor={(item) => `category-pick-${item._id}`}
                            renderItem={({ item, index }) =>
                              renderCard(item, SHELF_CARD_W, index)
                            }
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.shelfList}
                            nestedScrollEnabled
                            directionalLockEnabled
                            initialNumToRender={3}
                            maxToRenderPerBatch={4}
                            windowSize={3}
                          />
                        </View>
                      ) : null}

                      <View
                        style={s.shelf}
                        onLayout={(event) =>
                          setAllProductsOffset(event.nativeEvent.layout.y)
                        }
                      >
                        <SectionHeader
                          title={
                            selectedCategory === "All"
                              ? "All products"
                              : categories.find(
                                  (item) =>
                                    String(item._id) === selectedCategory,
                                )?.name || "Category products"
                          }
                          subtitle={`${sortedResults.length} ${sortedResults.length === 1 ? "product" : "products"} available`}
                        />

                        {/* All filters and sorting controls stay in one horizontal row. */}
                        <View
                          ref={filterRowMeasureRef}
                          onLayout={() => {
                            requestAnimationFrame(() => {
                              filterRowMeasureRef.current?.measureInWindow(
                                (_x, rowY) => {
                                  mainRef.current?.measureInWindow(
                                    (_sx, scrollWindowY) => {
                                      // Start pinning the filter rail as soon as its
                                      // top reaches the bottom edge of the sticky search bar.
                                      // Without subtracting the search-bar height here,
                                      // the rail appears late and the first product row
                                      // gets partially covered before the overlay mounts.
                                      setFilterRowThreshold(
                                        Math.max(
                                          0,
                                          rowY -
                                            scrollWindowY +
                                            currentScrollY.current -
                                            stickySearchHeight,
                                        ),
                                      );
                                    },
                                  );
                                },
                              );
                            });
                          }}
                        >
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={[
                              s.sortRow,
                              { alignItems: "center" },
                            ]}
                            keyboardShouldPersistTaps="handled"
                          >
                            <Pressable
                              onPress={() => setFilterOpen(true)}
                              style={[
                                s.sortChip,
                                s.filterTrigger,
                                activeFilterCount > 0 && s.sortChipActive,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel="Open all product filters"
                            >
                              <Ionicons
                                name="options-outline"
                                size={16}
                                color={activeFilterCount > 0 ? "#fff" : C.brand}
                              />
                              <Text
                                style={[
                                  s.sortChipText,
                                  activeFilterCount > 0 && s.sortChipTextActive,
                                ]}
                              >
                                Filters
                                {activeFilterCount
                                  ? ` · ${activeFilterCount}`
                                  : ""}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setFilterOpen(true)}
                              style={s.sortChip}
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name="grid-outline"
                                size={15}
                                color={C.brand}
                              />
                              <Text style={s.sortChipText}>
                                {selectedCategory !== "All"
                                  ? categories.find(
                                      (c) => c._id === selectedCategory,
                                    )?.name || "Category"
                                  : "Category"}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setFilterOpen(true)}
                              style={s.sortChip}
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name="layers-outline"
                                size={15}
                                color={C.brand}
                              />
                              <Text style={s.sortChipText}>Subcategory</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setFilterOpen(true)}
                              style={s.sortChip}
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name="pricetag-outline"
                                size={15}
                                color={C.brand}
                              />
                              <Text style={s.sortChipText}>
                                {selectedBrand !== "All"
                                  ? selectedBrand
                                  : "Brand"}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setFilterOpen(true)}
                              style={s.sortChip}
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name="cash-outline"
                                size={15}
                                color={C.brand}
                              />
                              <Text style={s.sortChipText}>Price</Text>
                            </Pressable>
                            <Pressable
                              onPress={() => setFilterOpen(true)}
                              style={s.sortChip}
                              accessibilityRole="button"
                            >
                              <Ionicons
                                name="swap-vertical-outline"
                                size={15}
                                color={C.brand}
                              />
                              <Text style={s.sortChipText}>
                                {SORTS.find((item) => item.key === sort)
                                  ?.label || "Sort"}
                              </Text>
                            </Pressable>
                          </ScrollView>
                        </View>

                        {sortedResults.length > 0 ? (
                          <>
                            <View style={s.grid}>
                              {sortedResults
                                .slice(0, visibleCount)
                                .map((p, i) => renderCard(p, gridCardW, i))}
                            </View>
                            {sortedResults.length > visibleCount ? (
                              <Pressable
                                style={s.moreBtn}
                                onPress={() =>
                                  setVisibleCount((c) => c + PAGE_SIZE)
                                }
                                accessibilityRole="button"
                              >
                                <LinearGradient
                                  colors={["#2563EB", "#312E81", "#7C3AED"]}
                                  start={{ x: 0, y: 0.5 }}
                                  end={{ x: 1, y: 0.5 }}
                                  style={s.moreBtnGradient}
                                >
                                  <Text style={s.moreBtnText}>
                                    Show more products
                                  </Text>
                                  <Ionicons
                                    name="chevron-down"
                                    size={16}
                                    color="#FFFFFF"
                                  />
                                </LinearGradient>
                              </Pressable>
                            ) : null}
                          </>
                        ) : (
                          <View style={s.empty}>
                            <CachedImage
                              source={require("../../../assets/images/not-found.webp")}
                              style={s.notFoundImage}
                              resizeMode="contain"
                              accessibilityLabel="No products available illustration"
                            />
                            <Text style={s.emptyTitle}>Nothing here yet</Text>
                            <Text style={s.emptyText}>
                              Pull down to refresh.
                            </Text>
                          </View>
                        )}
                      </View>
                    </>
                  )}
                </>
              )}
              <View style={{ height: 150 }} />
            </View>
          </ScrollView>

          {/* Floating cart */}
          {isAuthenticated && cartCount > 3 ? (
            <Animated.View
              style={[
                s.cartWrap,
                {
                  opacity: cartIn,
                  transform: [
                    { translateY: cartShift },
                    {
                      translateY: cartIn.interpolate({
                        inputRange: [0, 1],
                        outputRange: [48, 0],
                      }),
                    },
                  ],
                },
              ]}
              pointerEvents="box-none"
            >
              {!reduceMotion ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    s.cartAura,
                    {
                      opacity: shine.interpolate({
                        inputRange: [0, 0.25, 0.55, 0.8, 1],
                        outputRange: [0.45, 0.9, 0.55, 1, 0.45],
                      }),
                      transform: [
                        {
                          scale: shine.interpolate({
                            inputRange: [0, 0.5, 1],
                            outputRange: [0.97, 1.04, 0.97],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              ) : null}
              <Pressable
                style={({ pressed }) => [
                  s.cartBar,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={() => {
                  if (!isAuthenticated) {
                    showToast("Log in to use your cart.", "error");
                    return;
                  }
                  router.push("/cart");
                }}
                accessibilityRole="button"
                accessibilityLabel={`View cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              >
                <LinearGradient
                  pointerEvents="none"
                  colors={["#2563EB", "#312E81", "#7C3AED"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={s.cartTopGloss} />
                <View style={s.cartImages}>
                  {cartPreview.length === 0 ? (
                    <View style={s.cartImageFallback}>
                      <Ionicons
                        name="bag-handle-outline"
                        size={15}
                        color="#fff"
                      />
                    </View>
                  ) : (
                    cartPreview.map((img, i) => (
                      <View
                        key={`${img}-${i}`}
                        style={[s.cartImageWrap, i > 0 && { marginLeft: -12 }]}
                      >
                        <CachedImage
                          source={{ uri: img }}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      </View>
                    ))
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <View style={s.cartTitleRow}>
                    <Text style={s.cartTitle}>View cart</Text>
                    {/* <Ionicons name="sparkles" size={13} color="#FFE88A" /> */}
                  </View>
                  <Text style={s.cartSub}>
                    {cartCount} {cartCount === 1 ? "item" : "items"}{" "}
                  </Text>
                </View>
                <View style={s.cartArrow}>
                  <Ionicons name="arrow-forward" size={15} color="#6366F1" />
                </View>
                {shineOn ? (
                  <ShineLayer value={shineOn} from={-80} to={320} height={72} />
                ) : null}
                {/* {!reduceMotion ? <Ionicons name="sparkles" size={16} color="#FFF0A8" style={s.cartSparkleOne} /> : null} */}
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Scroll to top */}
          {showTop ? (
            <Animated.View
              style={[s.topBtnWrap, { transform: [{ translateY: cartShift }] }]}
            >
              <Pressable
                style={s.topBtn}
                onPress={() => {
                  mainRef.current?.scrollTo({ y: 0, animated: true });
                  setTabBarHidden(false);
                }}
                accessibilityRole="button"
                accessibilityLabel="Back to top"
              >
                <LinearGradient
                  colors={["#7100fc", "#322ad3", "#aaa1a1"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={s.topBtnGradient}
                >
                  <View style={s.topBtnIcon}>
                    <Ionicons name="arrow-up" size={17} color="#FFFFFF" />
                  </View>
                  <Text style={s.topBtnText}>Back to top</Text>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Choose product SKU / size / colour before adding to cart */}
          <Modal
            visible={!!variantPickerProduct}
            transparent
            animationType="slide"
            statusBarTranslucent={false}
            onRequestClose={() => setVariantPickerProduct(null)}
          >
            <View style={s.variantPickerOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setVariantPickerProduct(null)}
                accessibilityLabel="Close variant selector"
              />
              {variantPickerProduct ? (
                <>
                  <View
                    style={{
                      alignItems: "center",
                      marginBottom: 14,
                      zIndex: 1000,
                      elevation: 1000,
                    }}
                  >
                    <Pressable
                      onPress={() => setVariantPickerProduct(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Close modal"
                      hitSlop={10}
                    >
                      <View style={s.floatingModalClose}>
                        <Ionicons name="close" size={25} color="#FFFFFF" />
                      </View>
                    </Pressable>
                  </View>
                  <View style={s.variantPickerSheet}>
                    <View style={s.sheetHandle} />
                    <View style={s.variantPickerHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.variantPickerEyebrow}>
                          CHOOSE YOUR OPTION
                        </Text>
                        <Text style={s.variantPickerTitle} numberOfLines={2}>
                          {variantPickerProduct.title}
                        </Text>
                      </View>
                    </View>

                    <View style={s.variantPickerProductRow}>
                      {productImage(variantPickerProduct) ? (
                        <CachedImage
                          source={{ uri: productImage(variantPickerProduct) }}
                          style={s.variantPickerImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <View
                          style={[
                            s.variantPickerImage,
                            { alignItems: "center", justifyContent: "center" },
                          ]}
                        >
                          <Ionicons
                            name="image-outline"
                            size={26}
                            color={C.inkMuted}
                          />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={s.variantPickerPrice}>
                          {(() => {
                            const chosen = activeVariants(
                              variantPickerProduct,
                            ).find(
                              (item) =>
                                String(item.sku || "") === selectedPickerSku,
                            );
                            return money(
                              Number(
                                chosen?.price ??
                                  productPrice(variantPickerProduct),
                              ),
                            );
                          })()}
                        </Text>
                        <Text style={s.variantPickerHint}>
                          Select size, pack or SKU to continue
                        </Text>
                      </View>
                    </View>

                    <Text style={s.variantPickerSectionTitle}>
                      SELECT YOUR PREFERRED OPTION
                    </Text>
                    <ScrollView
                      style={s.variantPickerOptions}
                      contentContainerStyle={{ paddingBottom: 10 }}
                      showsVerticalScrollIndicator={false}
                      nestedScrollEnabled
                    >
                      {activeVariants(variantPickerProduct).map(
                        (variant, index) => {
                          const sku = String(variant.sku || "");
                          const selected = selectedPickerSku === sku;
                          const stockKnown =
                            variant.stock !== undefined &&
                            variant.stock !== null;
                          const soldOut =
                            stockKnown && Number(variant.stock) <= 0;
                          const original = Number(variant.originalPrice);
                          return (
                            <Pressable
                              key={`${sku || "variant"}-${index}`}
                              disabled={soldOut}
                              onPress={() => setSelectedPickerSku(sku)}
                              style={[
                                s.variantOption,
                                selected && s.variantOptionSelected,
                                soldOut && { opacity: 0.45 },
                              ]}
                            >
                              <View
                                style={[
                                  s.variantOptionRadio,
                                  selected && s.variantOptionRadioSelected,
                                ]}
                              >
                                {selected ? (
                                  <View style={s.variantOptionRadioDot} />
                                ) : null}
                              </View>
                              <View style={{ flex: 1 }}>
                                {variantAttributeEntries(variant).length > 0 ? (
                                  <View style={s.variantAttributeList}>
                                    {variantAttributeEntries(variant).map(
                                      ([key, value]) => (
                                        <View
                                          key={`${sku}-${key}`}
                                          style={[
                                            s.variantAttributeChip,
                                            selected &&
                                              s.variantAttributeChipSelected,
                                          ]}
                                        >
                                          <Text style={s.variantAttributeKey}>
                                            {key}
                                          </Text>
                                          <Text
                                            style={[
                                              s.variantAttributeValue,
                                              selected &&
                                                s.variantAttributeValueSelected,
                                            ]}
                                          >
                                            {value}
                                          </Text>
                                        </View>
                                      ),
                                    )}
                                  </View>
                                ) : (
                                  <Text
                                    style={[
                                      s.variantOptionName,
                                      selected && { color: C.brand },
                                    ]}
                                  >
                                    {variantDisplayName(variant, index)}
                                  </Text>
                                )}
                                <Text style={s.variantOptionSku}>
                                  {sku ? `SKU: ${sku}` : "Standard option"}
                                  {stockKnown
                                    ? ` · ${soldOut ? "Out of stock" : `${variant.stock} available`}`
                                    : ""}
                                </Text>
                              </View>
                              <View style={{ alignItems: "flex-end" }}>
                                <Text style={s.variantOptionPrice}>
                                  {money(Number(variant.price) || 0)}
                                </Text>
                                {original > Number(variant.price || 0) ? (
                                  <Text style={s.variantOptionOriginal}>
                                    {money(original)}
                                  </Text>
                                ) : null}
                              </View>
                            </Pressable>
                          );
                        },
                      )}
                    </ScrollView>

                    <Pressable
                      onPress={confirmVariantAdd}
                      disabled={
                        !selectedPickerSku ||
                        !activeVariants(variantPickerProduct).some(
                          (variant) =>
                            String(variant.sku || "") === selectedPickerSku &&
                            !(
                              variant.stock !== undefined &&
                              Number(variant.stock) <= 0
                            ),
                        )
                      }
                      style={({ pressed }) => [
                        s.variantPickerAddButton,
                        pressed && { opacity: 0.88 },
                        !selectedPickerSku && { opacity: 0.5 },
                      ]}
                    >
                      <LinearGradient
                        colors={["#2563EB", "#312E81", "#7C3AED"]}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={s.variantPickerAddGradient}
                      >
                        <Ionicons
                          name="cart-outline"
                          size={19}
                          color="#FFFFFF"
                        />
                        <Text style={s.variantPickerAddText}>ADD TO CART</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color="#FFFFFF"
                        />
                      </LinearGradient>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          </Modal>

          {/* Location sheet */}
          <Modal
            visible={locationOpen}
            transparent
            animationType="slide"
            statusBarTranslucent={false}
            onRequestClose={closeLocation}
          >
            <View style={s.overlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closeLocation}
                accessibilityLabel="Close"
              />
              <KeyboardAvoidingView
                style={{ width: "100%", justifyContent: "flex-end", flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
              >
                <View
                  style={{
                    alignItems: "center",
                    marginBottom: 14,
                    zIndex: 1000,
                    elevation: 1000,
                  }}
                >
                  <Pressable
                    onPress={closeLocation}
                    accessibilityRole="button"
                    accessibilityLabel="Close modal"
                    hitSlop={10}
                  >
                    <View style={s.floatingModalClose}>
                      <Ionicons name="close" size={25} color="#FFFFFF" />
                    </View>
                  </Pressable>
                </View>
                <View
                  style={[
                    s.sheet,
                    { maxHeight: "82%" },
                    keyboardVisible && { maxHeight: "82%" },
                  ]}
                >
                  <View style={s.sheetHandle} />
                  <View style={s.sheetHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.sheetTitle}>Choose delivery location</Text>
                      <Text style={s.sheetSubtitle}>
                        Search, use GPS, or pick a saved address
                      </Text>
                    </View>
                  </View>

                  <View style={s.sheetSearch}>
                    <Ionicons name="search" size={19} color={C.inkSoft} />
                    <TextInput
                      value={locationSearch}
                      onChangeText={setLocationSearch}
                      placeholder="Search area, street or pincode"
                      placeholderTextColor={C.inkMuted}
                      style={s.sheetSearchInput}
                      autoCorrect={false}
                      autoCapitalize="words"
                      returnKeyType="search"
                      selectionColor={C.brand}
                    />
                    {locationSearch.length > 0 ? (
                      <Pressable
                        onPress={() => {
                          setLocationSearch("");
                          setLocationResults([]);
                        }}
                        hitSlop={10}
                        accessibilityLabel="Clear"
                      >
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={C.inkMuted}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  {!locationSearch.trim() ? (
                    <View style={s.quickActions}>
                      <Pressable
                        style={[s.quickAction, detecting && { opacity: 0.6 }]}
                        disabled={detecting}
                        onPress={useCurrentLocation}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name={detecting ? "locate-outline" : "navigate"}
                          size={20}
                          color={C.brand}
                        />
                        <Text style={s.quickActionText}>
                          {detecting ? "Detecting…" : "Use current location"}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={s.quickAction}
                        onPress={() => {
                          closeLocation();
                          router.push("/checkout/add-address");
                        }}
                        accessibilityRole="button"
                      >
                        <Ionicons
                          name="add-circle-outline"
                          size={21}
                          color={C.brand}
                        />
                        <Text style={s.quickActionText}>Add new address</Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <Text style={s.listLabel}>
                    {locationSearch.trim()
                      ? "Search results"
                      : `Saved addresses${savedAddresses.length ? ` (${savedAddresses.length})` : ""}`}
                  </Text>

                  {locationSearch.trim() ? (
                    locationLoading ? (
                      <View>
                        {[1, 2, 3].map((i) => (
                          <View key={i} style={s.resultRow}>
                            <Skeleton width={20} height={20} radius={10} />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Skeleton width="45%" height={13} radius={5} />
                              <Skeleton
                                width="85%"
                                height={11}
                                radius={5}
                                style={{ marginTop: 7 }}
                              />
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : locationResults.length === 0 ? (
                      <View style={s.status}>
                        <Text style={s.statusText}>
                          No matching locations. Try a nearby landmark or
                          pincode.
                        </Text>
                      </View>
                    ) : (
                      <ScrollView
                        style={s.sheetList}
                        keyboardShouldPersistTaps="always"
                        keyboardDismissMode="on-drag"
                        showsVerticalScrollIndicator={false}
                      >
                        {locationResults.map((r) => {
                          const short = formatSearchResult(r);
                          return (
                            <Pressable
                              key={String(r.place_id)}
                              style={({ pressed }) => [
                                s.resultRow,
                                pressed && { opacity: 0.7 },
                              ]}
                              onPress={() =>
                                chooseLocation(r.display_name?.trim() || short)
                              }
                            >
                              <Ionicons
                                name="location-outline"
                                size={20}
                                color={C.inkSoft}
                              />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={s.resultName} numberOfLines={1}>
                                  {short}
                                </Text>
                                <Text style={s.resultAddress} numberOfLines={2}>
                                  {r.display_name}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )
                  ) : savedLoading ? (
                    <View>
                      {[1, 2].map((i) => (
                        <View key={i} style={s.addressCard}>
                          <Skeleton
                            width={44}
                            height={44}
                            radius={12}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Skeleton width="50%" height={14} radius={5} />
                            <Skeleton
                              width="92%"
                              height={11}
                              radius={5}
                              style={{ marginTop: 9 }}
                            />
                            <Skeleton
                              width="68%"
                              height={11}
                              radius={5}
                              style={{ marginTop: 6 }}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : savedAddresses.length === 0 ? (
                    <View style={[s.status, { paddingVertical: 14 }]}>
                      <CachedImage
                        source={require("../../../assets/images/location-permission.webp")}
                        style={{ width: 150, height: 125 }}
                        resizeMode="contain"
                        accessibilityLabel="Location map illustration"
                      />
                      <Text style={s.emptyTitle}>No saved addresses</Text>
                      <Text style={s.statusText}>
                        Add one to check out faster.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      style={s.sheetList}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      {savedAddresses.map((a) => {
                        const label =
                          formatAddressFull(a) || formatAddressShort(a);
                        const selected =
                          selectedLocation === label ||
                          selectedLocation === formatAddressShort(a);
                        return (
                          <Pressable
                            key={String(a._id)}
                            style={({ pressed }) => [
                              s.addressCard,
                              selected && s.addressCardSelected,
                              pressed && { opacity: 0.85 },
                            ]}
                            onPress={() => chooseLocation(label)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                          >
                            <View style={s.addressIcon}>
                              <Ionicons
                                name={
                                  a.label?.toLowerCase() === "work"
                                    ? "briefcase-outline"
                                    : "home-outline"
                                }
                                size={22}
                                color={C.ink}
                              />
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}
                              >
                                <Text style={s.addressName} numberOfLines={1}>
                                  {a.fullName || "Delivery address"}
                                </Text>
                                {a.label ? (
                                  <View style={s.addressTag}>
                                    <Text style={s.addressTagText}>
                                      {a.label}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={s.addressDetails} numberOfLines={3}>
                                {formatAddressFull(a)}
                              </Text>
                              {a.phone ? (
                                <Text style={s.addressPhone}>{a.phone}</Text>
                              ) : null}
                            </View>
                            {selected ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={22}
                                color={C.brand}
                                style={{ marginLeft: 6 }}
                              />
                            ) : null}
                            <Pressable
                              hitSlop={8}
                              style={s.addressEdit}
                              accessibilityLabel="Edit address"
                              onPress={() => {
                                closeLocation();
                                router.push({
                                  pathname: "/checkout/add-address",
                                  params: { addressId: String(a._id) },
                                });
                              }}
                            >
                              <Ionicons
                                name="create-outline"
                                size={20}
                                color={C.inkSoft}
                              />
                            </Pressable>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              </KeyboardAvoidingView>
            </View>
          </Modal>

          {/* Voice search */}
          <Modal
            visible={voiceOpen}
            transparent
            animationType="slide"
            statusBarTranslucent={false}
            onRequestClose={closeVoice}
          >
            <View style={s.overlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={closeVoice}
                accessibilityLabel="Close voice search"
              />

              <View
                style={{
                  alignItems: "center",
                  marginBottom: 14,
                  zIndex: 1000,
                  elevation: 1000,
                }}
              >
                <Pressable
                  onPress={closeVoice}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                  hitSlop={10}
                >
                  <View style={s.floatingModalClose}>
                    <Ionicons name="close" size={25} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
              <View style={s.voiceSheet}>
                <View style={s.sheetHandle} />
                <Text style={s.voiceTitle}>
                  {voiceError
                    ? "Didn't catch that"
                    : listening
                      ? "Listening…"
                      : "Voice search"}
                </Text>
                <Text style={s.voiceHint}>
                  {voiceError ||
                    (listening
                      ? "Say a product, brand or category"
                      : "Tap the mic and start speaking")}
                </Text>

                <View style={s.micStage}>
                  {listening && !reduceMotion
                    ? [0, 0.5].map((ph) => {
                        const p = Animated.modulo(
                          Animated.add(voicePulse, ph),
                          1,
                        );
                        return (
                          <Animated.View
                            key={ph}
                            pointerEvents="none"
                            style={[
                              s.micRing,
                              {
                                opacity: p.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.35, 0],
                                }),
                                transform: [
                                  {
                                    scale: p.interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [1, 2.1],
                                    }),
                                  },
                                ],
                              },
                            ]}
                          />
                        );
                      })
                    : null}
                  <Pressable
                    style={({ pressed }) => [
                      s.micBig,
                      pressed && {
                        opacity: 0.86,
                        transform: [{ scale: 0.96 }],
                      },
                    ]}
                    onPress={
                      listening ? stopVoice : () => beginListening(voiceLang)
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      listening ? "Stop listening" : "Start listening"
                    }
                  >
                    <LinearGradient
                      colors={["#2563EB", "#312E81", "#7C3AED"]}
                      locations={[0, 0.52, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={s.micGradient}
                    >
                      <Ionicons
                        name={listening ? "stop" : "mic"}
                        size={32}
                        color="#fff"
                      />
                    </LinearGradient>
                  </Pressable>
                </View>

                <Text style={s.voiceTranscript} numberOfLines={3}>
                  {transcript || " "}
                </Text>

                <View style={s.voiceLangRow}>
                  {VOICE_LANGS.map((l) => (
                    <Pressable
                      key={l.code}
                      onPress={() => changeVoiceLang(l.code)}
                      style={[
                        s.sortChip,
                        voiceLang === l.code && s.sortChipActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: voiceLang === l.code }}
                    >
                      <Text
                        style={[
                          s.sortChipText,
                          voiceLang === l.code && s.sortChipTextActive,
                        ]}
                      >
                        {l.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  style={s.voiceCancel}
                  onPress={closeVoice}
                  accessibilityRole="button"
                >
                  <Text style={s.voiceCancelText}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {/* Long-press product preview */}
          <Modal
            visible={!!previewProduct}
            transparent
            animationType="none"
            statusBarTranslucent={false}
            onRequestClose={() => setPreviewProduct(null)}
          >
            <View style={s.productPreviewOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setPreviewProduct(null)}
                accessibilityLabel="Close product preview"
              />
              {previewProduct ? (
                <View style={s.productPreviewContent}>
                  <Pressable
                    onPress={() => setPreviewProduct(null)}
                    style={s.productPreviewClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close preview"
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={20} color={C.ink} />
                  </Pressable>
                  {(() => {
                    const images = productImages(previewProduct);
                    return (
                      <View style={s.productPreviewGallery}>
                        {images.length > 0 ? (
                          <>
                            <ScrollView
                              horizontal
                              pagingEnabled
                              nestedScrollEnabled
                              showsHorizontalScrollIndicator={false}
                              style={{ width: previewCarouselWidth }}
                              contentContainerStyle={{ alignItems: "center" }}
                              onMomentumScrollEnd={(event) => {
                                const nextIndex = Math.round(
                                  event.nativeEvent.contentOffset.x /
                                    previewCarouselWidth,
                                );
                                setPreviewImageIndex(
                                  Math.max(
                                    0,
                                    Math.min(nextIndex, images.length - 1),
                                  ),
                                );
                              }}
                              key={previewProduct._id}
                            >
                              {images.map((uri, index) => (
                                <View
                                  key={`${previewProduct._id}-preview-image-${index}`}
                                  style={[
                                    s.productPreviewImageSlide,
                                    { width: previewCarouselWidth },
                                  ]}
                                >
                                  <CachedImage
                                    source={{ uri }}
                                    style={[
                                      s.productPreviewImage,
                                      {
                                        width: previewCarouselWidth,
                                        height: previewCarouselWidth,
                                      },
                                    ]}
                                    resizeMode="contain"
                                    accessibilityLabel={`${previewProduct.title}, image ${index + 1} of ${images.length}`}
                                  />
                                </View>
                              ))}
                            </ScrollView>
                            {images.length > 1 ? (
                              <View style={s.productPreviewGalleryFooter}>
                                <View style={s.productPreviewDots}>
                                  {images.map((_, index) => (
                                    <View
                                      key={`preview-dot-${index}`}
                                      style={[
                                        s.productPreviewDot,
                                        index === previewImageIndex &&
                                          s.productPreviewDotActive,
                                      ]}
                                    />
                                  ))}
                                </View>
                                <View style={s.productPreviewImageCount}>
                                  <Text style={s.productPreviewImageCountText}>
                                    {Math.min(
                                      previewImageIndex + 1,
                                      images.length,
                                    )}{" "}
                                    / {images.length}
                                  </Text>
                                </View>
                              </View>
                            ) : null}
                          </>
                        ) : (
                          <View
                            style={[
                              s.productPreviewImage,
                              s.cardImagePlaceholder,
                              {
                                width: previewCarouselWidth,
                                height: previewCarouselWidth,
                              },
                            ]}
                          >
                            <Ionicons
                              name="image-outline"
                              size={42}
                              color={C.inkMuted}
                            />
                          </View>
                        )}
                      </View>
                    );
                  })()}
                  <Text style={s.productPreviewTitle} numberOfLines={2}>
                    {previewProduct.title}
                  </Text>
                </View>
              ) : null}
              <Pressable
                style={s.productPreviewShare}
                accessibilityRole="button"
                accessibilityLabel="Share product"
                onPress={async () => {
                  if (!previewProduct) return;

                  const product = previewProduct;
                  const productUrl = `https://odikart.in/products/${product._id}`;
                  const shareMessage = `${product.title} — available on Odikart\n${productUrl}`;
                  const imageUrl = productImage(product);

                  try {
                    // Download remote image first: Android share targets generally need
                    // a local file URI to attach the actual image to the share sheet.
                    if (imageUrl && FileSystem.cacheDirectory) {
                      const extension = imageUrl
                        .split("?")[0]
                        .toLowerCase()
                        .endsWith(".png")
                        ? "png"
                        : imageUrl.split("?")[0].toLowerCase().endsWith(".webp")
                          ? "webp"
                          : "jpg";
                      const localPath = `${FileSystem.cacheDirectory}odikart-share-${product._id}.${extension}`;
                      let localUri = localPath;

                      const info = await FileSystem.getInfoAsync(localPath);
                      if (!info.exists) {
                        const download = await FileSystem.downloadAsync(
                          imageUrl,
                          localPath,
                        );
                        localUri = download.uri;
                      }

                      await Share.open({
                        title: product.title,
                        subject: `${product.title} on Odikart`,
                        message: shareMessage,
                        url: localUri,
                        type:
                          extension === "png"
                            ? "image/png"
                            : extension === "webp"
                              ? "image/webp"
                              : "image/jpeg",
                        failOnCancel: false,
                        useInternalStorage: true,
                      });
                      return;
                    }

                    // If no image is available, still allow the user to share the product link.
                    await Share.open({
                      title: product.title,
                      subject: `${product.title} on Odikart`,
                      message: shareMessage,
                      failOnCancel: false,
                    });
                  } catch (error: any) {
                    // Canceling the share sheet is normal and should not show an error.
                    if (
                      String(error?.message ?? "")
                        .toLowerCase()
                        .includes("cancel")
                    )
                      return;
                    console.log("PRODUCT SHARE ERROR:", error);
                    showToast(
                      "Couldn't share the product image. Please try again.",
                      "error",
                    );
                  }
                }}
              >
                <Ionicons name="share-outline" size={27} color="#6366F1" />
              </Pressable>
            </View>
          </Modal>

          {/* First-launch location and notification permission introduction. */}
          <Modal
            visible={permissionPrompt !== null}
            transparent
            animationType="slide"
            statusBarTranslucent={false}
            onRequestClose={() => {
              if (permissionPrompt === "location") {
                continueToNotificationPrompt();
              } else {
                void finishPermissionIntro();
              }
            }}
          >
            <View style={s.permissionIntroOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  if (permissionPrompt === "location") {
                    continueToNotificationPrompt();
                  } else {
                    void finishPermissionIntro();
                  }
                }}
                accessibilityLabel="Dismiss permission introduction"
              />

              <View
                style={{
                  alignItems: "center",
                  marginBottom: 14,
                  zIndex: 1000,
                  elevation: 1000,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (permissionPrompt === "location") {
                      continueToNotificationPrompt();
                    } else {
                      void finishPermissionIntro();
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Close permission modal"
                  hitSlop={10}
                >
                  <View style={s.floatingModalClose}>
                    <Ionicons name="close" size={25} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
              <View style={s.permissionIntroCard}>
                <View style={s.permissionIntroIconWrap}>
                  <Ionicons
                    name={
                      permissionPrompt === "location"
                        ? "location-outline"
                        : "notifications-outline"
                    }
                    size={76}
                    color={
                      permissionPrompt === "location" ? "#252525" : C.brand
                    }
                  />
                  {permissionPrompt === "location" ? (
                    <View style={s.permissionIntroSlash} />
                  ) : null}
                </View>

                <Text style={s.permissionIntroTitle}>
                  {permissionPrompt === "location"
                    ? "Location permission not enabled"
                    : "Stay updated with Odikart"}
                </Text>
                <Text style={s.permissionIntroDescription}>
                  {permissionPrompt === "location"
                    ? "Please enable location permission for a better delivery experience"
                    : "Enable notifications to receive order updates, delivery alerts and special offers"}
                </Text>

                <View style={s.permissionIntroDivider} />

                <Pressable
                  style={s.permissionIntroPrimary}
                  disabled={permissionPromptBusy}
                  onPress={
                    permissionPrompt === "location"
                      ? handleEnableLocationFromIntro
                      : handleEnableNotificationsFromIntro
                  }
                >
                  {permissionPromptBusy ? (
                    <ActivityIndicator color={C.success} />
                  ) : (
                    <Text style={s.permissionIntroPrimaryText}>
                      {permissionPrompt === "location"
                        ? "Enable device location"
                        : "Enable notifications"}
                    </Text>
                  )}
                </Pressable>

                <View style={s.permissionIntroDivider} />

                <Pressable
                  style={s.permissionIntroSecondary}
                  disabled={permissionPromptBusy}
                  onPress={() => {
                    if (permissionPrompt === "location") {
                      setPermissionPrompt(null);
                      setShowNotificationAfterLocationPicker(true);
                      setLocationOpen(true);
                      void loadSavedAddresses();
                    } else {
                      void finishPermissionIntro();
                    }
                  }}
                >
                  <Text style={s.permissionIntroSecondaryText}>
                    {permissionPrompt === "location"
                      ? "Select location manually"
                      : "Maybe later"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          <Modal
            visible={filterOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setFilterOpen(false)}
            statusBarTranslucent={false}
          >
            <View style={s.filterOverlay}>
              <Pressable
                style={s.filterBackdrop}
                onPress={() => setFilterOpen(false)}
              />

              <View
                style={{
                  alignItems: "center",
                  marginBottom: 14,
                  zIndex: 1000,
                  elevation: 1000,
                }}
              >
                <Pressable
                  onPress={() => setFilterOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close modal"
                  hitSlop={10}
                >
                  <View style={s.floatingModalClose}>
                    <Ionicons name="close" size={25} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
              <View style={s.filterSheet}>
                <View style={s.filterHandle} />
                <View
                  style={[
                    s.modalTopCloseRow,
                    { paddingHorizontal: 18, marginTop: 2 },
                  ]}
                ></View>
                <View style={s.filterHeader}>
                  <View style={s.filterHeaderIcon}>
                    <Ionicons name="options" size={22} color={C.brand} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Text style={s.filterTitle}>Find your favourites</Text>
                      {activeFilterCount > 0 ? (
                        <View style={s.filterHeaderBadge}>
                          <Text style={s.filterHeaderBadgeText}>
                            {activeFilterCount}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.filterSubtitle}>
                      Fine-tune your shopping results
                    </Text>
                  </View>
                </View>
                <View style={s.filterDashboard}>
                  {/* Website-style left filter navigation */}
                  <ScrollView
                    style={s.filterSidebar}
                    contentContainerStyle={s.filterSidebarContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={s.filterSidebarEyebrow}>FILTER BY</Text>
                    {(
                      [
                        {
                          id: "category",
                          title: "Category",
                          subtitle: "Choose category",
                          count: selectedCategory !== "All" ? 1 : 0,
                          icon: "grid-outline",
                        },
                        {
                          id: "subcategory",
                          title: "Subcategory",
                          subtitle: "Refine category",
                          count: selectedSubCategory !== "All" ? 1 : 0,
                          icon: "layers-outline",
                        },
                        {
                          id: "brand",
                          title: "Brand",
                          subtitle: "Choose brand",
                          count: selectedBrand !== "All" ? 1 : 0,
                          icon: "pricetag-outline",
                        },
                        {
                          id: "price",
                          title: "Price Range",
                          subtitle: "Set your budget",
                          count:
                            priceRange[0] !== 0 || priceRange[1] !== 5000
                              ? 1
                              : 0,
                          icon: "cash-outline",
                        },
                        {
                          id: "sort",
                          title: "Sort By",
                          subtitle: "Arrange products",
                          count: sort !== "relevance" ? 1 : 0,
                          icon: "swap-vertical-outline",
                        },
                      ] as const
                    ).map((item) => {
                      const active = activeFilter === item.id;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setActiveFilter(item.id)}
                          style={[
                            s.filterNavItem,
                            active && s.filterNavItemActive,
                          ]}
                        >
                          {active ? (
                            <View style={s.filterNavIndicator} />
                          ) : null}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                s.filterNavTitle,
                                active && s.filterNavTitleActive,
                              ]}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={[
                                s.filterNavSubtitle,
                                active && s.filterNavSubtitleActive,
                              ]}
                            >
                              {item.subtitle}
                            </Text>
                          </View>
                          {item.count > 0 ? (
                            <View style={s.filterNavCount}>
                              <Text style={s.filterNavCountText}>
                                {item.count}
                              </Text>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {/* Active filter content */}
                  <ScrollView
                    style={s.filterContentPane}
                    contentContainerStyle={s.filterBody}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {activeFilter === "category" && (
                      <View style={s.filterSectionCard}>
                        <View style={{ marginBottom: 14 }}>
                          <Text style={s.filterContentTitle}>Category</Text>
                          <Text style={s.filterContentDescription}>
                            Select the category you want to browse
                          </Text>
                        </View>
                        <View style={s.categoryPickerGrid}>
                          {[
                            { _id: "All", name: "All Categories" },
                            ...categories,
                          ].map((item: any, index: number) => {
                            const selected =
                              selectedCategory === String(item._id);
                            const imageUrl = getCategoryImageUrl(item.image);
                            return (
                              <Pressable
                                key={`filter-category-${item._id}`}
                                onPress={() => {
                                  setSelectedCategory(String(item._id));
                                  setSelectedSubCategory("All");
                                  setActiveFilter("subcategory");
                                }}
                                style={({ pressed }) => [
                                  s.categoryPickerCard,
                                  selected && s.categoryPickerCardActive,
                                  pressed && {
                                    transform: [{ scale: 0.97 }],
                                    opacity: 0.92,
                                  },
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={`${item.name}${selected ? ", selected" : ""}`}
                              >
                                <View
                                  style={[
                                    s.categoryPickerImageWrap,
                                    {
                                      backgroundColor:
                                        TILE_TINTS[index % TILE_TINTS.length],
                                    },
                                    selected && s.categoryPickerImageWrapActive,
                                  ]}
                                >
                                  {imageUrl ? (
                                    <CachedImage
                                      source={{ uri: imageUrl }}
                                      style={s.categoryPickerImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <Text style={s.categoryPickerFallbackIcon}>
                                      {item.icon ||
                                        (item._id === "All" ? "🛍️" : "📦")}
                                    </Text>
                                  )}
                                  {selected ? (
                                    <View style={s.categoryPickerCheck}>
                                      <Ionicons
                                        name="checkmark"
                                        size={13}
                                        color="#FFFFFF"
                                      />
                                    </View>
                                  ) : null}
                                </View>
                                <Text
                                  style={[
                                    s.categoryPickerName,
                                    selected && s.categoryPickerNameActive,
                                  ]}
                                  numberOfLines={2}
                                >
                                  {item.name}
                                </Text>
                                <Text style={s.categoryPickerHint}>
                                  {item._id === "All"
                                    ? "Explore everything"
                                    : "Explore category"}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {activeFilter === "subcategory" && (
                      <View style={s.filterSectionCard}>
                        <View style={s.filterSectionHeading}>
                          <View style={s.filterSectionIcon}>
                            <Ionicons
                              name="layers-outline"
                              size={16}
                              color={C.brand}
                            />
                          </View>
                          <View>
                            <Text style={s.filterContentTitle}>
                              Explore subcategories
                            </Text>
                            <Text style={s.filterContentDescription}>
                              Pick a collection to narrow down your results
                            </Text>
                          </View>
                        </View>
                        {subCategoriesLoading ? (
                          <Text style={s.filterMuted}>
                            Loading subcategories...
                          </Text>
                        ) : (
                          <View style={s.filterStackList}>
                            {[
                              {
                                _id: "All",
                                name: "All Subcategories",
                                image: undefined,
                                icon: "🛍️",
                              },
                              ...subCategories,
                            ].map((item: any, index: number) => {
                              const selected =
                                selectedSubCategory === String(item._id);
                              return (
                                <Pressable
                                  key={`filter-subcategory-${item._id}`}
                                  onPress={() =>
                                    setSelectedSubCategory(String(item._id))
                                  }
                                  style={[
                                    s.filterImageRow,
                                    selected && s.filterImageRowActive,
                                  ]}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected }}
                                >
                                  {item.image ? (
                                    <CachedImage
                                      source={{ uri: item.image }}
                                      style={s.filterCategoryImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View
                                      style={[
                                        s.filterCategoryImageFallback,
                                        {
                                          backgroundColor:
                                            TILE_TINTS[
                                              index % TILE_TINTS.length
                                            ],
                                        },
                                      ]}
                                    >
                                      <Text style={{ fontSize: 21 }}>
                                        {item.icon || "📦"}
                                      </Text>
                                    </View>
                                  )}
                                  <Text
                                    style={[
                                      s.filterCategoryRowText,
                                      selected && s.filterCategoryRowTextActive,
                                    ]}
                                  >
                                    {item.name}
                                  </Text>
                                  {selected ? (
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={21}
                                      color={C.brand}
                                    />
                                  ) : null}
                                </Pressable>
                              );
                            })}
                            {subCategories.length === 0 ? (
                              <Text style={s.filterMuted}>
                                No subcategories available.
                              </Text>
                            ) : null}
                          </View>
                        )}
                      </View>
                    )}

                    {activeFilter === "brand" && (
                      <View style={s.filterSectionCard}>
                        <View style={s.filterSectionHeading}>
                          <View style={s.filterSectionIcon}>
                            <Ionicons
                              name="pricetag-outline"
                              size={16}
                              color={C.brand}
                            />
                          </View>
                          <View>
                            <Text style={s.filterContentTitle}>
                              Choose a brand
                            </Text>
                            <Text style={s.filterContentDescription}>
                              Choose your preferred brand
                            </Text>
                          </View>
                        </View>
                        <View style={s.filterStackList}>
                          {[
                            { name: "All", image: undefined },
                            ...uniqueBrands,
                          ].map((item: any, index: number) => {
                            const selected = selectedBrand === item.name;
                            return (
                              <Pressable
                                key={`filter-brand-${item.name}`}
                                onPress={() => setSelectedBrand(item.name)}
                                style={[
                                  s.filterImageRow,
                                  selected && s.filterImageRowActive,
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                              >
                                {item.image ? (
                                  <CachedImage
                                    source={{ uri: item.image }}
                                    style={s.filterCategoryImage}
                                    resizeMode="contain"
                                  />
                                ) : (
                                  <View
                                    style={[
                                      s.filterCategoryImageFallback,
                                      {
                                        backgroundColor:
                                          TILE_TINTS[index % TILE_TINTS.length],
                                      },
                                    ]}
                                  >
                                    <Ionicons
                                      name="pricetag-outline"
                                      size={21}
                                      color={C.brand}
                                    />
                                  </View>
                                )}
                                <Text
                                  style={[
                                    s.filterCategoryRowText,
                                    selected && s.filterCategoryRowTextActive,
                                  ]}
                                >
                                  {item.name === "All"
                                    ? "All Brands"
                                    : item.name}
                                </Text>
                                {selected ? (
                                  <Ionicons
                                    name="checkmark-circle"
                                    size={21}
                                    color={C.brand}
                                  />
                                ) : null}
                              </Pressable>
                            );
                          })}
                          {uniqueBrands.length === 0 ? (
                            <Text style={s.filterMuted}>
                              No brands available.
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )}

                    {activeFilter === "price" && (
                      <View style={s.filterSectionCard}>
                        <View style={s.filterSectionHeading}>
                          <View style={s.filterSectionIcon}>
                            <Ionicons
                              name="cash-outline"
                              size={16}
                              color={C.brand}
                            />
                          </View>
                          <View>
                            <Text style={s.filterContentTitle}>
                              Price Range
                            </Text>
                            <Text style={s.filterContentDescription}>
                              Set your budget and find products within your
                              range
                            </Text>
                          </View>
                        </View>
                        <Text style={s.filterPriceHeadline}>
                          {money(priceRange[0])} — {money(priceRange[1])}
                          {priceRange[1] >= 5000 ? "+" : ""}
                        </Text>
                        <View style={s.filterPriceInputs}>
                          <View style={s.filterPriceField}>
                            <Text style={s.filterFieldLabel}>MINIMUM (₹)</Text>
                            <TextInput
                              value={minPriceInput}
                              onChangeText={(v) => {
                                const clean = v.replace(/[^0-9]/g, "");
                                setMinPriceInput(clean);
                                const n = Number(clean);
                                if (Number.isFinite(n) && n <= priceRange[1])
                                  setPriceRange([n, priceRange[1]]);
                              }}
                              keyboardType="number-pad"
                              style={s.filterPriceInput}
                              placeholder="0"
                            />
                          </View>
                          <View style={s.filterPriceField}>
                            <Text style={s.filterFieldLabel}>MAXIMUM (₹)</Text>
                            <TextInput
                              value={maxPriceInput}
                              onChangeText={(v) => {
                                const clean = v.replace(/[^0-9]/g, "");
                                setMaxPriceInput(clean);
                                const n = Number(clean);
                                if (Number.isFinite(n) && n >= priceRange[0])
                                  setPriceRange([priceRange[0], n]);
                              }}
                              keyboardType="number-pad"
                              style={s.filterPriceInput}
                              placeholder="5000"
                            />
                          </View>
                        </View>
                        <Text style={s.filterQuickLabel}>QUICK SELECT</Text>
                        <View style={s.filterChipWrap}>
                          {[
                            {
                              label: "Under ₹500",
                              range: [0, 500] as [number, number],
                            },
                            {
                              label: "₹500 – ₹1,000",
                              range: [500, 1000] as [number, number],
                            },
                            {
                              label: "₹1,000 – ₹2,500",
                              range: [1000, 2500] as [number, number],
                            },
                            {
                              label: "₹2,500+",
                              range: [2500, 5000] as [number, number],
                            },
                            {
                              label: "Any price",
                              range: [0, 5000] as [number, number],
                            },
                          ].map((preset) => {
                            const active =
                              priceRange[0] === preset.range[0] &&
                              priceRange[1] === preset.range[1];
                            return (
                              <Pressable
                                key={preset.label}
                                onPress={() => {
                                  setPriceRange(preset.range);
                                  setMinPriceInput(String(preset.range[0]));
                                  setMaxPriceInput(String(preset.range[1]));
                                }}
                                style={[
                                  s.filterOption,
                                  active && s.filterOptionActive,
                                ]}
                              >
                                <Text
                                  style={[
                                    s.filterOptionText,
                                    active && s.filterOptionTextActive,
                                  ]}
                                >
                                  {preset.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {activeFilter === "sort" && (
                      <View style={s.filterSectionCard}>
                        <View style={s.filterSectionHeading}>
                          <View style={s.filterSectionIcon}>
                            <Ionicons
                              name="swap-vertical-outline"
                              size={16}
                              color={C.brand}
                            />
                          </View>
                          <View>
                            <Text style={s.filterContentTitle}>
                              Sort Products
                            </Text>
                            <Text style={s.filterContentDescription}>
                              Choose how you want products to appear
                            </Text>
                          </View>
                        </View>
                        <View style={s.filterSortList}>
                          {SORTS.map((option) => (
                            <Pressable
                              key={`filter-sort-${option.key}`}
                              onPress={() => setSort(option.key)}
                              style={[
                                s.filterSortOption,
                                sort === option.key && s.filterOptionActive,
                              ]}
                            >
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={[
                                    s.filterOptionText,
                                    sort === option.key &&
                                      s.filterOptionTextActive,
                                  ]}
                                >
                                  {option.label}
                                </Text>
                                <Text
                                  style={[
                                    s.filterMuted,
                                    { paddingVertical: 2 },
                                  ]}
                                >
                                  {option.key === "relevance"
                                    ? "Recommended products"
                                    : option.key === "priceLow"
                                      ? "Cheapest products first"
                                      : option.key === "priceHigh"
                                        ? "Most expensive products first"
                                        : option.key === "discount"
                                          ? "Highest discount first"
                                          : "Best rated products first"}
                                </Text>
                              </View>
                              <Ionicons
                                name={
                                  sort === option.key
                                    ? "radio-button-on"
                                    : "radio-button-off"
                                }
                                size={19}
                                color={sort === option.key ? "#fff" : C.inkSoft}
                              />
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    )}
                  </ScrollView>
                </View>
                <View style={s.filterFooter}>
                  <Pressable
                    style={s.filterResetButton}
                    onPress={() => {
                      setSelectedCategory("All");
                      setSelectedSubCategory("All");
                      setSelectedBrand("All");
                      setPriceRange([0, 5000]);
                      setMinPriceInput("0");
                      setMaxPriceInput("5000");
                      setSort("relevance");
                      setActiveFilter("category");
                      setVisibleCount(PAGE_SIZE);
                    }}
                  >
                    <LinearGradient
                      colors={["#2563EB", "#312E81", "#7C3AED"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={s.filterFooterButtonGradient}
                    >
                      <Ionicons
                        name="options-outline"
                        size={16}
                        color="#FFFFFF"
                      />
                      <Text style={s.filterFooterButtonText}>Reset</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    style={s.filterApplyButton}
                    onPress={() => {
                      // Apply filters in-place on the current Home/category view.
                      // Do not navigate to the separate All Categories screen.
                      setVisibleCount(PAGE_SIZE);
                      setFilterOpen(false);

                      requestAnimationFrame(() => {
                        const targetY = Math.max(
                          0,
                          allProductsOffset - stickySearchHeight,
                        );
                        mainRef.current?.scrollTo({
                          y: targetY,
                          animated: true,
                        });
                      });
                    }}
                  >
                    <LinearGradient
                      colors={["#2563EB", "#312E81", "#7C3AED"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.filterApplyGradient}
                    >
                      <Ionicons name="checkmark" size={17} color="#fff" />
                      <Text style={s.filterApplyText}>Show Products</Text>
                      <View style={s.filterFooterCount}>
                        <Text style={s.filterFooterCountText}>
                          {sortedResults.length}
                        </Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* Modern full-bleed banner collection screen. Banner starts behind status bar. */}
          <Modal
            visible={bannerCollection !== null}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent={false}
            onRequestClose={() => {
              setBannerCollection(null);
              startBannerAuto();
            }}
          >
            <SafeAreaView
              style={{ flex: 1, backgroundColor: C.bg }}
              edges={["top", "left", "right", "bottom"]}
            >
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 26 }}
              >
                {/* Edge-to-edge hero image, including behind the status bar. */}
                {bannerCollection?.imageUrl ? (
                  <View style={{ width: "100%", height: 238, backgroundColor: C.brandDark, overflow: "hidden" }}>
                    <ExpoImage
                      source={{ uri: bannerCollection.imageUrl }}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      priority="high"
                      transition={100}
                    />
                    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 68, backgroundColor: "rgba(0,0,0,0.12)" }} />
                    <Pressable
                      onPress={() => { setBannerCollection(null); startBannerAuto(); }}
                      style={{ position: "absolute", top: 12, right: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}
                      accessibilityRole="button"
                      accessibilityLabel="Close banner products"
                    >
                      <Ionicons name="close" size={23} color={C.ink} />
                    </Pressable>
                  </View>
                ) : null}

                {/* Collection title / count */}
                <View style={{ paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 14, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: C.line }}>
                  <Text numberOfLines={2} style={{ color: C.ink, fontSize: 21, fontWeight: "900", letterSpacing: -0.35 }}>
                    {bannerCollection?.title || "Featured products"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", marginTop: 7 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.brand, marginRight: 7 }} />
                    <Text style={{ color: C.inkSoft, fontSize: 13, fontWeight: "600" }}>
                      {bannerCollection?.products.length || 0} handpicked products
                    </Text>
                  </View>
                </View>


                {bannerCollection?.products.length ? (
                  <View style={{ paddingTop: 14 }}>
                    <View style={s.grid}>
                      {bannerCollection.products.map((item, index) =>
                        renderCard(item, gridCardW, index),
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={{ flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", padding: 28 }}>
                    <Ionicons name="bag-outline" size={42} color={C.inkMuted} />
                    <Text style={{ marginTop: 12, color: C.ink, fontSize: 16, fontWeight: "700" }}>
                      No products available
                    </Text>
                    <Text style={{ marginTop: 6, color: C.inkSoft, fontSize: 13, textAlign: "center" }}>
                      The products selected for this banner may be unavailable right now.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </SafeAreaView>
          </Modal>


          <Toast toast={toast} />
        </SafeAreaView>
      </View>
    </GestureHandlerRootView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: C.bg,
  },
  searchLogo: {
    width: 30,
    height: 30,
    marginRight: 2,
  },

  /* header */
  header: {
    backgroundColor: C.brand,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerHero: {
    paddingTop: 8,
    paddingBottom: 15,
    overflow: "hidden",
    backgroundColor: "#312E81",
  },
  // deliveryEtaRow: {
  //   minHeight: 43,
  //   paddingHorizontal: GUTTER + 2,
  //   paddingTop: 4,
  //   paddingBottom: 2,
  //   flexDirection: "row",
  //   alignItems: "center",
  //   gap: 7,
  // },
  // deliveryEtaText: {
  //   color: "#FFFFFF",
  //   fontSize: 30,
  //   lineHeight: 36,
  //   fontWeight: "900",
  //   letterSpacing: -0.7,
  // },
  quickActionRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    columnGap: 8,
    marginBottom: 10,
  },
  quickAction: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    paddingVertical: 7,
  },
  quickActionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.97 }],
  },
  quickActionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  quickActionText: {
    color: C.ink,
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  headerTop: {
    backgroundColor: "transparent",
    paddingHorizontal: GUTTER,
    paddingTop: 1,
    // paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyHeaderBackdrop: {
    // Purple backing remains visible only in the rounded top corners.
    backgroundColor: "#312E81",
    width: "100%",
    alignSelf: "stretch",
  },
  stickyHeader: {
    // The delivery header scrolls away; this combined search/category surface stays pinned.
    // Keep the complete search bar above the sticky category rail on Android
    // and iOS so the TextInput never gets covered while scrolling.
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: "hidden",
    width: "100%",
    alignSelf: "stretch",
    zIndex: 50,
    elevation: 8,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  locationBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    minHeight: 44,
  },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  deliverTo: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  locationText: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  bellBadge: {
    position: "absolute",
    right: 2,
    top: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#dc1d1d",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },

  searchWrap: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: GUTTER,
    paddingTop: 7,
    paddingBottom: 9,
    zIndex: 20,
  },
  searchGradientShell: {
    borderRadius: 22,
    padding: 1,
    overflow: "hidden",
    shadowColor: "#27346B",
    shadowOpacity: 0.06,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchBox: {
    width: "100%",
    marginTop: 3,
    minWidth: 0,
    minHeight: 54,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 10,
    borderWidth: 1,
    borderColor: "#ECEEF5",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.025,
    shadowRadius: 2,
    elevation: 1,
  },
  searchLogo: { width: 27, height: 27 },
  searchBackBtn: {
    width: 30,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 52,
    fontSize: 15,
    lineHeight: 20,
    color: C.ink,
    paddingHorizontal: 0,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },

  /* sections */
  sectionHeader: {
    paddingHorizontal: GUTTER,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.35,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: C.inkSoft,
  },
  seeAll: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    paddingLeft: 10,
  },
  seeAllText: { color: C.brand, fontSize: 13, fontWeight: "700" },
  shelf: { marginTop: 22, backgroundColor: C.surface },
  shelfList: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 3,
    // Align the first horizontal product card with the section heading.
    paddingLeft: GUTTER,
    paddingRight: GUTTER,
  },
  grid: {
    backgroundColor: C.surface,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: GUTTER,
    columnGap: GRID_GAP,
    rowGap: 16,
    alignItems: "stretch",
  },

  /* sticky category rail */
  categoryRail: {
    backgroundColor: "transparent",
    paddingTop: 0,
    paddingBottom: 7,
  },
  categoryRailContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    columnGap: 20,
  },
  categoryRailItem: {
    minWidth: 68,
    minHeight: 76,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingTop: 3,
  },
  categoryRailIcon: {
    width: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F4F5FA",
  },
  categoryRailIconActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  categoryRailImage: {
    width: 44,
    height: 44,
  },
  categoryRailEmoji: {
    fontSize: 25,
  },
  categoryRailLabel: {
    marginTop: 4,
    maxWidth: 84,
    color: C.inkSoft,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  categoryRailLabelActive: {
    color: C.brandDark,
    fontWeight: "900",
  },
  categoryRailIndicator: {
    width: 0,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    marginTop: 3,
    backgroundColor: "transparent",
  },
  categoryRailIndicatorActive: {
    width: "72%",
    backgroundColor: C.brand,
  },

  visualCategorySection: {
    marginTop: 0,
    paddingTop: 3,
    paddingBottom: 5,
    backgroundColor: "#FFFFFF",
  },
  visualCategoryHeading: {
    paddingHorizontal: GUTTER,
    marginBottom: 12,
  },
  visualCategoryTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  visualCategorySub: {
    color: C.inkMuted,
    fontSize: 12,
    marginTop: 3,
  },
  visualCategoryList: {
    paddingLeft: 8,
    paddingRight: 12,
    paddingBottom: 5,
    columnGap: 7,
  },

  /* Selected category landing page */
  categoryLanding: {
    marginTop: 10,
    marginBottom: 12,
  },
  categoryHero: {
    marginHorizontal: GUTTER,
    minHeight: 190,
    borderRadius: 26,
    padding: 17,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 5,
  },
  categoryHeroCopy: {
    flex: 1,
    zIndex: 2,
    paddingRight: 8,
  },
  categoryBackButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.17)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    marginBottom: 15,
    gap: 5,
  },
  categoryBackText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  categoryEyebrow: {
    color: "#DDD6FE",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.35,
    marginBottom: 6,
  },
  categoryHeroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    lineHeight: 30,
    fontWeight: "900",
    maxWidth: 220,
    letterSpacing: -0.6,
  },
  categoryHeroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
    maxWidth: 190,
  },
  categoryCountPill: {
    alignSelf: "flex-start",
    marginTop: 13,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.17)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  categoryHeroMedia: {
    width: 112,
    height: 132,
    borderRadius: 22,
    padding: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    zIndex: 1,
    transform: [{ rotate: "3deg" }],
  },
  categoryHeroImage: {
    width: "100%",
    height: "100%",
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  categoryHeroImageFallback: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryHeroGlow: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    right: 35,
    top: -115,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  categoryHeroDecor: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    right: -64,
    bottom: -92,
    backgroundColor: "rgba(196,181,253,0.18)",
  },
  categorySubHeader: {
    paddingHorizontal: GUTTER,
    marginTop: 22,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categorySubTitle: {
    color: C.ink,
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.25,
  },
  categorySubCaption: {
    color: C.inkMuted,
    fontSize: 11,
    marginTop: 4,
  },
  categorySubRail: {
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
    gap: 9,
  },
  categorySubChip: {
    minHeight: 46,
    maxWidth: 190,
    paddingLeft: 6,
    paddingRight: 13,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E7E5F4",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 5,
    elevation: 1,
  },
  categorySubChipActive: {
    backgroundColor: C.brand,
    borderColor: C.brand,
    shadowColor: C.brand,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  categorySubChipImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
  },
  categorySubChipImageActive: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
  },
  categorySubChipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  categorySubChipIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  categorySubChipText: {
    color: C.inkSoft,
    fontSize: 11,
    fontWeight: "800",
    flexShrink: 1,
    maxWidth: 120,
  },
  categorySubChipTextActive: {
    color: "#FFFFFF",
  },
  categoryQuickInfo: {
    marginHorizontal: GUTTER,
    marginTop: 8,
    marginBottom: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF0F7",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  categoryQuickInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  categoryQuickInfoText: {
    color: C.inkMuted,
    fontSize: 10,
    fontWeight: "700",
  },

  /* categories */
  categorySectionHeader: {
    marginTop: 12,
    marginBottom: 14,
    paddingHorizontal: GUTTER,
    flexDirection: "row",
    alignItems: "center",
  },
  categorySectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -0.35,
  },
  categorySectionSubtitle: {
    marginTop: 3,
    fontSize: 12.5,
    lineHeight: 17,
    color: C.inkSoft,
  },
  categorySeeAll: {
    minHeight: 44,
    paddingLeft: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  categoryName: {
    marginTop: 7,
    minHeight: 28,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
    color: C.ink,
    textAlign: "center",
  },

  skeletonCategoryTile: {
    width: 82,
    height: 82,
    borderRadius: 23,
    backgroundColor: "#ECEEF3",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonProductMedia: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 13,
    backgroundColor: "#F3F4F6",
  },
  skeletonWishlist: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  skeletonDiscount: {
    position: "absolute",
    top: 7,
    left: 7,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  skeletonPriceRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonBanner: {
    minHeight: 184,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  skeletonBannerContent: {
    flex: 1,
    paddingVertical: 20,
    alignItems: "flex-start",
  },
  skeletonBannerArt: {
    width: 78,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  shine: {
    position: "absolute",
    left: 0,
    top: -60,
    width: 34,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    zIndex: 50,
  },
  bannerBackdrop: {
    paddingTop: 13,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  categoryRailOuter: {
    backgroundColor: "#FFFFFF",
    zIndex: 30,
    borderColor: "#EEF0F5",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dots: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(18,20,43,0.22)",
  },
  dotActive: { width: 18, backgroundColor: C.brand },
  // Explicit 100% size is required: local images default to their file size (1080x450) and ignore left/right/bottom.
  bannerImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },

  catGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    paddingBottom: 14,
    columnGap: 14,
  },

  catItem: {
    width: 62,
    minHeight: 88,
    alignItems: "center",
    justifyContent: "flex-start",
    borderRadius: 18,
  },

  // Compact sticky rail keeps a small category thumbnail beside its label.
  catItemCompact: {
    minHeight: 42,
    minWidth: 0,
    width: "auto",
    maxWidth: 150,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 7,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.16)",
  },

  catTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4FA",
    borderWidth: 1,
    borderColor: "#EEF0F7",
    elevation: 1,
    shadowColor: "#27346B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.045,
    shadowRadius: 4,
  },

  catTileCompact: {
    width: 30,
    height: 30,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.14)",
  },

  catImage: {
    width: "100%",
    height: "100%",
  },
  catImageCompact: {
    width: "100%",
    height: "100%",
  },

  catFallbackIcon: {
    fontSize: 23,
  },
  catFallbackIconCompact: {
    fontSize: 16,
  },

  catName: {
    width: "100%",
    marginTop: 6,
    color: "#34384B",
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 2,
  },
  catNameCompact: {
    color: "#342A72",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    textAlign: "left",
    flexShrink: 1,
    maxWidth: 104,
    paddingHorizontal: 0,
  },

  /* banner */
  banner: {
    height: 190,
    borderRadius: 23,
    overflow: "hidden",
    backgroundColor: "#F1F3FA",
    borderWidth: 1,
    borderColor: "#EEF0F6",
  },
  cardImageWrap: {
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#F6F7FB",
    borderWidth: 1,
    borderColor: "#F0F1F6",
  },
  cardImageCarousel: { width: "100%", height: "100%" },
  cardImage: { width: "100%", height: "100%" },
  cardCarouselArrow: {
    position: "absolute",
    top: "42%",
    zIndex: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(30,30,60,0.08)",
    elevation: 3,
  },
  cardCarouselArrowLeft: { left: 5 },
  cardCarouselArrowRight: { right: 5 },
  cardCarouselDots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    zIndex: 1,
  },
  cardCarouselDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(40,40,60,0.22)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.9)",
  },
  cardCarouselDotActive: {
    width: 14,
    backgroundColor: C.brand,
    borderColor: "#FFFFFF",
  },
  cardCarouselMore: {
    color: C.inkSoft,
    fontSize: 8,
    fontWeight: "800",
    marginLeft: 1,
    backgroundColor: "rgba(255,255,255,0.8)",
    overflow: "hidden",
    paddingHorizontal: 3,
    borderRadius: 5,
  },
  cardImagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  imageCountBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    minWidth: 35,
    height: 23,
    paddingHorizontal: 7,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,20,43,0.62)",
  },
  imageCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  discountBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: C.brand,
  },
  discountBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  wishBtn: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderWidth: 1,
    borderColor: "#EEF0F5",
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  cardBody: { paddingTop: 8, paddingHorizontal: 3 },
  cardTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "750",
    color: C.ink,
  },
  cardUnit: { marginTop: 2, fontSize: 11, lineHeight: 14, color: C.inkMuted },
  cardPriceRow: {
    minHeight: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 0,
  },
  cardMetaRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 0,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
  },
  ratingText: { fontSize: 10.5, fontWeight: "700", color: C.ink },
  reviewCount: { fontSize: 10, color: C.inkMuted },
  newTag: { fontSize: 10.5, fontWeight: "700", color: C.brand },
  price: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "900",
    color: "#15182A",
    letterSpacing: -0.35,
  },
  originalPrice: {
    fontSize: 10,
    color: C.inkMuted,
    textDecorationLine: "line-through",
  },
  addBtn: {
    minWidth: 68,
    height: 35,
    paddingHorizontal: 10,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    elevation: 2,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.25,
  },
  stepper: {
    height: 35,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  stepBtn: {
    width: 28,
    height: 29,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  stepQty: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    minWidth: 13,
    textAlign: "center",
  },
  outPill: {
    paddingHorizontal: 6,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  outText: { color: C.danger, fontSize: 9.5, fontWeight: "800" },

  /* voice */
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceSheet: {
    maxHeight: "82%",
    backgroundColor: "#F3F4FA",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 24,
    alignItems: "center",
    width: "100%",
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 22,
  },
  voiceTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  voiceHint: {
    marginTop: 6,
    fontSize: 13.5,
    color: C.inkSoft,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  micStage: {
    height: 170,
    width: 170,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  micRing: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.brand,
  },
  micBig: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  micGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  voiceTranscript: {
    minHeight: 50,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: C.ink,
    textAlign: "center",
  },
  voiceLangRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  voiceCancel: {
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 28,
    borderRadius: 23,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceCancelText: { fontSize: 14, fontWeight: "800", color: C.inkSoft },

  /* Search discovery page only */
  suggestWrap: {
    paddingTop: 18,
    paddingHorizontal: GUTTER,
    paddingBottom: 24,
    backgroundColor: "#FFFFFF",
  },
  searchWelcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    marginBottom: 24,
    borderRadius: 19,
    backgroundColor: "#F7F8FF",
    borderWidth: 1,
    borderColor: "#E9EAFE",
  },
  searchWelcomeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8EAFE",
  },
  searchWelcomeTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  searchWelcomeSubtitle: {
    color: C.inkSoft,
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 3,
  },
  searchSection: { marginBottom: 23 },
  searchSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  searchSectionHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  suggestTitle: { fontSize: 14, fontWeight: "800", color: C.ink },
  searchClearText: { color: C.brand, fontSize: 12, fontWeight: "800" },
  searchSectionNote: { color: C.inkMuted, fontSize: 10.5, fontWeight: "600" },
  searchRecentList: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  searchRecentItem: {
    minHeight: 39,
    maxWidth: "100%",
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF2",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchRecentText: {
    maxWidth: 180,
    color: C.ink,
    fontSize: 12,
    fontWeight: "600",
  },
  searchCategoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  searchCategoryCard: {
    width: "48.5%",
    minHeight: 66,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF2",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchCategoryThumb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  searchCategoryImage: { width: 30, height: 30 },
  searchCategoryName: {
    flex: 1,
    color: C.ink,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "700",
  },
  searchEmptyHint: {
    minHeight: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchEmptyHintText: { color: C.inkSoft, fontSize: 12.5 },
  filterTrigger: { flexDirection: "row", gap: 6 },
  activeFilterChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: C.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  activeFilterChipText: { color: C.brand, fontSize: 11, fontWeight: "800" },
  filterOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18, 20, 32, 0.58)",
  },
  filterBackdrop: { ...StyleSheet.absoluteFillObject },
  filterSheet: {
    height: "82%",
    backgroundColor: "#F3F4FA",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 22,
  },
  filterHandle: {
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 5,
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#C9CBD5",
  },
  filterHeader: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F6",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  filterHeaderIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterHeaderBadge: {
    minWidth: 25,
    height: 25,
    paddingHorizontal: 7,
    borderRadius: 13,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  filterHeaderBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  filterHeaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
  },
  filterMetaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.brand,
  },
  filterMetaText: { fontSize: 11, color: C.inkSoft, fontWeight: "700" },
  filterTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -0.35,
  },
  filterSubtitle: { fontSize: 11.5, color: C.inkSoft, marginTop: 3 },
  filterClose: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  filterDashboard: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#F7F8FC",
    minHeight: 0,
  },
  filterSidebar: {
    width: 116,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#ECEEF5",
  },
  filterSidebarContent: {
    paddingHorizontal: 7,
    paddingTop: 15,
    paddingBottom: 18,
  },
  filterSidebarEyebrow: {
    color: C.inkSoft,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.1,
    marginHorizontal: 7,
    marginBottom: 10,
  },
  filterNavItem: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 10,
    borderRadius: 15,
    marginBottom: 7,
    backgroundColor: "transparent",
    position: "relative",
  },
  filterNavItemActive: {
    backgroundColor: "#EEF0FF",
    borderWidth: 1,
    borderColor: "#DDE2FF",
  },
  filterNavIndicator: {
    position: "absolute",
    left: 0,
    top: 13,
    bottom: 13,
    width: 3,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: C.brand,
  },
  filterNavTitle: { color: C.inkSoft, fontSize: 11, fontWeight: "800" },
  filterNavTitleActive: { color: C.brand },
  filterNavSubtitle: {
    color: C.inkMuted,
    fontSize: 8,
    fontWeight: "600",
    marginTop: 4,
  },
  filterNavSubtitleActive: { color: C.brand, opacity: 0.72 },
  filterNavCount: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 3,
  },
  filterNavCountText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  filterContentPane: { flex: 1, minWidth: 0, backgroundColor: "#F7F8FC" },
  filterContentTitle: { color: C.ink, fontSize: 16, fontWeight: "900" },
  filterContentDescription: {
    color: C.inkSoft,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
  },
  filterQuickLabel: {
    color: C.inkSoft,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 9,
  },
  filterBody: { paddingHorizontal: 13, paddingTop: 13, paddingBottom: 24 },
  categoryPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 10,
  },
  categoryPickerCard: {
    width: "48%",
    minHeight: 154,
    padding: 11,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF4",
    alignItems: "center",
    justifyContent: "flex-start",
    shadowColor: "#26316B",
    shadowOpacity: 0.035,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  categoryPickerCardActive: {
    borderColor: C.brand,
    backgroundColor: "#F4F3FF",
    shadowColor: C.brandDark,
    shadowOpacity: 0.1,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  categoryPickerImageWrap: {
    width: 82,
    height: 82,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#F0F1F8",
  },
  categoryPickerImageWrapActive: {
    borderColor: "#C7D2FE",
  },
  categoryPickerImage: {
    width: "100%",
    height: "100%",
  },
  categoryPickerFallbackIcon: {
    fontSize: 30,
  },
  categoryPickerCheck: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brand,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  categoryPickerName: {
    width: "100%",
    color: C.ink,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  categoryPickerNameActive: {
    color: C.brandDark,
  },
  categoryPickerHint: {
    marginTop: 3,
    color: C.inkMuted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  filterCategoryRow: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    marginBottom: 11,
  },
  filterCategoryRowActive: {
    borderColor: "#A9B5FF",
    backgroundColor: "#F0F2FF",
  },
  filterStackList: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    columnGap: 8,
    rowGap: 10,
  },
  filterImageRow: {
    width: "48%",
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EAECF4",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 9,
    paddingVertical: 12,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#26316B",
    shadowOpacity: 0.035,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  filterImageRowActive: {
    borderColor: "#9AA7FF",
    backgroundColor: "#F0F1FF",
    shadowColor: C.brand,
    shadowOpacity: 0.09,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterCategoryImage: {
    width: 66,
    height: 66,
    borderRadius: 16,
    backgroundColor: "#F4F5FA",
  },
  filterCategoryImageFallback: {
    width: 66,
    height: 66,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCategoryRowText: {
    color: "#39445D",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    textAlign: "center",
    minHeight: 30,
    width: "100%",
  },
  filterCategoryRowTextActive: { color: C.brand },
  filterSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 15,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "#ECEEF5",
    shadowColor: "#24205F",
    shadowOpacity: 0.045,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  filterSectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  filterSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: C.ink,
    marginTop: 0,
    marginBottom: 0,
  },
  filterChipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterOption: {
    borderWidth: 1,
    borderColor: "#E5E7F1",
    backgroundColor: "#FFFFFF",
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: "center",
  },
  filterOptionActive: {
    backgroundColor: C.brand,
    borderColor: C.brand,
    shadowColor: C.brand,
    shadowOpacity: 0.18,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  filterOptionText: { fontSize: 12, fontWeight: "700", color: C.inkSoft },
  filterOptionTextActive: { color: "#fff" },
  filterMuted: { color: C.inkSoft, fontSize: 12, paddingVertical: 8 },
  filterPriceHeadline: {
    fontSize: 24,
    fontWeight: "900",
    color: C.brand,
    marginBottom: 14,
    letterSpacing: -0.5,
  },
  filterPriceInputs: { flexDirection: "row", gap: 10, marginBottom: 12 },
  filterPriceField: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E4E6F0",
    borderRadius: 15,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  filterFieldLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: C.inkSoft,
    marginBottom: 5,
    letterSpacing: 0.7,
  },
  filterPriceInput: {
    padding: 0,
    color: C.ink,
    fontSize: 16,
    fontWeight: "800",
    minHeight: 28,
  },
  filterSortList: { gap: 8 },
  filterSortOption: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E7E9F2",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterFooter: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
    borderTopWidth: 1,
    borderTopColor: "#ECEEF5",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    gap: 11,
  },
  filterResetButton: {
    minHeight: 52,
    width: "32%",
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "stretch",
    justifyContent: "center",
  },
  filterFooterButtonGradient: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  filterFooterButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  filterApplyButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: C.brand,
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  filterApplyGradient: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterApplyText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  filterFooterCount: {
    minWidth: 25,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterFooterCountText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  stickyFilterOverlay: {
    position: "absolute",
    // The measured search navbar height is applied inline so this rail sits
    // exactly against its bottom edge on different screen sizes.
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 16,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    overflow: "hidden",
    shadowColor: "#15123D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
  },
  stickyFilterInner: {
    paddingTop: 7,
    paddingBottom: 7,
    backgroundColor: C.surface,
  },
  stickyFilterHeading: {
    minHeight: 22,
    paddingHorizontal: GUTTER,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 1,
  },
  stickyFilterTitleWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  stickyFilterTitle: {
    color: C.ink,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  stickyFilterHint: { color: C.inkMuted, fontSize: 11, fontWeight: "600" },
  activeFilterCountPill: {
    backgroundColor: C.brandSoft,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  activeFilterCountText: { color: C.brand, fontSize: 10, fontWeight: "800" },
  sortRow: {
    paddingHorizontal: GUTTER,
    paddingTop: 9,
    paddingBottom: 9,
    gap: 8,
  },
  stickySortRow: { paddingTop: 5, paddingBottom: 1 },
  sortChip: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: "#F8F8FE",
    borderWidth: 1,
    borderColor: "#E7E7F5",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  filterTrigger: { backgroundColor: C.brandSoft, borderColor: "#D9D7FF" },
  sortChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  sortChipText: { fontSize: 12.5, fontWeight: "700", color: C.inkSoft },
  sortChipTextActive: { color: "#fff" },
  moreBtn: {
    alignSelf: "center",
    marginTop: 9,
    borderRadius: 23,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  moreBtnGradient: {
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  moreBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  topBtnWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 112 : 88 + 39 + 120,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 800,
  },
  topBtn: {
    borderRadius: 22,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    color: "#ffffff",
  },
  topBtnGradient: {
    minHeight: 9,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingLeft: 5,
    paddingRight: 13,
    borderRadius: 22,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: "#E8E6FF",
    elevation: 7,
    shadowColor: "#3528A5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 9,
  },
  topBtnIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },

  /* offline page + empty states */
  offlineScreen: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  offlineContent: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    paddingVertical: 28,
  },
  offlineImageWrap: {
    width: 230,
    height: 185,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  offlineImage: { width: "100%", height: "100%" },
  offlineStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: C.dangerSoft,
  },
  offlineStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.danger,
  },
  offlineStatusText: {
    color: C.danger,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  offlineTitle: {
    marginTop: 18,
    color: C.ink,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  offlineDescription: {
    marginTop: 9,
    maxWidth: 300,
    color: C.inkSoft,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  offlineRetryBtn: {
    marginTop: 24,
    minWidth: 160,
    borderRadius: 15,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  offlineRetryGradient: {
    minHeight: 50,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 15,
  },
  offlineRetryText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  offlineHint: {
    marginTop: 18,
    maxWidth: 290,
    color: C.inkMuted,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: "center",
  },
  empty: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 60,
    paddingHorizontal: 30,
  },
  notFoundImage: { width: 230, height: 210, marginBottom: 8 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "800", color: C.ink },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: C.inkSoft,
    textAlign: "center",
  },
  errorCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: C.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
  },
  errorIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: { marginTop: 14, fontSize: 18, fontWeight: "800", color: C.ink },
  errorText: {
    marginTop: 6,
    fontSize: 13.5,
    color: C.inkSoft,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 18,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
  },
  retryGradient: {
    height: 46,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  /* toast */
  toastWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 160,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    width: "100%",
    maxWidth: 180,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  toastText: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  /* floating cart */
  cartWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: Platform.OS === "ios" ? 100 : 96,
    alignItems: "center",
    zIndex: 900,
    paddingHorizontal: 20,
  },
  // cartAura: { position: "absolute", width: "78%", maxWidth: 233, height: 58, borderRadius: 32, backgroundColor: "#6366F1", shadowColor: "#6366F1", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 22, elevation: 18 },
  cartBar: {
    width: "100%",
    maxWidth: 230,
    minHeight: 54,
    paddingLeft: 11,
    paddingRight: 9,
    borderRadius: 30,
    backgroundColor: "#6366F1",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.96)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.42,
    shadowRadius: 16,
  },
  cartTopGloss: {
    position: "absolute",
    left: 2,
    right: 2,
    top: 2,
    height: 18,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  cartTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cartArrow: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    shadowColor: "#A5B4FC",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 7,
    elevation: 5,
  },
  cartSparkleOne: { position: "absolute", right: 48, top: 5 },
  cartImages: {
    minWidth: 42,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
  },
  cartImageWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 0.5,
    borderColor: "transparent",
  },
  cartImageFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  cartTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: -0.15,
  },

  cartSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.9)",
    fontSize: 9.5,
    fontWeight: "700",
  },
  floatingModalClose: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#17171D",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.83)",
    justifyContent: "center",
    shadowColor: "rgba(218, 205, 205, 0.63)",
    shadowOffset: { width: 9, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 12,
  },
  modalTopCloseRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 0,
    marginBottom: 10,
  },
  modalTopClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },

  /* location sheet */
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18, 20, 32, 0.58)",
  },
  sheet: {
    backgroundColor: "#F3F4FA",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 22,
    borderWidth: 0,
    borderColor: "transparent",
    minHeight: 390,
    maxHeight: "88%",
    width: "100%",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 22,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#C9CBD5",
    marginBottom: 12,
  },
  sheetHeader: { flexDirection: "row", alignItems: "center" },
  sheetTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.3,
  },
  sheetSubtitle: { marginTop: 3, fontSize: 12.5, color: C.inkSoft },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetSearch: {
    marginTop: 9,
    height: 50,
    borderRadius: 14,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 9,
  },
  sheetSearchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: C.ink,
    paddingVertical: 0,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  quickActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  quickAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: C.brandSoft,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profileHeaderBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    marginLeft: 8,
    marginRight: 4,
    shadowColor: "#1F2A5A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 1,
  },
  quickActionText: {
    flexShrink: 1,
    color: C.brand,
    fontSize: 13,
    fontWeight: "800",
  },
  listLabel: {
    marginTop: 18,
    marginBottom: 4,
    fontSize: 13,
    fontWeight: "800",
    color: C.inkSoft,
  },
  sheetList: { flexGrow: 0, maxHeight: 320 },
  status: {
    minHeight: 90,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  statusText: {
    marginTop: 4,
    fontSize: 13,
    color: C.inkSoft,
    textAlign: "center",
  },
  resultRow: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  resultName: { fontSize: 14, fontWeight: "700", color: C.ink },
  resultAddress: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    color: C.inkSoft,
  },
  addressCard: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
  },
  addressCardSelected: { borderColor: C.brand, backgroundColor: C.brandSoft },
  addressIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  addressName: { flexShrink: 1, fontSize: 14, fontWeight: "800", color: C.ink },
  addressTag: {
    marginLeft: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
    backgroundColor: C.starSoft,
  },
  addressTagText: { fontSize: 10.5, fontWeight: "800", color: C.brandDark },
  addressDetails: {
    marginTop: 4,
    fontSize: 12.5,
    lineHeight: 18,
    color: C.inkSoft,
  },
  addressPhone: {
    marginTop: 4,
    fontSize: 12.5,
    fontWeight: "700",
    color: C.ink,
  },
  addressEdit: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  permissionIntroOverlay: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "flex-end",
    paddingHorizontal: 0,
    backgroundColor: "rgba(18, 20, 32, 0.58)",
  },
  permissionIntroCard: {
    width: "100%",
    maxWidth: "100%",
    maxHeight: "82%",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#F3F4FA",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    alignItems: "center",
    overflow: "hidden",
    elevation: 22,
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
  },
  permissionIntroIconWrap: {
    width: 128,
    height: 128,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  permissionIntroSlash: {
    position: "absolute",
    width: 150,
    height: 7,
    borderRadius: 5,
    backgroundColor: "#E9344B",
    transform: [{ rotate: "-48deg" }],
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  permissionIntroTitle: {
    color: "#292929",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 2,
  },
  permissionIntroDescription: {
    color: "#667085",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  permissionIntroDivider: {
    height: 1,
    width: "100%",
    backgroundColor: "#E8E8E8",
  },
  permissionIntroPrimary: {
    width: "100%",
    minHeight: 57,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIntroPrimaryText: {
    color: "#287C35",
    fontSize: 15,
    fontWeight: "600",
  },
  permissionIntroSecondary: {
    width: "100%",
    minHeight: 57,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionIntroSecondaryText: {
    color: "#596273",
    fontSize: 15,
    fontWeight: "500",
  },
  variantPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18, 20, 32, 0.58)",
  },
  variantPickerSheet: {
    width: "100%",
    maxHeight: "82%",
    backgroundColor: "#F3F4FA",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 30 : 22,
    borderWidth: 0,
    borderColor: "transparent",
    shadowColor: "#101828",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 22,
  },
  variantPickerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  variantPickerEyebrow: {
    color: C.brand,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  variantPickerTitle: {
    marginTop: 4,
    color: C.ink,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "900",
  },
  variantPickerClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  variantPickerProductRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 17,
    backgroundColor: "#F7F8FF",
    borderWidth: 1,
    borderColor: "#ECEEFF",
  },
  variantPickerImage: {
    width: 68,
    height: 68,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
  },
  variantPickerPrice: {
    color: C.ink,
    fontSize: 21,
    fontWeight: "900",
  },
  variantPickerHint: {
    marginTop: 4,
    color: C.inkSoft,
    fontSize: 11,
    lineHeight: 16,
  },
  variantPickerSectionTitle: {
    marginTop: 18,
    marginBottom: 9,
    color: C.inkSoft,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  variantPickerOptions: {
    maxHeight: 280,
    flexGrow: 0,
  },
  variantOption: {
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E7EAF3",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  variantOptionSelected: {
    borderColor: C.brand,
    backgroundColor: "#F2F2FF",
  },
  variantOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#B8BED0",
    alignItems: "center",
    justifyContent: "center",
  },
  variantOptionRadioSelected: {
    borderColor: C.brand,
  },
  variantOptionRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.brand,
  },
  variantOptionName: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  variantAttributeList: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  variantAttributeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F3F4F8",
    borderWidth: 1,
    borderColor: "#E8EAF2",
  },
  variantAttributeChipSelected: {
    backgroundColor: "#E9E7FF",
    borderColor: "#C7C3FF",
  },
  variantAttributeKey: {
    color: C.inkMuted,
    fontSize: 9,
    fontWeight: "700",
  },
  variantAttributeValue: {
    color: C.ink,
    fontSize: 10,
    fontWeight: "900",
  },
  variantAttributeValueSelected: {
    color: C.brandDark,
  },
  variantOptionSku: {
    marginTop: 4,
    color: C.inkSoft,
    fontSize: 10,
    fontWeight: "600",
  },
  variantOptionPrice: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  variantOptionOriginal: {
    marginTop: 2,
    color: C.inkMuted,
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  variantPickerAddButton: {
    marginTop: 12,
    borderRadius: 15,
    overflow: "hidden",
  },
  variantPickerAddGradient: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "center",
  },
  variantPickerAddText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  productPreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.76)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  productPreviewContent: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 14,
    paddingTop: 14,
    overflow: "hidden",
  },
  productPreviewClose: {
    position: "absolute",
    zIndex: 2,
    right: 20,
    top: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  productPreviewGallery: {
    alignItems: "center",
    width: "100%",
  },
  productPreviewImageSlide: {
    alignItems: "center",
    justifyContent: "center",
  },
  productPreviewImage: {
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
  },
  productPreviewGalleryFooter: {
    width: "100%",
    minHeight: 30,
    marginTop: 10,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productPreviewDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: 5,
  },
  productPreviewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D7D9E5",
  },
  productPreviewDotActive: {
    width: 18,
    backgroundColor: C.brand,
  },
  productPreviewImageCount: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: C.brandSoft,
  },
  productPreviewImageCountText: {
    color: C.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  productPreviewTitle: {
    color: "#111111",
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  productPreviewShare: {
    width: 63,
    height: 63,
    borderRadius: 43,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 36,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
});
54;
