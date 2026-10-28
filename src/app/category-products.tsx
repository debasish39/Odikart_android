import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {

  Animated,

  FlatList,

  Keyboard,

  Image,

  Pressable,

  RefreshControl,

  ScrollView,

  StyleSheet,

  Text,

  TextInput,

  Modal,

  Platform,

  ToastAndroid,

  View,

} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";

import { useLocalSearchParams, useRouter } from "expo-router";

import { getCategories } from "../api/categories";
import { getProducts } from "../api/products";
import { getCart, addToCart, increaseCartItem, decreaseCartItem } from "../api/cart";
import { getWishlist, addToWishlist, removeFromWishlist, getWishlistProductIds } from "../api/wishlist";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

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

const getCategoryName = (item: Category) => item.name || item.title || "Category";

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
    if (Array.isArray(candidate?.data) && candidate.data.every((item: any) => item && typeof item === "object")) {
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
    const nested = value.url || value.uri || value.secure_url || value.src || value.path;
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

function ProductImage({ uri, style }: { uri: string; style: any }) {
  const [failedUri, setFailedUri] = useState("");
  useEffect(() => {
    setFailedUri("");
  }, [uri]);

  const validUri = /^https?:\/\//i.test(uri) || /^file:\/\//i.test(uri) || /^data:image\//i.test(uri);
  if (!uri || !validUri || failedUri === uri) {
    return <View style={[style, styles.noImage]}><Ionicons name="image-outline" size={32} color="#A0A8B7" /></View>;
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

function getProductPrice(product: Product) {
  const variant = product.variants?.[0];
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
  const variant = product.variants?.[0];
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

  const direct = Number(product.discountPercentage);

  if (product.discountPercentage !== undefined && Number.isFinite(direct) && direct > 0) {

    return Math.round(direct);

  }

  const price = getProductPrice(product);

  const original = getOriginalPrice(product);

  if (original > price && original > 0) return Math.round(((original - price) / original) * 100);

  return 0;

}

function getProductCategoryValue(value: any) {

  if (value && typeof value === "object") {

    return {

      id: String(value._id || value.id || ""),

      name: String(value.name || value.title || "").trim().toLowerCase(),

    };

  }

  return { id: String(value || ""), name: String(value || "").trim().toLowerCase() };

}

function productMatchesCategory(product: Product, category: Category) {

  const categoryId = getCategoryId(category);

  const categoryName = getCategoryName(category).trim().toLowerCase();

  const candidates = [product.category, product.subcategory].map(getProductCategoryValue);

  return candidates.some((value) =>

    (!!categoryId && value.id === categoryId) ||

    (!!categoryName && value.name === categoryName)

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

      ])

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

      <SkeletonBox style={{ width: "100%", height: 26, marginTop: 8, borderRadius: 9 }} />

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
          <SkeletonBox key={index} style={{ width, height: 28, borderRadius: 14 }} />
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

  const params = useLocalSearchParams<{ categoryId?: string | string[]; categoryName?: string | string[] }>();

  const routeCategoryId = Array.isArray(params.categoryId) ? params.categoryId[0] : params.categoryId;

  const routeCategoryName = Array.isArray(params.categoryName) ? params.categoryName[0] : params.categoryName;

  const [categories, setCategories] = useState<Category[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");

  const [selectedChip, setSelectedChip] = useState("All");

  const [sortVisible, setSortVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [offersOnly, setOffersOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [ratingOnly, setRatingOnly] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [cartPreviewImages, setCartPreviewImages] = useState<string[]>([]);
  const [voiceListening, setVoiceListening] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartBusy = useRef(false);
  const [wishBusyId, setWishBusyId] = useState<string | null>(null);
  const animeGlow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(animeGlow, { toValue: 1, duration: 1400, useNativeDriver: true }),
      Animated.timing(animeGlow, { toValue: 0, duration: 1400, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animeGlow]);
  const cartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0),
    [cartItems]
  );
  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
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
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useSpeechRecognitionEvent("start", () => setVoiceListening(true));
  useSpeechRecognitionEvent("end", () => setVoiceListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results?.[0]?.transcript?.trim();
    if (transcript) {
      setSearchQuery(transcript);
      setSearchVisible(true);
    }
  });
  useSpeechRecognitionEvent("error", (event) => {
    setVoiceListening(false);
    if (event.error !== "aborted") showToast("Voice search failed. Check microphone permission and try again.", "error");
  });
  const startVoiceSearch = useCallback(async () => {
    try {
      Keyboard.dismiss();
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        showToast("Allow microphone and speech recognition permission to use voice search.", "error");
        return;
      }
      ExpoSpeechRecognitionModule.start({ lang: "en-IN", interimResults: false, continuous: false });
    } catch (e) {
      setVoiceListening(false);
      console.log("VOICE SEARCH ERROR:", e);
      showToast("Voice search isn't available on this device.", "error");
    }
  }, [showToast]);

  const syncCart = useCallback(async () => {
    const response: any = await getCart();
    const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : Array.isArray(response?.cartItems) ? response.cartItems : Array.isArray(response?.data?.items) ? response.data.items : [];
    setCartItems(items);
    const quantities: Record<string, number> = {};
    items.forEach((item: any) => {
      const id = String(item.productId || item.product?._id || item.product?._id || "");
      if (id) quantities[id] = Math.max(0, Number(item.quantity) || 0);
    });
    setCartQuantities(quantities);
    setCartPreviewImages(items.map((item: any) => imageValue(item.image) || imageValue(item.variant?.image) || (item.product ? getProductImage(item.product) : "") || imageValue(item.product?.media?.thumbnail) || imageValue(item.selectedVariant?.images?.[0])).filter((value: string) => /^https?:\/\//i.test(value)).slice(0, 3));
  }, []);

  const syncWishlist = useCallback(async () => {
    try { setWishlistIds(getWishlistProductIds(await getWishlist())); }
    catch { setWishlistIds([]); }
  }, []);

  const mutateCart = useCallback(async (action: () => Promise<unknown>, fallback: string, success?: string) => {
    if (cartBusy.current) return;
    cartBusy.current = true;
    try {
      await action();
      await syncCart();
      if (success) showToast(success, "success");
    } catch (e: any) {
      console.log("CATEGORY CART ERROR:", e?.response?.data || e?.message || e);
      const status = e?.response?.status;
      showToast(status === 401 || status === 403 ? "Log in to use your cart." : e?.response?.data?.message || fallback, "error");
    } finally { cartBusy.current = false; }
  }, [showToast, syncCart]);

  const handleAddToCart = useCallback((product: Product) => {
    const id = getProductId(product);
    if (!id) return;
    if (product.stock !== undefined && Number(product.stock) <= 0) {
      showToast("This product is out of stock.", "error");
      return;
    }
    const variant = product.variants?.[0];
    const image = getProductImage(product);
    mutateCart(
      () => addToCart({ productId: id, variantSku: variant?.sku || "", quantity: 1, image }),
      "Couldn't add this product to your cart.",
      `${getProductName(product)} added to cart`
    );
  }, [mutateCart, showToast]);

  const changeCartQuantity = useCallback((product: Product, direction: "increase" | "decrease") => {
    const id = getProductId(product);
    if (!id) return;
    const variantSku = product.variants?.[0]?.sku || "";
    const quantity = cartQuantities[id] || 0;
    if (direction === "increase" && quantity === 0) return handleAddToCart(product);
    if (direction === "increase") {
      mutateCart(() => increaseCartItem({ productId: id, variantSku }), "Couldn't update quantity.");
    } else if (quantity > 0) {
      mutateCart(() => decreaseCartItem({ productId: id, variantSku }), "Couldn't update quantity.");
    }
  }, [cartQuantities, handleAddToCart, mutateCart]);

  const handleWishlist = useCallback(async (productId: string) => {
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
        setWishlistIds((current) => current.includes(id) ? current : [...current, id]);
        showToast("Saved to wishlist", "success");
      }
    } catch (e: any) {
      const status = e?.response?.status;
      showToast(status === 401 || status === 403 ? "Log in to use your wishlist." : "Couldn't update wishlist. Try again.", "error");
    } finally { setWishBusyId(null); }
  }, [wishlistIds, wishBusyId, showToast]);
  const resetFilters = useCallback(() => {
    setSearchQuery(""); setSelectedChip("All"); setOffersOnly(false);
    setInStockOnly(false); setRatingOnly(false); setSortBy("recommended");
  }, []);


  const [sortBy, setSortBy] = useState<"recommended" | "priceLow" | "priceHigh" | "discount">("recommended");

  const loadData = useCallback(async (refresh = false) => {

    try {

      setError("");

      if (refresh) setRefreshing(true);

      else setLoading(true);

      const [categoryResponse, productResponse] = await Promise.all([getCategories(), getProducts()]);
      await Promise.allSettled([syncCart(), syncWishlist()]);

      const categoryList = unwrapList(categoryResponse, "categories")
        .filter((item: any) => item && typeof item === "object");
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

      setError(e?.response?.data?.message || e?.message || "Couldn't load products.");

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [syncCart, syncWishlist]);

  React.useEffect(() => {

    loadData();

  }, [loadData]);

  const selectedCategory = useMemo(() => {

    if (routeCategoryId) {

      const byId = categories.find((category) => getCategoryId(category) === routeCategoryId);

      if (byId) return byId;

    }

    if (routeCategoryName) {

      const target = routeCategoryName.trim().toLowerCase();

      const byName = categories.find((category) => getCategoryName(category).trim().toLowerCase() === target);

      if (byName) return byName;

    }

    return undefined;

  }, [categories, routeCategoryId, routeCategoryName]);

  const title = selectedCategory ? getCategoryName(selectedCategory) : routeCategoryName || "Products";

  const filteredProducts = useMemo(() => {

    let result = selectedCategory

      ? products.filter((product) => productMatchesCategory(product, selectedCategory))

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
      result = result.filter((product) => [
        getProductName(product), product.description || "",
        getProductCategoryValue(product.category).name,
        getProductCategoryValue(product.subcategory).name,
      ].join(" ").toLowerCase().includes(query));
    }
    if (offersOnly) result = result.filter((product) => getDiscount(product) > 0);
    if (inStockOnly) result = result.filter((product) => product.stock === undefined || Number(product.stock) > 0);
    if (ratingOnly) result = result.filter((product) => Number(product.averageRating || product.rating || 0) >= 4);

    if (selectedChip !== "All") {

      const normalized = selectedChip.toLowerCase();

      result = result.filter((product) => {

        const name = getProductName(product).toLowerCase();

        const categoryName = getProductCategoryValue(product.subcategory).name;

        if (normalized === "popular") return Number(product.averageRating || product.rating || 0) >= 4;

        if (normalized === "offers") return getDiscount(product) > 0;

        return name.includes(normalized) || categoryName.includes(normalized);

      });

    }

    const copy = [...result];

    if (sortBy === "priceLow") copy.sort((a, b) => getProductPrice(a) - getProductPrice(b));

    if (sortBy === "priceHigh") copy.sort((a, b) => getProductPrice(b) - getProductPrice(a));

    if (sortBy === "discount") copy.sort((a, b) => getDiscount(b) - getDiscount(a));

    return copy;

  }, [products, selectedCategory, selectedChip, sortBy, searchQuery, offersOnly, inStockOnly, ratingOnly]);

  const categoryChips = useMemo(() => {
    const baseProducts = selectedCategory
      ? products.filter((product) => productMatchesCategory(product, selectedCategory))
      : products;
    const subcategoryNames = Array.from(new Set(
      baseProducts
        .map((product) => getProductCategoryValue(product.subcategory).name)
        .filter(Boolean)
        .map((name) => name.charAt(0).toUpperCase() + name.slice(1))
    ));
    return ["All", ...(subcategoryNames.length ? subcategoryNames : ["Popular", "Offers"])];
  }, [products, selectedCategory]);

  const openProduct = (product: Product) => {

    const id = getProductId(product);

    if (!id) return;

    router.push({ pathname: "/product/[id]", params: { id } } as any);

  };

  const renderProduct = ({ item }: { item: Product }) => {

    const image = getProductImage(item);

    const price = getProductPrice(item);

    const original = getOriginalPrice(item);

    const discount = getDiscount(item);

    const rating = Number(item.averageRating || item.rating || 4.5);

    const reviews = Number(item.reviewCount || item.numReviews || 0);

    return (

      <Pressable style={({ pressed }) => [styles.productCard, pressed && styles.productPressed]} onPress={() => openProduct(item)}>

        <View style={styles.productImageArea}>

          <ProductImage uri={image} style={styles.productImage} />
          <Animated.View pointerEvents="none" style={[styles.animeGlow, { opacity: animeGlow.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.18] }) }]} />
          <View pointerEvents="none" style={styles.sparkleOne}><Ionicons name="sparkles" size={15} color="#A78BFA" /></View>
          <View pointerEvents="none" style={styles.sparkleTwo}><Ionicons name="sparkles" size={10} color="#F0ABFC" /></View>
          {discount > 0 ? (

            <View style={styles.discountBadge}><Text style={styles.discountText}>{discount}% OFF</Text></View>

          ) : null}

          <Pressable

            style={styles.wishlistButton}

            accessibilityLabel="Add to wishlist"

            onPress={(event: any) => {
              event?.stopPropagation?.();
              handleWishlist(getProductId(item));
            }}

          >

            <Ionicons name={wishlistIds.includes(getProductId(item)) ? "heart" : "heart-outline"} size={17} color="#E45A70" />

          </Pressable>

        </View>

        <Text numberOfLines={2} style={styles.productName}>{getProductName(item)}</Text>

        <Text style={styles.variantHint}>Available options</Text>

        <View style={styles.priceLine}>

          <Text style={styles.price}>{formatPrice(price)}</Text>

          {original > price ? <Text style={styles.originalPrice}>{formatPrice(original)}</Text> : null}

        </View>

        <View style={styles.productBottom}>

          <View style={styles.ratingLine}>

            <Ionicons name="star" size={10} color="#E6A21A" />

            <Text style={styles.ratingText}>{Number.isFinite(rating) ? rating.toFixed(1) : "4.5"}</Text>

            {reviews > 0 ? <Text style={styles.reviewText}>({reviews})</Text> : null}

          </View>

          <Pressable

            style={cartQuantities[getProductId(item)] ? styles.quantityStepper : styles.addButton}
            accessibilityLabel={`Add ${getProductName(item)} to cart`}
            onPress={(event: any) => {
              event?.stopPropagation?.();
              handleAddToCart(item);
            }}
          >
            {cartQuantities[getProductId(item)] > 0 ? (
              <View style={styles.inlineStepper}>
                <Pressable style={styles.stepperAction} onPress={(event: any) => { event?.stopPropagation?.(); changeCartQuantity(item, "decrease"); }}>
                  <Ionicons name="remove" size={15} color="#4438F5" />
                </Pressable>
                <Text style={styles.cartQuantityText}>{cartQuantities[getProductId(item)]}</Text>
                <Pressable style={styles.stepperAction} onPress={(event: any) => { event?.stopPropagation?.(); changeCartQuantity(item, "increase"); }}>
                  <Ionicons name="add" size={15} color="#4438F5" />
                </Pressable>
              </View>
            ) : <Ionicons name="add" size={21} color="#FFFFFF" />}
          </Pressable>

        </View>

      </Pressable>

    );

  };

  if (loading) return <ProductsSkeleton />;

  return (

    <SafeAreaView style={styles.safeArea} edges={["top"]}>

      <View style={styles.header}>

        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityLabel="Go back">

          <Ionicons name="chevron-back" size={22} color="#202124" />

        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>

        <Pressable style={styles.iconButton} onPress={() => setSearchVisible((value) => !value)} accessibilityLabel="Search">

          <Ionicons name="search-outline" size={21} color="#202124" />

        </Pressable>

      </View>

      {searchVisible ? (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#7B8498" />
          <TextInput value={searchQuery} onChangeText={setSearchQuery}
            placeholder={`Search in ${title}...`} placeholderTextColor="#9AA2B2"
            style={styles.searchInput} returnKeyType="search" autoFocus />
          <Pressable onPress={voiceListening ? () => ExpoSpeechRecognitionModule.stop() : startVoiceSearch}
            hitSlop={10} accessibilityRole="button" accessibilityLabel={voiceListening ? "Stop voice search" : "Start voice search"}>
            <Ionicons name={voiceListening ? "mic" : "mic-outline"} size={19} color={voiceListening ? "#E54868" : "#5B55A5"} />
          </Pressable>
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={19} color="#8B93A4" />
            </Pressable>
          ) : null}
          <Pressable onPress={() => { setSearchVisible(false); setSearchQuery(""); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close search" style={styles.searchClose}>
            <Ionicons name="close" size={18} color="#5B55A5" />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        horizontal

        style={styles.chipScroller}

        showsHorizontalScrollIndicator={false}

        contentContainerStyle={styles.chipRow}

      >

        {categoryChips.map((chip) => {

          const active = selectedChip === chip;

          return (

            <Pressable key={chip} onPress={() => setSelectedChip(chip)} style={[styles.chip, active && styles.activeChip]}>

              <Text style={[styles.chipText, active && styles.activeChipText]} numberOfLines={1}>{chip}</Text>

            </Pressable>

          );

        })}

      </ScrollView>

      <View style={styles.toolbar}>

        <Text style={styles.resultText}>{filteredProducts.length} products</Text>

        <View style={styles.toolbarActions}>
            {cartCount > 0 ? (
              <View style={styles.cartPill}>
                <Ionicons name="bag-handle-outline" size={14} color="#4438F5" />
                <Text style={styles.cartPillText}>{cartCount}</Text>
              </View>
            ) : null}

          <Pressable style={styles.toolButton} onPress={() => setSortVisible((value) => !value)}>

            <Ionicons name="swap-vertical-outline" size={14} color="#333844" />

            <Text style={styles.toolText}>Sort</Text>

            <Ionicons name="chevron-down" size={11} color="#333844" />

          </Pressable>

          <Pressable style={styles.toolButton} onPress={() => setFilterVisible(true)}>

            <Ionicons name="options-outline" size={14} color="#333844" />

            <Text style={styles.toolText}>Filter</Text>

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

              {sortBy === option.key ? <Ionicons name="checkmark-circle" size={17} color="#2563EB" /> : null}

            </Pressable>

          ))}

        </View>

      ) : null}

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)}>
          <Pressable style={styles.filterSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Filter products</Text>
              <Pressable onPress={() => setFilterVisible(false)}><Ionicons name="close" size={22} color="#242A3A" /></Pressable>
            </View>
            <Text style={styles.filterLabel}>Show me</Text>
            <Pressable style={styles.filterOption} onPress={() => setOffersOnly(v => !v)}>
              <View style={[styles.filterCheck, offersOnly && styles.filterCheckActive]}>{offersOnly ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}</View>
              <Text style={styles.filterOptionText}>Discounted products only</Text>
            </Pressable>
            <Pressable style={styles.filterOption} onPress={() => setInStockOnly(v => !v)}>
              <View style={[styles.filterCheck, inStockOnly && styles.filterCheckActive]}>{inStockOnly ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}</View>
              <Text style={styles.filterOptionText}>In-stock products</Text>
            </Pressable>
            <Pressable style={styles.filterOption} onPress={() => setRatingOnly(v => !v)}>
              <View style={[styles.filterCheck, ratingOnly && styles.filterCheckActive]}>{ratingOnly ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}</View>
              <Text style={styles.filterOptionText}>Rated 4 stars and above</Text>
            </Pressable>
            <View style={styles.sheetActions}>
              <Pressable style={styles.resetButton} onPress={() => { setOffersOnly(false); setInStockOnly(false); setRatingOnly(false); }}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </Pressable>
              <Pressable style={styles.applyButton} onPress={() => setFilterVisible(false)}>
                <Text style={styles.applyButtonText}>Show {filteredProducts.length} products</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {error ? (
        <View style={styles.errorBox}>

          <Text style={styles.errorText}>{error}</Text>

          <Pressable onPress={() => loadData()}><Text style={styles.retryText}>Retry</Text></Pressable>

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

        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="#2563EB" />}

        ListEmptyComponent={

          <View style={styles.emptyState}>
            <View style={styles.emptyIllustrationWrap}>
              <Animated.View pointerEvents="none" style={[styles.emptyGlow, {
                opacity: animeGlow.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] }),
                transform: [{ scale: animeGlow.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) }],
              }]} />
              <Image source={require("../../assets/images/not-found.webp")} style={styles.emptyIllustration} resizeMode="contain" accessibilityLabel="UFO searching for products" />
              <View style={styles.emptySparkleA}><Ionicons name="sparkles" size={18} color="#8B5CF6" /></View>
              <View style={styles.emptySparkleB}><Ionicons name="star" size={12} color="#F59E0B" /></View>
            </View>
            <Text style={styles.emptyEyebrow}>LOST IN THE GALAXY?</Text>
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptySubtitle}>We couldn't find a match. Try another search or clear your filters to explore OdiKart.</Text>
            <Pressable onPress={resetFilters} style={({ pressed }) => [styles.emptyResetButton, pressed && styles.productPressed]} accessibilityRole="button" accessibilityLabel="Clear search and filters">
              <Ionicons name="refresh" size={17} color="#FFFFFF" />
              <Text style={styles.emptyResetText}>Clear search & filters</Text>
            </Pressable>
          </View>

        }

      />

      {Platform.OS !== "android" && toast ? (
        <View pointerEvents="none" style={[styles.toast, toast.type === "error" && styles.toastError]}>
          <Ionicons name={toast.type === "error" ? "alert-circle" : toast.type === "success" ? "checkmark-circle" : "information-circle"} size={18} color="#FFFFFF" />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      ) : null}

      {cartCount > 0 ? (
        <Pressable style={styles.floatingCart} onPress={() => router.push("/cart" as any)} accessibilityRole="button" accessibilityLabel={`View cart, ${cartCount} items`}>
          <View style={styles.floatingCartImages}>
            {cartPreviewImages.slice(0, 3).map((image, index) => (
              <Image key={`${image}-${index}`} source={{ uri: image }} style={[styles.floatingCartImage, index > 0 && styles.floatingCartOverlap]} resizeMode="cover" />
            ))}
            {cartPreviewImages.length === 0 ? <Ionicons name="bag-handle" size={20} color="#FFFFFF" /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.floatingCartTitle}>View cart</Text>
            <Text style={styles.floatingCartSubtitle}>{cartCount} {cartCount === 1 ? "item" : "items"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F6F7FC" },
  header: {
    minHeight: 58, paddingHorizontal: 16, flexDirection: "row",
    alignItems: "center", gap: 12, backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E9EAF5",
  },
  iconButton: {
    width: 42, height: 42, borderRadius: 15, backgroundColor: "#F1F0FF",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", color: "#17152E", fontSize: 17, fontWeight: "800", letterSpacing: 0.1 },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48,
    marginHorizontal: 16, marginTop: 12, marginBottom: 5, paddingHorizontal: 14,
    borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E5E2FF",
    shadowColor: "#4438F5", shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  searchInput: { flex: 1, minHeight: 46, color: "#211D3D", fontSize: 14, paddingVertical: 0 },
  searchClose: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#F1F0FF", alignItems: "center", justifyContent: "center" },
  chipScroller: { flexGrow: 0, maxHeight: 54 },
  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: {
    maxWidth: 130, paddingHorizontal: 15, height: 34, borderRadius: 18,
    backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#E7E8F1",
  },
  activeChip: { backgroundColor: "#4438F5", borderColor: "#4438F5", shadowColor: "#4438F5", shadowOpacity: 0.22, shadowRadius: 7, elevation: 3 },
  chipText: { fontSize: 12, fontWeight: "700", color: "#626A7D" },
  activeChipText: { color: "#FFFFFF" },
  toolbar: {
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  resultText: { color: "#777D91", fontSize: 12, fontWeight: "700" },
  toolbarActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  toolButton: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E7E8F2",
  },
  toolText: { fontSize: 12, color: "#35334D", fontWeight: "800" },
  cartPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: "#EEEDFF" },
  cartPillText: { color: "#4438F5", fontSize: 12, fontWeight: "900" },
  sortPanel: {
    marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 15, paddingVertical: 7,
    borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9E8F5",
    elevation: 4, shadowColor: "#202044", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  sortOption: { minHeight: 43, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sortOptionText: { fontSize: 13, color: "#33344A", fontWeight: "600" },
  productList: { flex: 1 },
  productsContent: { paddingHorizontal: 14, paddingBottom: 32, paddingTop: 3, flexGrow: 1 },
  productRow: { gap: 12, marginBottom: 12 },
  productCard: {
    flex: 1, minWidth: 0, padding: 9, borderRadius: 19, backgroundColor: "#FFFFFF",
    borderWidth: 1, borderColor: "#E9E4FF", shadowColor: "#6554D9",
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.09, shadowRadius: 13, elevation: 3,
  },
  productPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  productImageArea: {
    height: 142, borderRadius: 14, backgroundColor: "#F4F1FF",
    alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative",
  },
  animeGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: "#A78BFA", borderRadius: 14 },
  sparkleOne: { position: "absolute", right: 42, top: 14, opacity: 0.9 },
  sparkleTwo: { position: "absolute", left: 13, bottom: 17, opacity: 0.9 },
  productImage: { width: "94%", height: "94%" },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  discountBadge: { position: "absolute", top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 7, backgroundColor: "#168653" },
  discountText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  wishlistButton: {
    position: "absolute", top: 7, right: 7, width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.96)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "#EEEEF5",
  },
  productName: { color: "#22213A", fontSize: 13, lineHeight: 18, fontWeight: "800", marginTop: 12, minHeight: 36 },
  variantHint: { color: "#9296A8", fontSize: 10, marginTop: 3 },
  priceLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" },
  price: { color: "#19172E", fontSize: 16, fontWeight: "900" },
  originalPrice: { color: "#999CAF", fontSize: 11, textDecorationLine: "line-through" },
  productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  ratingLine: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, backgroundColor: "#FFF8E8", paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7 },
  ratingText: { color: "#494153", fontSize: 10, fontWeight: "800" },
  reviewText: { color: "#8B91A1", fontSize: 9 },
  addButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#4438F5", alignItems: "center", justifyContent: "center", shadowColor: "#4438F5", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  quantityStepper: { height: 36, minWidth: 94, paddingHorizontal: 4, borderRadius: 12, backgroundColor: "#F0EEFF", borderWidth: 1, borderColor: "#DCD7FF", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepperAction: { width: 27, height: 27, borderRadius: 9, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  cartQuantityText: { color: "#4438F5", fontSize: 13, fontWeight: "900", minWidth: 14, textAlign: "center" },
  inlineStepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  toast: { position: "absolute", bottom: 28, left: 18, right: 18, zIndex: 30, backgroundColor: "#242044", borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 9, elevation: 8 },
  toastError: { backgroundColor: "#9F263A" },
  toastText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700", flex: 1 },
  floatingCart: { position: "absolute", bottom: 16, left: 22, right: 22, minHeight: 62, borderRadius: 19, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: "#4438F5", flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#4438F5", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  floatingCartImages: { flexDirection: "row", alignItems: "center", minWidth: 34 },
  floatingCartImage: { width: 34, height: 34, borderRadius: 11, borderWidth: 2, borderColor: "#FFFFFF", backgroundColor: "#8B83FF" },
  floatingCartOverlap: { marginLeft: -12 },
  floatingCartTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },
  floatingCartSubtitle: { color: "#E5E2FF", fontSize: 10, marginTop: 2, fontWeight: "700" },
  emptyState: { flex: 1, minHeight: 430, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, paddingBottom: 35 },
  emptyIllustrationWrap: { width: 250, height: 220, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emptyGlow: { position: "absolute", width: 168, height: 168, borderRadius: 84, backgroundColor: "#C4B5FD" },
  emptyIllustration: { width: "100%", height: "100%" },
  emptySparkleA: { position: "absolute", top: 20, right: 22 },
  emptySparkleB: { position: "absolute", top: 58, left: 26 },
  emptyEyebrow: { marginTop: 2, color: "#7C3AED", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  emptyResetButton: { marginTop: 18, paddingHorizontal: 19, paddingVertical: 13, borderRadius: 15, backgroundColor: "#4438F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: "#4438F5", shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  emptyResetText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  emptyTitle: { marginTop: 15, color: "#25223E", fontSize: 18, fontWeight: "900", textAlign: "center" },
  emptySubtitle: { marginTop: 7, color: "#85899B", fontSize: 13, lineHeight: 20, textAlign: "center" },
  errorBox: { marginHorizontal: 16, marginBottom: 10, padding: 13, borderRadius: 14, backgroundColor: "#FFF0F1", borderWidth: 1, borderColor: "#FFD9DE", flexDirection: "row", gap: 10, justifyContent: "space-between", alignItems: "center" },
  errorText: { flex: 1, color: "#8A2635", fontSize: 12, lineHeight: 18 },
  retryText: { color: "#4438F5", fontSize: 12, fontWeight: "900", padding: 5 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(20,18,46,0.42)" },
  filterSheet: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#FFFFFF" },
  sheetHandle: { alignSelf: "center", width: 42, height: 5, borderRadius: 3, backgroundColor: "#D9D9E8", marginBottom: 20 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  sheetTitle: { fontSize: 20, fontWeight: "900", color: "#211E3C" },
  filterLabel: { fontSize: 13, fontWeight: "800", color: "#777B91", marginBottom: 12 },
  filterOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  filterCheck: { width: 23, height: 23, borderRadius: 7, borderWidth: 1.5, borderColor: "#D8D9E8", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  filterCheckActive: { backgroundColor: "#4438F5", borderColor: "#4438F5" },
  filterOptionText: { color: "#34334B", fontSize: 14, fontWeight: "600" },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 25 },
  resetButton: { flex: 0.8, height: 50, borderRadius: 15, borderWidth: 1, borderColor: "#E2E2F0", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  resetButtonText: { color: "#514D70", fontSize: 14, fontWeight: "800" },
  applyButton: { flex: 1.5, height: 50, borderRadius: 15, backgroundColor: "#4438F5", alignItems: "center", justifyContent: "center", shadowColor: "#4438F5", shadowOpacity: 0.2, shadowRadius: 7, elevation: 3 },
  applyButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  skeletonIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#E8E8F3" },
  simpleSkeletonSearch: { minHeight: 44, marginHorizontal: 16, marginTop: 10, marginBottom: 2, paddingHorizontal: 13, borderRadius: 12, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECECF5", flexDirection: "row", alignItems: "center", gap: 10 },
  skeletonChips: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  skeletonToolbar: { paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", justifyContent: "space-between" },
  skeletonGrid: { paddingHorizontal: 14, paddingTop: 3, flex: 1 },
  skeletonProductRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  skeletonCard: { flex: 1, minWidth: 0, padding: 9, borderWidth: 1, borderColor: "#ECECF5", borderRadius: 19, backgroundColor: "#FFFFFF", marginBottom: 0, elevation: 1 },
  skeletonImage: { height: 142, width: "100%", borderRadius: 14 },
  skeletonBox: { backgroundColor: "#E8E8F3", borderRadius: 6 },
  skeletonShine: { backgroundColor: "#FFFFFF", transform: [{ scale: 1.02 }] },
  skeletonTitle: { width: 96, height: 12, borderRadius: 6, backgroundColor: "#E9E8F5" },
});