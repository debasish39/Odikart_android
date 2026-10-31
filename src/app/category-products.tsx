import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Animated,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useLocalSearchParams, useRouter } from "expo-router";

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  addToCart,
  decreaseCartItem,
  getCart,
  increaseCartItem,
} from "../api/cart";
import { getCategories } from "../api/categories";
import { getProducts } from "../api/products";
import {
  addToWishlist,
  getWishlist,
  getWishlistProductIds,
  removeFromWishlist,
} from "../api/wishlist";

type Category = {
  _id?: string;

  id?: string;

  name?: string;

  title?: string;

  image?: string;

  imageUrl?: string;

  thumbnail?: string;
};

type Product = {
  _id?: string;

  id?: string;

  name?: string;

  title?: string;

  description?: string;

  brand?: any;

  sku?: string;

  barcode?: string;

  unit?: string;

  stock?: number;

  isActive?: boolean;

  price?: number | string;

  originalPrice?: number | string;

  discountPercentage?: number | string;

  discountAmount?: number | string;

  image?: string;

  imageUrl?: string;

  thumbnail?: string;

  media?: { thumbnail?: string; images?: string[] };

  variants?: any[];

  category?: any;

  subcategory?: any;

  rating?: number | string;

  averageRating?: number | string;

  reviewCount?: number | string;

  numReviews?: number | string;

  stock?: number;
};

const getCategoryId = (item: Category) => String(item._id || item.id || "");

const getCategoryName = (item: Category) =>
  item.name || item.title || "Category";

function unwrapList(response: any, key: string): any[] {
  // API clients may return either the raw payload or an Axios response.
  // Accept common paginated/wrapped shapes without treating objects as arrays.
  const candidates = [
    response,
    response?.data,
    response?.body,
    response?.result,
    response?.data?.data,
    response?.data?.result,
    response?.payload,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.[key])) return candidate[key];
    if (Array.isArray(candidate?.results)) return candidate.results;
    if (Array.isArray(candidate?.items)) return candidate.items;
    if (Array.isArray(candidate?.docs)) return candidate.docs;
    if (
      Array.isArray(candidate?.data) &&
      candidate.data.every((item: any) => item && typeof item === "object")
    ) {
      return candidate.data;
    }
  }
  return [];
}

function getProductId(product: Product) {
  return String(product._id || product.id || "");
}

function getProductName(product: Product) {
  return product.name || product.title || "Product";
}

function imageValue(value: any): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const nested =
      value.url || value.uri || value.secure_url || value.src || value.path;
    if (typeof nested === "string") return nested.trim();
  }
  return "";
}

function getProductImage(product: Product): string {
  const firstVariant = product.variants?.[0];
  const rawImages = (product as any).images;
  const candidates = [
    product.media?.thumbnail,
    product.media?.images?.[0],
    Array.isArray(rawImages) ? rawImages[0] : rawImages,
    (product as any).mainImage,
    (product as any).primaryImage,
    (product as any).image_url,
    product.image,
    product.imageUrl,
    product.thumbnail,
    firstVariant?.image,
    firstVariant?.imageUrl,
    firstVariant?.images?.[0],
  ];
  for (const candidate of candidates) {
    const value = imageValue(candidate);
    if (value) return value;
  }
  return "";
}

function getProductImages(product: Product): string[] {
  const raw = product as any;
  const candidates = [
    ...(Array.isArray(product.media?.images) ? product.media!.images! : []),
    ...(Array.isArray(raw.images) ? raw.images : []),
    ...(Array.isArray(raw.gallery) ? raw.gallery : []),
    ...(Array.isArray(raw.galleryImages) ? raw.galleryImages : []),
    raw.mainImage,
    raw.primaryImage,
    raw.image_url,
    product.image,
    product.imageUrl,
    product.thumbnail,
    product.media?.thumbnail,
    ...(product.variants || []).flatMap((variant: any) => [
      variant?.image,
      variant?.imageUrl,
      ...(Array.isArray(variant?.images) ? variant.images : []),
    ]),
  ];
  const seen = new Set<string>();
  return candidates.map(imageValue).filter((uri) => {
    if (!uri || seen.has(uri)) return false;
    seen.add(uri);
    return true;
  });
}

function ProductImageCarousel({
  images,
  style,
}: {
  images: string[];
  style: any;
}) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  // Avoid resetting the carousel when the parent re-renders for cart/wishlist changes.
  const imageSignature = images.join("|");

  const safeImages = useMemo(() => {
    const seen = new Set<string>();
    const unique = images.filter((uri) => {
      if (!uri || seen.has(uri)) return false;
      seen.add(uri);
      return true;
    });
    return unique.length ? unique : [""];
  }, [imageSignature]);

  useEffect(() => {
    setActiveIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [imageSignature]);

  const updateActiveIndex = useCallback(
    (event: any) => {
      if (width <= 0) return;
      const offsetX = event?.nativeEvent?.contentOffset?.x ?? 0;
      const nextIndex = Math.round(offsetX / width);
      setActiveIndex(Math.max(0, Math.min(nextIndex, safeImages.length - 1)));
    },
    [safeImages.length, width],
  );

  return (
    <View
      style={style}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth > 0 && nextWidth !== width) {
          setWidth(nextWidth);
        }
      }}
      accessible={false}
    >
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={safeImages}
          horizontal
          pagingEnabled
          snapToInterval={width}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          nestedScrollEnabled
          directionalLockEnabled
          keyboardShouldPersistTaps="handled"
          scrollEnabled={true}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          keyExtractor={(uri, index) => `${uri || "no-image"}-${index}`}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onScroll={updateActiveIndex}
          onMomentumScrollEnd={updateActiveIndex}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({
              offset: info.index * width,
              animated: true,
            });
          }}
          renderItem={({ item: uri }) => (
            <View
              style={{
                width,
                height: "100%",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <ProductImage
                uri={uri}
                style={{ width: "100%", height: "100%" }}
              />
            </View>
          )}
        />
      ) : null}

      {safeImages.length > 1 ? (
        <>
          <View pointerEvents="none" style={styles.imageCountBadge}>
            <Text style={styles.imageCountText}>
              {Math.min(activeIndex + 1, safeImages.length)}/{safeImages.length}
            </Text>
          </View>
          <View pointerEvents="none" style={styles.carouselDots}>
            {safeImages.map((_, index) => (
              <View
                key={`${index}`}
                style={[
                  styles.carouselDot,
                  index === activeIndex && styles.carouselDotActive,
                ]}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function ProductImage({ uri, style }: { uri: string; style: any }) {
  const [failedUri, setFailedUri] = useState("");
  useEffect(() => {
    setFailedUri("");
  }, [uri]);

  const validUri =
    /^https?:\/\//i.test(uri) ||
    /^file:\/\//i.test(uri) ||
    /^data:image\//i.test(uri);
  if (!uri || !validUri || failedUri === uri) {
    return (
      <View style={[style, styles.noImage]}>
        <Ionicons name="image-outline" size={32} color="#A0A8B7" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode="contain"
      onError={() => setFailedUri(uri)}
      accessibilityLabel="Product image"
    />
  );
}

// Use the cheapest active variant for the card's "From" price. Keep its
// original price paired with that same variant so the discount is accurate.
function getCheapestActiveVariant(product: Product) {
  const variants = (product.variants || []).filter(
    (variant: any) => variant?.isActive !== false,
  );
  return variants
    .filter(
      (variant: any) =>
        Number.isFinite(Number(variant?.price)) && Number(variant.price) >= 0,
    )
    .sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
}

function getProductPrice(product: Product) {
  const variant = getCheapestActiveVariant(product);
  const candidates = [
    variant?.salePrice,
    variant?.price,
    (product as any).salePrice,
    product.price,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      const value = Number(candidate);
      if (Number.isFinite(value) && value >= 0) return value;
    }
  }
  return 0;
}

function getOriginalPrice(product: Product) {
  const variant = getCheapestActiveVariant(product);
  const candidates = [
    variant?.originalPrice,
    variant?.compareAtPrice,
    (product as any).compareAtPrice,
    product.originalPrice,
  ];
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== "") {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return 0;
}

function getDiscount(product: Product) {
  const price = getProductPrice(product);
  const original = getOriginalPrice(product);
  // Calculate from the exact displayed price pair rather than trusting a stale
  // discount field that may not match the current variant price.
  if (original > price && original > 0)
    return Math.round(((original - price) / original) * 100);
  const direct = Number(product.discountPercentage);
  return product.discountPercentage !== undefined &&
    Number.isFinite(direct) &&
    direct > 0
    ? Math.round(direct)
    : 0;
}

function getCardStock(product: Product) {
  const variants = (product.variants || []).filter(
    (variant: any) => variant?.isActive !== false,
  );
  if (variants.length) {
    const knownStocks = variants
      .map((variant: any) => variant?.stock)
      .filter(
        (stock: any) =>
          stock !== undefined &&
          stock !== null &&
          Number.isFinite(Number(stock)),
      );
    if (!knownStocks.length)
      return { available: true, label: "Stock available" };
    const total = knownStocks.reduce(
      (sum: number, stock: any) => sum + Math.max(0, Number(stock)),
      0,
    );
    return total > 0
      ? { available: true, label: `${total} in stock` }
      : { available: false, label: "Out of stock" };
  }
  const stock = (product as any).stock ?? (product as any).quantity;
  if (stock === undefined || stock === null)
    return { available: true, label: "Available" };
  return Number(stock) > 0
    ? { available: true, label: `${Number(stock)} in stock` }
    : { available: false, label: "Out of stock" };
}

function getProductCategoryValue(value: any) {
  if (value && typeof value === "object") {
    return {
      id: String(value._id || value.id || ""),

      name: String(value.name || value.title || "")
        .trim()
        .toLowerCase(),
    };
  }

  return {
    id: String(value || ""),
    name: String(value || "")
      .trim()
      .toLowerCase(),
  };
}

function productMatchesCategory(product: Product, category: Category) {
  const categoryId = getCategoryId(category);

  const categoryName = getCategoryName(category).trim().toLowerCase();

  const candidates = [product.category, product.subcategory].map(
    getProductCategoryValue,
  );

  return candidates.some(
    (value) =>
      (!!categoryId && value.id === categoryId) ||
      (!!categoryName && value.name === categoryName),
  );
}

function formatPrice(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function SkeletonBox({ style }: { style?: any }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,

          duration: 850,

          useNativeDriver: true,
        }),

        Animated.timing(shimmer, {
          toValue: 0,

          duration: 850,

          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],

    outputRange: [0.4, 1],
  });

  return (
    <View style={[styles.skeletonBox, style, { overflow: "hidden" }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,

          styles.skeletonShine,

          { opacity },
        ]}
      />
    </View>
  );
}

function ProductSkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonBox style={styles.skeletonImage} />

      <SkeletonBox style={{ width: "82%", height: 9, marginTop: 8 }} />

      <SkeletonBox style={{ width: "55%", height: 8, marginTop: 6 }} />

      <SkeletonBox style={{ width: "68%", height: 8, marginTop: 7 }} />

      <SkeletonBox
        style={{ width: "100%", height: 26, marginTop: 8, borderRadius: 9 }}
      />
    </View>
  );
}

function ProductsSkeleton() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* Simple header skeleton — keep navigation in one horizontal row. */}
      <View style={styles.header}>
        <View style={styles.skeletonIcon} />
        <View style={[styles.skeletonTitle, { flex: 1, width: undefined }]} />
        <View style={styles.skeletonIcon} />
      </View>

      {/* One simple search placeholder instead of a busy toolbar. */}
      <View style={styles.simpleSkeletonSearch}>
        <SkeletonBox style={{ width: 18, height: 18, borderRadius: 9 }} />
        <SkeletonBox style={{ width: "55%", height: 10 }} />
      </View>

      {/* Lightweight category chips. */}
      <View style={styles.skeletonChips}>
        {[58, 76, 64, 52].map((width, index) => (
          <SkeletonBox
            key={index}
            style={{ width, height: 28, borderRadius: 14 }}
          />
        ))}
      </View>

      {/* Match the actual two-column product layout. */}
      <View style={styles.skeletonGrid}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={styles.skeletonProductRow}>
            <ProductSkeletonCard />
            <ProductSkeletonCard />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function CategoryProductsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    categoryId?: string | string[];
    categoryName?: string | string[];
  }>();

  const routeCategoryId = Array.isArray(params.categoryId)
    ? params.categoryId[0]
    : params.categoryId;

  const routeCategoryName = Array.isArray(params.categoryName)
    ? params.categoryName[0]
    : params.categoryName;

  const [categories, setCategories] = useState<Category[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [selectedChip, setSelectedChip] = useState("All");

  const [sortVisible, setSortVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState("All");
  const [selectedBrand, setSelectedBrand] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000]);
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceSearchVisible, setVoiceSearchVisible] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(
    {},
  );
  const [cartPreviewImages, setCartPreviewImages] = useState<string[]>([]);
  const [voiceListening, setVoiceListening] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartBusy = useRef(false);
  const [wishBusyId, setWishBusyId] = useState<string | null>(null);
  const animeGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animeGlow, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(animeGlow, {
          toValue: 0,
          duration: 1400,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animeGlow]);
  const cartCount = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + Math.max(0, Number(item.quantity) || 0),
        0,
      ),
    [cartItems],
  );
  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      // Use the native Android toast on Android; keep the lightweight in-app
      // equivalent for platforms that do not expose ToastAndroid.
      if (Platform.OS === "android") {
        ToastAndroid.showWithGravity(
          message,
          type === "error" ? ToastAndroid.LONG : ToastAndroid.SHORT,
          ToastAndroid.BOTTOM,
        );
        return;
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message, type });
      toastTimer.current = setTimeout(() => setToast(null), 2400);
    },
    [],
  );
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  useSpeechRecognitionEvent("start", () => setVoiceListening(true));
  useSpeechRecognitionEvent("end", () => setVoiceListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (transcript) {
      setSearchQuery(transcript);
      setVoiceSearchVisible(false);
      Keyboard.dismiss();
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    setVoiceListening(false);
    if (event.error !== "aborted")
      showToast(
        "Voice search failed. Check microphone permission and try again.",
        "error",
      );
  });
  const startVoiceSearch = useCallback(async () => {
    try {
      Keyboard.dismiss();
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        showToast(
          "Allow microphone and speech recognition permission to use voice search.",
          "error",
        );
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: false,
        continuous: false,
      });
    } catch (e) {
      setVoiceListening(false);
      console.log("VOICE SEARCH ERROR:", e);
      showToast("Voice search isn't available on this device.", "error");
    }
  }, [showToast]);

  const syncCart = useCallback(async () => {
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
    setCartItems(items);
    const quantities: Record<string, number> = {};
    items.forEach((item: any) => {
      const id = String(
        item.productId || item.product?._id || item.product?._id || "",
      );
      if (id) quantities[id] = Math.max(0, Number(item.quantity) || 0);
    });
    setCartQuantities(quantities);
    setCartPreviewImages(
      items
        .map(
          (item: any) =>
            imageValue(item.image) ||
            imageValue(item.variant?.image) ||
            (item.product ? getProductImage(item.product) : "") ||
            imageValue(item.product?.media?.thumbnail) ||
            imageValue(item.selectedVariant?.images?.[0]),
        )
        .filter((value: string) => /^https?:\/\//i.test(value))
        .slice(0, 3),
    );
  }, []);

  const syncWishlist = useCallback(async () => {
    try {
      setWishlistIds(getWishlistProductIds(await getWishlist()));
    } catch {
      setWishlistIds([]);
    }
  }, []);

  const mutateCart = useCallback(
    async (
      action: () => Promise<unknown>,
      fallback: string,
      success?: string,
    ) => {
      if (cartBusy.current) return;
      cartBusy.current = true;
      try {
        await action();
        await syncCart();
        if (success) showToast(success, "success");
      } catch (e: any) {
        console.log(
          "CATEGORY CART ERROR:",
          e?.response?.data || e?.message || e,
        );
        const status = e?.response?.status;
        showToast(
          status === 401 || status === 403
            ? "Log in to use your cart."
            : e?.response?.data?.message || fallback,
          "error",
        );
      } finally {
        cartBusy.current = false;
      }
    },
    [showToast, syncCart],
  );

  const handleAddToCart = useCallback(
    (product: Product) => {
      const id = getProductId(product);
      if (!id) return;
      if (product.stock !== undefined && Number(product.stock) <= 0) {
        showToast("This product is out of stock.", "error");
        return;
      }
      const variant = product.variants?.[0];
      const image = getProductImage(product);
      mutateCart(
        () =>
          addToCart({
            productId: id,
            variantSku: variant?.sku || "",
            quantity: 1,
            image,
          }),
        "Couldn't add this product to your cart.",
        `${getProductName(product)} added to cart`,
      );
    },
    [mutateCart, showToast],
  );

  const changeCartQuantity = useCallback(
    (product: Product, direction: "increase" | "decrease") => {
      const id = getProductId(product);
      if (!id) return;
      const variantSku = product.variants?.[0]?.sku || "";
      const quantity = cartQuantities[id] || 0;
      if (direction === "increase" && quantity === 0)
        return handleAddToCart(product);
      if (direction === "increase") {
        mutateCart(
          () => increaseCartItem({ productId: id, variantSku }),
          "Couldn't update quantity.",
        );
      } else if (quantity > 0) {
        mutateCart(
          () => decreaseCartItem({ productId: id, variantSku }),
          "Couldn't update quantity.",
        );
      }
    },
    [cartQuantities, handleAddToCart, mutateCart],
  );

  const handleWishlist = useCallback(
    async (productId: string) => {
      const id = String(productId);
      if (!id || wishBusyId) return;
      const wished = wishlistIds.includes(id);
      try {
        setWishBusyId(id);
        if (wished) {
          await removeFromWishlist(id);
          setWishlistIds((current) => current.filter((value) => value !== id));
          showToast("Removed from wishlist");
        } else {
          await addToWishlist(id);
          setWishlistIds((current) =>
            current.includes(id) ? current : [...current, id],
          );
          showToast("Saved to wishlist", "success");
        }
      } catch (e: any) {
        const status = e?.response?.status;
        showToast(
          status === 401 || status === 403
            ? "Log in to use your wishlist."
            : "Couldn't update wishlist. Try again.",
          "error",
        );
      } finally {
        setWishBusyId(null);
      }
    },
    [wishlistIds, wishBusyId, showToast],
  );
  const resetFilters = useCallback(() => {
    // Clear search
    setSearchQuery("");
    Keyboard.dismiss();

    // Reset category and product filters
    setFilterCategoryId("All");
    setSelectedChip("All");
    setSelectedBrand("All");
    setSelectedSubcategory("All");
    setPriceRange([0, 5000]);

    // Reset additional filters
    setOffersOnly(false);
    setInStockOnly(false);
    setRatingOnly(false);

    // Reset sorting
    setSortBy("recommended");

    // Close filter and sort panels
    setFilterVisible(false);
    setSortVisible(false);
  }, []);

  const [sortBy, setSortBy] = useState<
    "recommended" | "priceLow" | "priceHigh" | "discount"
  >("recommended");

  const loadData = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) setRefreshing(true);
        else setLoading(true);

        const [categoryResponse, productResponse] = await Promise.all([
          getCategories(),
          getProducts(),
        ]);
        await Promise.allSettled([syncCart(), syncWishlist()]);

        const categoryList = unwrapList(categoryResponse, "categories").filter(
          (item: any) => item && typeof item === "object",
        );
        const productList = unwrapList(productResponse, "products")
          .filter((item: any) => item && typeof item === "object")
          .filter((item: any) => Boolean(item._id || item.id || item.slug));

        setCategories(categoryList);
        // Deduplicate API results by stable ID so wrapped/paginated responses
        // don't produce duplicate cards.
        const seenProductIds = new Set<string>();
        const cleanProducts = productList.filter((item: any) => {
          const id = String(item._id || item.id || item.slug);
          if (seenProductIds.has(id)) return false;
          seenProductIds.add(id);
          return true;
        });
        setProducts(cleanProducts);
      } catch (e: any) {
        console.log("CATEGORY PRODUCTS ERROR:", e);

        setError(
          e?.response?.data?.message || e?.message || "Couldn't load products.",
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [syncCart, syncWishlist],
  );

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedCategory = useMemo(() => {
    if (filterCategoryId !== "All") {
      const chosen = categories.find(
        (category) => getCategoryId(category) === filterCategoryId,
      );
      if (chosen) return chosen;
    }
    if (routeCategoryId) {
      const byId = categories.find(
        (category) => getCategoryId(category) === routeCategoryId,
      );

      if (byId) return byId;
    }

    if (routeCategoryName) {
      const target = routeCategoryName.trim().toLowerCase();

      const byName = categories.find(
        (category) => getCategoryName(category).trim().toLowerCase() === target,
      );

      if (byName) return byName;
    }

    return undefined;
  }, [categories, routeCategoryId, routeCategoryName, filterCategoryId]);

  const title = selectedCategory
    ? getCategoryName(selectedCategory)
    : routeCategoryName || "Products";

  const filteredProducts = useMemo(() => {
    let result = selectedCategory
      ? products.filter((product) =>
          productMatchesCategory(product, selectedCategory),
        )
      : products;

    // A fallback for apps whose products only contain a category name/id string in the route.

    if (selectedCategory && result.length === 0) {
      const targetId = getCategoryId(selectedCategory);

      const targetName = getCategoryName(selectedCategory).trim().toLowerCase();

      result = products.filter((product) => {
        const value = getProductCategoryValue(product.category);

        return value.id === targetId || value.name === targetName;
      });
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((product) =>
        [
          getProductName(product),
          product.description || "",
          getProductCategoryValue(product.category).name,
          getProductCategoryValue(product.subcategory).name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }
    if (offersOnly)
      result = result.filter((product) => getDiscount(product) > 0);
    if (inStockOnly)
      result = result.filter((product) => getCardStock(product).available);
    if (ratingOnly)
      result = result.filter(
        (product) => Number(product.averageRating || product.rating || 0) >= 4,
      );

    if (selectedBrand !== "All") {
      result = result.filter((product) => {
        const brand = product.brand;
        const brandName =
          typeof brand === "object"
            ? String(brand?.name || brand?.title || "")
            : String(brand || "");
        return brandName.trim().toLowerCase() === selectedBrand.toLowerCase();
      });
    }

    if (selectedSubcategory !== "All") {
      result = result.filter(
        (product) =>
          getProductCategoryValue(product.subcategory).name ===
          selectedSubcategory.toLowerCase(),
      );
    }

    result = result.filter((product) => {
      const price = getProductPrice(product);
      return price >= priceRange[0] && price <= priceRange[1];
    });

    if (selectedChip !== "All") {
      const normalized = selectedChip.toLowerCase();

      result = result.filter((product) => {
        const name = getProductName(product).toLowerCase();

        const categoryName = getProductCategoryValue(product.subcategory).name;

        if (normalized === "popular")
          return Number(product.averageRating || product.rating || 0) >= 4;

        if (normalized === "offers") return getDiscount(product) > 0;

        return name.includes(normalized) || categoryName.includes(normalized);
      });
    }

    const copy = [...result];

    if (sortBy === "priceLow")
      copy.sort((a, b) => getProductPrice(a) - getProductPrice(b));

    if (sortBy === "priceHigh")
      copy.sort((a, b) => getProductPrice(b) - getProductPrice(a));

    if (sortBy === "discount")
      copy.sort((a, b) => getDiscount(b) - getDiscount(a));

    return copy;
  }, [
    products,
    selectedCategory,
    selectedChip,
    sortBy,
    searchQuery,
    offersOnly,
    inStockOnly,
    ratingOnly,
    selectedBrand,
    selectedSubcategory,
    priceRange,
  ]);

  const categoryChips = useMemo(() => {
    const baseProducts = selectedCategory
      ? products.filter((product) =>
          productMatchesCategory(product, selectedCategory),
        )
      : products;
    const subcategoryNames = Array.from(
      new Set(
        baseProducts
          .map((product) => getProductCategoryValue(product.subcategory).name)
          .filter(Boolean)
          .map((name) => name.charAt(0).toUpperCase() + name.slice(1)),
      ),
    );
    return [
      "All",
      ...(subcategoryNames.length ? subcategoryNames : ["Popular", "Offers"]),
    ];
  }, [products, selectedCategory]);

  const brandOptions = useMemo(() => {
    const values = products
      .map((product) => {
        const brand = product.brand;
        return typeof brand === "object" ? brand?.name || brand?.title : brand;
      })
      .filter((value) => typeof value === "string" && value.trim());
    return [
      "All",
      ...Array.from(
        new Set(values.map((value) => String(value).trim())),
      ).sort(),
    ];
  }, [products]);

  const subcategoryOptions = useMemo(() => {
    const values = products
      .map((product) => getProductCategoryValue(product.subcategory).name)
      .filter(Boolean);
    return ["All", ...Array.from(new Set(values)).sort()];
  }, [products]);

  const activeHomeFilterCount =
    (filterCategoryId !== "All" ? 1 : 0) +
    (selectedBrand !== "All" ? 1 : 0) +
    (selectedSubcategory !== "All" ? 1 : 0) +
    (priceRange[0] !== 0 || priceRange[1] !== 5000 ? 1 : 0) +
    (sortBy !== "recommended" ? 1 : 0);

  const openProduct = (product: Product) => {
    const id = getProductId(product);

    if (!id) return;

    router.push({ pathname: "/product/[id]", params: { id } } as any);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const price = getProductPrice(item);

    const original = getOriginalPrice(item);

    const discount = getDiscount(item);

    // Never invent ratings or review counts. Render social proof only when the API
    // supplies a valid rating and at least one real review.
    const rawRating = item.averageRating ?? item.rating;
    const rating =
      rawRating === undefined || rawRating === null || rawRating === ""
        ? 0
        : Number(rawRating);
    const rawReviews =
      item.reviewCount ?? item.numReviews ?? (item as any).reviewsCount;
    const reviews =
      rawReviews === undefined || rawReviews === null || rawReviews === ""
        ? 0
        : Number(rawReviews);
    const hasGenuineReviews =
      Number.isFinite(rating) &&
      rating > 0 &&
      rating <= 5 &&
      Number.isFinite(reviews) &&
      reviews > 0;

    return (
      <View style={styles.productCard}>
        <View style={styles.productImageArea}>
          <ProductImageCarousel
            images={getProductImages(item)}
            style={styles.productImageCarousel}
          />
          {discount > 0 ? (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}% OFF</Text>
            </View>
          ) : null}
          <Pressable
            style={styles.wishlistButton}
            accessibilityLabel="Add to wishlist"
            onPress={(event: any) => {
              event?.stopPropagation?.();
              handleWishlist(getProductId(item));
            }}
          >
            <Ionicons
              name={
                wishlistIds.includes(getProductId(item))
                  ? "heart"
                  : "heart-outline"
              }
              size={17}
              color="#E45A70"
            />
          </Pressable>
        </View>

        <Pressable onPress={() => openProduct(item)} accessibilityRole="button">
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.productName}
          >
            {getProductName(item)}
          </Text>

          <View style={styles.priceLine}>
            <Text style={styles.price}>{formatPrice(price)}</Text>

            {original > price ? (
              <Text style={styles.originalPrice}>{formatPrice(original)}</Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.productBottom}>
          <View style={styles.ratingLine}>
            {hasGenuineReviews ? (
              <>
                <Ionicons name="star" size={12} color="#E6A21A" />
                <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
                <Text style={styles.reviewText}>
                  ({reviews.toLocaleString()}{" "}
                  {reviews === 1 ? "review" : "reviews"})
                </Text>
              </>
            ) : (
              <Text style={styles.reviewText}>New · No reviews</Text>
            )}
          </View>

          <Pressable
            style={
              cartQuantities[getProductId(item)]
                ? styles.quantityStepper
                : styles.addButton
            }
            accessibilityLabel={`Add ${getProductName(item)} to cart`}
            onPress={(event: any) => {
              event?.stopPropagation?.();
              handleAddToCart(item);
            }}
          >
            {cartQuantities[getProductId(item)] > 0 ? (
              <LinearGradient
                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.stepperGradient}
              >
                <View style={styles.inlineStepper}>
                  <Pressable
                    style={styles.stepperAction}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      changeCartQuantity(item, "decrease");
                    }}
                  >
                    <Ionicons name="remove" size={15} color="#4F46E5" />
                  </Pressable>
                  <Text style={styles.cartQuantityText}>
                    {cartQuantities[getProductId(item)]}
                  </Text>
                  <Pressable
                    style={styles.stepperAction}
                    onPress={(event: any) => {
                      event?.stopPropagation?.();
                      changeCartQuantity(item, "increase");
                    }}
                  >
                    <Ionicons name="add" size={15} color="#4F46E5" />
                  </Pressable>
                </View>
              </LinearGradient>
            ) : (
              <LinearGradient
                colors={["#2563EB", "#4F46E5", "#7C3AED"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButton}
              >
                <View style={styles.addButtonContent}>
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>ADD</Text>
                </View>
              </LinearGradient>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  if (loading) return <ProductsSkeleton />;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#202124" />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={19} color="#737B91" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`Search in ${title}...`}
          placeholderTextColor="#969DB0"
          style={styles.searchInput}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={`Search products in ${title}`}
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => setSearchQuery("")}
            hitSlop={10}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={19} color="#8B93A4" />
          </Pressable>
        ) : null}
        <View style={styles.searchDivider} />
        <Pressable
          style={styles.searchVoiceButton}
          onPress={() => setVoiceSearchVisible(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open voice search"
        >
          <Ionicons name="mic-outline" size={20} color="#4F46E5" />
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.resultCopy}>
          <Text style={styles.resultHeading}>Explore products</Text>
          <Text style={styles.resultText}>
            {filteredProducts.length}{" "}
            {filteredProducts.length === 1 ? "item" : "items"}
          </Text>
        </View>
        <View style={styles.toolbarActions}>
          <Pressable
            style={({ pressed }) => [
              styles.toolButton,
              pressed && styles.toolButtonPressed,
            ]}
            onPress={() => setFilterVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open product filters"
          >
            <Ionicons name="options-outline" size={16} color="#3730A3" />
            <Text style={styles.toolText}>
              Filters
              {activeHomeFilterCount ? ` · ${activeHomeFilterCount}` : ""}
            </Text>
            <Ionicons name="chevron-down" size={12} color="#6B6B82" />
          </Pressable>
        </View>
      </View>

      {sortVisible ? (
        <View style={styles.sortPanel}>
          {[
            { key: "recommended", label: "Recommended" },

            { key: "priceLow", label: "Price: Low to high" },

            { key: "priceHigh", label: "Price: High to low" },

            { key: "discount", label: "Biggest discount" },
          ].map((option) => (
            <Pressable
              key={option.key}
              style={styles.sortOption}
              onPress={() => {
                setSortBy(option.key as typeof sortBy);

                setSortVisible(false);
              }}
            >
              <Text style={styles.sortOptionText}>{option.label}</Text>

              {sortBy === option.key ? (
                <Ionicons name="checkmark-circle" size={17} color="#2563EB" />
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.filterModalRoot}>
          <Pressable
            style={styles.filterBackdrop}
            onPress={() => setFilterVisible(false)}
          />
          <View style={styles.filterSheet}>
            <View style={styles.filterSheetHandle} />
            <View style={styles.filterSheetHeader}>
              <View>
                <Text allowFontScaling={false} style={styles.filterSheetTitle}>
                  Filters & sort
                </Text>
                <Text
                  allowFontScaling={false}
                  style={styles.filterSheetSubtitle}
                >
                  {filteredProducts.length} matching products
                </Text>
              </View>
              <Pressable
                onPress={() => setFilterVisible(false)}
                style={styles.filterSheetClose}
              >
                <Ionicons name="close" size={21} color="#37334F" />
              </Pressable>
            </View>
            <ScrollView
              style={styles.filterScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.filterScrollContent}
            >
              <View style={styles.filterSectionCard}>
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1.15}
                  style={styles.filterSectionTitle}
                >
                  SUBCATEGORY
                </Text>
                <View style={styles.filterOptionWrap}>
                  {subcategoryOptions.map((option) => (
                    <Pressable
                      key={`sub-${option}`}
                      onPress={() => setSelectedSubcategory(option)}
                      style={[
                        styles.filterOption,
                        selectedSubcategory === option &&
                          styles.filterOptionActive,
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.filterOptionText,
                          selectedSubcategory === option &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {option === "All" ? "All subcategories" : option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filterSectionCard}>
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1.15}
                  style={styles.filterSectionTitle}
                >
                  BRAND
                </Text>
                <View style={styles.filterOptionWrap}>
                  {brandOptions.map((option) => (
                    <Pressable
                      key={`brand-${option}`}
                      onPress={() => setSelectedBrand(option)}
                      style={[
                        styles.filterOption,
                        selectedBrand === option && styles.filterOptionActive,
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.filterOptionText,
                          selectedBrand === option &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {option === "All" ? "All brands" : option}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filterSectionCard}>
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1.15}
                  style={styles.filterSectionTitle}
                >
                  PRICE RANGE
                </Text>
                <View style={styles.filterOptionWrap}>
                  {[
                    {
                      label: "Under ₹500",
                      range: [0, 500] as [number, number],
                    },
                    {
                      label: "₹500–₹1,000",
                      range: [500, 1000] as [number, number],
                    },
                    {
                      label: "₹1,000–₹2,500",
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
                  ].map((option) => (
                    <Pressable
                      key={option.label}
                      onPress={() => setPriceRange(option.range)}
                      style={[
                        styles.filterOption,
                        priceRange[0] === option.range[0] &&
                          priceRange[1] === option.range[1] &&
                          styles.filterOptionActive,
                      ]}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.filterOptionText,
                          priceRange[0] === option.range[0] &&
                            priceRange[1] === option.range[1] &&
                            styles.filterOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filterSectionCard}>
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1.15}
                  style={styles.filterSectionTitle}
                >
                  MORE OPTIONS
                </Text>
                <View style={styles.filterOptionWrap}>
                  {[
                    {
                      key: "offers",
                      label: "On offer",
                      active: offersOnly,
                      toggle: () => setOffersOnly((value) => !value),
                      icon: "pricetag-outline" as const,
                    },
                    {
                      key: "stock",
                      label: "In stock",
                      active: inStockOnly,
                      toggle: () => setInStockOnly((value) => !value),
                      icon: "checkmark-circle-outline" as const,
                    },
                    {
                      key: "rating",
                      label: "4★ & up",
                      active: ratingOnly,
                      toggle: () => setRatingOnly((value) => !value),
                      icon: "star-outline" as const,
                    },
                  ].map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={option.toggle}
                      style={[
                        styles.filterOption,
                        option.active && styles.filterOptionActive,
                        styles.filterOptionWithIcon,
                      ]}
                    >
                      <Ionicons
                        name={option.icon}
                        size={15}
                        color={option.active ? "#FFFFFF" : "#5145C5"}
                      />
                      <Text
                        allowFontScaling={false}
                        style={[
                          styles.filterOptionText,
                          option.active && styles.filterOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.filterSectionCard}>
                <Text
                  allowFontScaling={false}
                  maxFontSizeMultiplier={1.15}
                  style={styles.filterSectionTitle}
                >
                  SORT BY
                </Text>
                {[
                  { key: "recommended", label: "Relevance" },
                  { key: "priceLow", label: "Price: Low to High" },
                  { key: "priceHigh", label: "Price: High to Low" },
                  { key: "discount", label: "Biggest discount" },
                ].map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setSortBy(option.key as typeof sortBy)}
                    style={[
                      styles.filterSortOption,
                      sortBy === option.key && styles.filterOptionActive,
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.filterOptionText,
                        sortBy === option.key && styles.filterOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Ionicons
                      name={
                        sortBy === option.key
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={18}
                      color={sortBy === option.key ? "#FFFFFF" : "#7B7890"}
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <View style={styles.filterFooter}>
              <Pressable
                style={styles.filterResetButton}
                onPress={() => {
                  setFilterCategoryId("All");
                  setSelectedBrand("All");
                  setSelectedSubcategory("All");
                  setPriceRange([0, 5000]);
                  setSortBy("recommended");
                  setOffersOnly(false);
                  setInStockOnly(false);
                  setRatingOnly(false);
                }}
              >
                <Text allowFontScaling={false} style={styles.filterResetText}>
                  Reset all
                </Text>
              </Pressable>
              <Pressable
                style={styles.filterApplyButton}
                onPress={() => setFilterVisible(false)}
              >
                <Text allowFontScaling={false} style={styles.filterApplyText}>
                  Show {filteredProducts.length} products
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={voiceSearchVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          if (voiceListening) ExpoSpeechRecognitionModule.stop();
          setVoiceSearchVisible(false);
        }}
      >
        <Pressable
          style={styles.voiceModalBackdrop}
          onPress={() => {
            if (voiceListening) ExpoSpeechRecognitionModule.stop();
            setVoiceSearchVisible(false);
          }}
        >
          <Pressable style={styles.voiceModalCard} onPress={() => {}}>
            <Pressable
              style={styles.voiceModalClose}
              onPress={() => {
                if (voiceListening) ExpoSpeechRecognitionModule.stop();
                setVoiceSearchVisible(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Close voice search"
            >
              <Ionicons name="close" size={20} color="#55536C" />
            </Pressable>
            <LinearGradient
              colors={
                voiceListening
                  ? ["#EF4444", "#DB2777"]
                  : ["#2563EB", "#4F46E5", "#7C3AED"]
              }
              style={styles.voiceMicHalo}
            >
              <Ionicons
                name={voiceListening ? "radio" : "mic"}
                size={34}
                color="#FFFFFF"
              />
            </LinearGradient>
            <Text style={styles.voiceModalTitle}>
              {voiceListening ? "Listening..." : "Search with your voice"}
            </Text>
            <Text style={styles.voiceModalSubtitle}>
              {voiceListening
                ? "Say the product name clearly. We’ll fill it into search."
                : "Tap the microphone and tell OdiKart what you’re looking for."}
            </Text>
            {voiceListening ? (
              <View style={styles.voiceListeningPills}>
                {[0, 1, 2, 3, 4].map((item) => (
                  <View
                    key={item}
                    style={[
                      styles.voiceListeningPill,
                      { height: 10 + (item % 3) * 7 },
                    ]}
                  />
                ))}
              </View>
            ) : null}
            <Pressable
              style={styles.voicePrimaryButton}
              onPress={() => {
                if (voiceListening) ExpoSpeechRecognitionModule.stop();
                else startVoiceSearch();
              }}
              accessibilityRole="button"
            >
              <Ionicons
                name={voiceListening ? "stop" : "mic"}
                size={18}
                color="#FFFFFF"
              />
              <Text style={styles.voicePrimaryButtonText}>
                {voiceListening ? "Stop listening" : "Start speaking"}
              </Text>
            </Pressable>
            <Pressable
              style={styles.voiceCancelButton}
              onPress={() => {
                if (voiceListening) ExpoSpeechRecognitionModule.stop();
                setVoiceSearchVisible(false);
              }}
            >
              <Text style={styles.voiceCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>

          <Pressable onPress={() => loadData()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filteredProducts}
        keyExtractor={(item, index) => getProductId(item) || `product-${index}`}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={styles.productRow}
        contentContainerStyle={styles.productsContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={40}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIllustrationWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.emptyGlow,
                  {
                    opacity: animeGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.25, 0.6],
                    }),
                    transform: [
                      {
                        scale: animeGlow.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.94, 1.06],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Image
                source={require("../../assets/images/not-found.webp")}
                style={styles.emptyIllustration}
                resizeMode="contain"
                accessibilityLabel="UFO searching for products"
              />
              <View style={styles.emptySparkleA}>
                <Ionicons name="sparkles" size={18} color="#8B5CF6" />
              </View>
              <View style={styles.emptySparkleB}>
                <Ionicons name="star" size={12} color="#F59E0B" />
              </View>
            </View>
            <Text style={styles.emptyEyebrow}>LOST IN THE GALAXY?</Text>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptySubtitle}>
              We couldn't find a match. Try another search or clear your filters
              to explore OdiKart.
            </Text>
            <Pressable
              onPress={resetFilters}
              style={({ pressed }) => [
                styles.emptyResetButton,
                pressed && styles.productPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Clear search and filters"
            >
              <Ionicons name="refresh" size={17} color="#FFFFFF" />
              <Text style={styles.emptyResetText}>Clear search & filters</Text>
            </Pressable>
          </View>
        }
      />

      {Platform.OS !== "android" && toast ? (
        <View
          pointerEvents="none"
          style={[styles.toast, toast.type === "error" && styles.toastError]}
        >
          <Ionicons
            name={
              toast.type === "error"
                ? "alert-circle"
                : toast.type === "success"
                  ? "checkmark-circle"
                  : "information-circle"
            }
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}

      {cartCount > 0 ? (
        <Pressable
          style={styles.floatingCartOuter}
          onPress={() => router.push("/cart" as any)}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${cartCount} items`}
        >
          <LinearGradient
            colors={["#2563EB", "#4F46E5", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.floatingCart}
          >
            <View style={styles.floatingCartImages}>
              {cartPreviewImages.slice(0, 3).map((image, index) => (
                <Image
                  key={`${image}-${index}`}
                  source={{ uri: image }}
                  style={[
                    styles.floatingCartImage,
                    index > 0 && styles.floatingCartOverlap,
                  ]}
                  resizeMode="cover"
                />
              ))}
              {cartPreviewImages.length === 0 ? (
                <Ionicons name="bag-handle" size={20} color="#FFFFFF" />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.floatingCartTitle}>View cart</Text>
              <Text style={styles.floatingCartSubtitle}>
                {cartCount} {cartCount === 1 ? "item" : "items"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F7FC" },
  header: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E9EAF5",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F1F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#17152E",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 13,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E2FF",
    shadowColor: "#4438F5",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    minHeight: 46,
    color: "#211D3D",
    fontSize: 14,
    paddingVertical: 0,
  },
  searchClose: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#F1F0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  chipScroller: { flexGrow: 0, maxHeight: 54 },
  chipRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    maxWidth: 130,
    paddingHorizontal: 15,
    height: 34,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E7E8F1",
  },
  activeChip: {
    backgroundColor: "#4438F5",
    borderColor: "#4438F5",
    shadowColor: "#4438F5",
    shadowOpacity: 0.22,
    shadowRadius: 7,
    elevation: 3,
  },
  chipText: { fontSize: 12, fontWeight: "700", color: "#626A7D" },
  activeChipText: { color: "#FFFFFF" },
  searchDivider: { width: 1, height: 24, backgroundColor: "#E8E7F3" },
  searchVoiceButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F0FF",
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  resultCopy: { flex: 1, minWidth: 0 },
  resultHeading: { color: "#24213D", fontSize: 14, fontWeight: "900" },
  resultText: {
    color: "#85899B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  toolbarActions: { flexDirection: "row", gap: 7, alignItems: "center" },
  toolButton: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E3F0",
  },
  toolButtonActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  toolButtonPressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  toolText: { fontSize: 12, color: "#35334D", fontWeight: "800" },
  toolTextActive: { color: "#FFFFFF" },
  filterCountBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  filterCountText: { color: "#4F46E5", fontSize: 10, fontWeight: "900" },
  voiceModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 16, 43, 0.48)",
    justifyContent: "flex-end",
  },
  voiceModalCard: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  voiceModalClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F2FA",
  },
  voiceMicHalo: {
    width: 88,
    height: 88,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  voiceModalTitle: {
    color: "#211D3D",
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
  voiceModalSubtitle: {
    marginTop: 9,
    color: "#777B91",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 280,
  },
  voiceListeningPills: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 4,
  },
  voiceListeningPill: { width: 5, borderRadius: 4, backgroundColor: "#7C3AED" },
  voicePrimaryButton: {
    width: "100%",
    minHeight: 49,
    borderRadius: 15,
    marginTop: 23,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePrimaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  voiceCancelButton: {
    paddingVertical: 13,
    paddingHorizontal: 22,
    marginTop: 3,
  },
  voiceCancelText: { color: "#73718A", fontSize: 13, fontWeight: "700" },
  cartPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#EEEDFF",
  },
  cartPillText: { color: "#4438F5", fontSize: 12, fontWeight: "900" },
  filterChipsRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    alignItems: "center",
  },
  filterChip: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3E4F0",
  },
  filterChipActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
  },
  filterChipText: { color: "#3F3B5B", fontSize: 11, fontWeight: "800" },
  filterChipTextActive: { color: "#FFFFFF" },
  clearFiltersChip: { paddingHorizontal: 8, paddingVertical: 8 },
  clearFiltersText: { color: "#6D5AE8", fontSize: 11, fontWeight: "800" },
  filterModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(13,18,38,0.52)",
  },
  filterBackdrop: { ...StyleSheet.absoluteFillObject },
  filterSheet: {
    height: "88%",
    maxHeight: "92%",
    width: "100%",
    backgroundColor: "#F7F8FE",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 36,
    borderWidth: 1,
    borderColor: "#ECEBFA",
    overflow: "hidden",
    flexDirection: "column",
  },
  filterSheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D7DAE9",
    marginBottom: 3,
  },
  filterSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E9F5",
  },
  filterScroll: { flex: 1, minHeight: 0 },
  filterScrollContent: { paddingTop: 12, paddingBottom: 18, gap: 12 },
  filterSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9EAF5",
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 14,
  },
  filterSheetTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#171A35",
    letterSpacing: -0.5,
  },
  filterSheetSubtitle: {
    fontSize: 12,
    color: "#737994",
    marginTop: 5,
    fontWeight: "600",
  },
  filterSheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ECEEFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E3FF",
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.05,
    color: "#777D9A",
    marginTop: 13,
    marginBottom: 10,
  },
  filterOptionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  filterOption: {
    minHeight: 34,
    maxWidth: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E5F2",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  filterOptionActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#4F46E5",
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 2,
  },
  filterOptionText: {
    color: "#343955",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    flexShrink: 1,
    includeFontPadding: false,
  },
  filterOptionWithIcon: { flexDirection: "row", alignItems: "center", gap: 7 },
  filterOptionTextActive: { color: "#FFFFFF" },
  filterSortOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E5E7F4",
    backgroundColor: "#FFFFFF",
  },
  filterFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 8 : 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7F4",
    backgroundColor: "#F7F8FE",
  },
  filterResetButton: {
    flex: 0.8,
    minHeight: 49,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ECEEFF",
    borderWidth: 1,
    borderColor: "#DDE1FF",
  },
  filterResetText: { color: "#5145C5", fontSize: 13, fontWeight: "800" },
  filterApplyButton: {
    flex: 1.5,
    minHeight: 49,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    shadowColor: "#4F46E5",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  filterApplyText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  sortPanel: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E8F5",
    elevation: 4,
    shadowColor: "#202044",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  sortOption: {
    minHeight: 43,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sortOptionText: { fontSize: 13, color: "#33344A", fontWeight: "600" },
  productList: { flex: 1 },
  productsContent: {
    paddingHorizontal: 12,
    paddingBottom: 132,
    paddingTop: 4,
    flexGrow: 1,
  },
  productRow: { gap: 9, marginBottom: 9 },
  productCard: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7E8F0",
    // Keep cards light for smoother Android scrolling.
    shadowColor: "#25233A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  productPressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  productImageArea: {
    height: 126,
    width: "100%",
    marginTop: 0,
    marginHorizontal: 0,
    marginBottom: 1,
    borderRadius: 13,
    backgroundColor: "#F8F8FA",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  productImage: { width: "100%", height: "100%" },
  productImageCarousel: { width: "100%", height: "100%" },
  carouselDots: {
    position: "absolute",
    bottom: 7,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.72)",
  },
  carouselDot: {
    width: 4,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#B8B8C8",
  },
  carouselDotActive: { width: 12, backgroundColor: "#5145ED" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  discountBadge: {
    position: "absolute",
    top: 9,
    left: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#5546F5",
  },
  discountText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  imageCountBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "rgba(35,35,52,0.68)",
  },
  imageCountText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  wishlistButton: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEEEF5",
  },
  productName: {
    color: "#171725",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    marginTop: 6,
    height: 16,
  },
  productMeta: {
    color: "#77758F",
    fontSize: 10,
    marginTop: 3,
    fontWeight: "700",
  },
  productDescription: {
    color: "#777D91",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  stockVariantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    marginTop: 5,
  },
  stockLabel: {
    color: "#16804A",
    backgroundColor: "#EAF8EF",
    overflow: "hidden",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
    fontWeight: "800",
  },
  outOfStockLabel: { color: "#B42336", backgroundColor: "#FFF0F1" },
  variantHint: {
    color: "#8A91A4",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
    flexShrink: 1,
  },
  priceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
    flexWrap: "nowrap",
  },
  price: { color: "#171725", fontSize: 15, fontWeight: "900" },
  originalPrice: {
    color: "#9AA1B2",
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  productBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginTop: 5,
    minHeight: 32,
  },
  ratingLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 1,
    borderRadius: 0,
  },
  ratingText: { color: "#303044", fontSize: 10, fontWeight: "800" },
  reviewText: { color: "#8B91A1", fontSize: 8, flexShrink: 1 },
  addButton: {
    width: 78,
    height: 32,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  addButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.1,
  },
  quantityStepper: {
    width: 78,
    height: 32,
    paddingHorizontal: 0,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepperGradient: {
    width: 78,
    height: 32,
    paddingHorizontal: 3,
    borderRadius: 11,
    overflow: "hidden",
    justifyContent: "center",
  },
  stepperAction: {
    width: 23,
    height: 23,
    borderRadius: 7,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  cartQuantityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    minWidth: 12,
    textAlign: "center",
  },
  inlineStepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  toast: {
    position: "absolute",
    bottom: 28,
    left: 18,
    right: 18,
    zIndex: 30,
    backgroundColor: "#242044",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    elevation: 8,
  },
  toastError: { backgroundColor: "#9F263A" },
  toastText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", flex: 1 },
  floatingCartOuter: {
    position: "absolute",
    bottom: 14,
    left: 16,
    right: 16,
    borderRadius: 18,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.3,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  floatingCart: {
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
  },
  floatingCartImages: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 38,
  },
  floatingCartImage: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#DBEAFE",
  },
  floatingCartOverlap: { marginLeft: -12 },
  floatingCartTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  floatingCartSubtitle: {
    color: "#E5E2FF",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    minHeight: 430,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 35,
  },
  emptyIllustrationWrap: {
    width: 250,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyGlow: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: "#C4B5FD",
  },
  emptyIllustration: { width: "100%", height: "100%" },
  emptySparkleA: { position: "absolute", top: 20, right: 22 },
  emptySparkleB: { position: "absolute", top: 58, left: 26 },
  emptyEyebrow: {
    marginTop: 2,
    color: "#7C3AED",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
  },
  emptyResetButton: {
    marginTop: 18,
    paddingHorizontal: 19,
    paddingVertical: 13,
    borderRadius: 15,
    backgroundColor: "#4438F5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#4438F5",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  emptyResetText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  emptyTitle: {
    marginTop: 15,
    color: "#25223E",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptySubtitle: {
    marginTop: 7,
    color: "#85899B",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#FFF0F1",
    borderWidth: 1,
    borderColor: "#FFD9DE",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: { flex: 1, color: "#8A2635", fontSize: 12, lineHeight: 18 },
  retryText: { color: "#4438F5", fontSize: 12, fontWeight: "900", padding: 5 },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(20,18,46,0.42)",
  },
  legacyFilterSheet: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#FFFFFF",
  },
  sheetHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D9D9E8",
    marginBottom: 20,
  },
  filterHeaderGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: -22,
    marginTop: -12,
    marginBottom: 22,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  filterHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  filterHeaderCopy: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: 19, fontWeight: "900", color: "#FFFFFF" },
  filterHeaderSubtitle: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#EDE9FE",
  },
  filterHeaderClose: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#777B91",
    marginBottom: 12,
  },
  legacyFilterOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
  },
  filterCheck: {
    width: 23,
    height: 23,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: "#D8D9E8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  filterCheckActive: { backgroundColor: "#4438F5", borderColor: "#4438F5" },
  legacyFilterOptionText: { color: "#34334B", fontSize: 14, fontWeight: "600" },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 25 },
  resetButton: {
    flex: 0.8,
    height: 50,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E2E2F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  resetButtonText: { color: "#514D70", fontSize: 14, fontWeight: "800" },
  applyButton: {
    flex: 1.5,
    height: 50,
    borderRadius: 15,
    backgroundColor: "#4438F5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4438F5",
    shadowOpacity: 0.2,
    shadowRadius: 7,
    elevation: 3,
  },
  applyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  skeletonIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#E8E8F3",
  },
  simpleSkeletonSearch: {
    minHeight: 44,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ECECF5",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skeletonChips: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  skeletonToolbar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonGrid: { paddingHorizontal: 14, paddingTop: 3, flex: 1 },
  skeletonProductRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  skeletonCard: {
    flex: 1,
    minWidth: 0,
    padding: 9,
    borderWidth: 1,
    borderColor: "#ECECF5",
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    marginBottom: 0,
    elevation: 1,
  },
  skeletonImage: { height: 142, width: "100%", borderRadius: 14 },
  skeletonBox: { backgroundColor: "#E8E8F3", borderRadius: 6 },
  skeletonShine: { backgroundColor: "#FFFFFF", transform: [{ scale: 1.02 }] },
  skeletonTitle: {
    width: 96,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E9E8F5",
  },
});
