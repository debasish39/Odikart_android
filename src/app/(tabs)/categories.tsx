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
    const productId = String(productValue._id || productValue.id || "");
    const productName = String(productValue.name || productValue.title || "")
      .trim()
      .toLowerCase();
    return (!!id && productId === id) || (!!name && productName === name);
  }

  const value = String(productValue || "");
  return (!!id && value === id) || value.trim().toLowerCase() === name;
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

      <View style={styles.skeletonIntro}>
        <View style={{ flex: 1 }}>
          <ShimmerBlock style={{ width: 148, height: 19 }} radius={6} />
          <ShimmerBlock
            style={{ width: 188, height: 9, marginTop: 8 }}
            radius={4}
          />
        </View>
        <ShimmerBlock style={{ width: 38, height: 38 }} radius={13} />
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

        const count =
          typeof category.productCount === "number"
            ? category.productCount
            : typeof category.count === "number"
              ? category.count
              : countFromProducts;

        return { category, count, name };
      }),
    [categories, products],
  );

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
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: art.bg },
          pressed && styles.cardPressed,
        ]}
      >
        <View
          pointerEvents="none"
          style={[styles.cardAccent, { backgroundColor: art.tint }]}
        />
        <View style={styles.cardTop}>
          <View style={styles.textBlock}>
            <Text style={styles.categoryName} numberOfLines={2}>
              {getName(category)}
            </Text>
            <Text style={styles.productCount}>
              {count} {count === 1 ? "product" : "products"}
            </Text>
          </View>
          <View
            style={[styles.imageWrap, { backgroundColor: `${art.tint}12` }]}
          >
            {image ? (
              <Image
                source={{ uri: image }}
                style={styles.categoryImage}
                resizeMode="contain"
              />
            ) : (
              <Ionicons name={art.icon} size={38} color={art.tint} />
            )}
          </View>
        </View>
        <View style={styles.cardFooter}>
          <Text style={[styles.exploreText, { color: art.tint }]}>Explore</Text>
          <Ionicons name="arrow-forward" size={14} color={art.tint} />
          <View style={[styles.footerDot, { backgroundColor: art.tint }]} />
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
        <Pressable
          style={styles.headerButton}
          onPress={() => router.push("/(tabs)" as any)}
          accessibilityLabel="Search products"
        >
          <Ionicons name="search-outline" size={22} color="#202124" />
        </Pressable>
      </View>

      <View style={styles.intro}>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>FIND YOUR FAVOURITES</Text>
          <Text style={styles.introTitle}>Shop by category</Text>
          <Text style={styles.introSubtitle}>
            A little something for every day.
          </Text>
        </View>
        <View style={styles.introIcon}>
          <Ionicons name="sparkles-outline" size={24} color="#2563EB" />
        </View>
        <View pointerEvents="none" style={styles.introOrb} />
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
        data={categoryItems}
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
            <Text style={styles.emptyTitle}>No categories yet</Text>
            <Text style={styles.stateText}>
              Pull down to refresh and try again.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    height: 52,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F1F3",
  },
  headerButton: {
    width: 36,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: "#17191C",
    letterSpacing: 0.15,
  },
  intro: {
    minHeight: 106,
    marginHorizontal: 13,
    marginTop: 13,
    marginBottom: 6,
    borderRadius: 19,
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#F2F6FF",
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  introCopy: {
    flex: 1,
    zIndex: 1,
  },
  eyebrow: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.25,
    color: "#5574B9",
  },
  introTitle: {
    color: "#17233E",
    fontSize: 19,
    fontWeight: "900",
    marginTop: 5,
    letterSpacing: -0.4,
  },
  introSubtitle: {
    color: "#6C7891",
    fontSize: 10,
    marginTop: 4,
  },
  introIcon: {
    width: 45,
    height: 45,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  introOrb: {
    position: "absolute",
    right: 26,
    top: -43,
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: "#E2EAFF",
    opacity: 0.8,
  },
  gridContent: {
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 28,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  card: {
    flex: 1,
    minWidth: 0,
    height: 108,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 9,
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#182746",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.055,
    shadowRadius: 7,
    elevation: 2,
  },
  cardAccent: {
    position: "absolute",
    left: 0,
    top: 13,
    width: 3,
    height: 31,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    opacity: 0.55,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.975 }],
  },
  cardTop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    paddingLeft: 2,
  },
  categoryName: {
    color: "#202124",
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 15,
  },
  productCount: {
    color: "#747982",
    fontSize: 9,
    marginTop: 5,
    lineHeight: 11,
  },
  imageWrap: {
    width: 57,
    height: 57,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryImage: {
    width: 54,
    height: 54,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    paddingTop: 3,
  },
  exploreText: {
    fontSize: 9,
    fontWeight: "800",
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    marginLeft: 2,
    opacity: 0.65,
  },
  skeletonIntro: {
    minHeight: 106,
    marginHorizontal: 13,
    marginTop: 13,
    marginBottom: 15,
    borderRadius: 19,
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: "#F2F6FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 13,
    gap: 10,
  },
  skeletonCard: {
    width: "48.4%",
    height: 108,
    borderRadius: 15,
    padding: 11,
    backgroundColor: "#F7F8FA",
    marginBottom: 0,
  },
  skeletonCardTop: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  skeletonTextGroup: {
    flex: 1,
  },
  skeletonImage: {
    width: 54,
    height: 54,
  },
  shimmerBase: {
    backgroundColor: "#E6EAF0",
    overflow: "hidden",
  },
  shimmerGlow: {
    backgroundColor: "#FFFFFF",
    opacity: 0.8,
    transform: [{ scale: 1.02 }],
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 65,
  },
  emptyIcon: {
    width: 70,
    height: 70,
    borderRadius: 23,
    backgroundColor: "#F0F4FA",
    alignItems: "center",
    justifyContent: "center",
  },
  stateText: {
    marginTop: 8,
    color: "#7A808A",
    fontSize: 12,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#25282D",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 13,
  },
  errorBox: {
    marginHorizontal: 13,
    marginTop: 12,
    marginBottom: 4,
    padding: 12,
    borderRadius: 13,
    backgroundColor: "#FFF1F1",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  errorText: {
    flex: 1,
    color: "#7F1D1D",
    fontSize: 11,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#2563EB",
  },
  retryText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
});
