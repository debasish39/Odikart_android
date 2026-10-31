import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getCategories } from "../../api/categories";
import { getProducts } from "../../api/products";

type Category = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  icon?: string;
  productCount?: number;
  count?: number;
};

type Product = {
  _id?: string;
  id?: string;
  category?: any;
  subcategory?: any;
};

const CATEGORY_ART: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string }
> = {
  snacks: { icon: "fast-food-outline", tint: "#B96A18", bg: "#FFF0D8" },
  pickles: { icon: "nutrition-outline", tint: "#B33A32", bg: "#FFE8E4" },
  papad: { icon: "ellipse-outline", tint: "#A16A2D", bg: "#FFF2DF" },
  spices: { icon: "leaf-outline", tint: "#B7791F", bg: "#FFF2D8" },
  handicrafts: {
    icon: "color-palette-outline",
    tint: "#9A5C36",
    bg: "#FCE8DD",
  },
  clothes: { icon: "shirt-outline", tint: "#C04B73", bg: "#FCE6EE" },
  "home needs": { icon: "home-outline", tint: "#267DAD", bg: "#E2F4FF" },
  "health & beauty": { icon: "flower-outline", tint: "#D65A86", bg: "#FFE8F0" },
  grocery: { icon: "basket-outline", tint: "#2E8B57", bg: "#E4F8E9" },
  electronics: {
    icon: "phone-portrait-outline",
    tint: "#5265B5",
    bg: "#E9EDFF",
  },
  "home & kitchen": { icon: "home-outline", tint: "#267DAD", bg: "#E2F4FF" },
  "health and beauty": {
    icon: "heart-outline",
    tint: "#D65A86",
    bg: "#FFE8F0",
  },
};

const getId = (item: Category) => String(item._id || item.id || "");
const getName = (item: Category) => item.name || item.title || "Category";
const getImage = (item: Category) =>
  item.image || item.imageUrl || item.thumbnail || "";

function unwrapList(response: any, key: string): any[] {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.[key])) return response[key];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.[key])) return response.data[key];
  return [];
}

function categoryMatch(productValue: any, category: Category) {
  const id = getId(category);
  const name = getName(category).trim().toLowerCase();

  if (productValue && typeof productValue === "object") {
    const productId = String(
      productValue._id ||
        productValue.id ||
        productValue.categoryId ||
        productValue.subcategoryId ||
        "",
    );
    const productName = String(
      productValue.name ||
        productValue.title ||
        productValue.categoryName ||
        productValue.subcategoryName ||
        "",
    )
      .trim()
      .toLowerCase();

    return (!!id && productId === id) || (!!name && productName === name);
  }

  const value = String(productValue || "").trim();
  return (!!id && value === id) || value.toLowerCase() === name;
}

function ShimmerBlock({
  style,
  radius = 10,
}: {
  style?: any;
  radius?: number;
}) {
  const shimmer = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1050,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 1050,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  const opacity = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1],
  });

  return (
    <View style={[styles.shimmerBase, { borderRadius: radius }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, styles.shimmerGlow, { opacity }]}
      />
    </View>
  );
}

function CategorySkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonCardTop}>
        <View style={styles.skeletonTextGroup}>
          <ShimmerBlock style={{ width: "78%", height: 12 }} radius={5} />
          <ShimmerBlock
            style={{ width: "54%", height: 8, marginTop: 8 }}
            radius={4}
          />
        </View>
        <ShimmerBlock style={styles.skeletonImage} radius={12} />
      </View>
      <ShimmerBlock style={{ width: 48, height: 8, marginTop: 7 }} radius={4} />
    </View>
  );
}

function CategoriesSkeleton() {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />
      <View style={styles.header}>
        <View style={styles.headerButton}>
          <Ionicons name="chevron-back" size={23} color="#202124" />
        </View>
        <Text style={styles.headerTitle}>Categories</Text>
        <View style={styles.headerButton}>
          <Ionicons name="search-outline" size={22} color="#202124" />
        </View>
      </View>

      <View style={styles.skeletonGrid}>
        {Array.from({ length: 8 }).map((_, index) => (
          <CategorySkeletonCard key={`category-skeleton-${index}`} />
        ))}
      </View>
    </SafeAreaView>
  );
}

const CATEGORIES_CACHE_KEY = "@odikart/categories-screen-cache-v1";
type CategoriesCache = {
  savedAt: number;
  categories: Category[];
  products: Product[];
};

export default function CategoriesScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const hasStartedRef = useRef(false);
  const requestRef = useRef(false);

  const readCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CATEGORIES_CACHE_KEY);
      if (!raw) return false;

      const cached = JSON.parse(raw) as CategoriesCache;
      if (
        !cached ||
        !Array.isArray(cached.categories) ||
        !Array.isArray(cached.products)
      ) {
        return false;
      }

      // Show saved data immediately, even if it is old; refresh it below.
      setCategories(cached.categories);
      setProducts(cached.products);
      setHasLoaded(true);
      setLoading(false);
      return true;
    } catch (cacheError) {
      console.log("CATEGORIES CACHE READ ERROR:", cacheError);
      return false;
    }
  }, []);

  const loadData = useCallback(async (refresh = false) => {
    if (requestRef.current) {
      if (refresh) setRefreshing(false);
      return;
    }

    requestRef.current = true;
    try {
      setError("");
      if (refresh) setRefreshing(true);

      const [categoryResponse, productResponse] = await Promise.all([
        getCategories(),
        getProducts(),
      ]);

      const nextCategories = unwrapList(
        categoryResponse,
        "categories",
      ) as Category[];
      const nextProducts = unwrapList(productResponse, "products") as Product[];

      setCategories(nextCategories);
      setProducts(nextProducts);
      setHasLoaded(true);

      const cache: CategoriesCache = {
        savedAt: Date.now(),
        categories: nextCategories,
        products: nextProducts,
      };

      // Cache failure must not make the page fail.
      AsyncStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cache)).catch(
        (cacheError) =>
          console.log("CATEGORIES CACHE WRITE ERROR:", cacheError),
      );
    } catch (e: any) {
      console.log("CATEGORIES SCREEN ERROR:", e);
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Couldn't refresh categories. Showing saved data if available.",
      );
    } finally {
      requestRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const start = async () => {
        // Read persistent cache on first focus, then fetch fresh server data.
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          const hadCache = await readCache();
          if (!active) return;
          if (!hadCache) setLoading(true);
        }
        if (active) void loadData();
      };

      void start();
      return () => {
        active = false;
      };
    }, [loadData, readCache]),
  );

  const categoryItems = useMemo(
    () =>
      categories.map((category) => {
        const name = getName(category).trim().toLowerCase();
        const countFromProducts = products.filter(
          (product) =>
            categoryMatch(product.category, category) ||
            categoryMatch(product.subcategory, category),
        ).length;

        // Prefer the count calculated from the loaded products. Some category
        // APIs return a stale productCount (for example, 1 when 6 products exist).
        // Use the API count only when this product response has no matching items.
        const apiCount =
          typeof category.productCount === "number"
            ? category.productCount
            : typeof category.count === "number"
              ? category.count
              : 0;
        const count = countFromProducts > 0 ? countFromProducts : apiCount;

        return { category, count, name };
      }),
    [categories, products],
  );

  const filteredCategoryItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categoryItems;
    return categoryItems.filter(
      ({ category, name }) =>
        name.includes(query) || getName(category).toLowerCase().includes(query),
    );
  }, [categoryItems, searchQuery]);

  const openCategory = (category: Category) => {
    router.push({
      pathname: "/category-products",
      params: {
        categoryId: getId(category),
        categoryName: getName(category),
      },
    });
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: (typeof categoryItems)[number];
    index: number;
  }) => {
    const { category, count, name } = item;
    const image = getImage(category);
    const art = CATEGORY_ART[name] || {
      icon: "grid-outline" as const,
      tint: "#5265B5",
      bg: "#E9EDFF",
    };

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${getName(category)}, ${count} products`}
        onPress={() => openCategory(category)}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={[styles.cardArt, { backgroundColor: art.bg }]}>
          <View style={[styles.artOrb, { backgroundColor: art.tint }]} />
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.categoryImage}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                styles.fallbackIcon,
                { backgroundColor: `${art.tint}18` },
              ]}
            >
              <Ionicons name={art.icon} size={39} color={art.tint} />
            </View>
          )}
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{count}</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.categoryName} numberOfLines={1}>
            {getName(category)}
          </Text>
          <View style={styles.cardBottom}>
            <Text style={styles.productCount}>
              {count} {count === 1 ? "product" : "products"}
            </Text>
            <View style={[styles.exploreButton, { backgroundColor: art.bg }]}>
              <Ionicons name="arrow-forward" size={15} color={art.tint} />
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  if (loading && !hasLoaded) return <CategoriesSkeleton />;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={23} color="#202124" />
        </Pressable>
        <Text style={styles.headerTitle}>Categories</Text>
        <View style={styles.headerButton}>
          <Ionicons name="grid-outline" size={20} color="#2563EB" />
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#8490A5" />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search categories..."
          placeholderTextColor="#98A2B3"
          returnKeyType="search"
          style={styles.searchInput}
          accessibilityLabel="Search categories"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 ? (
          <Pressable
            onPress={() => setSearchQuery("")}
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={19} color="#98A2B3" />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={24} color="#D14343" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadData()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={filteredCategoryItems}
        keyExtractor={(item, index) =>
          getId(item.category) || `${item.name}-${index}`
        }
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="grid-outline" size={34} color="#7C8AA5" />
            </View>
            <Text style={styles.emptyTitle}>
              {searchQuery.trim()
                ? "No matching categories"
                : "No categories yet"}
            </Text>
            <Text style={styles.stateText}>
              {searchQuery.trim()
                ? "Try another category name."
                : "Pull down to refresh and try again."}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F7F9FC" },
  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E9EDF4",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3F6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "900",
    color: "#17233E",
    letterSpacing: -0.3,
  },
  intro: {
    minHeight: 118,
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 12,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 17,
    backgroundColor: "#EAF1FF",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  introCopy: { flex: 1, zIndex: 1 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.35,
    color: "#5574B9",
  },
  introTitle: {
    color: "#17233E",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 6,
    letterSpacing: -0.7,
  },
  introSubtitle: { color: "#63728D", fontSize: 12, marginTop: 5 },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  introOrb: {
    position: "absolute",
    right: 14,
    top: -46,
    width: 135,
    height: 135,
    borderRadius: 68,
    backgroundColor: "#D7E3FF",
    opacity: 0.85,
  },
  searchBar: {
    minHeight: 50,
    marginHorizontal: 15,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EBF3",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#1C2D4A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: "#17233E", fontSize: 13 },
  gridContent: {
    paddingHorizontal: 15,
    paddingTop: 5,
    paddingBottom: 115,
    flexGrow: 1,
  },
  gridRow: { gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    minWidth: 0,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#EDF0F5",
    shadowColor: "#192A46",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 10,
    elevation: 2,
  },
  cardPressed: { opacity: 0.9, transform: [{ scale: 0.975 }] },
  cardArt: {
    height: 125,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    margin: 7,
    marginBottom: 0,
    borderRadius: 16,
  },
  artOrb: {
    position: "absolute",
    width: 94,
    height: 94,
    borderRadius: 47,
    opacity: 0.08,
    right: -24,
    top: -24,
  },
  categoryImage: { width: "88%", height: "88%" },
  fallbackIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 27,
    height: 27,
    paddingHorizontal: 7,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: "#263653", fontSize: 10, fontWeight: "900" },
  cardInfo: { paddingHorizontal: 12, paddingTop: 11, paddingBottom: 12 },
  categoryName: {
    color: "#18243B",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  cardBottom: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  productCount: {
    color: "#8590A3",
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1,
  },
  exploreButton: {
    width: 29,
    height: 29,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  skeletonIntro: {
    minHeight: 118,
    marginHorizontal: 15,
    marginTop: 15,
    marginBottom: 15,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 17,
    backgroundColor: "#EAF1FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 15,
    paddingBottom: 115,
    gap: 12,
  },
  skeletonCard: {
    width: "48%",
    height: 165,
    borderRadius: 21,
    padding: 11,
    backgroundColor: "#FFFFFF",
    marginBottom: 0,
  },
  skeletonCardTop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  skeletonTextGroup: { flex: 1 },
  skeletonImage: { width: 54, height: 54 },
  shimmerBase: { backgroundColor: "#E7ECF4", overflow: "hidden" },
  shimmerGlow: {
    backgroundColor: "#FFFFFF",
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 55,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "#EDF2FA",
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    marginTop: 8,
    color: "#7A879C",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  emptyTitle: {
    color: "#202D45",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 13,
  },
  errorBox: {
    marginHorizontal: 15,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#FFF0F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  errorText: { flex: 1, color: "#7F1D1D", fontSize: 11, lineHeight: 16 },
  retryButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#2563EB",
  },
  retryText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
});
