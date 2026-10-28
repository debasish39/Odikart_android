import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient"; // npx expo install expo-linear-gradient
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
   Indigo stays as the brand; saffron (Odisha's temple flag
   colour) is the single warm accent. Cool-tinted neutrals.
========================================================= */

const C = {
  brand: "#3A2FB8",
  brandDark: "#241C85",
  brandSoft: "#EEF0FF",
  saffron: "#F59E0B",
  saffronSoft: "#FFF4D6",
  bg: "#F6F7FB",
  surface: "#FFFFFF",
  ink: "#12142B",
  inkSoft: "#555A78",
  inkMuted: "#8A8FA8",
  line: "#E6E8F2",
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

const BANNER_INTERVAL = 4500;
const TILE_TINTS = [
  "#FFF1DE",
  "#FDE7EC",
  "#F3E8FF",
  "#FFEBD6",
  "#FFF0C9",
  "#E6EDFF",
  "#E3F6E8",
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
  brand?: string;
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

type Category = { _id: string; name: string; image?: string; icon?: string };

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
            tone === "light" ? "rgba(255,255,255,0.32)" : "#E5E7EB",
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
      {onSeeAll ? (
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
      ) : null}
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
      <View
        style={s.catGrid}
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
      </View>
    </View>
  );
}

function HomeSkeleton() {
  const { width } = useWindowDimensions();
  const gridW = Math.floor((width - GUTTER * 2 - GRID_GAP) / 2);
  return (
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <StatusBar style="light" backgroundColor={C.brand} translucent={false} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: C.bg }}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Delivery header */}
        <View style={s.headerTop}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Skeleton
              tone="light"
              width={36}
              height={36}
              radius={18}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Skeleton tone="light" width={58} height={9} radius={4} />
              <Skeleton
                tone="light"
                width={148}
                height={14}
                radius={5}
                style={{ marginTop: 7 }}
              />
            </View>
          </View>
          <Skeleton tone="light" width={42} height={42} radius={21} />
        </View>

        {/* Large rounded search bar, matching the live home screen */}
        <View style={s.searchWrap}>
          <View
            style={[
              s.searchBox,
              { minHeight: 58, borderRadius: 18, paddingHorizontal: 18 },
            ]}
          >
            <Skeleton width={24} height={24} radius={12} />
            <Skeleton width="68%" height={16} radius={7} />
            <Skeleton
              width={42}
              height={42}
              radius={21}
              style={{ marginLeft: "auto" }}
            />
          </View>
        </View>

        {/* Promotional banner placeholder */}
        <LinearGradient
          colors={[C.brand, "#7B70E6", C.bg]}
          locations={[0, 0.62, 1]}
          style={s.bannerBackdrop}
        >
          <View style={{ paddingHorizontal: GUTTER }}>
            <Skeleton tone="light" height={170} radius={22} />
          </View>
          <View style={s.dots}>
            <Skeleton width={18} height={6} radius={3} />
            <Skeleton width={6} height={6} radius={3} />
            <Skeleton width={6} height={6} radius={3} />
          </View>
        </LinearGradient>

        {/* Multiple category icon placeholders */}
        <CategoryGridSkeleton />

        {/* Match the live page: Trending, Bestsellers and New Arrivals shelves */}
        <ShelfSkeleton />
        <ShelfSkeleton />
        <ShelfSkeleton />

        {/* Additional products further down the page */}
        <View style={s.shelf}>
          <SectionTitleSkeleton />
          <GridSkeleton width={gridW} count={12} />
        </View>
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
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
        <Skeleton height={116} radius={12} />
        <View style={s.skeletonWishlist}>
          <Skeleton width={27} height={27} radius={14} />
        </View>
        <View style={s.skeletonDiscount}>
          <Skeleton width={38} height={10} radius={5} />
        </View>
      </View>

      {/* Keep the same rhythm as the real product title, price and action */}
      <View style={{ paddingTop: 11 }}>
        <Skeleton width="42%" height={9} radius={5} />
        <Skeleton width="92%" height={12} radius={5} style={{ marginTop: 9 }} />
        <Skeleton width="68%" height={12} radius={5} style={{ marginTop: 6 }} />
        <View style={s.skeletonPriceRow}>
          <Skeleton width="38%" height={15} radius={5} />
          <Skeleton width="25%" height={10} radius={5} />
        </View>
        <Skeleton height={35} radius={10} style={{ marginTop: 12 }} />
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
  const imageHeight = Math.min(126, Math.round(imageSize * 0.78));
  const price = productPrice(product);
  const original = productOriginalPrice(product);
  const discount = productDiscount(product);
  const out = isOutOfStock(product);
  const pop = useRef(new Animated.Value(1)).current;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const popHeart = () =>
    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1.3,
        speed: 40,
        bounciness: 12,
        useNativeDriver: true,
      }),
      Animated.spring(pop, { toValue: 1, speed: 20, useNativeDriver: true }),
    ]).start();
  const productUnit = product.weight || product.netWeight || product.unit || "";

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
            horizontal
            pagingEnabled
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            style={s.cardImageCarousel}
            contentContainerStyle={{ alignItems: "center" }}
            onMomentumScrollEnd={(event) => {
              const nextIndex = Math.round(
                event.nativeEvent.contentOffset.x / imageSize,
              );
              setActiveImageIndex(
                Math.max(0, Math.min(nextIndex, images.length - 1)),
              );
            }}
          >
            {images.map((uri, imageIndex) => (
              <Image
                key={`${product._id}-card-image-${imageIndex}`}
                source={{ uri }}
                style={[
                  s.cardImage,
                  { width: imageSize, height: imageHeight },
                  out && { opacity: 0.45 },
                ]}
                resizeMode="contain"
                accessibilityLabel={`${product.title}, image ${imageIndex + 1}`}
              />
            ))}
          </ScrollView>
        ) : image ? (
          <Image
            source={{ uri: image }}
            style={[s.cardImage, out && { opacity: 0.45 }]}
            resizeMode="contain"
          />
        ) : (
          <View style={s.cardImagePlaceholder}>
            <Ionicons name="image-outline" size={26} color={C.inkMuted} />
          </View>
        )}

        {images.length > 1 ? (
          <View style={s.imageCountBadge} pointerEvents="none">
            <Text style={s.imageCountText}>
              {activeImageIndex + 1}/{images.length}
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
              color={p.wished ? C.danger : "#7B7F9D"}
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
              <Ionicons name="star" size={13} color={C.saffron} />
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
            <View style={s.stepper}>
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
            </View>
          ) : (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                p.onAdd();
              }}
              accessibilityLabel={`Add ${product.title} to cart`}
              style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.82 }]}
            >
              <Ionicons name="add" size={19} color="#fff" />
              <Text style={s.addBtnText}>ADD</Text>
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
  const { isAuthenticated } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const gridCardW = Math.floor((screenWidth - GUTTER * 2 - GRID_GAP) / 2);

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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("Select location");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Ask for location permission on launch. When permission is granted, detect
  // the device location and use the readable area as the delivery destination.
  // If permission is denied, keep manual location selection available.
  const locationPermissionPrompted = useRef(false);
  useEffect(() => {
    let cancelled = false;

    const initializeDeliveryLocation = async () => {
      if (locationPermissionPrompted.current) return;
      locationPermissionPrompted.current = true;

      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;

        if (permission.status === Location.PermissionStatus.UNDETERMINED) {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        if (cancelled) return;

        if (permission.status === Location.PermissionStatus.GRANTED) {
          // Let the screen finish mounting before starting GPS/reverse geocoding.
          requestAnimationFrame(() => {
            if (!cancelled) void useCurrentLocation();
          });
        }
      } catch (error) {
        console.log("LOCATION PERMISSION / INITIAL LOCATION ERROR:", error);
      }
    };

    void initializeDeliveryLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- cart + wishlist ---------- */
  const [cartItems, setCartItems] = useState<any[]>([]);
  const cartItemsRef = useRef<any[]>([]);
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

  /* ---------- banner carousel ---------- */
  const bannerRef = useRef<ScrollView>(null);
  const bannerIndexRef = useRef(0);
  const bannerTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);

  const stopBannerAuto = () => {
    if (bannerTimer.current) clearInterval(bannerTimer.current);
    bannerTimer.current = null;
  };

  const startBannerAuto = () => {
    stopBannerAuto();
    if (reduceMotion) return;
    bannerTimer.current = setInterval(() => {
      if (!bannerRef.current) return;
      const next = (bannerIndexRef.current + 1) % BANNERS.length;
      bannerIndexRef.current = next;
      setBannerIndex(next);
      bannerRef.current.scrollTo({ x: next * screenWidth, animated: true });
    }, BANNER_INTERVAL);
  };

  useEffect(() => {
    startBannerAuto();
    return stopBannerAuto;
  }, [screenWidth, reduceMotion]);

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
    const diff = y - lastY.current;

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
      const loadedCategories: Category[] = Array.isArray(data?.categories)
        ? data.categories
        : Array.isArray(data?.data?.categories)
          ? data.data.categories
          : Array.isArray(data)
            ? data
            : [];
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
      const data = res?.data as
        | Address[]
        | { addresses?: Address[] }
        | undefined;
      const list = (
        Array.isArray(data) ? data : (data?.addresses ?? [])
      ).filter((a: Address) => !a.isDeleted);
      setSavedAddresses(list);
      if (selectedLocation === "Select location") {
        const def = list.find((a: Address) => a.isDefault);
        if (def) setSelectedLocation(formatAddressShort(def));
      }
    } catch (e) {
      console.log("SAVED ADDRESS LOAD ERROR:", e);
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

  useEffect(() => {
    loadHeaderCounts();
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

      // Reverse-geocode the actual coordinates; prefer street/area detail over city-only labels.
      let addr: Location.LocationGeocodedAddress | undefined;
      try {
        addr = (
          await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          })
        )?.[0];
      } catch (geocodeError) {
        console.log("REVERSE GEOCODE ERROR:", geocodeError);
      }

      const area =
        addr?.district || addr?.subregion || addr?.city || addr?.name;
      const city = addr?.city || addr?.subregion || addr?.district;
      const street = [
        addr?.streetNumber,
        addr?.street,
        addr?.name !== area ? addr?.name : undefined,
      ]
        .filter(Boolean)
        .join(" ");
      const preciseLabel = [street, area, city]
        .filter(
          (value, index, values) =>
            value &&
            values.findIndex(
              (v) => v?.toLowerCase() === value.toLowerCase(),
            ) === index,
        )
        .join(", ");

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

  const quantityOf = (p: Product) => {
    if (!isAuthenticated) return 0;
    const sku = variantSkuOf(p);
    const item = cartItems.find(
      (i) =>
        String(i.productId ?? i.product?._id ?? "") === String(p._id) &&
        String(
          i.variantSku || i.variant?.sku || i.selectedVariant?.sku || "",
        ) === String(sku),
    );
    return Math.max(0, Number(item?.quantity) || 0);
  };

  // Optimistic cart UI: update the card immediately, then sync with the server
  // in a per-variant queue. Avoid a second GET /cart after every successful tap.
  const cartQueues = useRef<Record<string, Promise<void>>>({});
  const cartQuantitiesRef = useRef<Record<string, number>>({});
  const mutateProductCart = (p: Product, delta: 1 | -1) => {
    if (!isAuthenticated) {
      router.push("/login-modal" as any);
      return;
    }
    if (isOutOfStock(p) && delta > 0) {
      showToast("This product is out of stock.", "error");
      return;
    }

    const sku = variantSkuOf(p);
    const key = `${p._id}:${sku}`;
    const image = productImage(p) || "";
    // The ref prevents rapid taps from reading a stale React render.
    const renderedQuantity = quantityOf(p);
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
          await syncCart();
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

  const handleAdd = (p: Product) => mutateProductCart(p, 1);
  const handleIncrease = (p: Product) => mutateProductCart(p, 1);
  const handleDecrease = (p: Product) => mutateProductCart(p, -1);

  // Track busy wishlist products individually so one network request doesn't
  // block heart taps on every other product.
  const wishBusyIds = useRef<Set<string>>(new Set());
  const handleWishlist = async (productId: string) => {
    // Open the login modal instead of calling wishlist APIs for signed-out users.
    if (!isAuthenticated) {
      router.push("/login-modal" as any);
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
        const productId = String(item._id ?? "").trim();

        if (!productId || productId === "undefined" || productId === "null") {
          showToast("Product details are unavailable.", "error");
          return;
        }

        void trackProductEvent(productId, "view").catch((error: any) => {
          console.log("PRODUCT VIEW TRACKING ERROR:", error?.message || error);
        });

        void addRecentlyViewedProduct(productId).catch((error: any) => {
          console.log(
            "RECENTLY VIEWED TRACKING ERROR:",
            error?.message || error,
          );
        });

        // Product details are public; authentication is not required here.
        router.push({
          pathname: "/product/[id]",
          params: { id: productId },
        });
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.shelfList}
        >
          {items.map((p, i) => renderCard(p, SHELF_CARD_W, i))}
        </ScrollView>
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
        <StatusBar
          style="light"
          backgroundColor={C.brandDark}
          translucent={false}
        />
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
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={s.offlineRetryText}>Try again</Text>
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
  const sortedResults = sortProducts(products, sort);
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
    <SafeAreaView style={s.root} edges={["top", "left", "right"]}>
      <StatusBar
        style="light"
        backgroundColor={C.brandDark}
        translucent={false}
      />

      <ScrollView
        ref={mainRef}
        style={{ backgroundColor: C.bg }}
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
        {/* [0] Location + bell */}
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
              <Ionicons name="location" size={18} color={C.brand} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={s.deliverTo}>Deliver to</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={s.locationText} numberOfLines={1}>
                  {locationLabel}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color="#fff"
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
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {notificationCount > 0 ? (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* [1] Search — natively sticky, one input only */}
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
              <Image
                source={require("../../../assets/images/odikart-splash.png")}
                style={s.searchLogo}
                resizeMode="contain"
                accessibilityLabel="OdiKart logo"
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
                <Ionicons name="close-circle" size={20} color={C.inkMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* [2] Content */}
        <View>
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
                    onPress={() => setSort(o.key)}
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
                    <Text style={s.retryText}>Clear search</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* Banner carousel on a header-to-page gradient */}
              <LinearGradient
                colors={[C.brand, "#7B70E6", C.bg]}
                locations={[0, 0.62, 1]}
                style={s.bannerBackdrop}
              >
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
                  {BANNERS.map((b) => (
                    <View
                      key={b.id}
                      style={{ width: screenWidth, paddingHorizontal: GUTTER }}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          s.banner,
                          pressed && { opacity: 0.96 },
                        ]}
                        onPress={() => router.push("/(tabs)/categories")}
                        accessibilityRole="button"
                        accessibilityLabel={b.label}
                      >
                        <Image
                          source={b.source}
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
                          <Text style={s.bannerTagline}>{b.tagline}</Text>
                          <View style={s.bannerBtn}>
                            <Text style={s.bannerBtnText}>{b.cta}</Text>
                            <Ionicons
                              name="arrow-forward"
                              size={15}
                              color="#fff"
                            />
                          </View>
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

                <View
                  style={s.dots}
                  accessibilityLabel={`Banner ${bannerIndex + 1} of ${BANNERS.length}`}
                >
                  {BANNERS.map((b, i) => (
                    <View
                      key={b.id}
                      style={[s.dot, i === bannerIndex && s.dotActive]}
                    />
                  ))}
                </View>
              </LinearGradient>

              {/* Categories */}
              <View style={s.categorySectionHeader}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={s.categorySectionTitle}
                    accessibilityRole="header"
                  >
                    Shop by category
                  </Text>
                  <Text style={s.categorySectionSubtitle}>
                    Find your everyday favourites
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push("/(tabs)/categories")}
                  style={s.categorySeeAll}
                  accessibilityRole="button"
                  accessibilityLabel="View all categories"
                >
                  <Text style={s.seeAllText}>View all</Text>
                  <Ionicons name="chevron-forward" size={14} color={C.brand} />
                </Pressable>
              </View>
              <View style={s.catGrid}>
                {categoriesLoading
                  ? [1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                      <View key={i} style={s.catItem}>
                        <View style={s.skeletonCategoryTile}>
                          <Skeleton width={36} height={36} radius={12} />
                        </View>
                        <Skeleton
                          width={44}
                          height={10}
                          radius={5}
                          style={{ marginTop: 9 }}
                        />
                      </View>
                    ))
                  : categories.length > 0
                    ? [
                        ...categories.slice(0, 7).map((c, i) => (
                          <Pressable
                            key={c._id}
                            style={({ pressed }) => [
                              s.catItem,
                              pressed && {
                                opacity: 0.88,
                                transform: [{ scale: 0.96 }],
                              },
                            ]}
                            android_ripple={{
                              color: "rgba(58,47,184,0.10)",
                              borderless: false,
                            }}
                            onPress={() =>
                              router.push({
                                pathname: "/(tabs)/categories",
                                params: { categoryId: c._id },
                              })
                            }
                            accessibilityRole="button"
                            accessibilityLabel={c.name}
                          >
                            <View
                              style={[
                                s.catTile,
                                {
                                  backgroundColor:
                                    TILE_TINTS[i % TILE_TINTS.length],
                                },
                              ]}
                            >
                              {c.image ? (
                                <Image
                                  source={{ uri: c.image }}
                                  style={s.catImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text style={{ fontSize: 24 }}>
                                  {c.icon || "🛍️"}
                                </Text>
                              )}
                            </View>
                            <Text style={s.categoryName} numberOfLines={2}>
                              {c.name}
                            </Text>
                          </Pressable>
                        )),
                        <Pressable
                          key="more"
                          style={({ pressed }) => [
                            s.catItem,
                            pressed && {
                              opacity: 0.88,
                              transform: [{ scale: 0.96 }],
                            },
                          ]}
                          android_ripple={{
                            color: "rgba(58,47,184,0.10)",
                            borderless: false,
                          }}
                          onPress={() => router.push("/(tabs)/categories")}
                          accessibilityRole="button"
                          accessibilityLabel="More categories"
                        >
                          <View
                            style={[
                              s.catTile,
                              { backgroundColor: C.brandSoft },
                            ]}
                          >
                            <Ionicons
                              name="ellipsis-horizontal"
                              size={26}
                              color={C.brand}
                            />
                          </View>
                          <Text style={s.categoryName}>More</Text>
                        </Pressable>,
                      ]
                    : null}
              </View>

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
                  {shelf("topRated", "Top Rated", "Highly rated by customers")}
                  {shelf("newArrivals", "New Arrivals", "Just added")}
                  {shelf("featured", "Featured Products", "Handpicked for you")}
                  {shelf(
                    "recommended",
                    "Recommended for You",
                    "Discover your next favourite",
                  )}
                  {shelf("flashSales", "Flash Sales", "Limited-time offers")}
                  {shelf("deals", "Deals", "Save on everyday picks")}
                  {shelf("lowStock", "Almost Gone", "Limited stock available")}
                  {shelf(
                    "recentlyViewed",
                    "Recently Viewed",
                    "Pick up where you left off",
                  )}
                  {shelvesLoading && shelfProducts.trending.length === 0 ? (
                    <ShelfSkeleton />
                  ) : null}

                  <View style={s.shelf}>
                    <SectionHeader
                      title="All products"
                      subtitle={`${products.length} available`}
                    />
                    {products.length > 0 ? (
                      <>
                        <View style={s.grid}>
                          {products
                            .slice(0, visibleCount)
                            .map((p, i) => renderCard(p, gridCardW, i))}
                        </View>
                        {products.length > visibleCount ? (
                          <Pressable
                            style={s.moreBtn}
                            onPress={() =>
                              setVisibleCount((c) => c + PAGE_SIZE)
                            }
                            accessibilityRole="button"
                          >
                            <Text style={s.moreBtnText}>
                              Show more products
                            </Text>
                            <Ionicons
                              name="chevron-down"
                              size={16}
                              color={C.brand}
                            />
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
              colors={["blue", "#4A2AAE"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={s.cartTopGloss} />
            <View style={s.cartImages}>
              {cartPreview.length === 0 ? (
                <View style={s.cartImageFallback}>
                  <Ionicons name="bag-handle-outline" size={15} color="#fff" />
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
              <Ionicons name="arrow-forward" size={15} color="#4A2AAE" />
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
            <View style={s.topBtnIcon}>
              <Ionicons name="arrow-up" size={17} color="#FFFFFF" />
            </View>
            <Text style={s.topBtnText}>Back to top</Text>
          </Pressable>
        </Animated.View>
      ) : null}

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

              <View style={s.sheetHeader}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={s.sheetTitle}>Choose delivery location</Text>
                  <Text style={s.sheetSubtitle}>
                    Search, use GPS, or pick a saved address
                  </Text>
                </View>
                <Pressable
                  style={s.sheetClose}
                  onPress={closeLocation}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={20} color={C.ink} />
                </Pressable>
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
                          onPress={() => chooseLocation(short)}
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
                  <Text style={s.statusText}>Add one to check out faster.</Text>
                </View>
              ) : (
                <ScrollView
                  style={s.sheetList}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {savedAddresses.map((a) => {
                    const label = formatAddressShort(a);
                    const selected = selectedLocation === label;
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
                                <Text style={s.addressTagText}>{a.label}</Text>
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
                    const p = Animated.modulo(Animated.add(voicePulse, ph), 1);
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
                style={[s.micBig, listening && s.micBigActive]}
                onPress={
                  listening ? stopVoice : () => beginListening(voiceLang)
                }
                accessibilityRole="button"
                accessibilityLabel={
                  listening ? "Stop listening" : "Start listening"
                }
              >
                <Ionicons
                  name={listening ? "stop" : "mic"}
                  size={32}
                  color="#fff"
                />
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
                  style={[s.sortChip, voiceLang === l.code && s.sortChipActive]}
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
                const previewImages = productImages(previewProduct);
                const previewWidth = Math.max(
                  0,
                  Math.min(screenWidth - 84, 432),
                );
                return previewImages.length > 0 ? (
                  <View>
                    <ScrollView
                      horizontal
                      pagingEnabled
                      nestedScrollEnabled
                      showsHorizontalScrollIndicator={false}
                      style={{ width: previewWidth }}
                      onMomentumScrollEnd={(event) => {
                        const nextIndex = Math.round(
                          event.nativeEvent.contentOffset.x / previewWidth,
                        );
                        setPreviewImageIndex(
                          Math.max(
                            0,
                            Math.min(nextIndex, previewImages.length - 1),
                          ),
                        );
                      }}
                    >
                      {previewImages.map((uri, index) => (
                        <Image
                          key={`${previewProduct._id}-preview-${index}`}
                          source={{ uri }}
                          style={[
                            s.productPreviewImage,
                            { width: previewWidth, height: previewWidth },
                          ]}
                          resizeMode="contain"
                          accessibilityLabel={`${previewProduct.title}, image ${index + 1} of ${previewImages.length}`}
                        />
                      ))}
                    </ScrollView>
                    {previewImages.length > 1 ? (
                      <View style={s.previewCarouselFooter}>
                        <Text style={s.previewImageCount}>
                          {previewImageIndex + 1} / {previewImages.length}
                        </Text>
                        <View style={s.previewDots}>
                          {previewImages.map((_, index) => (
                            <View
                              key={`preview-dot-${index}`}
                              style={[
                                s.previewDot,
                                index === previewImageIndex &&
                                  s.previewDotActive,
                              ]}
                            />
                          ))}
                        </View>
                        <Text style={s.previewSwipeHint}>Swipe images</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View
                    style={[
                      s.productPreviewImage,
                      { width: previewWidth, height: previewWidth },
                      s.cardImagePlaceholder,
                    ]}
                  >
                    <Ionicons
                      name="image-outline"
                      size={42}
                      color={C.inkMuted}
                    />
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
              try {
                await Share.share({
                  title: previewProduct.title,
                  message: `${previewProduct.title} — available on Odikart\\nhttps://odikart.in/product/${previewProduct._id}`,
                  url: `https://odikart.in/product/${previewProduct._id}`,
                });
              } catch (error) {
                console.log("PRODUCT SHARE ERROR:", error);
                showToast("Couldn't share this product.", "error");
              }
            }}
          >
            <Ionicons name="share-outline" size={27} color="#6747b1" />
          </Pressable>
        </View>
      </Modal>

      <Toast toast={toast} />
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.brand },
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
  headerTop: {
    backgroundColor: C.brand,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    minHeight: 44,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  deliverTo: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "600",
  },
  locationText: {
    flexShrink: 1,
    color: "#fff",
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
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  bellBadge: {
    position: "absolute",
    right: 2,
    top: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },

  searchWrap: {
    backgroundColor: C.brand,
    paddingHorizontal: GUTTER,
    paddingTop: 6,
    paddingBottom: 14,
    zIndex: 20,
    elevation: 5,
  },
  searchBox: {
    minHeight: 54,
    borderRadius: 17,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
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
    height: 52,
    fontSize: 15,
    color: C.ink,
    paddingVertical: 0,
  },

  /* sections */
  sectionHeader: {
    paddingHorizontal: GUTTER,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
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
  shelf: { marginTop: 28 },
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    paddingHorizontal: GUTTER,
    columnGap: GRID_GAP,
    rowGap: 16,
    alignItems: "stretch",
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
    width: 60,
    height: 60,
    borderRadius: 19,
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
  bannerBackdrop: { paddingTop: 8, paddingBottom: 16 },
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
    flexWrap: "wrap",
    paddingHorizontal: 8,
    paddingTop: 8,
    rowGap: 8,
  },
  catItem: {
    width: "25%",
    alignItems: "center",
    marginBottom: 2,
    paddingHorizontal: 5,
    minHeight: 100,
    borderRadius: 16,
  },
  catTile: {
    width: 60,
    height: 60,
    borderRadius: 19,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    elevation: 2,
    shadowColor: "#171747",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
  },
  catImage: { width: "100%", height: "100%" },
  /* banner */
  banner: {
    height: 184,
    borderRadius: 22,
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
    backgroundColor: "#5B4BFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bannerBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

  /* compact product card — inspired by the supplied pickle-card reference */
  card: {
    backgroundColor: C.surface,
    borderRadius: 17,
    padding: 8,
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
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#FAFAFD",
  },
  cardImageCarousel: { width: "100%", height: "100%" },
  cardImage: { width: "100%", height: "100%" },
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
  cardBody: { paddingTop: 6, paddingHorizontal: 1 },
  cardTitle: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    color: C.ink,
  },
  cardUnit: { marginTop: 3, fontSize: 11.5, lineHeight: 15, color: C.inkMuted },
  cardPriceRow: {
    minHeight: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  cardMetaRow: {
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 1,
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
    fontSize: 15,
    lineHeight: 20,
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
    minWidth: 58,
    height: 35,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: C.brand,
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
    backgroundColor: "#4338F5",
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    alignItems: "center",
    width: "100%",
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
    backgroundColor: C.brand,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  micBigActive: { backgroundColor: C.danger },
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
  sortRow: { paddingHorizontal: GUTTER, paddingTop: 12, gap: 8 },
  sortChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
  },
  sortChipActive: { backgroundColor: C.brand, borderColor: C.brand },
  sortChipText: { fontSize: 12.5, fontWeight: "700", color: C.inkSoft },
  sortChipTextActive: { color: "#fff" },
  moreBtn: {
    alignSelf: "center",
    marginTop: 9,
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 23,
    backgroundColor: C.brandSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  moreBtnText: { color: C.brand, fontSize: 14, fontWeight: "800" },
  topBtnWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 112 : 88 + 39,
    alignSelf: "center",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 800,
  },
  topBtn: {
    minHeight: 40,
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
    color: C.brand,
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
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 15,
    backgroundColor: C.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    elevation: 3,
    shadowColor: C.brand,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
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
    height: 46,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: C.brand,
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
  // cartAura: { position: "absolute", width: "78%", maxWidth: 233, height: 58, borderRadius: 32, backgroundColor: "#6D4AFF", shadowColor: "#6D4AFF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 22, elevation: 18 },
  cartBar: {
    width: "100%",
    maxWidth: 210,
    minHeight: 54,
    paddingLeft: 11,
    paddingRight: 9,
    borderRadius: 30,
    backgroundColor: "#5B35E8",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.96)",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#5B35E8",
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
    shadowColor: "#FFE88A",
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

  /* location sheet */
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(18,20,43,0.45)",
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
    minHeight: 390,
    maxHeight: "90%",
    width: "100%",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginBottom: 16,
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
    backgroundColor: C.saffronSoft,
  },
  addressTagText: { fontSize: 10.5, fontWeight: "800", color: "#92600A" },
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
  productPreviewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 20,
    backgroundColor: "#F4F4F5",
  },
  previewCarouselFooter: {
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 9,
  },
  previewImageCount: {
    color: C.inkSoft,
    fontSize: 12,
    fontWeight: "700",
    minWidth: 42,
  },
  previewDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    flex: 1,
  },
  previewDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D6D8E5",
  },
  previewDotActive: {
    width: 16,
    backgroundColor: C.brand,
  },
  previewSwipeHint: {
    color: C.inkMuted,
    fontSize: 10,
    minWidth: 62,
    textAlign: "right",
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
    width: 69,
    height: 69,
    borderRadius: 43,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 33,
    elevation: 8,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
  },
});
54;
