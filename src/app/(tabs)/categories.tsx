import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import notFoundImage from "../../../assets/images/search.webp";
import { getToken } from "../../api/authStorage";
import {
  addToCart,
  decreaseCartItem,
  getCart,
  increaseCartItem,
} from "../../api/cart";
import { getCategories } from "../../api/categories";
import { getProducts } from "../../api/products";
import {
  addToWishlist,
  getWishlist,
  getWishlistProductIds,
  removeFromWishlist,
} from "../../api/wishlist";

type Category = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  image?: any;
  imageUrl?: any;
  thumbnail?: any;
  icon?: string;
  productCount?: number;
  count?: number;
  [key: string]: any;
};

type Product = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  price?: number | string;
  salePrice?: number | string;
  sellingPrice?: number | string;
  discountedPrice?: number | string;
  originalPrice?: number | string;
  mrp?: number | string;
  discount?: number | string;
  discountPercentage?: number | string;
  image?: any;
  images?: any;
  productImage?: any;
  category?: any;
  subcategory?: any;
  [key: string]: any;
};

type CacheData = {
  savedAt: number;
  categories: Category[];
  products: Product[];
};

const CACHE_KEY = "@odikart/category-products-layout-v2";

const COLORS = {
  ink: "#182238",
  muted: "#7D8798",
  primary: "#263D9B",
  blue: "#2563EB",
  purple: "#7138D5",
  pale: "#F5F6FC",
  line: "#E9ECF4",
  white: "#FFFFFF",
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  grocery: "basket-outline",
  groceries: "basket-outline",
  "food & snacks": "fast-food-outline",
  snacks: "fast-food-outline",
  fashion: "shirt-outline",
  clothes: "shirt-outline",
  electronics: "phone-portrait-outline",
  "home & living": "home-outline",
  "home needs": "home-outline",
  "home & kitchen": "home-outline",
  "beauty & care": "color-palette-outline",
  "beauty & personal care": "color-palette-outline",
  "health & fitness": "fitness-outline",
  "health and beauty": "heart-outline",
  handicrafts: "color-palette-outline",
  "handloom & sarees": "shirt-outline",
  "books & stationery": "book-outline",
  "toys & games": "game-controller-outline",
  "baby & kids": "happy-outline",
  "festive & puja": "sparkles-outline",
};

const getId = (item: any) =>
  String(item?._id || item?.id || item?.categoryId || "");
const getName = (item: any) => String(item?.name || item?.title || "Category");

function unwrapList(response: any, key: string): any[] {
  let value = response;
  for (let i = 0; i < 6 && value; i += 1) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.[key])) return value[key];
    if (Array.isArray(value?.results)) return value.results;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.docs)) return value.docs;
    if (Array.isArray(value?.[`${key}List`])) return value[`${key}List`];
    value = value?.data ?? value?.payload ?? value?.result;
  }
  return [];
}

function findImage(value: any, depth = 0): string {
  if (!value || depth > 6) return "";

  if (typeof value === "string") {
    const url = value.trim();
    // Only render actual remote/local image URLs. Relative paths need the API base URL.
    return /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(url) ? url : "";
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findImage(entry, depth + 1);
      if (found) return found;
    }
    return "";
  }

  if (typeof value === "object") {
    // Common product image properties first, then inspect nested Cloudinary/API objects.
    const preferredKeys = [
      "secure_url",
      "secureUrl",
      "url",
      "uri",
      "imageUrl",
      "image_url",
      "src",
      "path",
      "Location",
      "location",
      "original",
      "large",
      "medium",
      "thumbnail",
      "image",
      "publicUrl",
      "downloadURL",
    ];
    for (const key of preferredKeys) {
      if (value[key] != null) {
        const found = findImage(value[key], depth + 1);
        if (found) return found;
      }
    }
    // Some APIs use an unanticipated property name for their image object.
    for (const [key, nested] of Object.entries(value)) {
      if (/image|photo|picture|gallery|media|asset/i.test(key)) {
        const found = findImage(nested, depth + 1);
        if (found) return found;
      }
    }
  }
  return "";
}

function getProductImage(product: Product): string {
  return findImage({
    image: product.image,
    images: product.images,
    productImage: product.productImage,
    productImages: product.productImages,
    thumbnail: product.thumbnail,
    imageUrl: product.imageUrl,
    image_url: product.image_url,
    photos: product.photos,
    gallery: product.gallery,
    mainImage: product.mainImage,
    featuredImage: product.featuredImage,
    coverImage: product.coverImage,
    media: product.media,
    variants: product.variants,
  });
}

function getCategoryImage(category: Category): string {
  return findImage(
    category.image ??
      category.imageUrl ??
      category.thumbnail ??
      category.categoryImage ??
      category.category_image ??
      category.icon,
  );
}

function getProductName(product: Product) {
  return String(product.name || product.title || "Product");
}

function asNumber(value: any): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object")
    return asNumber(
      value.amount ??
        value.value ??
        value.price ??
        value.sellingPrice ??
        value.salePrice,
    );
  return 0;
}
function firstPrice(values: any[]): number {
  for (const value of values) {
    const n = asNumber(value);
    if (n > 0) return n;
  }
  return 0;
}
function getSellingPrice(product: Product): number {
  const p = product.pricing || product.priceDetails || product.prices || {};
  const v = Array.isArray(product.variants) ? product.variants[0] || {} : {};
  const vp = v.pricing || v.priceDetails || {};
  return firstPrice([
    product.salePrice,
    product.sellingPrice,
    product.discountedPrice,
    product.finalPrice,
    product.offerPrice,
    product.discounted_price,
    p.salePrice,
    p.sellingPrice,
    p.discountedPrice,
    p.finalPrice,
    p.offerPrice,
    p.price,
    product.price,
    v.salePrice,
    v.sellingPrice,
    v.discountedPrice,
    v.finalPrice,
    v.offerPrice,
    vp.salePrice,
    vp.sellingPrice,
    vp.discountedPrice,
    vp.finalPrice,
    v.price,
    v.mrp,
    product.minimumPrice,
    product.minPrice,
  ]);
}
function getMrp(product: Product): number {
  const p = product.pricing || product.priceDetails || product.prices || {};
  const v = Array.isArray(product.variants) ? product.variants[0] || {} : {};
  const vp = v.pricing || v.priceDetails || {};
  return firstPrice([
    product.mrp,
    product.originalPrice,
    product.regularPrice,
    product.mrpPrice,
    p.mrp,
    p.originalPrice,
    p.regularPrice,
    p.price,
    v.mrp,
    v.originalPrice,
    v.regularPrice,
    vp.mrp,
    vp.originalPrice,
    vp.regularPrice,
    product.price,
    v.price,
  ]);
}

function getDiscount(product: Product): number {
  const explicit = asNumber(product.discountPercentage ?? product.discount);
  if (explicit > 0 && explicit <= 100) return Math.round(explicit);
  const price = getSellingPrice(product);
  const mrp = getMrp(product);
  if (mrp > price && mrp > 0) return Math.round(((mrp - price) / mrp) * 100);
  return 0;
}

function collectCategoryTokens(value: any, tokens: Set<string>, depth = 0) {
  if (value == null || depth > 4) return;
  if (typeof value === "string" || typeof value === "number") {
    const token = String(value).trim().toLowerCase();
    if (token) tokens.add(token);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectCategoryTokens(entry, tokens, depth + 1));
    return;
  }
  if (typeof value === "object") {
    [
      "_id",
      "id",
      "categoryId",
      "subcategoryId",
      "name",
      "title",
      "categoryName",
      "subcategoryName",
      "slug",
      "categorySlug",
    ].forEach((field) => {
      if (value[field] != null)
        collectCategoryTokens(value[field], tokens, depth + 1);
    });
  }
}

function belongsToCategory(product: Product, category: Category): boolean {
  const categoryId = getId(category).trim().toLowerCase();
  const categoryName = getName(category).trim().toLowerCase();
  const tokens = new Set<string>();
  [
    product.category,
    product.subcategory,
    product.categoryId,
    product.category_id,
    product.categoryName,
    product.category_name,
    product.subcategory,
    product.subcategoryId,
    product.subcategory_id,
    product.subcategoryName,
    product.subcategory_name,
    product.categories,
    product.subCategories,
    product.subcategories,
  ].forEach((value) => collectCategoryTokens(value, tokens));
  return (
    (!!categoryId && tokens.has(categoryId)) ||
    (!!categoryName && tokens.has(categoryName))
  );
}

function ProductImage({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={styles.imageFallback}>
        <View style={styles.fallbackGlow}>
          <Ionicons name="image-outline" size={38} color="#7774C9" />
        </View>
        <Text style={styles.fallbackTitle}>Image unavailable</Text>
        <Text style={styles.fallbackSubtitle}>Product preview coming soon</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.productImage}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

function CategoryThumb({ category }: { category: Category }) {
  const [failed, setFailed] = useState(false);
  const uri = getCategoryImage(category);
  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={styles.categoryThumbImage}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    );
  }
  const name = getName(category).toLowerCase();
  return (
    <View style={styles.categoryFallback}>
      <Ionicons
        name={CATEGORY_ICONS[name] || "grid-outline"}
        size={25}
        color="#5546C7"
      />
      <ShineOverlay />
    </View>
  );
}

function showToast(message: string) {
  const clean = String(message || "Something went wrong")
    .replace(/\s+/g, " ")
    .trim();
  ToastAndroid.show(clean.slice(0, 220), ToastAndroid.SHORT);
}

function ShineOverlay() {
  const progress = useRef(new Animated.Value(-1)).current;
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(850),
        Animated.timing(progress, {
          toValue: 1,
          duration: 1450,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return (
    <View pointerEvents="none" style={styles.shineClip}>
      <Animated.View
        style={[
          styles.shineBand,
          {
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-170, 250],
                }),
              },
              { skewX: "-22deg" },
            ],
          },
        ]}
      />
    </View>
  );
}

function SkeletonCategoryItem({ active = false }: { active?: boolean }) {
  return (
    <View style={[styles.sidebarItem, active && styles.sidebarItemActive]}>
      <View style={styles.skeletonCategoryThumb}>
        <View style={styles.skeletonCategoryIcon} />
      </View>
      <View style={styles.skeletonCategoryLabel} />
      <View style={[styles.skeletonCategoryLabelShort]} />
    </View>
  );
}

function ProductCard({
  product,
  onPress,
  onWish,
  wished,
  onAdd,
  onIncrease,
  onDecrease,
  quantity,
  wishBusy,
}: {
  product: Product;
  onPress: () => void;
  onWish: () => void;
  wished: boolean;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  quantity: number;
  wishBusy: boolean;
}) {
  const price = getSellingPrice(product);
  const mrp = getMrp(product);
  const discount = getDiscount(product);
  const image = getProductImage(product);
  const rating = asNumber(
    product.averageRating ??
      product.average_rating ??
      product.rating ??
      product.ratings?.average,
  );
  const reviews = asNumber(
    product.reviewCount ??
      product.review_count ??
      product.numReviews ??
      product.reviewsCount ??
      product.ratings?.count,
  );
  const unit =
    product.unit ||
    product.measurementUnit ||
    product.weight ||
    product.size ||
    product.packSize;
  const stock = product.stock ?? product.quantity;
  const inStock = stock === undefined || stock === null || Number(stock) > 0;

  return (
    <View style={styles.productCard}>
      <View style={styles.productImageWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
          <ProductImage uri={image} />
        </Pressable>
        {discount > 0 ? (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}% OFF</Text>
          </View>
        ) : null}

        {/* Wishlist stays visible at top-left; cart controls sit bottom-right. */}
        <Pressable
          style={styles.wishlistButton}
          onPress={onWish}
          disabled={wishBusy}
          accessibilityLabel={
            wished ? "Remove from wishlist" : "Add to wishlist"
          }
          hitSlop={8}
        >
          <Ionicons
            name={wished ? "heart" : "heart-outline"}
            size={18}
            color={wished ? "#E54870" : "#475569"}
          />
        </Pressable>
      </View>

      <View style={styles.productInfo}>
        <Pressable onPress={onPress}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={styles.productName}
          >
            {getProductName(product)}
          </Text>
          {unit ? (
            <Text numberOfLines={1} style={styles.productMeta}>
              {String(unit)}
            </Text>
          ) : null}
          {rating > 0 ? (
            <View style={styles.ratingLine}>
              <Ionicons name="star" size={11} color="#F5A623" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              {reviews > 0 ? (
                <Text style={styles.productMeta}>({reviews})</Text>
              ) : null}
            </View>
          ) : null}
        </Pressable>
        <View style={styles.priceRow}>
          <View style={styles.priceDetails}>
            <Text style={styles.price}>
              {price > 0
                ? `₹${price.toLocaleString("en-IN")}`
                : "Price unavailable"}
            </Text>
            {mrp > price && mrp > 0 ? (
              <Text style={styles.oldPrice}>
                ₹{mrp.toLocaleString("en-IN")}
              </Text>
            ) : null}
          </View>
          {quantity > 0 ? (
            <View style={styles.priceQuantityStepper}>
              <Pressable
                style={styles.priceStepperAction}
                onPress={onDecrease}
                hitSlop={5}
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={15} color="#FFFFFF" />
              </Pressable>
              <Text style={styles.priceQuantityText}>{quantity}</Text>
              <Pressable
                style={styles.priceStepperAction}
                onPress={onIncrease}
                hitSlop={5}
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={15} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.priceAddButton, !inStock && styles.disabledButton]}
              onPress={onAdd}
              disabled={!inStock}
              accessibilityLabel="Add to cart"
              hitSlop={6}
            >
              <Ionicons name="add" size={19} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function SkeletonProductCard() {
  return (
    <View style={styles.productCard}>
      <View style={styles.skeletonImage}>
        <ShineOverlay />
        <View style={styles.skeletonOffer} />
        <View style={styles.skeletonHeart} />
      </View>
      <View style={styles.productInfo}>
        <View style={[styles.skeletonLine, styles.skeletonProductName]} />
        <View style={[styles.skeletonLine, styles.skeletonProductMeta]} />
        <View style={styles.skeletonRatingRow}>
          <View style={styles.skeletonRatingStar} />
          <View style={styles.skeletonRatingText} />
          <View style={styles.skeletonReviewText} />
        </View>
        <View style={styles.priceRow}>
          <View style={styles.skeletonPriceDetails}>
            <View style={[styles.skeletonLine, styles.skeletonPrice]} />
            <View style={[styles.skeletonLine, styles.skeletonOldPrice]} />
          </View>
          <View style={styles.skeletonAdd} />
        </View>
      </View>
    </View>
  );
}

function ProductGridSkeleton() {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <View key={`skeleton-${index}`} style={styles.skeletonGridItem}>
          <SkeletonProductCard />
        </View>
      ))}
    </View>
  );
}

function CategoryHeadingSkeleton() {
  return (
    <View style={styles.categoryHeading}>
      <View style={styles.headingTextWrap}>
        <View style={[styles.skeletonLine, styles.skeletonEyebrow]} />
        <View style={[styles.skeletonLine, styles.skeletonHeading]} />
      </View>
      <View style={styles.skeletonCountPill} />
    </View>
  );
}

export default function CategoriesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
  }>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] =
    useState("All Products");
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>(
    {},
  );
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishBusyId, setWishBusyId] = useState<string | null>(null);
  const cartBusy = useRef(false);
  const requestRef = useRef(false);
  const initializedRef = useRef(false);

  const syncCart = useCallback(async () => {
    const response: any = await getCart();
    const items = Array.isArray(response)
      ? response
      : response?.items || response?.cartItems || response?.data?.items || [];
    const quantities: Record<string, number> = {};
    let count = 0;
    items.forEach((item: any) => {
      const id = String(
        item.productId || item.product?._id || item.product?.id || "",
      );
      const quantity = Math.max(0, Number(item.quantity) || 0);
      if (id) quantities[id] = quantity;
      count += quantity;
    });
    setCartQuantities(quantities);
    setCartCount(count);
  }, []);

  const syncWishlist = useCallback(async () => {
    try {
      setWishlistIds(getWishlistProductIds(await getWishlist()));
    } catch (e) {
      console.log("WISHLIST SYNC ERROR:", e);
    }
  }, []);

  const runCartAction = useCallback(
    async (action: () => Promise<any>) => {
      if (cartBusy.current) return;
      cartBusy.current = true;
      try {
        await action();
        await syncCart();
      } catch (e: any) {
        console.log("CART ACTION ERROR:", e?.response?.data || e?.message || e);
        const message =
          e?.response?.data?.message ||
          e?.message ||
          "Couldn't update cart. Please sign in and try again.";
        showToast(message);
      } finally {
        cartBusy.current = false;
      }
    },
    [syncCart],
  );
  const hasAuthToken = useCallback(async () => {
    try {
      const token = await getToken();

      if (typeof token === "string" && token.trim().length > 0) {
        console.log("ODIKART AUTH: Valid stored token found");
        console.log("ODIKART AUTH: Token length =", token.length);
        return true;
      }

      console.log("ODIKART AUTH: No stored token found");
      return false;
    } catch (error) {
      console.log("ODIKART AUTH: Token read failed", error);
      return false;
    }
  }, []);

  const requireLogin = useCallback(async () => {
    const authenticated = await hasAuthToken();
    if (!authenticated) {
      showToast("Please log in to continue");
      router.push("/login" as any);
      return false;
    }
    return true;
  }, [hasAuthToken, router]);

  const handleAddToCart = useCallback(
    async (product: Product) => {
      if (!(await requireLogin())) return;
      const id = String(product._id || product.id || "");
      if (!id) return;
      const variant = product.variants?.[0];
      runCartAction(() =>
        addToCart({
          productId: id,
          variantSku: variant?.sku || "",
          quantity: 1,
          image: getProductImage(product),
        }),
      );
    },
    [runCartAction, requireLogin],
  );

  const changeCartQuantity = useCallback(
    async (product: Product, direction: "increase" | "decrease") => {
      if (!(await requireLogin())) return;
      const id = String(product._id || product.id || "");
      if (!id) return;
      const variantSku = product.variants?.[0]?.sku || "";
      if (direction === "increase")
        runCartAction(() => increaseCartItem({ productId: id, variantSku }));
      else runCartAction(() => decreaseCartItem({ productId: id, variantSku }));
    },
    [runCartAction, requireLogin],
  );

  const handleWishlist = useCallback(
    async (product: Product) => {
      if (!(await requireLogin())) return;
      const id = String(product._id || product.id || "");
      if (!id || wishBusyId) return;
      setWishBusyId(id);
      try {
        if (wishlistIds.includes(id)) {
          await removeFromWishlist(id);
          setWishlistIds((current) => current.filter((value) => value !== id));
        } else {
          await addToWishlist(id);
          setWishlistIds((current) =>
            current.includes(id) ? current : [...current, id],
          );
        }
      } catch (e: any) {
        console.log(
          "WISHLIST ACTION ERROR:",
          e?.response?.data || e?.message || e,
        );
        const message =
          e?.response?.status === 401
            ? "Please log in to use your wishlist."
            : e?.response?.data?.message ||
              e?.message ||
              "Couldn't update wishlist.";
        showToast(message);
      } finally {
        setWishBusyId(null);
      }
    },
    [wishlistIds, wishBusyId, requireLogin],
  );

  const loadData = useCallback(
    async (refresh = false) => {
      if (requestRef.current) return;
      requestRef.current = true;

      if (refresh) setRefreshing(true);

      try {
        // Fetch only the data required to draw this screen first.
        const [categoryResponse, productResponse] = await Promise.all([
          getCategories(),
          getProducts(),
        ]);

        const nextCategories = unwrapList(
          categoryResponse,
          "categories",
        ) as Category[];
        const nextProducts = unwrapList(
          productResponse,
          "products",
        ) as Product[];

        // Render products immediately; cart and wishlist sync must not block them.
        setCategories(nextCategories);
        setProducts(nextProducts);
        setLoading(false);

        // Persist data without blocking the UI.
        AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({
            savedAt: Date.now(),
            categories: nextCategories,
            products: nextProducts,
          }),
        ).catch((e) => console.log("CATEGORY CACHE WRITE ERROR:", e));

        // Update cart and wishlist quietly in the background.
        void Promise.allSettled([syncCart(), syncWishlist()]);
      } catch (e: any) {
        console.log("CATEGORY PRODUCTS SCREEN ERROR:", e);
        const message =
          e?.response?.data?.message ||
          e?.message ||
          "Unable to load products.";

        showToast(message);

        // Keep the screen useful if the network request fails.
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached) as CacheData;
            setCategories(parsed.categories || []);
            setProducts(parsed.products || []);
          }
        } catch (cacheError) {
          console.log("CATEGORY CACHE READ ERROR:", cacheError);
        }
      } finally {
        requestRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [syncCart, syncWishlist],
  );

  useFocusEffect(
    useCallback(() => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        const routeId = String(params.categoryId || "");
        const routeName = String(params.categoryName || "");
        if (routeId) setSelectedCategoryId(routeId);
        if (routeName) setSelectedCategoryName(routeName);
      }
      void loadData();
    }, [loadData, params.categoryId, params.categoryName]),
  );

  React.useEffect(() => {
    if (params.categoryId) setSelectedCategoryId(String(params.categoryId));
    if (params.categoryName)
      setSelectedCategoryName(String(params.categoryName));
  }, [params.categoryId, params.categoryName]);

  React.useEffect(() => {
    // Read the locally cached list immediately while the API refreshes.
    AsyncStorage.getItem(CACHE_KEY)
      .then((raw) => {
        if (!raw || categories.length) return;
        const cached = JSON.parse(raw) as CacheData;
        setCategories(cached.categories || []);
        setProducts(cached.products || []);
        setLoading(false);
      })
      .catch((e) => console.log("CATEGORY CACHE READ ERROR:", e));
  }, []);

  const selectedCategory = useMemo(
    () =>
      categories.find(
        (category) =>
          (selectedCategoryId && getId(category) === selectedCategoryId) ||
          (selectedCategoryName &&
            getName(category).toLowerCase() ===
              selectedCategoryName.toLowerCase()),
      ),
    [categories, selectedCategoryId, selectedCategoryName],
  );

  const visibleProducts = useMemo(() => {
    let list = products;
    if (selectedCategory) {
      // Show only products assigned to the selected category.
      list = products.filter((product) =>
        belongsToCategory(product, selectedCategory),
      );
    } else if (selectedCategoryId || selectedCategoryName !== "All Products") {
      // Handle deep links while the category list is still loading.
      const wantedId = selectedCategoryId.trim().toLowerCase();
      const wantedName = selectedCategoryName.trim().toLowerCase();
      list = products.filter((product) => {
        const tokens = new Set<string>();
        [
          product.category,
          product.categoryId,
          product.category_id,
          product.categoryName,
          product.category_name,
          product.subcategory,
          product.subcategoryId,
          product.subcategory_id,
          product.subcategoryName,
          product.subcategory_name,
          product.categories,
          product.subcategories,
          product.subCategories,
        ].forEach((value) => collectCategoryTokens(value, tokens));
        return (
          (!!wantedId && tokens.has(wantedId)) ||
          (!!wantedName && tokens.has(wantedName))
        );
      });
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((product) =>
        getProductName(product).toLowerCase().includes(query),
      );
    }
    return list;
  }, [
    products,
    selectedCategory,
    searchQuery,
    selectedCategoryId,
    selectedCategoryName,
  ]);

  const selectCategory = (category: Category | null) => {
    if (!category) {
      setSelectedCategoryId("");
      setSelectedCategoryName("All Products");
      return;
    }
    setSelectedCategoryId(getId(category));
    setSelectedCategoryName(getName(category));
  };

  const openProduct = (product: Product) => {
    const productId = String(product._id || product.id || "");
    if (!productId) return;
    router.push({
      pathname: "/product/[id]",
      params: { id: productId },
    });
  };

  const openCart = () => router.push("/cart" as any);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      <View pointerEvents="none" style={styles.pageShineLayer}>
        <ShineOverlay />
      </View>
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={23} color="#34405A" />
        </Pressable>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Ionicons name="bag-handle" size={19} color="#4639A8" />
          </View>
          <Text style={styles.brandText}>
            odi<Text style={styles.brandAccent}>kart</Text>
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerIcon}
            onPress={() => setSearchVisible((value) => !value)}
            accessibilityLabel="Search products"
          >
            <Ionicons name="search" size={22} color="#34405A" />
          </Pressable>
          <Pressable
            style={styles.headerIcon}
            onPress={openCart}
            accessibilityLabel="Open cart"
          >
            <Ionicons name="cart-outline" size={24} color="#34405A" />
            {cartCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {searchVisible ? (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={19} color={COLORS.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#9AA3B2"
            autoFocus
            style={styles.searchInput}
          />
          <Pressable
            onPress={() => {
              setSearchQuery("");
              setSearchVisible(false);
            }}
          >
            <Ionicons name="close-circle" size={20} color="#929BAD" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={styles.sidebar}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
          >
            {loading && categories.length === 0 ? (
              <SkeletonCategoryItem active />
            ) : (
              <Pressable
                onPress={() => selectCategory(null)}
                style={[
                  styles.sidebarItem,
                  !selectedCategoryId &&
                    selectedCategoryName === "All Products" &&
                    styles.sidebarItemActive,
                ]}
              >
                <View style={[styles.categoryThumb, styles.allThumb]}>
                  <Ionicons
                    name="apps-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.sidebarLabel,
                    !selectedCategoryId &&
                      selectedCategoryName === "All Products" &&
                      styles.sidebarLabelActive,
                  ]}
                >
                  All Products
                </Text>
              </Pressable>
            )}
            {loading && categories.length === 0
              ? Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonCategoryItem key={`category-skeleton-${index}`} />
                ))
              : categories.map((category, index) => {
                  const active =
                    (!!selectedCategoryId &&
                      getId(category) === selectedCategoryId) ||
                    getName(category).toLowerCase() ===
                      selectedCategoryName.toLowerCase();
                  return (
                    <Pressable
                      key={getId(category) || `${getName(category)}-${index}`}
                      onPress={() => selectCategory(category)}
                      style={[
                        styles.sidebarItem,
                        active && styles.sidebarItemActive,
                      ]}
                    >
                      <View style={styles.categoryThumb}>
                        <CategoryThumb category={category} />
                      </View>
                      <Text
                        style={[
                          styles.sidebarLabel,
                          active && styles.sidebarLabelActive,
                        ]}
                      >
                        {getName(category)}
                      </Text>
                    </Pressable>
                  );
                })}
          </ScrollView>
        </View>

        <View style={styles.productsPanel}>
          {loading && products.length === 0 ? (
            <CategoryHeadingSkeleton />
          ) : (
            <View style={styles.categoryHeading}>
              <View style={styles.headingTextWrap}>
                <Text numberOfLines={1} style={styles.eyebrow}>
                  {selectedCategoryName.toUpperCase()}
                </Text>
                <Text style={styles.headingTitle}>
                  {selectedCategoryName === "All Products"
                    ? "All Products"
                    : selectedCategoryName}
                </Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countText}>
                  {visibleProducts.length} products
                </Text>
              </View>
            </View>
          )}

          {loading && products.length === 0 ? (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.productListContent}
            >
              <ProductGridSkeleton />
            </ScrollView>
          ) : (
            <FlatList
              key="product-grid"
              data={visibleProducts}
              numColumns={2}
              initialNumToRender={6}
              maxToRenderPerBatch={8}
              updateCellsBatchingPeriod={40}
              windowSize={5}
              removeClippedSubviews
              keyExtractor={(item, index) =>
                String(item._id || item.id || `product-${index}`)
              }
              columnWrapperStyle={styles.productRow}
              contentContainerStyle={styles.productListContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadData(true)}
                  tintColor={COLORS.blue}
                />
              }
              renderItem={({ item }) => (
                <ProductCard
                  product={item}
                  onPress={() => openProduct(item)}
                  onWish={() => handleWishlist(item)}
                  wished={wishlistIds.includes(
                    String(item._id || item.id || ""),
                  )}
                  wishBusy={wishBusyId === String(item._id || item.id || "")}
                  quantity={
                    cartQuantities[String(item._id || item.id || "")] || 0
                  }
                  onAdd={() => handleAddToCart(item)}
                  onIncrease={() => changeCartQuantity(item, "increase")}
                  onDecrease={() => changeCartQuantity(item, "decrease")}
                />
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Image
                    source={notFoundImage}
                    style={styles.notFoundImage}
                    resizeMode="contain"
                  />

                  <Text style={styles.emptyTitle}>Oops! Nothing here yet</Text>

                  <Text style={styles.emptySubtitle}>
                    We couldn't find any products in this category. Try another
                    category or check back soon.
                  </Text>

                  <Pressable
                    style={styles.exploreButton}
                    onPress={() => {
                      setSelectedCategoryId("");
                      setSelectedCategoryName("All Products");
                      setSearchQuery("");
                    }}
                  >
                    <Text style={styles.exploreButtonText}>
                      Explore Products
                    </Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              }
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F4F6FB" },
  pageShineLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    opacity: 0.16,
  },
  header: {
    zIndex: 1,
    height: 66,
    marginHorizontal: 12,
    marginTop: 5,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#26345B",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  headerIcon: {
    width: 40,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  brandMark: {
    width: 25,
    height: 27,
    borderRadius: 8,
    backgroundColor: "#ECEBFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  brandText: {
    color: "#263B91",
    fontSize: 21,
    fontWeight: "900",
    letterSpacing: -1,
  },
  brandAccent: { color: "#7438CC" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 5 },
  cartBadge: {
    position: "absolute",
    top: 1,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#6D35D1",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  searchBar: {
    height: 48,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 13,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 13, paddingVertical: 8 },
  body: {
    zIndex: 1,
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingBottom: 82,
  },
  sidebar: {
    width: 82,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderRightWidth: 1,
    borderRightColor: "#EEF0F6",
  },
  sidebarContent: { paddingTop: 9, paddingBottom: 25, alignItems: "center" },
  sidebarItem: {
    width: "94%",
    minHeight: 101,
    marginBottom: 5,
    paddingVertical: 8,
    paddingHorizontal: 3,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  sidebarItemActive: {
    backgroundColor: "#F0F0FF",
    borderColor: "#DCDDFB",
  },
  categoryThumb: {
    width: 64,
    height: 64,
    borderRadius: 21,
    backgroundColor: "#F3F4FB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  categoryThumbImage: { width: "92%", height: "92%" },
  allThumb: { backgroundColor: "#EDEEFF" },
  sidebarLabel: {
    width: "100%",
    marginTop: 7,
    paddingHorizontal: 1,
    color: "#596477",
    fontSize: 9,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 13,
    flexShrink: 1,
  },
  sidebarLabelActive: { color: "#4639A8", fontWeight: "900" },
  productsPanel: { flex: 1, minWidth: 0, paddingLeft: 8 },
  categoryHeading: {
    minHeight: 74,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  headingTextWrap: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: "#8A91A5",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  headingTitle: {
    color: COLORS.ink,
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  countPill: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 13,
    backgroundColor: "#EEF0F8",
  },
  countText: { color: "#68748A", fontSize: 10, fontWeight: "800" },
  productListContent: { paddingBottom: 35, flexGrow: 1 },
  productRow: { gap: 8, marginBottom: 9 },
  productCard: {
    position: "relative",
    overflow: "hidden",
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E8ECF5",
    padding: 7,
    paddingBottom: 9,
    shadowColor: "#24345A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 8,
    elevation: 2,
  },
  productPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  shineClip: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
    overflow: "hidden",
    borderRadius: 16,
  },
  shineBand: {
    position: "absolute",
    top: -35,
    bottom: -35,
    width: 48,
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  productImageWrap: {
    width: "100%",
    aspectRatio: 1,
    minHeight: 0,
    borderRadius: 15,
    backgroundColor: "#F7F7FB",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  productImage: { width: "100%", height: "100%" },
  imageFallback: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0EEFF",
    overflow: "hidden",
  },
  fallbackGlow: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: "#E3DFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
    borderWidth: 1,
    borderColor: "#D4CCFF",
  },
  fallbackTitle: {
    color: "#5145A5",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 3,
  },
  fallbackSubtitle: {
    color: "#9292AA",
    fontSize: 8,
    marginTop: 4,
  },
  categoryFallback: {
    width: "100%",
    height: "100%",
    borderRadius: 21,
    backgroundColor: "#EDEBFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  discountBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#6338D6",
  },
  discountText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900" },
  quickAction: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 33,
    height: 33,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.96)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  productInfo: { paddingHorizontal: 2, paddingTop: 1 },
  productName: {
    minHeight: 18,
    marginTop: 1,
    color: "#202A3D",
    fontSize: 11,
    lineHeight: 18,
    fontWeight: "800",
  },
  priceRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    marginTop: 1,
  },
  priceDetails: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 5,
  },
  price: { color: "#172033", fontSize: 14, fontWeight: "900" },
  oldPrice: {
    color: "#A0A7B4",
    fontSize: 10,
    textDecorationLine: "line-through",
  },
  wishlistButton: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.97)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },
  productMeta: { color: "#7D8798", fontSize: 10, marginTop: 3 },
  productDescription: {
    color: "#596477",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 5,
  },
  ratingLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ratingText: { color: "#49546A", fontSize: 10, fontWeight: "800" },
  stockText: { color: "#16865B", fontSize: 9, fontWeight: "700" },
  outOfStock: { color: "#D14343" },
  priceAddButton: {
    width: 34,
    height: 32,
    flexShrink: 0,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  priceQuantityStepper: {
    height: 32,
    minWidth: 83,
    flexShrink: 0,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    elevation: 3,
  },
  priceStepperAction: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  priceQuantityText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 4,
  },
  disabledButton: { backgroundColor: "#9CA3AF" },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: { color: COLORS.muted, fontSize: 12, fontWeight: "600" },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 9,
  },
  skeletonGridItem: {
    width: "48.7%",
    minWidth: 0,
  },
  skeletonCategoryThumb: {
    width: 64,
    height: 64,
    borderRadius: 21,
    backgroundColor: "#E9ECF4",
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonCategoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#DDE2ED",
  },
  skeletonCategoryLabel: {
    width: 52,
    height: 7,
    marginTop: 7,
    borderRadius: 5,
    backgroundColor: "#E6E9F1",
  },
  skeletonCategoryLabelShort: {
    width: 34,
    height: 6,
    marginTop: 4,
    borderRadius: 5,
    backgroundColor: "#ECEEF4",
  },
  skeletonEyebrow: {
    width: 92,
    height: 7,
    marginBottom: 7,
  },
  skeletonHeading: {
    width: 135,
    height: 19,
  },
  skeletonCountPill: {
    width: 65,
    height: 27,
    borderRadius: 13,
    backgroundColor: "#E6E9F1",
  },
  skeletonImage: {
    width: "100%",
    aspectRatio: 1,
    minHeight: 0,
    borderRadius: 15,
    backgroundColor: "#E9ECF4",
    overflow: "hidden",
    position: "relative",
  },
  skeletonHeart: {
    position: "absolute",
    top: 7,
    right: 7,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#DDE2ED",
  },
  skeletonOffer: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 58,
    height: 23,
    borderRadius: 9,
    backgroundColor: "#D8D3F7",
  },
  skeletonAdd: {
    width: 34,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#D5D9E8",
  },
  skeletonLine: { height: 9, borderRadius: 6, backgroundColor: "#E6E9F1" },
  skeletonProductName: { width: "88%", height: 11, marginTop: 2 },
  skeletonProductMeta: { width: "48%", height: 8, marginTop: 5 },
  skeletonRatingRow: {
    height: 13,
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  skeletonRatingStar: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: "#E4E7EF",
  },
  skeletonRatingText: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E6E9F1",
  },
  skeletonReviewText: {
    width: 28,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ECEEF4",
  },
  skeletonPriceDetails: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  skeletonPrice: {
    width: "35%",
    height: 15,
    marginTop: 2,
    backgroundColor: "#DDE2ED",
  },
  skeletonOldPrice: { width: "22%", height: 8, backgroundColor: "#ECEEF4" },
  notFoundImage: {
    width: 190,
    height: 180,
    alignSelf: "center",
    marginBottom: 12,
  },

  exploreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    elevation: 3,
  },

  exploreButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: { alignItems: "center", paddingHorizontal: 15, paddingTop: 65 },
  emptyIllustration: {
    width: 110,
    height: 110,
    borderRadius: 35,
    backgroundColor: "#EEECFF",
    borderWidth: 1,
    borderColor: "#DCD6FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#7662E8",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 5,
  },
  emptySparkleOne: { position: "absolute", top: 12, right: 13 },
  emptySparkleTwo: { position: "absolute", bottom: 16, left: 12 },
  emptyTitle: {
    color: "#242447",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 17,
  },
  emptySubtitle: {
    color: "#85869D",
    fontSize: 11,
    textAlign: "center",
    marginTop: 7,
    lineHeight: 18,
    maxWidth: 220,
  },
});
