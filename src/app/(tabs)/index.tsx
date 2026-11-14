import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { LinearGradient } from "expo-linear-gradient"; // npx expo install expo-linear-gradient
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  BackHandler,
  Easing,
  FlatList,
  Image,
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
  brand: "#4F46E5",
  brandDark: "#3730A3",
  brandSoft: "#EEF2FF",
  accent: "#8B5CF6",
  star: "#FBBF24",
  bg: "#F7F7FF",
  surface: "#FFFFFF",
  ink: "#1E1B4B",
  inkSoft: "#63638A",
  inkMuted: "#9292B5",
  line: "#E4E4F7",
  success: "#15803D",
  danger: "#DC2626",
  dangerSoft: "#FEE9E9",
};

const GUTTER = 16;
const GRID_GAP = 12;
const SHELF_CARD_W = 164;
// Save odisha-banner.webp in assets/images/ (adjust the ../ count if this file lives elsewhere)

const BANNERS = [
  {
    id: "dussehra-offer",
    source: require("../../../assets/images/dusshera.webp"),
    title: "Dussehra Special",
    sub: "Celebrate the Victory of Good",
    tagline: "Festive shopping starts on Odikart",
    cta: "Shop Festive Deals",
    label: "Celebrate Dussehra with festive shopping deals on Odikart.",
  },
  {
    id: "local",
    source: require("../../../assets/images/odisha-banner.webp"),
    title: "Made in Odisha",
    sub: "Support Local Businesses",
    tagline: "Discover the pride of Odisha",
    cta: "Shop Now",
    label: "Made in Odisha. Support local businesses.",
  },
  {
    id: "crafts",
    source: require("../../../assets/images/odisha-crafts.webp"),
    title: "Handcrafted Treasures",
    sub: "Sambalpuri, Pattachitra & More",
    tagline: "Crafted with love by Odisha artisans",
    cta: "Explore Crafts",
    label: "Explore authentic handcrafted treasures from Odisha.",
  },
  {
    id: "deals",
    source: require("../../../assets/images/odisha-deals.webp"),
    title: "Amazing Deals",
    sub: "Save More on Every Order",
    tagline: "Discover great prices on your favorites",
    cta: "Explore Offers",
    label: "Explore exciting deals and offers on Odikart.",
  },
  {
    id: "fresh",
    source: require("../../../assets/images/odisha-fresh.webp"),
    title: "Everyday Essentials",
    sub: "Everything Your Home Needs",
    tagline: "Smart shopping for everyday living",
    cta: "Shop Essentials",
    label: "Shop daily essentials and home products on Odikart.",
  },
  {
    id: "food",
    source: require("../../../assets/images/odisha-fresh.webp"),
    title: "Flavours of Odisha",
    sub: "Traditional Snacks & Specialities",
    tagline: "Bring authentic tastes home",
    cta: "Explore Foods",
    label: "Discover traditional Odisha snacks and food products.",
  },
  {
    id: "festive",
    source: require("../../../assets/images/odisha-festive.webp"),
    title: "Celebrate Together",
    sub: "Festive Finds for Every Occasion",
    tagline: "Make every celebration special",
    cta: "Celebrate Now",
    label: "Discover festive shopping picks for every celebration on Odikart.",
  },
];

type HomeBanner = {
  id: string;
  title: string;
  sub: string;
  tagline: string;
  cta: string;
  label: string;
  imageUrl?: string;
  source?: any;
  raw?: any;
};

const FALLBACK_HOME_BANNERS: HomeBanner[] = BANNERS.map((banner) => ({
  ...banner,
  source: banner.source,
}));

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

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <Pressable
      style={({ pressed }) => [
        compact
          ? s.catItemCompact
          : [s.catItem, itemWidth ? { width: itemWidth } : null],
        pressed && { opacity: 0.88, transform: [{ scale: 0.96 }] },
      ]}
      android_ripple={{
        color: "rgba(59,130,246,0.12)",
        borderless: false,
      }}
      onPress={onPress}
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
          <Image
            key={imageUrl}
            source={{ uri: imageUrl }}
            style={compact ? s.catImageCompact : s.catImage}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            accessibilityLabel={`${category.name} category`}
          />
        ) : (
          <Text style={compact ? s.catFallbackIconCompact : s.catFallbackIcon}>
            {category.icon || "🛍️"}
          </Text>
        )}
      </View>
      <Text
        style={
          compact
            ? s.catNameCompact
            : [
                s.catName,
                {
                  color: "#FFFFFF",
                  textShadowColor: "rgba(24,12,88,0.28)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                },
              ]
        }
        numberOfLines={compact ? 1 : 2}
        ellipsizeMode="tail"
      >
        {category.name}
      </Text>
    </Pressable>
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
          backgroundColor:
            tone === "light" ? "rgba(99,102,241,0.16)" : "#E0E7FF",
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

function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gridW = Math.floor((width - GUTTER * 2 - GRID_GAP) / 2);
  return (
    <View style={{ flex: 1, backgroundColor: "#2563EB" }}>
      <SafeAreaView
        style={[s.root, { backgroundColor: "transparent" }]}
        edges={["left", "right"]}
      >
        <StatusBar style="light" backgroundColor="transparent" translucent />
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ backgroundColor: "transparent" }}
          contentContainerStyle={{
            paddingBottom: 24,
            backgroundColor: C.surface,
          }}
        >
          {/* Header: delivery row, search and the horizontal category rail */}
          <LinearGradient
            colors={["#2563EB", "#4F46E5", "#7C3AED"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[s.headerHero, { paddingTop: insets.top + 8 }]}
          >
            {/* Soft curved light waves: matching the Odikart purple reference. */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 390,
                height: 190,
                borderRadius: 190,
                backgroundColor: "rgba(255,255,255,0.075)",
                top: -92,
                left: 82,
                transform: [{ rotate: "-18deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 340,
                height: 145,
                borderRadius: 170,
                backgroundColor: "rgba(96,165,250,0.20)",
                top: 88,
                right: -155,
                transform: [{ rotate: "-22deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 360,
                height: 155,
                borderRadius: 180,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                top: 25,
                left: 110,
                transform: [{ rotate: "-18deg" }],
              }}
            />
            <View style={s.headerTop}>
              <View
                style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
              >
                <Skeleton
                  tone="light"
                  width={38}
                  height={38}
                  radius={19}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Skeleton tone="light" width={58} height={9} radius={4} />
                  <Skeleton
                    tone="light"
                    width="62%"
                    height={14}
                    radius={5}
                    style={{ marginTop: 7 }}
                  />
                </View>
              </View>
              <Skeleton tone="light" width={42} height={42} radius={21} />
            </View>

            <View style={s.searchWrap}>
              <View
                style={[
                  s.searchBox,
                  {
                    minHeight: 54,
                    borderRadius: 18,
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgba(255,255,255,0.5)",
                  },
                ]}
              >
                <Skeleton width={23} height={23} radius={12} />
                <Skeleton width="64%" height={15} radius={7} />
                <Skeleton
                  width={40}
                  height={40}
                  radius={20}
                  style={{ marginLeft: "auto" }}
                />
              </View>
            </View>

            <View style={s.visualCategorySection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.visualCategoryList}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <View
                    key={`header-category-${i}`}
                    style={[
                      s.catItem,
                      { width: Math.floor((width - GUTTER * 2 - 4 * 6) / 5) },
                    ]}
                  >
                    <View
                      style={[
                        s.catTile,
                        {
                          width: 48,
                          height: 48,
                          backgroundColor: "rgba(255,255,255,0.72)",
                          borderColor: "rgba(99,102,241,0.12)",
                        },
                      ]}
                    >
                      <Skeleton
                        tone="light"
                        width={26}
                        height={26}
                        radius={9}
                      />
                    </View>
                    <Skeleton
                      tone="light"
                      width={48 + (i % 3) * 8}
                      height={10}
                      radius={5}
                      style={{ marginTop: 9 }}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          </LinearGradient>

          {/* Banner carousel follows the header/category rail in the live page */}
          <LinearGradient
            colors={["#7C3AED", "#A78BFA", "#DBEAFE", "#FFFFFF"]}
            locations={[0, 0.24, 0.68, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.bannerBackdrop}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 420,
                height: 180,
                borderRadius: 220,
                backgroundColor: "rgba(255,255,255,0.10)",
                top: -112,
                left: 80,
                transform: [{ rotate: "-16deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 340,
                height: 140,
                borderRadius: 180,
                backgroundColor: "rgba(99,102,241,0.16)",
                top: 4,
                right: -150,
                transform: [{ rotate: "-20deg" }],
              }}
            />
            <View style={{ paddingHorizontal: GUTTER }}>
              <Skeleton
                height={Math.min(218, Math.max(174, Math.round(width * 0.49)))}
                radius={22}
              />
            </View>
            <View style={s.dots}>
              <Skeleton width={18} height={6} radius={3} />
              <Skeleton width={6} height={6} radius={3} />
              <Skeleton width={6} height={6} radius={3} />
            </View>
          </LinearGradient>

          {/* Discovery shelves mirror the order of the live home page */}
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />

          {/* Product discovery grid lower on the page */}
          <View style={s.shelf}>
            <SectionTitleSkeleton />
            <GridSkeleton width={gridW} count={12} />
          </View>
          <View style={{ height: 110 }} />
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
        <Image
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

  const popHeart = useCallback(() => {
    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1.3,
        speed: 40,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.spring(pop, {
        toValue: 1,
        speed: 20,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pop]);

  return (
    <Pressable
      onPress={p.onOpen}
      onLongPress={p.onLongPress}
      delayLongPress={250}
      accessibilityHint="Press and hold to preview this product"
      accessibilityRole="button"
      accessibilityLabel={`${product.title}, ${money(price)}${out ? ", out of stock" : ""}`}
      style={({ pressed }) => [
        s.card,
        { width: p.width },
        pressed && {
          opacity: 0.94,
          transform: [{ scale: 0.975 }],
        },
      ]}
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
                <Image
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
          <Image
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
            <Text style={s.discountBadgeText}>{Math.round(discount)}% OFF</Text>
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
          <Animated.View style={{ transform: [{ scale: pop }] }}>
            <Ionicons
              name={p.wished ? "heart" : "heart-outline"}
              size={19}
              color={p.wished ? C.danger : "#c5392c"}
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
              colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
                p.onAdd();
              }}
              accessibilityLabel={`Add ${product.title} to cart`}
              style={({ pressed }) => [pressed && { opacity: 0.82 }]}
            >
              <LinearGradient
                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                locations={[0, 0.52, 1]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.addBtn}
              >
                <Ionicons name="add" size={19} color="#fff" />
                <Text style={s.addBtnText}>ADD</Text>
              </LinearGradient>
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
  const [isSearchPinned, setIsSearchPinned] = useState(false);
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

          // If the shopper chose Android's "Only this time", that grant can expire
          // after the app is closed. Ask again on the next app entry whenever Android
          // still allows the permission request. Do not send these users to Settings.
          if (
            permission.canAskAgain ||
            permission.status === Location.PermissionStatus.UNDETERMINED
          ) {
            locationPermissionAlertShown.current = false;
            const requested =
              await Location.requestForegroundPermissionsAsync();
            if (cancelled) return;

            if (requested.status === Location.PermissionStatus.GRANTED) {
              requestAnimationFrame(() => {
                if (!cancelled) void useCurrentLocation();
              });
            }
            // If denied, wait until the next app entry to ask again. Android may
            // suppress the native dialog after repeated denials; canAskAgain then
            // becomes false and the Settings explanation below is used.
            return;
          }

          // Only show Settings guidance when Android no longer allows a permission
          // prompt (for example, after the user has denied it permanently).
          if (locationPermissionAlertShown.current) return;
          locationPermissionAlertShown.current = true;
          Alert.alert(
            "Turn on location",
            "Your delivery location isn't showing. Allow OdiKart to access your location so we can detect your delivery area.",
            [
              { text: "Not now", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => {
                  void Linking.openSettings().catch((error) =>
                    console.log("OPEN LOCATION SETTINGS ERROR:", error),
                  );
                },
              },
            ],
            { cancelable: true },
          );
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
    if (cartCount > 0)
      Animated.spring(cartIn, {
        toValue: 1,
        speed: 12,
        bounciness: 7,
        useNativeDriver: true,
      }).start();
    else cartIn.setValue(0);
  }, [cartCount > 0]);

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
  const [homeBanners, setHomeBanners] = useState<HomeBanner[]>(
    FALLBACK_HOME_BANNERS,
  );

  // Fetch only banners eligible for the Home main placement.
  const loadHomeBanners = useCallback(async () => {
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

      // An empty API result means no active, eligible Home banners exist.
      setHomeBanners(normalized);
      bannerIndexRef.current = 0;
      setBannerIndex(0);
      bannerRef.current?.scrollTo({ x: 0, animated: false });
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
    // Switch the search navbar into its compact state on the very first
    // meaningful downward movement. ScrollView's native sticky positioning
    // then keeps this same navbar pinned as soon as it reaches the top edge.
    const shouldPinSearch = y >= 8;
    setIsSearchPinned((current) => {
      if (current === shouldPinSearch) return current;

      // The header background is already driven continuously by scroll position.
      // Animate the remaining layout swap (category tiles, search spacing and
      // compact sticky-header padding) so it never snaps at the pin threshold.
      LayoutAnimation.configureNext({
        duration: 260,
        create: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
        update: {
          type: LayoutAnimation.Types.easeInEaseOut,
          springDamping: 0.88,
        },
        delete: {
          type: LayoutAnimation.Types.easeInEaseOut,
          property: LayoutAnimation.Properties.opacity,
        },
      });

      return shouldPinSearch;
    });
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

  const variantDisplayName = (variant: Variant, index: number) => {
    const attrs =
      variant.attributes && typeof variant.attributes === "object"
        ? Object.entries(variant.attributes)
            .map(([key, value]) => `${key}: ${String(value)}`)
            .join(" · ")
        : "";
    const label =
      variant.label ||
      variant.name ||
      variant.title ||
      variant.option ||
      variant.size ||
      variant.weight ||
      variant.color ||
      variant.colour ||
      variant.packSize ||
      attrs;
    return String(label || `Option ${index + 1}`);
  };

  const openVariantPicker = (product: Product) => {
    if (!isAuthenticated) {
      showToast("Log in to use your cart.", "error");
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
      showToast("Log in to use your cart.", "error");
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
    setCartPreview(
      nextItems
        .map(
          (item) =>
            item.image ||
            item.variant?.image ||
            item.product?.media?.thumbnail ||
            item.product?.media?.images?.[0] ||
            item.selectedVariant?.images?.[0] ||
            "",
        )
        .filter(Boolean)
        .slice(0, 3),
    );

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
    return <HomeSkeleton />;
  }

  if (error && products.length === 0) {
    return (
      <SafeAreaView
        style={s.offlineScreen}
        edges={["top", "left", "right", "bottom"]}
      >
        <StatusBar style="dark" backgroundColor="#ffffff" translucent={false} />
        <View style={s.offlineContent}>
          <View style={s.offlineImageWrap}>
            <Image
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
              colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
    <View style={s.root}>
      <SafeAreaView
        style={[s.root, { backgroundColor: C.surface }]}
        edges={["left", "right"]}
      >
        <StatusBar
          style={isSearchPinned ? "dark" : "light"}
          backgroundColor="transparent"
          translucent
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: Math.max(insets.top, 24),
            backgroundColor: "#FFFFFF",
            opacity: whiteSurfaceOpacity,
            // Keep this tint behind the scroll content. A high zIndex here
            // can cover the sticky search field when Android pins child [1].
            zIndex: 0,
          }}
        />

        <ScrollView
          ref={mainRef}
          // Let the hero/search/banner surfaces define the top background;
          // the catalogue's white surface begins in child [2], after the banner.
          // Render above the status-bar tint layer so the sticky search row
          // remains visible when the header reaches the top on Android.
          style={{ backgroundColor: "transparent", zIndex: 1, elevation: 1 }}
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
          {/* [0] Purple-indigo gradient hero: scrolls away naturally. */}
          <LinearGradient
            colors={["#2563EB", "#4F46E5", "#7C3AED"]}
            locations={[0, 0.55, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[s.headerHero, { paddingTop: insets.top + 8 }]}
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
            {/* Layered translucent curves create the flowing purple wave treatment. */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 410,
                height: 190,
                borderRadius: 210,
                backgroundColor: "rgba(255,255,255,0.075)",
                top: -92,
                left: 78,
                transform: [{ rotate: "-18deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 350,
                height: 150,
                borderRadius: 180,
                backgroundColor: "rgba(96,165,250,0.20)",
                top: 86,
                right: -155,
                transform: [{ rotate: "-22deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 370,
                height: 160,
                borderRadius: 190,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
                top: 24,
                left: 105,
                transform: [{ rotate: "-18deg" }],
              }}
            />
            <View style={s.headerTop}>
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
                  <Ionicons name="location" size={18} color={C.brandDark} />
                </View>
                <View style={{ flexShrink: 1 }}>
                  <Text
                    style={[s.deliverTo, { color: "rgba(255,255,255,0.78)" }]}
                  >
                    Deliver to
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
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
                      style={{ marginLeft: 3 }}
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
                  color={C.brandDark}
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
                onPress={() => router.push("/(tabs)/profile")}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                hitSlop={8}
              >
                <Ionicons name="person-outline" size={22} color={C.brandDark} />
              </Pressable>
            </View>
          </LinearGradient>

          {/* [1] One stable sticky search/category surface; keep its top geometry constant while pinning. */}
          <LinearGradient
            // This is the exact bottom colour of the hero. Keep it flat so
            // the sticky surface cannot restart a second gradient.
            colors={["#7C3AED", "#7C3AED"]}
            locations={[0, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            // Continue the same top-to-bottom colour flow from the hero into search and categories.
            // Adding the status-bar inset only after pinning shifts the search input
            // down by one safe-area height, making it appear to jump.
            style={[
              s.stickyHeader,
              isSearchPinned && s.stickyHeaderCompact,
              // The sticky header moves underneath the translucent status bar.
              // Restore the safe-area space only while pinned so the search
              // field remains fully visible below the system icons.
              isSearchPinned && { paddingTop: insets.top },
            ]}
          >
            {/* Decorative layers belong on this surface because search and category
                navigation live inside the sticky header, not inside headerHero. */}
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 430,
                height: 190,
                borderRadius: 220,
                backgroundColor: "rgba(255,255,255,0.075)",
                top: -92,
                left: -145,
                transform: [{ rotate: "-16deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 350,
                height: 165,
                borderRadius: 190,
                backgroundColor: "rgba(96,165,250,0.18)",
                top: 34,
                right: -175,
                transform: [{ rotate: "-23deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 390,
                height: 150,
                borderRadius: 200,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.13)",
                top: 66,
                left: 78,
                transform: [{ rotate: "-17deg" }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 260,
                height: 115,
                borderRadius: 140,
                backgroundColor: "rgba(167,139,250,0.16)",
                bottom: -52,
                left: -72,
                transform: [{ rotate: "18deg" }],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "#FFFFFF", opacity: whiteSurfaceOpacity },
              ]}
            />
            <View
              style={[s.searchWrap, isSearchPinned && s.searchWrapCompact]}
              onLayout={(event) => {
                const measuredHeight = Math.round(
                  event.nativeEvent.layout.height,
                );
                if (measuredHeight > 0) {
                  setStickySearchHeight((current) =>
                    current === measuredHeight ? current : measuredHeight,
                  );
                }
              }}
            >
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
                  <Ionicons name="search-outline" size={23} color={C.inkSoft} />
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
              {!searchActive && !suggestionsOpen ? (
                <>
                  {/* Visual category tiles, matching the reference shopping home. */}
                  <View style={s.visualCategorySection}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={s.visualCategoryList}
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
                          requestAnimationFrame(() =>
                            mainRef.current?.scrollTo({ y: 0, animated: true }),
                          );
                        }}
                        style={[
                          isSearchPinned
                            ? s.catItemCompact
                            : [
                                s.catItem,
                                {
                                  width: Math.floor(
                                    (screenWidth - GUTTER - 4 * 6) / 5,
                                  ),
                                },
                              ],
                          selectedCategory === "All" && {
                            opacity: 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Show all categories and products"
                        accessibilityState={{
                          selected: selectedCategory === "All",
                        }}
                      >
                        <View
                          style={[
                            isSearchPinned
                              ? s.catTileCompact
                              : [s.catTile, { width: 48, height: 48 }],
                            {
                              backgroundColor:
                                selectedCategory === "All"
                                  ? "#E0E7FF"
                                  : "#EEF2FF",
                              borderWidth: selectedCategory === "All" ? 2 : 1,
                              borderColor: "#6366F1",
                            },
                          ]}
                        >
                          <Ionicons
                            name="grid-outline"
                            size={isSearchPinned ? 17 : 20}
                            color="#4F46E5"
                          />
                        </View>
                        <Text
                          style={
                            isSearchPinned
                              ? s.catNameCompact
                              : [
                                  s.catName,
                                  {
                                    color: "#FFFFFF",
                                    textShadowColor: "rgba(24,12,88,0.28)",
                                    textShadowOffset: { width: 0, height: 1 },
                                    textShadowRadius: 2,
                                  },
                                ]
                          }
                          numberOfLines={isSearchPinned ? 1 : 2}
                        >
                          All
                        </Text>
                      </Pressable>
                      {categories.map((category, index) => (
                        <CategoryHomeTile
                          key={category._id}
                          category={category}
                          index={index}
                          compact={isSearchPinned}
                          itemWidth={Math.floor(
                            (screenWidth - GUTTER - 4 * 6) / 5,
                          )}
                          onPress={() => openCategoryProducts(category)}
                        />
                      ))}
                    </ScrollView>
                  </View>
                </>
              ) : null}
            </View>
          </LinearGradient>

          {/* [2] Content: keep the catalogue surface white; the banner has its own bounded gradient. */}
          <View style={{ backgroundColor: C.surface, flex: 1 }}>
            {suggestionsOpen ? (
              <View style={s.suggestWrap}>
                {recent.length > 0 ? (
                  <>
                    <View style={s.suggestHeader}>
                      <Text style={s.suggestTitle}>Recent searches</Text>
                      <Pressable
                        onPress={() => setRecent([])}
                        hitSlop={10}
                        accessibilityRole="button"
                      >
                        <Text style={s.seeAllText}>Clear</Text>
                      </Pressable>
                    </View>
                    <View style={s.chipWrap}>
                      {recent.map((q) => (
                        <Pressable
                          key={q}
                          style={s.chip}
                          onPress={() => setSearch(q)}
                          accessibilityRole="button"
                        >
                          <Ionicons
                            name="time-outline"
                            size={14}
                            color={C.inkSoft}
                          />
                          <Text style={s.chipText}>{q}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}
                {categories.length > 0 ? (
                  <>
                    <View style={s.suggestHeader}>
                      <Text style={s.suggestTitle}>Popular categories</Text>
                    </View>
                    <View style={s.chipWrap}>
                      {categories.slice(0, 8).map((c) => (
                        <Pressable
                          key={c._id}
                          style={s.chip}
                          onPress={() => {
                            setSearch(c.name);
                            rememberSearch(c.name);
                          }}
                          accessibilityRole="button"
                        >
                          <Text style={s.chipText}>{c.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={s.emptyText}>
                    Start typing to search products.
                  </Text>
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
                    <Image
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
                        colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
                    {/* Banner carousel on a header-to-page gradient */}
                    {homeBanners.length > 0 ? (
                      <LinearGradient
                        colors={["#7C3AED", "#A78BFA", "#DBEAFE", "#FFFFFF"]}
                        locations={[0, 0.24, 0.68, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={s.bannerBackdrop}
                      >
                        {/* Fade the banner's surrounding gradient into the same white
                            surface as the header while keeping banner artwork readable. */}
                        <Animated.View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            {
                              backgroundColor: "#FFFFFF",
                              opacity: whiteSurfaceOpacity,
                            },
                          ]}
                        />
                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            width: 420,
                            height: 180,
                            borderRadius: 220,
                            backgroundColor: "rgba(255,255,255,0.10)",
                            top: -112,
                            left: 80,
                            transform: [{ rotate: "-16deg" }],
                          }}
                        />
                        <View
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            width: 340,
                            height: 140,
                            borderRadius: 180,
                            backgroundColor: "rgba(99,102,241,0.16)",
                            top: 4,
                            right: -150,
                            transform: [{ rotate: "-20deg" }],
                          }}
                        />
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
                                accessibilityLabel={b.label}
                              >
                                <Image
                                  source={
                                    b.imageUrl ? { uri: b.imageUrl } : b.source
                                  }
                                  style={s.bannerImage}
                                  resizeMode="cover"
                                  onError={(e) =>
                                    console.log(
                                      "BANNER IMAGE ERROR:",
                                      b.id,
                                      e.nativeEvent,
                                    )
                                  }
                                />
                                <LinearGradient
                                  colors={[
                                    "rgba(24,18,110,0.88)",
                                    "rgba(24,18,110,0.45)",
                                    "rgba(24,18,110,0)",
                                  ]}
                                  start={{ x: 0, y: 0.5 }}
                                  end={{ x: 1, y: 0.5 }}
                                  style={StyleSheet.absoluteFill}
                                />
                                <View style={{ zIndex: 2, paddingLeft: 18 }}>
                                  <Text style={s.bannerTitle}>{b.title}</Text>
                                  <Text style={s.bannerSub}>{b.sub}</Text>
                                  <Text style={s.bannerTagline}>
                                    {b.tagline}
                                  </Text>
                                  <LinearGradient
                                    colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                                    locations={[0, 0.52, 1]}
                                    start={{ x: 0, y: 0.5 }}
                                    end={{ x: 1, y: 0.5 }}
                                    style={s.bannerBtn}
                                  >
                                    <Text style={s.bannerBtnText}>{b.cta}</Text>
                                    <Ionicons
                                      name="arrow-forward"
                                      size={15}
                                      color="#fff"
                                    />
                                  </LinearGradient>
                                </View>
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
                      </LinearGradient>
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
                        {shelf(
                          "trending",
                          "Trending Near You",
                          "Popular in your area",
                        )}
                        {shelf(
                          "bestSellers",
                          "Bestsellers",
                          "Loved by Odikart shoppers",
                        )}
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
                        {shelf(
                          "featured",
                          "Featured Products",
                          "Handpicked for you",
                        )}
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
                              <LinearGradient
                                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.categoryHero}
                              >
                                <View style={s.categoryHeroGlow} />
                                <View style={s.categoryHeroCopy}>
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
                                    style={s.categoryBackButton}
                                    accessibilityRole="button"
                                    accessibilityLabel="Back to all categories"
                                  >
                                    <Ionicons
                                      name="arrow-back"
                                      size={15}
                                      color="#FFFFFF"
                                    />
                                    <Text style={s.categoryBackText}>
                                      All categories
                                    </Text>
                                  </Pressable>
                                  <Text style={s.categoryEyebrow}>
                                    CURATED FOR YOU
                                  </Text>
                                  <Text style={s.categoryHeroTitle}>
                                    {activeCategory?.name || "Shop category"}
                                  </Text>
                                  <Text style={s.categoryHeroSubtitle}>
                                    Find your favourites in one place
                                  </Text>
                                  <View style={s.categoryCountPill}>
                                    <Ionicons
                                      name="grid-outline"
                                      size={13}
                                      color="#FFFFFF"
                                    />
                                    <Text style={s.categoryCountText}>
                                      {sortedResults.length} products to explore
                                    </Text>
                                  </View>
                                </View>
                                <View style={s.categoryHeroMedia}>
                                  {categoryImage ? (
                                    <Image
                                      source={{ uri: categoryImage }}
                                      style={s.categoryHeroImage}
                                      resizeMode="cover"
                                      accessibilityLabel={`${activeCategory?.name || "Category"} collection`}
                                    />
                                  ) : (
                                    <View style={s.categoryHeroImageFallback}>
                                      <Ionicons
                                        name="storefront-outline"
                                        size={42}
                                        color="#FFFFFF"
                                      />
                                    </View>
                                  )}
                                </View>
                                <View style={s.categoryHeroDecor} />
                              </LinearGradient>

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
                                        <Image
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
                                (item) => String(item._id) === selectedCategory,
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
                              {SORTS.find((item) => item.key === sort)?.label ||
                                "Sort"}
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
                                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
                          <Image
                            source={require("../../../assets/images/not-found.webp")}
                            style={s.notFoundImage}
                            resizeMode="contain"
                            accessibilityLabel="No products available illustration"
                          />
                          <Text style={s.emptyTitle}>Nothing here yet</Text>
                          <Text style={s.emptyText}>Pull down to refresh.</Text>
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
        {isAuthenticated && cartCount > 0 ? (
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
                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
                      <Image
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
                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
          statusBarTranslucent
          onRequestClose={() => setVariantPickerProduct(null)}
        >
          <View style={s.variantPickerOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setVariantPickerProduct(null)}
              accessibilityLabel="Close variant selector"
            />
            {variantPickerProduct ? (
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
                  <Pressable
                    style={s.variantPickerClose}
                    onPress={() => setVariantPickerProduct(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={21} color={C.ink} />
                  </Pressable>
                </View>

                <View style={s.variantPickerProductRow}>
                  {productImage(variantPickerProduct) ? (
                    <Image
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
                            chosen?.price ?? productPrice(variantPickerProduct),
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
                  AVAILABLE OPTIONS
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
                        variant.stock !== undefined && variant.stock !== null;
                      const soldOut = stockKnown && Number(variant.stock) <= 0;
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
                            <Text
                              style={[
                                s.variantOptionName,
                                selected && { color: C.brand },
                              ]}
                            >
                              {variantDisplayName(variant, index)}
                            </Text>
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
                    colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={s.variantPickerAddGradient}
                  >
                    <Ionicons name="cart-outline" size={19} color="#FFFFFF" />
                    <Text style={s.variantPickerAddText}>ADD TO CART</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </View>
            ) : null}
          </View>
        </Modal>

        {/* Location sheet */}
        <Modal
          visible={locationOpen}
          transparent
          animationType="slide"
          statusBarTranslucent
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
              <View style={[s.sheet, keyboardVisible && { maxHeight: "85%" }]}>
                <View style={s.sheetHandle} />
                <View style={s.modalTopCloseRow}>
                  <Pressable
                    style={s.modalTopClose}
                    onPress={closeLocation}
                    accessibilityRole="button"
                    accessibilityLabel="Close location"
                  >
                    <Ionicons name="close" size={21} color={C.ink} />
                  </Pressable>
                </View>
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
                        No matching locations. Try a nearby landmark or pincode.
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
                    <Image
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
          statusBarTranslucent
          onRequestClose={closeVoice}
        >
          <View style={s.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeVoice}
              accessibilityLabel="Close voice search"
            />
            <View style={s.voiceSheet}>
              <View style={s.sheetHandle} />
              <View style={s.modalTopCloseRow}>
                <Pressable
                  style={s.modalTopClose}
                  onPress={closeVoice}
                  accessibilityRole="button"
                  accessibilityLabel="Close voice search"
                >
                  <Ionicons name="close" size={21} color={C.ink} />
                </Pressable>
              </View>
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
                    pressed && { opacity: 0.86, transform: [{ scale: 0.96 }] },
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
                    colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
          statusBarTranslucent
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
                                <Image
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

        <Modal
          visible={filterOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setFilterOpen(false)}
          statusBarTranslucent
        >
          <View style={s.filterOverlay}>
            <Pressable
              style={s.filterBackdrop}
              onPress={() => setFilterOpen(false)}
            />
            <View style={s.filterSheet}>
              <View style={s.filterHandle} />
              <View
                style={[
                  s.modalTopCloseRow,
                  { paddingHorizontal: 18, marginTop: 2 },
                ]}
              >
                <Pressable
                  style={s.modalTopClose}
                  onPress={() => setFilterOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Close filters"
                >
                  <Ionicons name="close" size={21} color={C.ink} />
                </Pressable>
              </View>
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
                    <Text style={s.filterTitle}>Filters</Text>
                    {activeFilterCount > 0 ? (
                      <View style={s.filterHeaderBadge}>
                        <Text style={s.filterHeaderBadgeText}>
                          {activeFilterCount}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.filterSubtitle}>Refine your products</Text>
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
                          priceRange[0] !== 0 || priceRange[1] !== 5000 ? 1 : 0,
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
                        {active ? <View style={s.filterNavIndicator} /> : null}
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
                                  <Image
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
                          <Text style={s.filterContentTitle}>Subcategory</Text>
                          <Text style={s.filterContentDescription}>
                            Choose a more specific product group
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
                                  <Image
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
                                          TILE_TINTS[index % TILE_TINTS.length],
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
                          <Text style={s.filterContentTitle}>Brand</Text>
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
                                <Image
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
                                {item.name === "All" ? "All Brands" : item.name}
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
                          <Text style={s.filterContentTitle}>Price Range</Text>
                          <Text style={s.filterContentDescription}>
                            Set your budget and find products within your range
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
                                style={[s.filterMuted, { paddingVertical: 2 }]}
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
                    colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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
                    colors={["#2563EB", "#4F46E5", "#7C3AED"]}
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

        <Toast toast={toast} />
      </SafeAreaView>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2563EB" },
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
    paddingBottom: 12,
    overflow: "hidden",
  },
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
    paddingTop: 4,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stickyHeader: {
    // No elevation while expanded: an always-on native shadow creates a
    // visible horizontal seam between the live header and banner background.
    backgroundColor: "transparent",
    width: "100%",
    alignSelf: "stretch",
    zIndex: 30,
    elevation: 2,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  stickyHeaderCompact: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "#FFFFFF",
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 6,
  },
  locationBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    minHeight: 44,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  deliverTo: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.25,
  },
  locationText: {
    flexShrink: 1,
    color: "#312E81",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.12)",
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
    backgroundColor: "transparent",
    paddingHorizontal: GUTTER,
    paddingTop: 10,
    paddingBottom: 10,
    zIndex: 20,
  },
  searchWrapCompact: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchGradientShell: {
    borderRadius: 25,
    padding: 1.5,
    overflow: "hidden",
    shadowColor: "#6366F1",
    shadowOpacity: 0.18,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  searchBox: {
    width: "100%",
    minWidth: 0,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.22)",
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 8,
    elevation: 3,
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
    paddingHorizontal: 16,
    columnGap: 24,
  },
  categoryRailItem: {
    minWidth: 42,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 1,
    paddingTop: 2,
  },
  categoryRailIcon: {
    width: 32,
    height: 29,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  categoryRailIconActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  categoryRailImage: {
    width: 25,
    height: 25,
  },
  categoryRailEmoji: {
    fontSize: 21,
  },
  categoryRailLabel: {
    marginTop: 3,
    color: C.inkSoft,
    fontSize: 12,
    lineHeight: 17,
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
    marginTop: 4,
    backgroundColor: "transparent",
  },
  categoryRailIndicatorActive: {
    width: "100%",
    backgroundColor: "#A78BFA",
  },

  visualCategorySection: {
    marginTop: 0,
    paddingTop: 10,
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
    paddingLeft: 0,
    paddingRight: GUTTER,
    paddingBottom: 6,
    columnGap: 6,
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
    backgroundColor: C.brand,
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
    paddingTop: 10,
    paddingBottom: 22,
    backgroundColor: "#4F46E5",
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
  bannerTagline: {
    marginTop: 2,
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "600",
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
    width: 56,
    minHeight: 82,
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
    width: 48,
    height: 48,
    borderRadius: 15,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.brandSoft,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    elevation: 2,
    shadowColor: C.brandDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
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
    marginTop: 5,
    color: "#302B48",
    fontSize: 9,
    lineHeight: 12,
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
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.brandDark,
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#1E1B6B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  bannerSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 190,
  },
  bannerBtn: {
    alignSelf: "flex-start",
    marginTop: 12,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bannerBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  /* compact product card — inspired by the supplied pickle-card reference */
  card: {
    backgroundColor: C.surface,
    borderRadius: 19,
    padding: 9,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#25205F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  cardImageWrap: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#FAFAFD",
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
    left: 5,
    top: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: "#5B4BFF",
  },
  discountBadgeText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  wishBtn: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { paddingTop: 6, paddingHorizontal: 2 },
  cardTitle: {
    fontSize: 13.5,
    lineHeight: 18,
    fontWeight: "800",
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
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "900",
    color: C.ink,
    letterSpacing: -0.2,
  },
  originalPrice: {
    fontSize: 10,
    color: C.inkMuted,
    textDecorationLine: "line-through",
  },
  addBtn: {
    minWidth: 62,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    elevation: 2,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.25,
  },
  stepper: {
    height: 33,
    borderRadius: 9,
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
    backgroundColor: C.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#0F2F5F",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 18,
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

  /* search + more */
  suggestWrap: { paddingTop: 18, paddingHorizontal: GUTTER, minHeight: 300 },
  suggestHeader: {
    marginTop: 4,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  suggestTitle: { fontSize: 15, fontWeight: "800", color: C.ink },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontSize: 13, fontWeight: "600", color: C.ink },
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
    backgroundColor: "rgba(15,23,42,0.48)",
  },
  filterBackdrop: { ...StyleSheet.absoluteFillObject },
  filterSheet: {
    height: "91%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#0F2F5F",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 20,
  },
  filterHandle: {
    alignSelf: "center",
    marginTop: 9,
    marginBottom: 3,
    width: 42,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#D8DAE8",
  },
  filterHeader: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  filterHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: C.brandSoft,
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
    backgroundColor: C.bg,
    minHeight: 0,
  },
  filterSidebar: {
    width: 116,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: "#FFFFFF",
    borderRightWidth: 1,
    borderRightColor: "#E8E9F2",
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
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 12,
    marginBottom: 5,
    backgroundColor: "transparent",
    position: "relative",
  },
  filterNavItemActive: { backgroundColor: "#E0E7FF" },
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
  filterNavTitle: { color: C.inkSoft, fontSize: 10, fontWeight: "900" },
  filterNavTitleActive: { color: C.brand },
  filterNavSubtitle: {
    color: C.inkSoft,
    fontSize: 7,
    fontWeight: "600",
    marginTop: 3,
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
  filterContentPane: { flex: 1, minWidth: 0, backgroundColor: "#F8F9FC" },
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
  filterBody: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 22 },
  categoryPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
    columnGap: 10,
  },
  categoryPickerCard: {
    width: "48%",
    minHeight: 150,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF2",
    alignItems: "center",
    justifyContent: "flex-start",
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
    width: 76,
    height: 76,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
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
  filterStackList: { gap: 10 },
  filterImageRow: {
    minHeight: 66,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  filterImageRowActive: {
    borderColor: C.brand,
    backgroundColor: "#E0E7FF",
  },
  filterCategoryImage: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F4F6FA",
  },
  filterCategoryImageFallback: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCategoryRowText: {
    color: "#39445D",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  filterCategoryRowTextActive: { color: C.brand },
  filterSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#ECEEF6",
    shadowColor: "#24205F",
    shadowOpacity: 0.045,
    shadowRadius: 12,
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
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#E0E7FF",
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
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 25 : 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    gap: 10,
  },
  filterResetButton: {
    minHeight: 50,
    width: "34%",
    borderRadius: 15,
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
    minHeight: 50,
    borderRadius: 15,
    overflow: "hidden",
    shadowColor: C.brand,
    shadowOpacity: 0.22,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  filterApplyGradient: {
    flex: 1,
    minHeight: 50,
    paddingHorizontal: 12,
    borderRadius: 15,
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
    shadowColor: "#4F46E5",
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
    top: Platform.OS === "ios" ? 112 : 88 + 39 + 30,
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
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    color: "#ffffff",
  },
  topBtnGradient: {
    minHeight: 40,
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
    color:"#ffffff",
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
    shadowColor: "#4F46E5",
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
    maxWidth: 210,
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

  modalTopCloseRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: -4,
    marginBottom: 8,
  },
  modalTopClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F6FD",
    borderWidth: 1,
    borderColor: "#E2EAF5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#17365D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },

  /* location sheet */
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.42)",
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: C.line,
    minHeight: 390,
    maxHeight: "90%",
    width: "100%",
    shadowColor: "#0F2F5F",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 18,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
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
    width: 44,
    height: 44,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    marginLeft: 8,
    marginRight: 9,
    shadowColor: "#312E81",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 3,
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
  variantPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.48)",
  },
  variantPickerSheet: {
    width: "100%",
    maxHeight: "82%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 30 : 18,
    borderWidth: 1,
    borderColor: "#E8EAF6",
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
