import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    ToastAndroid,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    addToCart,
    decreaseCartItem,
    getCart,
    increaseCartItem,
} from "../../api/cart";
import { getTrendingProducts, trackProductEvent } from "../../api/products";
import {
    addToWishlist,
    getWishlist,
    getWishlistProductIds,
    removeFromWishlist,
} from "../../api/wishlist";

type Product = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
  price?: number | string;
  salePrice?: number | string;
  originalPrice?: number | string;
  compareAtPrice?: number | string;
  discount?: number | string;
  discountPercentage?: number | string;
  image?: any;
  imageUrl?: any;
  thumbnail?: any;
  mainImage?: any;
  primaryImage?: any;
  coverImage?: any;
  featuredImage?: any;
  productImages?: any[];
  images?: any[];
  media?: { thumbnail?: any; images?: any[] };
  variants?: any[];
  category?: any;
  rating?: number | string;
  averageRating?: number | string;
  reviewCount?: number | string;
  numReviews?: number | string;
  stock?: number | string;
  quantity?: number | string;
};

type SortMode = "trending" | "priceLow" | "priceHigh" | "discount" | "rating";

const unwrapProducts = (response: any): Product[] => {
  const candidates = [
    response,
    response?.data,
    response?.body,
    response?.result,
    response?.payload,
    response?.data?.data,
    response?.data?.result,
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.products)) return value.products;
    if (Array.isArray(value?.results)) return value.results;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.docs)) return value.docs;
  }
  return [];
};

const idOf = (p: Product) => String(p._id || p.id || "");
const nameOf = (p: Product) => p.name || p.title || "Product";
// Accepts common image URL formats returned by MongoDB, Cloudinary and APIs.
const imageValue = (value: any): string => {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const possibleValues = [
    value.url,
    value.uri,
    value.secure_url,
    value.secureUrl,
    value.src,
    value.path,
    value.publicUrl,
    value.imageUrl,
    value.image,
    value.original,
    value.full,
    value.large,
    value.medium,
    value.thumbnail,
  ];

  for (const candidate of possibleValues) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return "";
};

const isUsableImageUri = (uri: string) =>
  /^(https?:\/\/|file:\/\/|content:\/\/|data:image\/)/i.test(uri);

const imageListOf = (product: Product): string[] => {
  const variant =
    (product.variants || []).find((item: any) => item?.isActive !== false) ||
    product.variants?.[0];

  const candidates = [
    // Common product-level image fields
    ...(Array.isArray(product.media?.images) ? product.media.images : []),
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray((product as any).productImages)
      ? (product as any).productImages
      : []),
    (product as any).coverImage,
    (product as any).featuredImage,
    (product as any).imageUrl,
    (product as any).imageURL,
    (product as any).mainImage,
    (product as any).primaryImage,
    (product as any).thumbnail,
    (product as any).image,
    product.media?.thumbnail,

    // Variant images
    ...(Array.isArray(variant?.images) ? variant.images : []),
    variant?.image,
    variant?.imageUrl,
    variant?.thumbnail,
  ];

  const urls = candidates
    .map(imageValue)
    .filter((uri) => uri.length > 0 && isUsableImageUri(uri));

  return [...new Set(urls)];
};

const imageOf = (product: Product) => imageListOf(product)[0] || "";

const priceOf = (p: Product) => {
  const variant = (p.variants || [])
    .filter((v) => v?.isActive !== false && Number.isFinite(Number(v?.price)))
    .sort((a, b) => Number(a.price) - Number(b.price))[0];
  for (const v of [variant?.salePrice, variant?.price, p.salePrice, p.price]) {
    const n = Number(v);
    if (
      v !== undefined &&
      v !== null &&
      v !== "" &&
      Number.isFinite(n) &&
      n >= 0
    )
      return n;
  }
  return 0;
};
const originalOf = (p: Product) => {
  const variant = (p.variants || [])
    .filter((v) => v?.isActive !== false && Number.isFinite(Number(v?.price)))
    .sort((a, b) => Number(a.price) - Number(b.price))[0];
  for (const v of [
    variant?.originalPrice,
    variant?.compareAtPrice,
    p.compareAtPrice,
    p.originalPrice,
  ]) {
    const n = Number(v);
    if (
      v !== undefined &&
      v !== null &&
      v !== "" &&
      Number.isFinite(n) &&
      n > 0
    )
      return n;
  }
  return 0;
};
const discountOf = (p: Product) => {
  const price = priceOf(p),
    original = originalOf(p);
  if (original > price && original > 0)
    return Math.round(((original - price) / original) * 100);
  const d = Number(p.discountPercentage ?? p.discount ?? 0);
  return Number.isFinite(d) && d > 0 ? Math.round(d) : 0;
};
const stockOf = (p: Product) => {
  const variants = (p.variants || []).filter((v) => v?.isActive !== false);
  if (variants.length) {
    const known = variants
      .map((v) => v.stock)
      .filter((v) => v !== undefined && v !== null);
    if (known.length)
      return known.reduce((sum, v) => sum + Math.max(0, Number(v) || 0), 0);
  }
  const stock = p.stock ?? p.quantity;
  return stock == null ? null : Math.max(0, Number(stock) || 0);
};
const categoryOf = (p: Product) => {
  const c = p.category;
  return c && typeof c === "object" ? c.name || c.title || "All" : "All";
};
const ratingOf = (p: Product) => Number(p.averageRating ?? p.rating ?? 0) || 0;
const money = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

const ProductImageCarousel = ({
  images,
  fallback,
  productName,
}: {
  images: string[];
  fallback: string;
  productName: string;
}) => {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const slides = (images.length ? images : fallback ? [fallback] : []).filter(
    (uri) => !failedImages.includes(uri),
  );

  useEffect(() => {
    setActiveIndex(0);
    setFailedImages([]);
  }, [images.join("|")]);

  const handleImageError = (uri: string, error: any) => {
    console.log("TRENDING PRODUCT IMAGE LOAD FAILED:", {
      product: productName,
      uri,
      error: error?.nativeEvent?.error || error?.message || error,
    });
    setFailedImages((current) =>
      current.includes(uri) ? current : [...current, uri],
    );
  };

  return (
    <View
      style={s.carouselWrap}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout({ width, height });
      }}
    >
      {slides.length > 0 && layout.width > 0 && layout.height > 0 ? (
        <>
          <ScrollView
            style={StyleSheet.absoluteFill}
            contentContainerStyle={{ height: layout.height }}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              setActiveIndex(
                Math.max(
                  0,
                  Math.min(
                    slides.length - 1,
                    Math.round(event.nativeEvent.contentOffset.x / layout.width),
                  ),
                ),
              );
            }}
          >
            {slides.map((uri, index) => (
              <Image
                key={`${uri}-${index}`}
                source={{ uri }}
                style={{ width: layout.width, height: layout.height }}
                resizeMode="contain"
                onLoad={() =>
                  console.log("TRENDING PRODUCT IMAGE LOADED:", {
                    product: productName,
                    uri,
                    width: layout.width,
                    height: layout.height,
                  })
                }
                onError={(event) => handleImageError(uri, event)}
              />
            ))}
          </ScrollView>

          {slides.length > 1 ? (
            <View pointerEvents="none" style={s.carouselDots}>
              {slides.map((_, index) => (
                <View
                  key={index}
                  style={[
                    s.carouselDot,
                    activeIndex === index && s.carouselDotActive,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <View style={s.noImage}>
          <Ionicons name="image-outline" size={34} color="#A6A8B5" />
          <Text style={s.noImageText}>
            {images.length || fallback ? "Loading image…" : "Image coming soon"}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function TrendingProductsScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<SortMode>("trending");
  const [sortOpen, setSortOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [wishBusyId, setWishBusyId] = useState("");
  const [appAlert, setAppAlert] = useState<{
    title: string;
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showAppAlert = useCallback(
    (title: string, message: string, type: "success" | "error" | "info" = "info") => {
      setAppAlert({ title, message, type });
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      setAppAlert({ title: "Odikart", message, type: "success" });
    }
  }, []);

  const syncCart = useCallback(async () => {
    const response: any = await getCart();
    const items = Array.isArray(response)
      ? response
      : response?.items || response?.cartItems || response?.data?.items || [];
    const next: Record<string, number> = {};
    items.forEach((item: any) => {
      const id = String(
        item.productId || item.product?._id || item.product?.id || "",
      );
      if (id) next[id] = Number(item.quantity) || 0;
    });
    setQuantities(next);
  }, []);

  const loadTrending = useCallback(
    async (refresh = false) => {
      try {
        setError("");
        refresh ? setRefreshing(true) : setLoading(true);
        const [response, wishlist] = await Promise.all([
          getTrendingProducts(),
          getWishlist().catch(() => null),
        ]);
        const seen = new Set<string>();
        const list = unwrapProducts(response).filter((p) => {
          const id = idOf(p);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        setProducts(list);
        console.log(
          "TRENDING PRODUCT IMAGE CHECK:",
          list.map((product) => ({
            name: nameOf(product),
            extractedImages: imageListOf(product),
            imageFields: {
              image: product.image,
              imageUrl: product.imageUrl,
              images: product.images,
              media: product.media,
              mainImage: product.mainImage,
              primaryImage: product.primaryImage,
              productImages: (product as any).productImages,
            },
          })),
        );
        setWishlistIds(wishlist ? getWishlistProductIds(wishlist) : []);
        await syncCart().catch((e) => console.log("TRENDING CART SYNC:", e));
      } catch (e: any) {
        console.log(
          "TRENDING PRODUCTS ERROR:",
          e?.response?.data || e?.message || e,
        );
        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Couldn't load trending products.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [syncCart],
  );

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(products.map(categoryOf).filter((v) => v && v !== "All")),
      ),
    ],
    [products],
  );

  const visibleProducts = useMemo(() => {
    let list = products.filter(
      (p) => category === "All" || categoryOf(p) === category,
    );
    list = [...list];
    if (sort === "priceLow") list.sort((a, b) => priceOf(a) - priceOf(b));
    if (sort === "priceHigh") list.sort((a, b) => priceOf(b) - priceOf(a));
    if (sort === "discount") list.sort((a, b) => discountOf(b) - discountOf(a));
    if (sort === "rating") list.sort((a, b) => ratingOf(b) - ratingOf(a));
    return list;
  }, [products, category, sort]);

  const openProduct = async (p: Product) => {
    const id = idOf(p);
    if (!id) return;
    try {
      await trackProductEvent(id, "view");
    } catch (e) {
      console.log("VIEW EVENT:", e);
    }
    router.push(`/product/${id}` as any);
  };

  const toggleWishlist = async (p: Product) => {
    const id = idOf(p);
    if (!id || wishBusyId) return;
    const saved = wishlistIds.includes(id);
    setWishBusyId(id);
    setWishlistIds((current) =>
      saved ? current.filter((v) => v !== id) : [...current, id],
    );
    try {
      if (saved) await removeFromWishlist(id);
      else {
        await addToWishlist(id);
        showToast("Added to wishlist");
        try {
          await trackProductEvent(id, "wishlist");
        } catch {}
      }
    } catch (e: any) {
      setWishlistIds((current) =>
        saved ? [...current, id] : current.filter((v) => v !== id),
      );
      showAppAlert(
        "Wishlist update failed",
        e?.response?.status === 401
          ? "Please log in to use your wishlist."
          : "Couldn't update your wishlist. Please try again.",
        "error",
      );
    } finally {
      setWishBusyId("");
    }
  };

  const addProduct = async (p: Product) => {
    const id = idOf(p);
    if (!id || busyId) return;
    if (stockOf(p) !== null && stockOf(p)! <= 0) {
      showAppAlert("Out of stock", "This product is currently unavailable.", "info");
      return;
    }
    const variant =
      (p.variants || []).find((v) => v?.isActive !== false) || p.variants?.[0];
    setBusyId(id);
    try {
      await addToCart({
        productId: id,
        variantSku: variant?.sku || "",
        quantity: 1,
        image: imageOf(p),
      });
      await syncCart();
      showToast("Added to cart");
      try {
        await trackProductEvent(id, "cart");
      } catch {}
    } catch (e: any) {
      showAppAlert(
        "Couldn't add product",
        e?.response?.status === 401 || e?.response?.status === 403
          ? "Please log in to add products to your cart."
          : e?.response?.data?.message ||
              "Please try adding this product again.",
        "error",
      );
    } finally {
      setBusyId("");
    }
  };

  const changeQuantity = async (p: Product, direction: "plus" | "minus") => {
    const id = idOf(p);
    if (!id || busyId) return;
    const variant =
      (p.variants || []).find((v) => v?.isActive !== false) || p.variants?.[0];
    setBusyId(id);
    try {
      if (direction === "plus")
        await increaseCartItem({
          productId: id,
          variantSku: variant?.sku || "",
        });
      else
        await decreaseCartItem({
          productId: id,
          variantSku: variant?.sku || "",
        });
      await syncCart();
      showToast(direction === "plus" ? "Cart quantity increased" : "Cart quantity updated");
    } catch (e: any) {
      showAppAlert(
        "Cart update failed",
        e?.response?.data?.message || "Couldn't update the cart quantity. Please try again.",
        "error",
      );
    } finally {
      setBusyId("");
    }
  };

  const cartCount = Object.values(quantities).reduce((sum, n) => sum + n, 0);
  const sortLabels: Record<SortMode, string> = {
    trending: "Recommended",
    priceLow: "Price: Low to High",
    priceHigh: "Price: High to Low",
    discount: "Biggest Discount",
    rating: "Top Rated",
  };

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const id = idOf(item);
    const price = priceOf(item);
    const original = originalOf(item);
    const discount = discountOf(item);
    const rating = ratingOf(item);
    const qty = quantities[id] || 0;
    const stock = stockOf(item);
    const out = stock !== null && stock <= 0;
    const saved = wishlistIds.includes(id);
    const uri = imageOf(item);
    const productImages = imageListOf(item);
    const reviews = Number(item.reviewCount ?? item.numReviews ?? 0);

    return (
      <View style={s.card}>
        <Pressable
          style={s.imageArea}
          onPress={() => openProduct(item)}
          accessibilityRole="button"
          accessibilityLabel={`View ${nameOf(item)}`}
        >
          <ProductImageCarousel
            images={productImages}
            fallback={uri}
            productName={nameOf(item)}
          />

          {discount > 0 ? (
            <View style={s.discount}>
              <Ionicons name="pricetag" size={10} color="#FFFFFF" />
              <Text style={s.discountText}>{discount}% OFF</Text>
            </View>
          ) : null}

          {index < 3 ? (
            <View style={s.hot}>
              <Ionicons name="flame" size={11} color="#EA580C" />
              <Text style={s.hotText}>TRENDING</Text>
            </View>
          ) : null}
        </Pressable>

        <Pressable
          style={s.heart}
          onPress={() => toggleWishlist(item)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? "Remove from wishlist" : "Add to wishlist"}
          accessibilityState={{ selected: saved }}
        >
          {wishBusyId === id ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <Ionicons
              name={saved ? "heart" : "heart-outline"}
              size={19}
              color={saved ? "#EF4444" : "#555B70"}
            />
          )}
        </Pressable>

        <View style={s.info}>
          <View style={s.categoryRow}>
            <Text numberOfLines={1} style={s.category}>
              {categoryOf(item)}
            </Text>
            {rating > 0 ? (
              <View style={s.rating}>
                <Ionicons name="star" size={11} color="#F59E0B" />
                <Text style={s.ratingText}>{rating.toFixed(1)}</Text>
                {reviews > 0 ? (
                  <Text style={s.reviews}>({reviews})</Text>
                ) : null}
              </View>
            ) : (
              <View style={s.newTag}>
                <Text style={s.newTagText}>NEW</Text>
              </View>
            )}
          </View>

          <Pressable onPress={() => openProduct(item)} hitSlop={3}>
            <Text numberOfLines={2} style={s.name}>
              {nameOf(item)}
            </Text>
          </Pressable>

          <View style={s.priceRow}>
            <Text style={s.price}>{money(price)}</Text>
            {original > price ? (
              <Text style={s.original}>{money(original)}</Text>
            ) : null}
          </View>


        </View>
      </View>
    );
  };

  if (loading)
    return (
      <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
        <StatusBar hidden={false} translucent={false} barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={s.stickyTopBar}>
          <View style={s.top}>
            <View style={s.skeletonBack} />
            <View style={s.skeletonHeaderTitle} />
            <View style={s.skeletonCart} />
          </View>
        </View>
        <View style={s.skeletonHeader}>
          <View style={s.skeletonSubtitle} />
          <View style={s.skeletonHero}>
            <View style={s.skeletonHeroText}>
              <View style={s.skeletonPill} />
              <View style={s.skeletonHeroLine} />
              <View style={[s.skeletonHeroLine, { width: "62%" }]} />
              <View style={s.skeletonHeroCaption} />
              <View style={[s.skeletonHeroCaption, { width: "65%" }]} />
            </View>
            <View style={s.skeletonHeroArtwork} />
          </View>
        </View>
        <View style={s.skeletonSection}>
          <View>
            <View style={s.skeletonSectionTitle} />
            <View style={s.skeletonSectionSub} />
          </View>
          <View style={s.skeletonSort} />
        </View>
        <View style={s.skeletonChips}>
          {[76, 88, 72, 82].map((width, index) => (
            <View key={index} style={[s.skeletonChip, { width }]} />
          ))}
        </View>
        <View style={s.skeletonGrid}>
          {[0, 1].map((row) => (
            <View key={row} style={s.skeletonRow}>
              {[0, 1].map((col) => (
                <View key={col} style={s.skeletonCard}>
                  <View style={s.skeletonImageWrap}>
                    <View style={s.skeletonSquareImage} />
                    <View style={s.skeletonDiscount} />
                    <View style={s.skeletonHeart} />
                    <View style={s.skeletonTrending} />
                  </View>
                  <View style={s.skeletonCardInfo}>
                    <View style={s.skeletonMetaRow}>
                      <View style={s.skeletonCategory} />
                      <View style={s.skeletonRating} />
                    </View>
                    <View style={s.skeletonProductName} />
                    <View style={[s.skeletonProductName, { width: "68%" }]} />
                    <View style={s.skeletonPrice} />
                    <View style={s.skeletonAddButton} />
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <StatusBar hidden={false} translucent={false} barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.stickyTopBar}>
        <View style={s.top}>
          <Pressable onPress={() => router.back()} style={s.back}>
            <Ionicons name="arrow-back" size={21} color="#3730A3" />
          </Pressable>
          <Text style={s.headerTitle}>Trending Products</Text>
          <Pressable
            onPress={() => router.push("/cart" as any)}
            style={s.cart}
          >
            <Ionicons name="cart-outline" size={21} color="#3730A3" />
            {cartCount > 0 && (
              <View style={s.cartBadge}>
                <Text style={s.cartBadgeText}>
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <FlatList
        style={s.pageContent}
        data={visibleProducts}
        keyExtractor={(item, i) => idOf(item) || `trending-${i}`}
        renderItem={renderProduct}
        numColumns={2}
        columnWrapperStyle={s.row}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadTrending(true)}
            tintColor="#4F46E5"
            colors={["#4F46E5"]}
          />
        }
        ListHeaderComponent={
          <>
            <View style={s.header}>
              <Text style={s.subtitle}>Discover what everyone is loving</Text>
              <View style={s.hero}>
                <View style={s.bannerGlowOne} />
                <View style={s.bannerGlowTwo} />
                <View style={s.heroContent}>
                  <View style={s.bannerPill}>
                    <Ionicons name="flash" size={11} color="#FDE68A" />
                    <Text style={s.eyebrow}>ODIKART • TRENDING PICKS</Text>
                  </View>
                  <Text style={s.heroTitle}>What's hot right now?</Text>
                  <Text style={s.heroCaption}>
                    Fresh finds and shopper favourites, all in one place.
                  </Text>
                  <View style={s.bannerFoot}>
                    <View style={s.bannerDot} />
                    <Text style={s.bannerFootText}>Discover something you’ll love</Text>
                  </View>
                </View>
                <View style={s.heroArtwork}>
                  <View style={s.artworkCircle}>
                    <Ionicons name="flame" size={43} color="#6D28D9" />
                  </View>
                  <View style={s.artworkSparkle}>
                    <Ionicons name="sparkles" size={18} color="#7C3AED" />
                  </View>
                  <View style={s.artworkMini}>
                    <Ionicons name="trending-up" size={18} color="#4F46E5" />
                  </View>
                </View>
              </View>
            </View>
            <View style={s.section}>
              <View>
                <Text style={s.sectionTitle}>Trending now</Text>
                <Text style={s.sectionSub}>
                  {products.length} products people are checking out
                </Text>
              </View>
              <Pressable
                style={s.sortButton}
                onPress={() => setSortOpen((v) => !v)}
              >
                <Ionicons name="swap-vertical" size={15} color="#4F46E5" />
                <Text style={s.sortText}>Sort</Text>
              </Pressable>
            </View>
            {sortOpen && (
              <View style={s.sortPanel}>
                {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                  <Pressable
                    key={mode}
                    style={s.sortOption}
                    onPress={() => {
                      setSort(mode);
                      setSortOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        s.sortOptionText,
                        sort === mode && s.sortSelected,
                      ]}
                    >
                      {sortLabels[mode]}
                    </Text>
                    {sort === mode && (
                      <Ionicons name="checkmark" size={17} color="#4F46E5" />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
            {categories.length > 1 && (
              <FlatList
                horizontal
                data={categories}
                keyExtractor={(v) => v}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.chips}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => setCategory(item)}
                    style={[s.chip, category === item && s.chipActive]}
                  >
                    <Text
                      style={[
                        s.chipText,
                        category === item && s.chipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            {!!error && (
              <View style={s.error}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={25}
                  color="#DC2626"
                />
                <Text style={s.errorText}>{error}</Text>
                <Pressable onPress={() => loadTrending()} style={s.retry}>
                  <Text style={s.retryText}>Try again</Text>
                </Pressable>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          !error ? (
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="flame-outline" size={36} color="#6D28D9" />
              </View>
              <Text style={s.emptyTitle}>No trending products yet</Text>
              <Text style={s.emptySub}>
                Check back soon. New popular picks will appear here.
              </Text>
              <Pressable onPress={() => loadTrending(true)} style={s.refresh}>
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={s.refreshText}>Refresh</Text>
              </Pressable>
            </View>
          ) : null
        }
        ListFooterComponent={<View style={{ height: 28 }} />}
      />
      <Modal
        visible={!!appAlert}
        transparent
        animationType="fade"
        statusBarTranslucent={false}
        onRequestClose={() => setAppAlert(null)}
      >
        <View style={s.alertBackdrop}>
          <View style={s.alertCard}>
            <View
              style={[
                s.alertIconWrap,
                appAlert?.type === "error" && s.alertIconError,
                appAlert?.type === "success" && s.alertIconSuccess,
              ]}
            >
              <Ionicons
                name={
                  appAlert?.type === "error"
                    ? "alert-circle"
                    : appAlert?.type === "success"
                      ? "checkmark-circle"
                      : "information-circle"
                }
                size={29}
                color={
                  appAlert?.type === "error"
                    ? "#DC2626"
                    : appAlert?.type === "success"
                      ? "#059669"
                      : "#4F46E5"
                }
              />
            </View>
            <Text style={s.alertTitle}>{appAlert?.title}</Text>
            <Text style={s.alertMessage}>{appAlert?.message}</Text>
            <Pressable style={s.alertButton} onPress={() => setAppAlert(null)}>
              <Text style={s.alertButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  alertBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 16, 43, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  alertCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 20,
    alignItems: "center",
    elevation: 16,
    shadowColor: "#17152B",
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
  },
  alertIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "#EEEEFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  alertIconError: { backgroundColor: "#FEF2F2" },
  alertIconSuccess: { backgroundColor: "#ECFDF5" },
  alertTitle: {
    color: "#211E3A",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  alertMessage: {
    color: "#73778A",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
  },
  alertButton: {
    width: "100%",
    height: 46,
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 21,
  },
  alertButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  // Indigo behind the protected status-bar inset; page content starts below it.
  safe: { flex: 1, backgroundColor: "#FFFFFF" },
  stickyTopBar: {
    zIndex: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEFF5",
  },
  pageContent: {
    flex: 1,
    backgroundColor: "#F7F8FC",
    marginBottom: 39,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  top: {
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F3F1FF",
    borderWidth: 1,
    borderColor: "#E9E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#19172B", fontSize: 18, fontWeight: "900", letterSpacing: -0.35 },
  cart: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#F3F1FF",
    borderWidth: 1,
    borderColor: "#E9E5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    right: -4,
    top: -5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: "#F97316",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  subtitle: {
    color: "#858397",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 3,
    marginLeft: 53,
  },
  hero: {
    marginTop: 18,
    minHeight: 184,
    borderRadius: 24,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    backgroundColor: "#F1EEFF",
    borderWidth: 1,
    borderColor: "#E7E1FF",
  },
  bannerGlowOne: {
    position: "absolute", width: 190, height: 190, borderRadius: 95,
    right: -48, top: -85, backgroundColor: "rgba(139,92,246,0.09)",
  },
  bannerGlowTwo: {
    position: "absolute", width: 130, height: 130, borderRadius: 65,
    right: 40, bottom: -95, backgroundColor: "rgba(99,102,241,0.10)",
  },
  heroContent: { flex: 1, paddingRight: 5, zIndex: 1 },
  bannerPill: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center",
    gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    backgroundColor: "#E5DEFF",
  },
  eyebrow: { color: "#5B45B5", fontSize: 8, fontWeight: "900", letterSpacing: 1.05 },
  heroTitle: {
    color: "#211A45", fontSize: 27, lineHeight: 31, fontWeight: "900",
    marginTop: 12, letterSpacing: -0.6,
  },
  heroCaption: {
    color: "#6F6A87", fontSize: 11, lineHeight: 16,
    marginTop: 8, maxWidth: 205,
  },
  bannerFoot: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 13 },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#8B5CF6" },
  bannerFootText: { color: "#6D5AA8", fontSize: 9, fontWeight: "700" },
  heroArtwork: { width: 105, height: 132, alignItems: "center", justifyContent: "center", zIndex: 1 },
  artworkCircle: {
    width: 82, height: 82, borderRadius: 28,
    backgroundColor: "#FFFFFF", borderWidth: 1,
    borderColor: "#DDD4FF", alignItems: "center",
    justifyContent: "center", transform: [{ rotate: "8deg" }],
    elevation: 5, shadowColor: "#6D28D9", shadowOpacity: 0.10,
    shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  artworkSparkle: {
    position: "absolute", top: 4, right: 2, width: 34, height: 34,
    borderRadius: 17, backgroundColor: "#E5DEFF",
    alignItems: "center", justifyContent: "center",
  },
  artworkMini: {
    position: "absolute", bottom: 4, left: 2, width: 36, height: 36,
    borderRadius: 13, backgroundColor: "#FFFFFF", alignItems: "center",
    justifyContent: "center", elevation: 4,
  },
  list: { paddingBottom: 12 },
  section: {
    paddingHorizontal: 17,
    paddingTop: 22,
    paddingBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: "#19172B", fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  sectionSub: { color: "#8B899B", fontSize: 11, marginTop: 5 },
  sortButton: {
    height: 35,
    borderRadius: 11,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFEEFF",
    borderWidth: 1,
    borderColor: "#E4E1FF",
  },
  sortText: { color: "#4F46E5", fontSize: 11, fontWeight: "800" },
  sortPanel: {
    marginHorizontal: 17,
    marginBottom: 12,
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ECECF4",
  },
  sortOption: {
    minHeight: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EEEEF4",
  },
  sortOptionText: { color: "#5B6070", fontSize: 12, fontWeight: "600" },
  sortSelected: { color: "#4F46E5", fontWeight: "800" },
  chips: { paddingHorizontal: 17, paddingBottom: 15, gap: 8 },
  chip: {
    paddingHorizontal: 15,
    height: 34,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E9E9F1",
  },
  chipActive: { backgroundColor: "#4F46E5", borderColor: "#4F46E5" },
  chipText: { color: "#626779", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  row: {
    paddingHorizontal: 15,
    gap: 10,
    marginBottom: 16,
    alignItems: "stretch",
  },
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E6E8F2",
    elevation: 3,
    shadowColor: "#241C85",
    shadowOpacity: 0.07,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
  },
  imageArea: {
    width: "100%",
    aspectRatio: 1.32,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  carouselWrap: {
    // Use normal layout sizing inside imageArea. An absolutely-filled child
    // can report 0x0 on some Android layouts and leave the loader visible.
    width: "100%",
    height: "100%",
    overflow: "hidden",
  },

  carouselDots: {
    position: "absolute",
    bottom: 7,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  carouselDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#C7C8D4",
  },
  carouselDotActive: {
    width: 13,
    backgroundColor: "#4F46E5",
  },
  noImage: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  noImageText: {
    color: "#9699AA",
    fontSize: 10,
    fontWeight: "600",
  },
  discount: {
    position: "absolute",
    left: 9,
    top: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#E11D48",
  },
  discountText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  hot: {
    position: "absolute",
    left: 9,
    bottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#FFF1E8",
  },
  hotText: {
    color: "#C2410C",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.35,
  },
  heart: {
    position: "absolute",
    right: 9,
    top: 9,
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.97)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#17152B",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  info: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  categoryRow: {
    minHeight: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
  },
  category: {
    flex: 1,
    color: "#85899B",
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },
  newTag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#EEF2FF",
  },
  newTagText: {
    color: "#4F46E5",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  name: {
    color: "#24213A",
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "800",
    marginTop: 5,
    minHeight: 34,
    letterSpacing: -0.1,
  },
  rating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  ratingText: {
    color: "#4D5265",
    fontSize: 9,
    fontWeight: "800",
  },
  reviews: {
    color: "#9A9EAB",
    fontSize: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
    minHeight: 21,
  },
  price: {
    color: "#19152F",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.45,
  },
  original: {
    color: "#A1A4AE",
    fontSize: 11,
    fontWeight: "600",
    textDecorationLine: "line-through",
  },
  add: {
    height: 30,
    borderRadius: 10,
    marginTop: 7,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    elevation: 2,
    shadowColor: "#4F46E5",
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  addBusy: {
    opacity: 0.75,
  },
  addText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.25,
  },
  qty: {
    height: 30,
    marginTop: 7,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 5,
  },
  qtyButton: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "900",
  },
  out: {
    height: 30,
    marginTop: 7,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  outText: {
    color: "#B91C1C",
    fontSize: 9,
    fontWeight: "800",
  },
  skeletonHeader: {
    paddingHorizontal: 18,
    paddingTop: 7,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  skeletonBack: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#ECECF3" },
  skeletonCart: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#ECECF3" },
  skeletonHeaderTitle: { width: 142, height: 17, borderRadius: 8, backgroundColor: "#E9E9F0" },
  skeletonSubtitle: { width: 190, height: 10, borderRadius: 6, backgroundColor: "#EEEEF3", marginTop: 9, marginLeft: 53 },
  skeletonHero: {
    marginTop: 18, minHeight: 184, borderRadius: 20, padding: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#F0EFF6",
  },
  skeletonHeroText: { flex: 1, gap: 10 },
  skeletonPill: { width: 118, height: 19, borderRadius: 10, backgroundColor: "#E1DFEA" },
  skeletonHeroLine: { width: "78%", height: 19, borderRadius: 7, backgroundColor: "#DFDDE8" },
  skeletonHeroCaption: { width: "88%", height: 8, borderRadius: 5, backgroundColor: "#E3E1EA" },
  skeletonHeroArtwork: { width: 76, height: 76, borderRadius: 24, backgroundColor: "#E1DFEA", marginLeft: 8 },
  skeletonSection: {
    paddingHorizontal: 17, paddingTop: 22, paddingBottom: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  skeletonSectionTitle: { width: 120, height: 19, borderRadius: 7, backgroundColor: "#E6E6ED" },
  skeletonSectionSub: { width: 165, height: 9, borderRadius: 5, backgroundColor: "#EEEEF2", marginTop: 7 },
  skeletonSort: { width: 66, height: 35, borderRadius: 11, backgroundColor: "#ECEBF4" },
  skeletonChips: { flexDirection: "row", paddingHorizontal: 17, paddingBottom: 15, gap: 8 },
  skeletonChip: { height: 34, borderRadius: 18, backgroundColor: "#EAEAF0" },
  skeletonGrid: {
    paddingHorizontal: 15,
    gap: 16,
  },
  skeletonRow: {
    flexDirection: "row",
    gap: 10,
  },
  skeletonCard: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEEEF3",
  },
  skeletonImageWrap: {
    width: "100%",
    aspectRatio: 1.32,
    backgroundColor: "#ECECF2",
    overflow: "hidden",
  },
  skeletonSquareImage: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ECECF2",
  },
  skeletonDiscount: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 43,
    height: 17,
    borderRadius: 6,
    backgroundColor: "#DEDEE8",
  },
  skeletonHeart: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#DEDEE8",
  },
  skeletonTrending: {
    position: "absolute",
    left: 8,
    bottom: 8,
    width: 58,
    height: 16,
    borderRadius: 6,
    backgroundColor: "#DEDEE8",
  },
  skeletonCardInfo: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 7,
  },
  skeletonMetaRow: {
    minHeight: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  skeletonCategory: {
    width: "38%",
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EAEAF0",
  },
  skeletonRating: {
    width: 30,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#EAEAF0",
  },
  skeletonProductName: {
    width: "92%",
    height: 11,
    borderRadius: 5,
    backgroundColor: "#EAEAF0",
  },
  skeletonPrice: {
    width: "43%",
    height: 16,
    borderRadius: 5,
    backgroundColor: "#E4E4EC",
    marginTop: 1,
  },
  skeletonAddButton: {
    width: "100%",
    height: 30,
    borderRadius: 10,
    backgroundColor: "#E8E7F2",
    marginTop: 1,
  },
  loading: { flex: 1, backgroundColor: "#F7F8FC", alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#777D8F", fontSize: 12, fontWeight: "600" },
  error: {
    margin: 18,
    padding: 18,
    borderRadius: 15,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    gap: 9,
  },
  errorText: { color: "#991B1B", fontSize: 12, textAlign: "center" },
  retry: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 9,
  },
  retryText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  empty: { paddingHorizontal: 35, paddingVertical: 50, alignItems: "center" },
  emptyIcon: {
    width: 75,
    height: 75,
    borderRadius: 25,
    backgroundColor: "#EFEEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#24243A",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 15,
  },
  emptySub: {
    color: "#8B90A0",
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 6,
  },
  refresh: {
    marginTop: 16,
    borderRadius: 10,
    backgroundColor: "#4F46E5",
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
