import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import api from "../../api/api";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

const getProductCacheKey = (productId: string) =>
  `odikart:product-details:v1:${productId}`;

// Module-level cache makes revisiting a product instant during the same app session.
const productDetailsMemoryCache = new Map<string, Product>();

/* =========================================================
   SHARED NATIVE TOAST
   Android uses the same native toast style as "Press again to exit".
   iOS has no built-in ToastAndroid equivalent, so it uses an alert.
========================================================= */

const showNativeToast = (message: string, title = "OdiKart") => {
  const cleanMessage = String(message || "").trim();
  if (!cleanMessage) return;

  if (Platform.OS === "android") {
    ToastAndroid.show(cleanMessage, ToastAndroid.SHORT);
  } else {
    Alert.alert(title, cleanMessage);
  }
};

/* =========================================================
   SCREEN SIZE
========================================================= */

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

/* =========================================================
   REVIEW API ROUTES

   If your Express routes use different paths, change ONLY
   these three functions.
========================================================= */

const getAddReviewUrl = (productId: string) => `/products/${productId}/review`;

const getLikeReviewUrl = (productId: string, reviewId: string) =>
  `/products/${productId}/review/${reviewId}/like`;

const getDeleteReviewUrl = (productId: string, reviewId: string) =>
  `/products/${productId}/review/${reviewId}`;

/* =========================================================
   TYPES
========================================================= */

type Variant = {
  _id?: string;

  sku?: string;

  attributes?: {
    [key: string]: string | undefined;
  };

  price?: number;

  originalPrice?: number;

  discountPercentage?: number;

  tax?: number;

  stock?: number;

  images?: string[];

  isActive?: boolean;
};

type CategoryData = {
  _id?: string;

  name?: string;

  slug?: string;
};

type SellerData = {
  _id?: string;

  firstName?: string;

  lastName?: string;

  name?: string;

  image?: string;

  sellerInfo?: {
    store?: string;
  };
};

type ProductReview = {
  _id?: string;

  id?: string;

  user?: any;

  rating?: number;

  comment?: string;

  review?: string;

  reviewerName?: string;

  reviewerImage?: string;

  verifiedPurchase?: boolean;

  likes?: string[];

  likesCount?: number;

  images?: string[];

  videos?: string[];

  createdAt?: string;

  updatedAt?: string;
};

type Product = {
  _id: string;

  title: string;

  description?: string;

  shortDescription?: string;

  brand?: string;

  productType?: string;

  currency?: string;

  variants?: Variant[];

  media?: {
    thumbnail?: string;

    images?: string[];

    videos?: string[];
  };

  rating?: number;

  numReviews?: number;

  reviews?: ProductReview[];

  minimumOrderQuantity?: number;

  maximumOrderQuantity?: number;

  badges?: string[];

  featured?: boolean;

  trending?: boolean;

  bestSeller?: boolean;

  isNewArrival?: boolean;

  isPopular?: boolean;

  isLowStock?: boolean;

  material?: string;

  warrantyInformation?: string;

  returnPolicy?: string;

  shippingInformation?: string;

  shipping?: {
    freeShipping?: boolean;

    shippingCharge?: number;

    processingTime?: number;

    returnDays?: number;

    serviceablePincodes?: string[];
  };

  category?: CategoryData | string;

  subCategory?: CategoryData | string;

  categoryData?: CategoryData;

  subCategoryData?: CategoryData;

  seller?: SellerData | string;
};

/* =========================================================
   HELPERS
========================================================= */

const getMongoId = (value: any): string => {
  if (!value) return "";

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value.$oid) {
    return String(value.$oid);
  }

  if (typeof value === "object" && value._id) {
    return getMongoId(value._id);
  }

  return "";
};

const formatPrice = (value: number) => {
  return `₹${Number(value || 0).toLocaleString("en-IN")}`;
};

const formatDate = (date?: string) => {
  if (!date) return "";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getAttributeLabel = (value: string) => {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
};

const getReviewName = (review: ProductReview) => {
  if (review.reviewerName) {
    return review.reviewerName;
  }

  if (review.user?.name) {
    return review.user.name;
  }

  const fullName = `${review.user?.firstName || ""} ${
    review.user?.lastName || ""
  }`.trim();

  return fullName || "OdiKart Customer";
};

const getReviewText = (review: ProductReview) => {
  return review.comment || review.review || "";
};

const getReviewId = (review: ProductReview) => {
  return getMongoId(review._id || review.id);
};
const getSellerDisplayName = (seller: any) => {
  if (!seller) {
    return "OdiKart Seller";
  }

  // shopName can be a string
  const shopName = seller.sellerInfo?.shopName;

  if (typeof shopName === "string" && shopName.trim()) {
    return shopName.trim();
  }

  // shopName can also be:
  // { shopName: "My Shop" }
  if (
    shopName &&
    typeof shopName === "object" &&
    typeof shopName.shopName === "string" &&
    shopName.shopName.trim()
  ) {
    return shopName.shopName.trim();
  }

  // Existing backend store field
  const store = seller.sellerInfo?.store;

  if (typeof store === "string" && store.trim()) {
    return store.trim();
  }

  if (
    store &&
    typeof store === "object" &&
    typeof store.store === "string" &&
    store.store.trim()
  ) {
    return store.store.trim();
  }

  // Seller person's name
  const fullName = `${seller.firstName || ""} ${seller.lastName || ""}`.trim();

  if (fullName) {
    return fullName;
  }

  if (typeof seller.name === "string" && seller.name.trim()) {
    return seller.name.trim();
  }

  return "OdiKart Seller";
};
const getUserIdFromReview = (review: ProductReview) => {
  return getMongoId(review.user);
};

/* =========================================================
   STAR COMPONENT
========================================================= */

function Stars({
  rating,
  size = 18,
  interactive = false,
  onPress,
}: {
  rating: number;

  size?: number;

  interactive?: boolean;

  onPress?: (rating: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= rating;

        const content = (
          <Ionicons
            name={active ? "star" : "star-outline"}
            size={size}
            color={active ? colors.warning : colors.textMuted}
          />
        );

        if (interactive) {
          return (
            <Pressable key={star} onPress={() => onPress?.(star)} hitSlop={8}>
              {content}
            </Pressable>
          );
        }

        return <View key={star}>{content}</View>;
      })}
    </View>
  );
}

/* =========================================================
   IMAGE VIEWER
========================================================= */

function ZoomableViewerPage({
  image,
  active,
  onZoomChange,
}: {
  image: string;
  active: boolean;
  onZoomChange: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .enabled(active)
    .onUpdate((event) => {
      const next = Math.max(1, Math.min(savedScale.value * event.scale, 4));
      scale.value = next;
    })
    .onEnd(() => {
      const next = Math.max(1, Math.min(scale.value, 4));
      savedScale.value = next;
      scale.value = withSpring(next);
      runOnJS(onZoomChange)(next > 1);
      if (next === 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedX.value = 0;
        savedY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .enabled(active)
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = savedX.value + event.translationX;
      translateY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1) return;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .enabled(active)
    .onEnd(() => {
      if (savedScale.value > 1) {
        reset();
        runOnJS(onZoomChange)(false);
      } else {
        savedScale.value = 2.5;
        scale.value = withSpring(2.5);
        runOnJS(onZoomChange)(true);
      }
    });

  const gesture = Gesture.Simultaneous(
    Gesture.Simultaneous(pinch, pan),
    doubleTap,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.viewerImageWrapper, animatedStyle]}>
        <Image
          source={{ uri: image }}
          style={styles.viewerImage}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

function FullScreenImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
}: {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: SCREEN_WIDTH * initialIndex,
        animated: false,
      });
    }, 50);
  }, [visible, initialIndex]);

  if (!images.length) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Android Modal content needs its own gesture-handler root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.viewerContainer}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
            <Pressable style={styles.viewerIconButton} onPress={onClose}>
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>

            <Text style={styles.viewerCounter}>
              {currentIndex + 1} / {images.length}
            </Text>

            <View style={styles.viewerTouchHint}>
              <Ionicons name="hand-left-outline" size={17} color="#fff" />
              <Text style={styles.viewerTouchHintText}>Pinch & drag</Text>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            nestedScrollEnabled
            directionalLockEnabled
            // Prevent the image pager from stealing drag gestures while zoomed.
            scrollEnabled={!isZoomed}
            contentOffset={{ x: SCREEN_WIDTH * initialIndex, y: 0 }}
            onMomentumScrollEnd={(event) => {
              const index = Math.max(
                0,
                Math.min(
                  images.length - 1,
                  Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH),
                ),
              );
              setCurrentIndex(index);
              setIsZoomed(false);
            }}
            style={styles.viewerScroll}
          >
            {images.map((image, index) => (
              <View key={`${image}-${index}`} style={styles.viewerPage}>
                <ZoomableViewerPage
                  image={image}
                  active={index === currentIndex}
                  onZoomChange={setIsZoomed}
                />
              </View>
            ))}
          </ScrollView>

          {/* <View
          style={[
            styles.viewerFooter,
            { paddingBottom: insets.bottom + 14 },
          ]}
        >
          <Text style={styles.viewerHint}>
            Pinch to zoom • Drag to move • Double tap to zoom
          </Text>
          {images.length > 1 && (
            <Text style={styles.viewerSwipeHint}>
              Swipe left or right for more images
            </Text>
          )}
        </View> */}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/* =========================================================
   REVIEW MODAL
========================================================= */

function ReviewModal({
  visible,
  rating,
  comment,
  submitting,
  media,
  onClose,
  onRating,
  onComment,
  onPickMedia,
  onRemoveMedia,
  onSubmit,
}: {
  visible: boolean;
  rating: number;
  comment: string;
  submitting: boolean;
  media: ImagePicker.ImagePickerAsset[];
  onClose: () => void;
  onRating: (rating: number) => void;
  onComment: (comment: string) => void;
  onPickMedia: () => void;
  onRemoveMedia: (index: number) => void;
  onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[styles.reviewModal, { paddingBottom: insets.bottom + 18 }]}
        >
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Write a Review</Text>
              <Text style={styles.modalSubtitle}>
                Share your experience with other customers
              </Text>
            </View>

            <Pressable onPress={onClose} style={styles.modalClose}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          <Text style={styles.ratingQuestion}>How was this product?</Text>

          <Stars rating={rating} size={34} interactive onPress={onRating} />

          <Text style={styles.ratingLabel}>
            {rating === 0
              ? "Tap a star to rate"
              : rating === 5
                ? "Excellent"
                : rating === 4
                  ? "Very good"
                  : rating === 3
                    ? "Good"
                    : rating === 2
                      ? "Could be better"
                      : "Poor"}
          </Text>

          <Text style={styles.inputLabel}>Your review</Text>

          <TextInput
            value={comment}
            onChangeText={onComment}
            placeholder="Tell other customers about this product..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            style={styles.reviewInput}
          />

          <Text style={styles.characterCount}>{comment.length}/1000</Text>

          <View style={styles.mediaActionRow}>
            <Pressable
              style={styles.mediaAddButton}
              onPress={onPickMedia}
              disabled={submitting}
            >
              <View style={styles.mediaAddIcon}>
                <Ionicons
                  name="images-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View style={styles.mediaAddTextWrap}>
                <Text style={styles.mediaAddTitle}>Add photos & video</Text>
                <Text style={styles.mediaAddSubtitle}>
                  Share product images or a short video
                </Text>
              </View>
              <Ionicons
                name="add-circle-outline"
                size={23}
                color={colors.primary}
              />
            </Pressable>
          </View>

          {media.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedMediaList}
            >
              {media.map((item, index) => {
                const isVideo = item.type === "video";
                return (
                  <View
                    key={`${item.uri}-${index}`}
                    style={styles.selectedMedia}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      style={styles.selectedMediaImage}
                      resizeMode="cover"
                    />

                    {isVideo && (
                      <View style={styles.selectedVideoBadge}>
                        <Ionicons name="play" size={14} color="#fff" />
                      </View>
                    )}

                    <Pressable
                      style={styles.removeMediaButton}
                      onPress={() => onRemoveMedia(index)}
                    >
                      <Ionicons name="close" size={15} color="#fff" />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            style={[
              styles.submitReviewButton,
              (!rating || comment.trim().length < 3 || submitting) &&
                styles.disabledButton,
            ]}
            disabled={!rating || comment.trim().length < 3 || submitting}
            onPress={onSubmit}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={19} color="#fff" />
                <Text style={styles.submitReviewText}>Submit Review</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* =========================================================
   PRODUCT DETAILS SKELETON
========================================================= */

function ProductDetailsSkeleton() {
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0.55);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 750 }), -1, true);

    return () => {
      opacity.value = 0.55;
    };
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const SkeletonBlock = ({ style }: { style?: any }) => (
    <Animated.View style={[styles.skeletonBlock, animatedStyle, style]} />
  );

  const SkeletonCircle = ({
    size = 42,
    style,
  }: {
    size?: number;
    style?: any;
  }) => (
    <Animated.View
      style={[
        styles.skeletonCircle,
        animatedStyle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      {/* White safe-area header keeps the product image below the system area. */}
      <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120 + insets.bottom,
        }}
      >
        {/* Image gallery skeleton */}
        <View style={styles.imageSection}>
          <View style={styles.mainGalleryFrame}>
            <SkeletonBlock style={styles.skeletonMainImage} />

            <View style={styles.skeletonImageBadge}>
              <SkeletonBlock style={styles.skeletonBadgeLine} />
            </View>

            <View style={styles.skeletonCountBadge}>
              <SkeletonBlock style={styles.skeletonCountLine} />
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
          >
            {[1, 2, 3, 4, 5].map((item) => (
              <SkeletonBlock key={item} style={styles.skeletonThumbnail} />
            ))}
          </ScrollView>
        </View>

        {/* Product information skeleton */}
        <View style={styles.contentCard}>
          <View style={styles.skeletonBadgeRow}>
            <SkeletonBlock style={styles.skeletonSmallBadge} />
            <SkeletonBlock style={[styles.skeletonSmallBadge, { width: 78 }]} />
          </View>

          <SkeletonBlock style={styles.skeletonProductTitle} />
          <SkeletonBlock
            style={[
              styles.skeletonProductTitle,
              { width: "72%", marginTop: 9 },
            ]}
          />

          <View style={styles.skeletonRatingRow}>
            <SkeletonBlock style={styles.skeletonRating} />
            <SkeletonBlock style={styles.skeletonReviewCount} />
          </View>

          <View style={styles.skeletonDivider} />

          <SkeletonBlock style={styles.skeletonPrice} />
          <SkeletonBlock style={styles.skeletonPriceSub} />

          <View style={styles.skeletonInfoBox}>
            <SkeletonCircle size={34} style={{ borderRadius: 10 }} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <SkeletonBlock style={styles.skeletonInfoTitle} />
              <SkeletonBlock
                style={[styles.skeletonInfoText, { width: "68%" }]}
              />
            </View>
          </View>

          {/* Variant selector skeleton */}
          <SkeletonBlock style={styles.skeletonSectionTitle} />

          <View style={styles.skeletonOptionRow}>
            {[1, 2, 3, 4].map((item) => (
              <SkeletonBlock
                key={item}
                style={[
                  styles.skeletonOption,
                  item === 1 && styles.skeletonOptionActive,
                ]}
              />
            ))}
          </View>

          {/* Quantity skeleton */}
          <SkeletonBlock
            style={[styles.skeletonSectionTitle, { width: 100 }]}
          />

          <View style={styles.skeletonQuantity}>
            <SkeletonCircle size={34} style={{ borderRadius: 9 }} />
            <SkeletonBlock style={styles.skeletonQuantityValue} />
            <SkeletonCircle size={34} style={{ borderRadius: 9 }} />
          </View>

          {/* Delivery / seller / details */}
          <View style={styles.skeletonFeatureList}>
            {[1, 2, 3].map((item) => (
              <View key={item} style={styles.skeletonFeatureRow}>
                <SkeletonCircle size={34} style={{ borderRadius: 10 }} />
                <View
                  style={{
                    flex: 1,
                    marginLeft: 10,
                  }}
                >
                  <SkeletonBlock style={styles.skeletonFeatureTitle} />
                  <SkeletonBlock
                    style={[
                      styles.skeletonFeatureText,
                      {
                        width: item === 1 ? "74%" : item === 2 ? "58%" : "66%",
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Description skeleton */}
        <View style={styles.skeletonSectionCard}>
          <SkeletonBlock style={styles.skeletonCardTitle} />
          <SkeletonBlock style={styles.skeletonParagraph} />
          <SkeletonBlock style={[styles.skeletonParagraph, { width: "92%" }]} />
          <SkeletonBlock style={[styles.skeletonParagraph, { width: "78%" }]} />
        </View>

        {/* Reviews skeleton */}
        <View style={styles.skeletonSectionCard}>
          <View style={styles.skeletonReviewHeader}>
            <SkeletonBlock style={styles.skeletonCardTitle} />
            <SkeletonBlock style={styles.skeletonReviewButton} />
          </View>

          <View style={styles.skeletonReviewSummary}>
            <SkeletonBlock style={styles.skeletonBigRating} />
            <View style={{ flex: 1, marginLeft: 16 }}>
              {[1, 2, 3].map((item) => (
                <View key={item} style={styles.skeletonDistributionRow}>
                  <SkeletonBlock style={styles.skeletonDistributionStar} />
                  <SkeletonBlock style={styles.skeletonDistributionBar} />
                </View>
              ))}
            </View>
          </View>

          {[1, 2].map((item) => (
            <View key={item} style={styles.skeletonReviewCard}>
              <View style={styles.skeletonReviewerRow}>
                <SkeletonCircle size={38} />
                <View
                  style={{
                    flex: 1,
                    marginLeft: 10,
                  }}
                >
                  <SkeletonBlock style={styles.skeletonReviewerName} />
                  <SkeletonBlock style={styles.skeletonReviewerStars} />
                </View>
              </View>
              <SkeletonBlock style={styles.skeletonReviewLine} />
              <SkeletonBlock
                style={[styles.skeletonReviewLine, { width: "76%" }]}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom action skeleton */}
      <View
        style={[
          styles.skeletonBottomBar,
          {
            paddingBottom: Math.max(12, insets.bottom + 8),
          },
        ]}
      >
        <SkeletonBlock style={styles.skeletonCartButton} />
        <SkeletonBlock style={styles.skeletonBuyButton} />
      </View>
    </View>
  );
}

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function ProductDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const insets = useSafeAreaInsets();

  const { user, isAuthenticated } = useAuth();

  // Soft animated shine for the purchase actions.
  const purchaseShine = useSharedValue(0.25);

  useEffect(() => {
    // A smooth left-to-right shine sweep instead of a distracting pulse.
    purchaseShine.value = withRepeat(
      withTiming(1, { duration: 1750 }),
      -1,
      false,
    );
    return () => {
      purchaseShine.value = 0;
    };
  }, [purchaseShine]);

  const purchaseShineStyle = useAnimatedStyle(() => ({
    opacity: purchaseShine.value < 0.12 || purchaseShine.value > 0.9 ? 0 : 0.8,
    transform: [
      { translateX: purchaseShine.value * (SCREEN_WIDTH * 0.72) - 100 },
    ],
  }));

  const [designedAlert, setDesignedAlert] = useState<{
    title: string;
    message: string;
    buttons: Array<{ text: string; style?: string; onPress?: () => void }>;
  } | null>(null);
  const showDesignedAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; style?: string; onPress?: () => void }>,
  ) => {
    setDesignedAlert({
      title,
      message,
      buttons: buttons?.length ? buttons : [{ text: "OK" }],
    });
  };

  const initialProductId = String(Array.isArray(id) ? id[0] : id || "").trim();
  const initialCachedProduct = productDetailsMemoryCache.get(initialProductId) || null;
  const [product, setProduct] = useState<Product | null>(initialCachedProduct);
  const productLoadRequest = useRef(0);

  const [loading, setLoading] = useState(!initialCachedProduct);

  const [error, setError] = useState("");

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);

  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string>
  >({});

  const [selectedImage, setSelectedImage] = useState(0);

  const [quantity, setQuantity] = useState(1);

  const [showCompactNavbar, setShowCompactNavbar] = useState(false);

  const [isWishlisted, setIsWishlisted] = useState(false);

  const [wishlistUpdating, setWishlistUpdating] = useState(false);

  const [addingToCart, setAddingToCart] = useState(false);

  // Quantity currently in the cart for the selected product variant.
  const [cartQuantity, setCartQuantity] = useState(0);
  const [cartVariantSku, setCartVariantSku] = useState("");
  const [cartUpdating, setCartUpdating] = useState(false);

  const [buyingNow, setBuyingNow] = useState(false);

  const [viewerVisible, setViewerVisible] = useState(false);

  const [reviewViewerVisible, setReviewViewerVisible] = useState(false);
  const [reviewViewerImages, setReviewViewerImages] = useState<string[]>([]);
  const [reviewViewerInitialIndex, setReviewViewerInitialIndex] = useState(0);

  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  const [reviewRating, setReviewRating] = useState(0);

  const [reviewComment, setReviewComment] = useState("");

  const [reviewMedia, setReviewMedia] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);

  const [submittingReview, setSubmittingReview] = useState(false);

  const [likingReviewId, setLikingReviewId] = useState("");

  const [deletingReviewId, setDeletingReviewId] = useState("");

  /* =====================================================
     LOAD PRODUCT
  ===================================================== */

  const loadProduct = useCallback(async () => {
    const productId = String(Array.isArray(id) ? id[0] : id || "").trim();

    if (!productId) {
      setError("Product details are unavailable.");
      setLoading(false);
      return;
    }

    const requestId = ++productLoadRequest.current;
    let productShown = false;

    const applyProductData = (productData: Product) => {
      if (requestId !== productLoadRequest.current) return;

      setError("");
      setProduct(productData);
      productShown = true;

      const variants = productData.variants || [];
      const activeVariant =
        variants.find((variant: Variant) => variant.isActive !== false) || null;

      setSelectedVariant(activeVariant);

      const initialOptions: Record<string, string> = {};
      Object.entries(activeVariant?.attributes || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          initialOptions[key] = String(value);
        }
      });

      setSelectedOptions(initialOptions);
      setQuantity(Math.max(1, Number(productData.minimumOrderQuantity || 1)));
      setSelectedImage(0);
      setLoading(false);
    };

    setError("");

    // Instant path: show an in-memory product before doing any asynchronous work.
    const memoryCached = productDetailsMemoryCache.get(productId);
    if (memoryCached?._id && String(memoryCached._id) === productId) {
      applyProductData(memoryCached);
    } else {
      setLoading(true);
    }

    // Start disk-cache hydration and the network request together. Previously,
    // waiting for AsyncStorage before starting the API request prolonged the skeleton.
    const diskCacheTask = (async () => {
      if (memoryCached) return;
      try {
        const cachedValue = await AsyncStorage.getItem(getProductCacheKey(productId));
        if (requestId !== productLoadRequest.current || !cachedValue) return;

        const cachedProduct = JSON.parse(cachedValue) as Product;
        if (cachedProduct?._id && String(cachedProduct._id) === productId) {
          productDetailsMemoryCache.set(productId, cachedProduct);
          // Avoid replacing fresher API data if the request already completed.
          if (!productShown) applyProductData(cachedProduct);
        }
      } catch (cacheError) {
        console.log("PRODUCT CACHE READ ERROR:", cacheError);
      }
    })();

    const apiTask = (async () => {
      try {
        const response = await api.get(`/products/${encodeURIComponent(productId)}`);
        if (requestId !== productLoadRequest.current) return;

        const data = response.data;
        const productData = data?.product || data?.data?.product || data?.data || data;

        if (!productData?._id || String(productData._id) !== productId) {
          throw new Error("Product not found.");
        }

        productDetailsMemoryCache.set(productId, productData);
        applyProductData(productData);

        // Persist in the background; never block the UI on disk writes.
        void AsyncStorage.setItem(
          getProductCacheKey(productId),
          JSON.stringify(productData),
        ).catch((cacheError) => {
          console.log("PRODUCT CACHE WRITE ERROR:", cacheError);
        });
      } catch (err: any) {
        if (requestId !== productLoadRequest.current) return;
        console.error("PRODUCT DETAILS ERROR:", err?.response?.data || err?.message || err);

        // Wait for disk cache before showing an error; it may still have a usable copy.
        await diskCacheTask;
        if (requestId !== productLoadRequest.current) return;

        if (!productShown) {
          setError("Unable to load product details. Check your connection and try again.");
          setLoading(false);
        }
      }
    })();

    await Promise.allSettled([diskCacheTask, apiTask]);
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  /* =====================================================
     WISHLIST STATUS
  ===================================================== */

  const loadWishlistStatus = useCallback(async () => {
    if (!id || !isAuthenticated) {
      setIsWishlisted(false);
      return;
    }

    try {
      const response = await api.get("/wishlist");
      const items =
        response.data?.items || response.data?.wishlist?.items || [];

      const exists =
        Array.isArray(items) &&
        items.some((item: any) => {
          const wishlistProductId =
            typeof item?.productId === "object"
              ? item.productId?._id || item.productId?.id
              : item?.productId;

          return String(wishlistProductId || "") === String(id);
        });

      setIsWishlisted(exists);
    } catch (error: any) {
      console.log(
        "WISHLIST STATUS ERROR:",
        error?.response?.data || error?.message || error,
      );

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setIsWishlisted(false);
      }
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    loadWishlistStatus();
  }, [loadWishlistStatus]);

  /* =====================================================
     TOGGLE WISHLIST
  ===================================================== */

  const handleWishlistToggle = async () => {
    if (!product || !id) return;

    if (!isAuthenticated) {
      showDesignedAlert(
        "Login required",
        "Please login to add products to your wishlist.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Login",
            onPress: () => router.push("/login-modal" as any),
          },
        ],
      );
      return;
    }

    if (wishlistUpdating) return;

    const previousValue = isWishlisted;
    setIsWishlisted(!previousValue);
    setWishlistUpdating(true);

    try {
      if (previousValue) {
        await api.delete("/wishlist/remove", {
          data: { productId: product._id },
        });

        console.log("WISHLIST REMOVED:", product._id);
      } else {
        await api.post("/wishlist/add", {
          productId: product._id,
        });

        console.log("WISHLIST ADDED:", product._id);
      }
    } catch (error: any) {
      setIsWishlisted(previousValue);

      console.error(
        "WISHLIST TOGGLE ERROR:",
        error?.response?.data || error?.message || error,
      );

      if (error?.response?.status === 401 || error?.response?.status === 403) {
        showDesignedAlert(
          "Login required",
          "Please login to update your wishlist.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Login",
              onPress: () => router.push("/login-modal" as any),
            },
          ],
        );
      } else if (error?.response?.status === 400 && !previousValue) {
        // Backend can return 400 when the product is already present.
        await loadWishlistStatus();
        showNativeToast(
          error?.response?.data?.message ||
            "This product is already in your wishlist.",
          "Wishlist",
        );
      } else {
        showNativeToast(
          error?.response?.data?.message ||
            "Could not update your wishlist. Please try again.",
          "Wishlist update failed",
        );
      }
    } finally {
      setWishlistUpdating(false);
    }
  };

  /* =====================================================
     ACTIVE VARIANTS
  ===================================================== */

  const activeVariants = useMemo(() => {
    return (
      product?.variants?.filter((variant) => variant.isActive !== false) || []
    );
  }, [product]);

  /* =====================================================
     ATTRIBUTE GROUPS

     Build attributes from ALL variants instead
     of only the selected variant.
  ===================================================== */

  const attributeGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};

    activeVariants.forEach((variant) => {
      Object.entries(variant.attributes || {}).forEach(([key, value]) => {
        if (value === undefined || value === "") {
          return;
        }

        if (!groups[key]) {
          groups[key] = [];
        }

        const stringValue = String(value);

        if (!groups[key].includes(stringValue)) {
          groups[key].push(stringValue);
        }
      });
    });

    return Object.entries(groups);
  }, [activeVariants]);

  /* =====================================================
     FIND VARIANT
  ===================================================== */

  const findMatchingVariant = useCallback(
    (selection: Record<string, string>) => {
      if (!activeVariants.length) {
        return null;
      }

      const exact = activeVariants.find((variant) => {
        return Object.entries(selection).every(
          ([key, value]) =>
            String(variant.attributes?.[key] ?? "") === String(value),
        );
      });

      return exact || null;
    },
    [activeVariants],
  );

  /* =====================================================
     SELECT ATTRIBUTE
  ===================================================== */

  const handleSelectOption = (key: string, value: string) => {
    const nextSelection = {
      ...selectedOptions,
      [key]: value,
    };

    const exactVariant = findMatchingVariant(nextSelection);

    if (exactVariant) {
      setSelectedOptions(nextSelection);

      setSelectedVariant(exactVariant);

      setSelectedImage(0);

      const minimum = Number(product?.minimumOrderQuantity || 1);

      setQuantity(minimum);

      return;
    }

    /*
     * If the current combination doesn't exist,
     * find a compatible variant containing the
     * newly selected option.
     */
    const compatible = activeVariants.find(
      (variant) => String(variant.attributes?.[key] ?? "") === String(value),
    );

    if (compatible) {
      const compatibleOptions: Record<string, string> = {};

      Object.entries(compatible.attributes || {}).forEach(
        ([attributeKey, attributeValue]) => {
          if (attributeValue !== undefined && attributeValue !== "") {
            compatibleOptions[attributeKey] = String(attributeValue);
          }
        },
      );

      setSelectedOptions(compatibleOptions);

      setSelectedVariant(compatible);

      setSelectedImage(0);

      const minimum = Number(product?.minimumOrderQuantity || 1);

      setQuantity(minimum);
    }
  };

  /* =====================================================
     IMAGES
  ===================================================== */

  const images = useMemo(() => {
    if (!product) return [];

    const allImages: string[] = [];

    const addUnique = (values?: string[]) => {
      values?.forEach((image) => {
        if (image && !allImages.includes(image)) {
          allImages.push(image);
        }
      });
    };

    /*
     * Selected variant images first so the
     * gallery changes when variant changes.
     */
    addUnique(selectedVariant?.images);

    addUnique(product.media?.images);

    if (
      product.media?.thumbnail &&
      !allImages.includes(product.media.thumbnail)
    ) {
      allImages.push(product.media.thumbnail);
    }

    /*
     * Add images from other active variants
     * as a fallback gallery.
     */
    activeVariants.forEach((variant) => {
      addUnique(variant.images);
    });

    return allImages;
  }, [product, selectedVariant, activeVariants]);

  useEffect(() => {
    if (selectedImage >= images.length && images.length) {
      setSelectedImage(0);
    }
  }, [images.length, selectedImage]);

  /* =====================================================
     PRICE / STOCK
  ===================================================== */

  const price = Number(selectedVariant?.price || 0);

  const originalPrice = Number(selectedVariant?.originalPrice || 0);

  const discount = Number(selectedVariant?.discountPercentage || 0);

  const stock = Number(selectedVariant?.stock || 0);

  const isOutOfStock = stock <= 0;

  const minimumOrderQuantity = Math.max(
    1,
    Number(product?.minimumOrderQuantity || 1),
  );

  const maximumOrderQuantity = Number(
    product?.maximumOrderQuantity || stock || 999,
  );

  /* =====================================================
     REVIEWS
  ===================================================== */

  const reviews = product?.reviews || [];

  const rating = Number(product?.rating || 0);

  const reviewCount = Number(product?.numReviews || reviews.length || 0);

  const ratingDistribution = useMemo(() => {
    return [5, 4, 3, 2, 1].map((star) => {
      const count = reviews.filter(
        (review) => Number(review.rating) === star,
      ).length;

      const percentage = reviewCount > 0 ? (count / reviewCount) * 100 : 0;

      return {
        star,
        count,
        percentage,
      };
    });
  }, [reviews, reviewCount]);

  /* =====================================================
     CHECK OWN REVIEW
  ===================================================== */

  const currentUserId = getMongoId(user?._id || user?.id || user?.userId);

  const hasOwnReview = reviews.some((review) => {
    return getUserIdFromReview(review) === currentUserId && currentUserId;
  });

  /* =====================================================
     LOAD EXISTING CART QUANTITY
     Keeps the stepper visible immediately when this product
     and selected variant are already in the user's cart.
  ===================================================== */

  const loadCartStatus = useCallback(async () => {
    if (!product?._id || !isAuthenticated) {
      setCartQuantity(0);
      setCartVariantSku("");
      return;
    }

    try {
      const response = await api.get("/cart");
      const items =
        response.data?.cart?.items ||
        response.data?.items ||
        response.data?.cart?.cartItems ||
        [];

      if (!Array.isArray(items)) return;

      const sku = selectedVariant?.sku || "";
      const matchingItem = items.find((item: any) => {
        const itemProductId = getMongoId(
          item.productId || item.product || item.product?._id,
        );
        const itemSku = String(item.variantSku || item.sku || "");
        return itemProductId === getMongoId(product._id) && itemSku === sku;
      });

      setCartVariantSku(matchingItem ? sku : "");
      setCartQuantity(Math.max(0, Number(matchingItem?.quantity) || 0));
    } catch (err: any) {
      console.log(
        "LOAD CART STATUS ERROR:",
        err?.response?.data || err?.message || err,
      );
    }
  }, [product?._id, selectedVariant?.sku, isAuthenticated]);

  useEffect(() => {
    loadCartStatus();
  }, [loadCartStatus]);

  /* =====================================================
     ADD TO CART
  ===================================================== */

  const handleAddToCart = async () => {
    if (!product) return;

    if (!isAuthenticated) {
      showDesignedAlert(
        "Login required",
        "Please login before adding products to your cart.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Login",
            onPress: () => router.push("/login-modal" as any),
          },
        ],
      );

      return;
    }

    if (isOutOfStock) {
      showNativeToast("This product is currently unavailable.", "Out of stock");

      return;
    }

    try {
      setAddingToCart(true);

      const image =
        selectedVariant?.images?.[0] ||
        product.media?.thumbnail ||
        product.media?.images?.[0] ||
        "";

      const addResponse = await api.post("/cart/add", {
        productId: product._id,
        variantSku: selectedVariant?.sku || "",
        quantity: Number(quantity),
        image,
      });

      const returnedItems =
        addResponse.data?.cart?.items || addResponse.data?.items || [];
      const matchingItem = Array.isArray(returnedItems)
        ? returnedItems.find(
            (item: any) =>
              getMongoId(item.productId) === getMongoId(product._id) &&
              String(item.variantSku || "") === (selectedVariant?.sku || ""),
          )
        : null;

      setCartVariantSku(selectedVariant?.sku || "");
      setCartQuantity(Number(matchingItem?.quantity) || Number(quantity));

      showNativeToast(`${product.title} added to your cart.`, "Added to cart");
    } catch (err: any) {
      console.error("ADD TO CART STATUS:", err?.response?.status);
      console.error(
        "ADD TO CART BACKEND RESPONSE:",
        JSON.stringify(err?.response?.data ?? null, null, 2),
      );
      console.error(
        "ADD TO CART REQUEST:",
        JSON.stringify(
          {
            productId: getMongoId(product?._id),
            variantSku: selectedVariant?.sku ?? "",
            variantId: getMongoId(selectedVariant?._id),
            quantity: Number(quantity),
            image:
              selectedVariant?.images?.[0] ||
              product?.media?.thumbnail ||
              product?.media?.images?.[0] ||
              "",
          },
          null,
          2,
        ),
      );

      showNativeToast(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Unable to add product to cart.",
        "Unable to add",
      );
    } finally {
      setAddingToCart(false);
    }
  };

  const currentVariantSku = selectedVariant?.sku || "";
  const isCurrentVariantInCart =
    cartQuantity > 0 && cartVariantSku === currentVariantSku;

  const handleCartIncrement = async () => {
    if (!product || cartUpdating || addingToCart) return;
    if (isOutOfStock) {
      showNativeToast("This product is currently unavailable.", "Out of stock");
      return;
    }

    try {
      setCartUpdating(true);
      // The existing add endpoint increments quantity when the same
      // product + variant already exists in the cart.
      const response = await api.post("/cart/add", {
        productId: product._id,
        variantSku: currentVariantSku,
        quantity: 1,
        image:
          selectedVariant?.images?.[0] ||
          product.media?.thumbnail ||
          product.media?.images?.[0] ||
          "",
      });

      const returnedItems =
        response.data?.cart?.items || response.data?.items || [];
      const matchingItem = Array.isArray(returnedItems)
        ? returnedItems.find(
            (item: any) =>
              getMongoId(item.productId) === getMongoId(product._id) &&
              String(item.variantSku || "") === currentVariantSku,
          )
        : null;

      setCartVariantSku(currentVariantSku);
      setCartQuantity(Number(matchingItem?.quantity) || cartQuantity + 1);
    } catch (err: any) {
      console.error(
        "CART INCREMENT ERROR:",
        err?.response?.data || err?.message || err,
      );
      showNativeToast(
        err?.response?.data?.message || "Could not update cart quantity.",
        "Cart update failed",
      );
    } finally {
      setCartUpdating(false);
    }
  };

  const handleCartDecrement = async () => {
    if (!product || cartUpdating || cartQuantity <= 0) return;

    // Keep the product's minimum order quantity respected.
    if (cartQuantity <= minimumOrderQuantity) {
      try {
        setCartUpdating(true);
        await api.delete("/cart/remove", {
          data: {
            productId: product._id,
            variantSku: currentVariantSku,
          },
        });
        setCartQuantity(0);
        setCartVariantSku("");
      } catch (err: any) {
        console.error(
          "CART REMOVE ERROR:",
          err?.response?.data || err?.message || err,
        );
        showNativeToast(
          err?.response?.data?.message || "Could not remove item from cart.",
          "Cart update failed",
        );
      } finally {
        setCartUpdating(false);
      }
      return;
    }

    try {
      setCartUpdating(true);
      await api.put("/cart/decrease", {
        productId: product._id,
        variantSku: currentVariantSku,
      });
      setCartQuantity((current) => Math.max(0, current - 1));
    } catch (err: any) {
      console.error(
        "CART DECREMENT ERROR:",
        err?.response?.data || err?.message || err,
      );
      showNativeToast(
        err?.response?.data?.message || "Could not update cart quantity.",
        "Cart update failed",
      );
    } finally {
      setCartUpdating(false);
    }
  };

  /* =====================================================
     BUY NOW
  ===================================================== */

  const handleBuyNow = async () => {
    if (!product) return;

    if (!isAuthenticated) {
      showDesignedAlert(
        "Login required",
        "Please login before buying this product.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Login",
            onPress: () => router.push("/login-modal" as any),
          },
        ],
      );

      return;
    }

    if (isOutOfStock) {
      showNativeToast("This product is currently unavailable.", "Out of stock");

      return;
    }

    try {
      setBuyingNow(true);

      const image =
        selectedVariant?.images?.[0] ||
        product.media?.thumbnail ||
        product.media?.images?.[0] ||
        "";

      // If this product + variant is already in the cart,
      // preserve its existing cart quantity and go to checkout.
      // If it is not in the cart, add exactly 3 units first.
      const cartResponse = await api.get("/cart");
      const cartItems =
        cartResponse.data?.cart?.items || cartResponse.data?.items || [];

      const sku = selectedVariant?.sku || "";
      const existingItem = Array.isArray(cartItems)
        ? cartItems.find((item: any) => {
            const itemProductId = getMongoId(
              item.productId || item.product || item.product?._id,
            );
            return (
              itemProductId === getMongoId(product._id) &&
              String(item.variantSku || item.sku || "") === sku
            );
          })
        : null;

      if (!existingItem) {
        await api.post("/cart/add", {
          productId: product._id,
          variantSku: sku,
          quantity: 3,
          image,
        });
        setCartVariantSku(sku);
        setCartQuantity(3);
      } else {
        setCartVariantSku(sku);
        setCartQuantity(Math.max(0, Number(existingItem.quantity) || 0));
      }

      router.push("/checkout");
    } catch (err: any) {
      console.error("BUY NOW ERROR:", err);

      showNativeToast(
        err?.response?.data?.message || "Something went wrong.",
        "Unable to continue",
      );
    } finally {
      setBuyingNow(false);
    }
  };

  /* =====================================================
     QUANTITY
  ===================================================== */

  const decreaseQuantity = () => {
    setQuantity(Math.max(minimumOrderQuantity, quantity - 1));
  };

  const increaseQuantity = () => {
    const max = Math.min(maximumOrderQuantity, stock || maximumOrderQuantity);

    if (quantity >= max) {
      showNativeToast(
        `You can order maximum ${max} units.`,
        "Maximum quantity",
      );

      return;
    }

    setQuantity(quantity + 1);
  };

  /* =====================================================
     SHARE
  ===================================================== */

  const handleShare = async () => {
    if (!product?._id) return;

    const productUrl = `https://odikart.in/products/${product._id}`;

    try {
      await Share.share({
        title: product.title,
        message: `${product.title}\n\nCheck this product on OdiKart:\n${productUrl}`,
      });
    } catch (err) {
      console.log("SHARE ERROR:", err);
    }
  };

  /* =====================================================
     WRITE REVIEW
  ===================================================== */

  const openReviewModal = () => {
    if (!isAuthenticated) {
      showDesignedAlert("Login required", "Please login to write a review.", [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Login",
          onPress: () => router.push("/login-modal" as any),
        },
      ]);

      return;
    }

    if (hasOwnReview) {
      showNativeToast(
        "You have already reviewed this product.",
        "Already reviewed",
      );

      return;
    }

    setReviewRating(0);

    setReviewComment("");
    setReviewMedia([]);

    setReviewModalVisible(true);
  };

  const openReviewImageViewer = (review: ProductReview, imageIndex: number) => {
    const reviewImages = Array.isArray(review.images)
      ? review.images.filter(Boolean)
      : [];
    if (!reviewImages.length) return;
    setReviewViewerImages(reviewImages);
    setReviewViewerInitialIndex(imageIndex);
    setReviewViewerVisible(true);
  };

  const handlePickReviewMedia = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        showNativeToast(
          "Please allow photo and video access to attach media to your review.",
          "Permission required",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        selectionLimit: 6,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (result.canceled || !result.assets?.length) return;

      const next = [...reviewMedia, ...result.assets].slice(0, 6);
      setReviewMedia(next);

      if (reviewMedia.length + result.assets.length > 6) {
        showNativeToast(
          "You can attach up to 6 photos/videos.",
          "Maximum 6 files",
        );
      }
    } catch (err) {
      console.error("PICK REVIEW MEDIA ERROR:", err);
      showNativeToast("Please try again.", "Unable to select media");
    }
  };

  const removeReviewMedia = (index: number) => {
    setReviewMedia((previous) =>
      previous.filter((_, mediaIndex) => mediaIndex !== index),
    );
  };

  /* =====================================================
     SUBMIT REVIEW
  ===================================================== */

  const handleSubmitReview = async () => {
    if (!product) return;

    if (!reviewRating) {
      showNativeToast("Please select a star rating.", "Rating required");

      return;
    }

    if (reviewComment.trim().length < 3) {
      showNativeToast(
        "Please write at least 3 characters.",
        "Review too short",
      );

      return;
    }

    if (!isAuthenticated) {
      showNativeToast("Please login first.", "Login required");

      return;
    }

    try {
      setSubmittingReview(true);

      const formData = new FormData();

      formData.append("rating", String(reviewRating));
      formData.append("comment", reviewComment.trim());

      reviewMedia.forEach((asset, index) => {
        if (asset.type !== "image") return;

        const extension =
          asset.fileName?.split(".").pop()?.toLowerCase() || "jpg";

        const mimeType =
          asset.mimeType || `image/${extension === "jpg" ? "jpeg" : extension}`;

        formData.append("images", {
          uri: asset.uri,
          name: asset.fileName || `review-image-${index}.${extension}`,
          type: mimeType,
        } as any);
      });

      // The backend accepts review videos through the "videos" field.
      reviewMedia.forEach((asset, index) => {
        if (asset.type !== "video") return;

        const extension =
          asset.fileName?.split(".").pop()?.toLowerCase() || "mp4";

        const mimeType =
          asset.mimeType ||
          (extension === "mov" ? "video/quicktime" : `video/${extension}`);

        // Remove the accidental image entry for videos by sending
        // videos separately as well; backend will use req.files.videos.
        formData.append("videos", {
          uri: asset.uri,
          name: asset.fileName || `review-video-${index}.${extension}`,
          type: mimeType,
        } as any);
      });

      const response = await api.post(getAddReviewUrl(product._id), formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 60000,
      });

      console.log("REVIEW RESPONSE:", response.data);

      const returnedReviews = response.data?.reviews;

      if (Array.isArray(returnedReviews)) {
        const total = returnedReviews.length;

        const average =
          total > 0
            ? returnedReviews.reduce(
                (sum: number, item: ProductReview) =>
                  sum + Number(item.rating || 0),
                0,
              ) / total
            : 0;

        setProduct((previous) =>
          previous
            ? {
                ...previous,

                reviews: returnedReviews,

                numReviews: total,

                rating: Number(average.toFixed(1)),
              }
            : previous,
        );
      }

      setReviewModalVisible(false);

      setReviewRating(0);

      setReviewComment("");
      setReviewMedia([]);

      showNativeToast(
        "Thank you for sharing your experience!",
        "Review submitted",
      );
    } catch (err: any) {
      console.error("SUBMIT REVIEW ERROR:", err);

      const message =
        err?.response?.data?.message || "Unable to submit your review.";

      showNativeToast(message, "Review not submitted");
    } finally {
      setSubmittingReview(false);
    }
  };

  /* =====================================================
     LIKE / HELPFUL REVIEW
  ===================================================== */

  const handleLikeReview = async (review: ProductReview) => {
    if (!product) return;
    const reviewId = getReviewId(review);
    if (!reviewId) return;
    if (!isAuthenticated) {
      showNativeToast(
        "Please login to mark a review as helpful.",
        "Login required",
      );
      return;
    }

    try {
      setLikingReviewId(reviewId);
      const wasLiked =
        Array.isArray(review.likes) &&
        Boolean(currentUserId) &&
        review.likes.some((id: any) => getMongoId(id) === currentUserId);
      const response = await api.put(getLikeReviewUrl(product._id, reviewId));
      const likes = Number(
        response.data?.likes ?? review.likesCount ?? review.likes?.length ?? 0,
      );
      const updatedLikes = Array.isArray(review.likes)
        ? wasLiked
          ? review.likes.filter((id: any) => getMongoId(id) !== currentUserId)
          : [...review.likes, currentUserId]
        : wasLiked
          ? []
          : currentUserId
            ? [currentUserId]
            : [];

      setProduct((previous) =>
        previous
          ? {
              ...previous,
              reviews: previous.reviews?.map((item) =>
                getReviewId(item) === reviewId
                  ? { ...item, likes: updatedLikes, likesCount: likes }
                  : item,
              ),
            }
          : previous,
      );
    } catch (err: any) {
      console.error("LIKE REVIEW ERROR:", err);
      showNativeToast(
        err?.response?.data?.message || "Please try again.",
        "Unable to update",
      );
    } finally {
      setLikingReviewId("");
    }
  };

  /* =====================================================
     DELETE REVIEW
  ===================================================== */

  const confirmDeleteReview = (review: ProductReview) => {
    const reviewId = getReviewId(review);

    if (!reviewId) return;

    showDesignedAlert(
      "Delete review?",
      "This review will be permanently removed.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteReview(reviewId),
        },
      ],
    );
  };

  const deleteReview = async (reviewId: string) => {
    if (!product) return;

    try {
      setDeletingReviewId(reviewId);

      const response = await api.delete(
        getDeleteReviewUrl(product._id, reviewId),
      );

      const returnedReviews = response.data?.reviews;

      if (Array.isArray(returnedReviews)) {
        const total = returnedReviews.length;

        const average =
          total > 0
            ? returnedReviews.reduce(
                (sum: number, item: ProductReview) =>
                  sum + Number(item.rating || 0),
                0,
              ) / total
            : 0;

        setProduct((previous) =>
          previous
            ? {
                ...previous,

                reviews: returnedReviews,

                numReviews: total,

                rating: Number(average.toFixed(1)),
              }
            : previous,
        );
      }

      showNativeToast("Your review has been removed.", "Review deleted");
    } catch (err: any) {
      console.error("DELETE REVIEW ERROR:", err);

      showNativeToast(
        err?.response?.data?.message || "Please try again.",
        "Unable to delete",
      );
    } finally {
      setDeletingReviewId("");
    }
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return <ProductDetailsSkeleton />;
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error || !product) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={54} color={colors.error} />

        <Text style={styles.errorTitle}>Product unavailable</Text>

        <Text style={styles.errorText}>{error || "Product not found."}</Text>

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="#fff" />

          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  /* =====================================================
     CURRENT IMAGE
  ===================================================== */

  const currentImage = images[selectedImage] || images[0];

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
      {/* White safe-area header keeps the product image below the system area. */}
      <View style={{ height: insets.top, backgroundColor: "#FFFFFF" }} />

      {/* Compact sticky product bar appears after the gallery scrolls away. */}
      {showCompactNavbar && (
        <View
          style={[
            styles.header,
            styles.compactStickyHeader,
            { paddingTop: insets.top + 8 },
          ]}
        >
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.compactProductInfo}>
            {currentImage ? (
              <Image
                source={{ uri: currentImage }}
                style={styles.compactProductImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.compactProductImage} />
            )}
            <View style={styles.compactProductText}>
              <Text style={styles.compactProductTitle} numberOfLines={1}>
                {product.title}
              </Text>
              <View style={styles.compactPriceRow}>
                <Text style={styles.compactPrice}>{formatPrice(price)}</Text>
                {originalPrice > price && (
                  <Text style={styles.compactMrp}>
                    {formatPrice(originalPrice)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerButton}
              onPress={handleShare}
              accessibilityRole="button"
              accessibilityLabel="Share product"
            >
              <Ionicons name="share-outline" size={20} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.headerButton}
              onPress={handleWishlistToggle}
              disabled={wishlistUpdating}
              accessibilityRole="button"
              accessibilityLabel={
                isWishlisted ? "Remove from wishlist" : "Add to wishlist"
              }
            >
              {wishlistUpdating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons
                  name={isWishlisted ? "heart" : "heart-outline"}
                  size={21}
                  color={isWishlisted ? colors.error : colors.text}
                />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* =================================================
          CONTENT
      ================================================= */}

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          // Reveal the sticky product header as soon as the user starts scrolling.
          const shouldShow = event.nativeEvent.contentOffset.y > 8;

          setShowCompactNavbar((previous) =>
            previous === shouldShow ? previous : shouldShow,
          );
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: 120 + insets.bottom,
        }}
      >
        {/* =================================================
            IMAGE GALLERY
        ================================================= */}

        <View style={styles.imageSection}>
          <View style={styles.mainGalleryFrame}>
            {/* Floating controls over the image; no separate page header. */}
            <View
              style={[styles.imageTopControls, { paddingTop: 8 }]}
              pointerEvents="box-none"
            >
              <Pressable
                style={styles.imageTopButton}
                onPress={() => router.back()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
              >
                <Ionicons name="arrow-back" size={22} color={colors.text} />
              </Pressable>
              <View style={styles.imageTopActions}>
                <Pressable
                  style={styles.imageTopButton}
                  onPress={handleShare}
                  accessibilityRole="button"
                  accessibilityLabel="Share product"
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={colors.text}
                  />
                </Pressable>
                <Pressable
                  style={styles.imageTopButton}
                  onPress={handleWishlistToggle}
                  disabled={wishlistUpdating}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isWishlisted ? "Remove from wishlist" : "Add to wishlist"
                  }
                >
                  {wishlistUpdating ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name={isWishlisted ? "heart" : "heart-outline"}
                      size={21}
                      color={isWishlisted ? colors.error : colors.text}
                    />
                  )}
                </Pressable>
              </View>
            </View>
            {images.length > 0 ? (
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                contentOffset={{
                  x: SCREEN_WIDTH * selectedImage,
                  y: 0,
                }}
                onMomentumScrollEnd={(event) => {
                  const index = Math.max(
                    0,
                    Math.min(
                      images.length - 1,
                      Math.round(
                        event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                      ),
                    ),
                  );
                  setSelectedImage(index);
                }}
                style={styles.mainGalleryScroll}
              >
                {images.map((image, index) => (
                  <Pressable
                    key={`${image}-${index}`}
                    style={styles.mainImageContainer}
                    onPress={() => {
                      setSelectedImage(index);
                      setViewerVisible(true);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Open image ${index + 1} of ${images.length} to zoom`}
                  >
                    <Image
                      source={{ uri: image }}
                      style={styles.mainImage}
                      resizeMode="contain"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.mainImageContainer}>
                <View style={styles.imagePlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={52}
                    color={colors.textMuted}
                  />
                  <Text style={styles.noImageText}>No image</Text>
                </View>
              </View>
            )}

            {images.length > 1 && (
              <View style={styles.imageCountBadge}>
                <Ionicons name="images-outline" size={14} color="#fff" />
                <Text style={styles.imageCountText}>
                  {selectedImage + 1}/{images.length}
                </Text>
              </View>
            )}
          </View>

          {/* THUMBNAILS */}

          {images.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailList}
            >
              {images.map((image, index) => (
                <Pressable
                  key={`${image}-${index}`}
                  onPress={() => setSelectedImage(index)}
                  style={[
                    styles.thumbnail,
                    selectedImage === index && styles.thumbnailActive,
                  ]}
                >
                  <Image
                    source={{
                      uri: image,
                    }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* =================================================
            PRODUCT INFORMATION
        ================================================= */}

        <View style={styles.contentCard}>
          {/* BADGES */}

          {product.badges && product.badges.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeList}
            >
              {product.badges.map((badge, index) => (
                <View key={`${badge}-${index}`} style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* BRAND */}

          {product.brand && (
            <Text style={styles.brandText}>{product.brand}</Text>
          )}

          {/* TITLE */}

          <Text style={styles.productTitle}>{product.title}</Text>

          {/* SHORT DESCRIPTION */}

          {product.shortDescription && (
            <Text style={styles.shortDescription}>
              {product.shortDescription}
            </Text>
          )}

          {/* RATING */}

          <Pressable
            style={styles.ratingSummary}
            onPress={() => {
              // Reviews are on this same page.
            }}
          >
            <View style={styles.ratingPill}>
              <Text style={styles.ratingNumber}>{rating.toFixed(1)}</Text>

              <Ionicons name="star" size={14} color="#fff" />
            </View>

            <Text style={styles.reviewCountText}>
              {reviewCount} {reviewCount === 1 ? "rating" : "ratings"}
            </Text>
          </Pressable>

          <View style={styles.divider} />

          {/* PRICE */}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(price)}</Text>

            {originalPrice > price && (
              <Text style={styles.originalPrice}>
                {formatPrice(originalPrice)}
              </Text>
            )}

            {discount > 0 && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  {Math.round(discount)}% OFF
                </Text>
              </View>
            )}
          </View>

          {/* STOCK */}

          <View style={styles.stockRow}>
            <View
              style={[
                styles.stockDot,
                {
                  backgroundColor: isOutOfStock
                    ? colors.error
                    : stock <= 5
                      ? colors.warning
                      : colors.success,
                },
              ]}
            />

            <Text
              style={[
                styles.stockText,
                {
                  color: isOutOfStock
                    ? colors.error
                    : stock <= 5
                      ? colors.warning
                      : colors.success,
                },
              ]}
            >
              {isOutOfStock
                ? "Out of stock"
                : stock <= 5
                  ? `Only ${stock} left`
                  : "In stock"}
            </Text>
          </View>

          {/* =================================================
              VARIANTS
          ================================================= */}

          {attributeGroups.length > 0 && (
            <View style={styles.variantSection}>
              {attributeGroups.map(([key, values]) => (
                <View key={key} style={styles.variantGroup}>
                  <Text style={styles.sectionLabel}>
                    {getAttributeLabel(key)}
                  </Text>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.optionList}
                  >
                    {values.map((value) => {
                      const active = selectedOptions[key] === value;

                      return (
                        <Pressable
                          key={value}
                          style={[styles.option, active && styles.optionActive]}
                          onPress={() => handleSelectOption(key, value)}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              active && styles.optionTextActive,
                            ]}
                          >
                            {value}
                          </Text>

                          {active && (
                            <Ionicons
                              name="checkmark-circle"
                              size={17}
                              color={colors.primary}
                            />
                          )}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ))}
            </View>
          )}

          {/* =================================================
              QUANTITY
          ================================================= */}

          {!isOutOfStock && (
            <View style={styles.quantitySection}>
              <View>
                <Text style={styles.sectionLabel}>Quantity</Text>

                <Text style={styles.quantityHint}>
                  Min. order: {minimumOrderQuantity}
                </Text>
              </View>

              <View style={styles.quantityControl}>
                <Pressable
                  style={styles.quantityButton}
                  onPress={decreaseQuantity}
                >
                  <Ionicons name="remove" size={19} color={colors.text} />
                </Pressable>

                <Text style={styles.quantityValue}>{quantity}</Text>

                <Pressable
                  style={styles.quantityButton}
                  onPress={increaseQuantity}
                >
                  <Ionicons name="add" size={19} color={colors.text} />
                </Pressable>
              </View>
            </View>
          )}

          {/* =================================================
              DESCRIPTION
          ================================================= */}

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>About this product</Text>

            <Text style={styles.description}>
              {product.description ||
                product.shortDescription ||
                "No product description available."}
            </Text>
          </View>

          {/* =================================================
              KEY DETAILS
          ================================================= */}

          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Product details</Text>

            <View style={styles.detailsGrid}>
              {product.productType && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Product type</Text>

                  <Text style={styles.detailValue}>{product.productType}</Text>
                </View>
              )}

              {product.material && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Material</Text>

                  <Text style={styles.detailValue}>{product.material}</Text>
                </View>
              )}

              {product.warrantyInformation && (
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Warranty</Text>

                  <Text style={styles.detailValue}>
                    {product.warrantyInformation}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* =================================================
              SHIPPING
          ================================================= */}

          <View style={styles.serviceCard}>
            <View style={styles.serviceRow}>
              <View style={styles.serviceIcon}>
                <Ionicons
                  name="cube-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>

              <View style={styles.serviceContent}>
                <Text style={styles.serviceTitle}>
                  {product.shipping?.freeShipping
                    ? "Free delivery"
                    : "Delivery available"}
                </Text>

                <Text style={styles.serviceText}>
                  {product.shippingInformation ||
                    "Fast and secure delivery to your address."}
                </Text>
              </View>
            </View>

            {product.shipping?.returnDays !== undefined && (
              <View style={styles.serviceRow}>
                <View style={styles.serviceIcon}>
                  <Ionicons
                    name="refresh-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.serviceContent}>
                  <Text style={styles.serviceTitle}>
                    {product.shipping.returnDays}
                    -day returns
                  </Text>

                  <Text style={styles.serviceText}>
                    {product.returnPolicy ||
                      "Return policy available for eligible orders."}
                  </Text>
                </View>
              </View>
            )}

            {product.shipping?.processingTime !== undefined && (
              <View style={styles.serviceRow}>
                <View style={styles.serviceIcon}>
                  <Ionicons
                    name="time-outline"
                    size={22}
                    color={colors.primary}
                  />
                </View>

                <View style={styles.serviceContent}>
                  <Text style={styles.serviceTitle}>Processing time</Text>

                  <Text style={styles.serviceText}>
                    {product.shipping.processingTime} days
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* =================================================
              SELLER
          ================================================= */}

          {product.seller && typeof product.seller === "object" && (
            <View style={styles.sellerCard}>
              <View style={styles.sellerAvatar}>
                {product.seller.image ? (
                  <Image
                    source={{
                      uri: product.seller.image,
                    }}
                    style={styles.sellerAvatarImage}
                  />
                ) : (
                  <Ionicons
                    name="storefront-outline"
                    size={24}
                    color={colors.primary}
                  />
                )}
              </View>

              <View style={styles.sellerInfo}>
                <Text style={styles.sellerLabel}>Sold by</Text>

                <Text style={styles.sellerName}>
                  {getSellerDisplayName(product.seller)}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </View>
          )}

          {/* =================================================
              REVIEWS
          ================================================= */}

          <View style={styles.reviewsSection}>
            <View style={styles.reviewsHeader}>
              <View>
                <Text style={styles.sectionTitle}>Ratings & Reviews</Text>

                <Text style={styles.reviewsSubtitle}>
                  {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
                </Text>
              </View>

              <Pressable
                style={styles.writeReviewButton}
                onPress={openReviewModal}
              >
                <Ionicons
                  name="create-outline"
                  size={17}
                  color={colors.primary}
                />

                <Text style={styles.writeReviewText}>Write Review</Text>
              </Pressable>
            </View>

            {/* RATING OVERVIEW */}

            <View style={styles.ratingOverview}>
              <View style={styles.bigRating}>
                <Text style={styles.bigRatingNumber}>{rating.toFixed(1)}</Text>

                <Stars rating={Math.round(rating)} size={18} />

                <Text style={styles.totalRatingText}>
                  {reviewCount} ratings
                </Text>
              </View>

              <View style={styles.distribution}>
                {ratingDistribution.map(({ star, count, percentage }) => (
                  <View key={star} style={styles.distributionRow}>
                    <Text style={styles.distributionStar}>{star}</Text>

                    <Ionicons name="star" size={11} color={colors.warning} />

                    <View style={styles.progressBackground}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.max(
                              percentage,
                              percentage > 0 ? 2 : 0,
                            )}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.distributionCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.divider} />

            {/* REVIEW LIST */}

            {reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={44}
                  color={colors.textMuted}
                />

                <Text style={styles.emptyReviewTitle}>No reviews yet</Text>

                <Text style={styles.emptyReviewText}>
                  Be the first customer to review this product.
                </Text>
              </View>
            ) : (
              reviews.map((review, index) => {
                const reviewId = getReviewId(review);

                const reviewUserId = getUserIdFromReview(review);

                const isOwnReview = Boolean(
                  currentUserId && reviewUserId === currentUserId,
                );

                const likes = Number(
                  review.likesCount || review.likes?.length || 0,
                );

                return (
                  <View
                    key={reviewId || index}
                    style={[
                      styles.reviewCard,
                      index < reviews.length - 1 && styles.reviewBorder,
                    ]}
                  >
                    <View style={styles.reviewTop}>
                      <View style={styles.reviewerAvatar}>
                        {review.reviewerImage ? (
                          <Image
                            source={{
                              uri: review.reviewerImage,
                            }}
                            style={styles.reviewerImage}
                          />
                        ) : (
                          <Text style={styles.reviewerInitial}>
                            {getReviewName(review).charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>

                      <View style={styles.reviewerInfo}>
                        <Text style={styles.reviewerName}>
                          {getReviewName(review)}
                        </Text>

                        <View style={styles.reviewMeta}>
                          <Stars
                            rating={Number(review.rating || 0)}
                            size={14}
                          />

                          {review.verifiedPurchase && (
                            <View style={styles.verifiedBadge}>
                              <Ionicons
                                name="checkmark-circle"
                                size={13}
                                color={colors.success}
                              />

                              <Text style={styles.verifiedText}>
                                Verified Purchase
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {isOwnReview && (
                        <Pressable
                          onPress={() => confirmDeleteReview(review)}
                          disabled={deletingReviewId === reviewId}
                          style={styles.deleteReviewButton}
                        >
                          {deletingReviewId === reviewId ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.error}
                            />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={colors.error}
                            />
                          )}
                        </Pressable>
                      )}
                    </View>

                    <Text style={styles.reviewComment}>
                      {getReviewText(review)}
                    </Text>

                    {/* REVIEW IMAGES */}

                    {review.images && review.images.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reviewImages}
                      >
                        {review.images.map((image, imageIndex) => (
                          <Pressable
                            key={`${image}-${imageIndex}`}
                            onPress={() =>
                              openReviewImageViewer(review, imageIndex)
                            }
                            style={styles.reviewImagePressable}
                            android_ripple={{ color: colors.overlay }}
                          >
                            <Image
                              source={{ uri: image }}
                              style={styles.reviewImage}
                              resizeMode="cover"
                            />
                            <View style={styles.reviewImageOverlay}>
                              <Ionicons
                                name="expand-outline"
                                size={18}
                                color="#fff"
                              />
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}

                    <View style={styles.reviewBottom}>
                      <Text style={styles.reviewDate}>
                        {formatDate(review.createdAt)}
                      </Text>

                      <Pressable
                        style={styles.helpfulButton}
                        disabled={likingReviewId === reviewId}
                        onPress={() => handleLikeReview(review)}
                      >
                        {likingReviewId === reviewId ? (
                          <ActivityIndicator
                            size="small"
                            color={colors.primary}
                          />
                        ) : (
                          <>
                            <Ionicons
                              name={
                                Array.isArray(review.likes) &&
                                currentUserId &&
                                review.likes.some(
                                  (id: any) => getMongoId(id) === currentUserId,
                                )
                                  ? "thumbs-up"
                                  : "thumbs-up-outline"
                              }
                              size={17}
                              color={
                                Array.isArray(review.likes) &&
                                currentUserId &&
                                review.likes.some(
                                  (id: any) => getMongoId(id) === currentUserId,
                                )
                                  ? colors.primary
                                  : colors.textSecondary
                              }
                            />
                            <Text style={styles.helpfulText}>Helpful</Text>
                            <Text style={styles.helpfulCount}>{likes}</Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* =================================================
          BOTTOM PURCHASE BAR
      ================================================= */}

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + 10,
          },
        ]}
      >
        {isCurrentVariantInCart ? (
          <View style={[styles.cartButton, styles.cartStepper]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Decrease cart quantity"
              style={styles.cartStepperAction}
              disabled={cartUpdating}
              onPress={handleCartDecrement}
            >
              <Ionicons name="remove" size={22} color={colors.primary} />
            </Pressable>

            {cartUpdating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.cartStepperValue}>{cartQuantity}</Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Increase cart quantity"
              style={styles.cartStepperAction}
              disabled={cartUpdating || isOutOfStock || cartQuantity >= stock}
              onPress={handleCartIncrement}
            >
              <Ionicons
                name="add"
                size={22}
                color={
                  cartQuantity >= stock ? colors.textMuted : colors.primary
                }
              />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.cartButton}
            disabled={isOutOfStock || addingToCart}
            onPress={handleAddToCart}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.purchaseShine, purchaseShineStyle]}
            />
            {addingToCart ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons
                  name="cart-outline"
                  size={22}
                  color={colors.primary}
                />
                <Text style={styles.cartButtonText}>Add to Cart</Text>
              </>
            )}
          </Pressable>
        )}

        <Pressable
          style={[styles.buyButton, isOutOfStock && styles.disabledBuyButton]}
          disabled={isOutOfStock || buyingNow}
          onPress={handleBuyNow}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.purchaseShine,
              styles.purchaseShineBuy,
              purchaseShineStyle,
            ]}
          />
          {buyingNow ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="flash-outline" size={20} color="#fff" />

              <Text style={styles.buyButtonText}>
                {isOutOfStock ? "Out of Stock" : "Buy Now"}
              </Text>
            </>
          )}
        </Pressable>
      </View>

      {/* =================================================
          FULL SCREEN IMAGE VIEWER
      ================================================= */}

      <FullScreenImageViewer
        visible={viewerVisible}
        images={images}
        initialIndex={selectedImage}
        onClose={() => setViewerVisible(false)}
      />

      <FullScreenImageViewer
        visible={reviewViewerVisible}
        images={reviewViewerImages}
        initialIndex={reviewViewerInitialIndex}
        onClose={() => setReviewViewerVisible(false)}
      />

      {/* =================================================
          REVIEW MODAL
      ================================================= */}

      <ReviewModal
        visible={reviewModalVisible}
        rating={reviewRating}
        comment={reviewComment}
        submitting={submittingReview}
        media={reviewMedia}
        onPickMedia={handlePickReviewMedia}
        onRemoveMedia={removeReviewMedia}
        onClose={() => setReviewModalVisible(false)}
        onRating={setReviewRating}
        onComment={setReviewComment}
        onSubmit={handleSubmitReview}
      />

      <Modal
        visible={!!designedAlert}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDesignedAlert(null)}
      >
        <View style={styles.alertOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDesignedAlert(null)}
          />
          <View style={styles.alertCard}>
            <View style={styles.alertIconWrap}>
              <Ionicons
                name={
                  designedAlert?.title.toLowerCase().includes("delete")
                    ? "trash-outline"
                    : designedAlert?.title.toLowerCase().includes("login")
                      ? "person-circle-outline"
                      : "information-circle-outline"
                }
                size={29}
                color={
                  designedAlert?.title.toLowerCase().includes("delete")
                    ? "#DC2626"
                    : colors.primary
                }
              />
            </View>
            <Text style={styles.alertTitle}>{designedAlert?.title}</Text>
            <Text style={styles.alertMessage}>{designedAlert?.message}</Text>
            <View style={styles.alertActions}>
              {(designedAlert?.buttons || []).map((button, index) => (
                <Pressable
                  key={`${button.text}-${index}`}
                  style={[
                    styles.alertButton,
                    index === (designedAlert?.buttons.length || 1) - 1 &&
                      styles.alertPrimaryButton,
                    button.style === "destructive" && styles.alertDangerButton,
                    button.style === "cancel" && styles.alertCancelButton,
                  ]}
                  onPress={() => {
                    setDesignedAlert(null);
                    button.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.alertButtonText,
                      (index === (designedAlert?.buttons.length || 1) - 1 ||
                        button.style === "destructive") &&
                        styles.alertPrimaryButtonText,
                      button.style === "cancel" && styles.alertCancelButtonText,
                    ]}
                  >
                    {button.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(13, 16, 42, 0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  alertCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    shadowColor: "#17133D",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  alertIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.primarySoft || "#EEF0FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  alertTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  alertMessage: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 9,
  },
  alertActions: {
    flexDirection: "row",
    width: "100%",
    gap: 10,
    marginTop: 24,
  },
  alertButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
  },
  alertPrimaryButton: {
    backgroundColor: colors.primary,
  },
  alertDangerButton: {
    backgroundColor: "#DC2626",
  },
  alertCancelButton: {
    backgroundColor: colors.surfaceSoft || "#F1F2F8",
    borderWidth: 1,
    borderColor: colors.borderLight || "#E6E8F2",
  },
  alertButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  alertPrimaryButtonText: {
    color: "#FFFFFF",
  },
  alertCancelButtonText: {
    color: colors.text,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: colors.textSecondary,
  },

  /* =====================================================
       SKELETON
    ===================================================== */

  skeletonBlock: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 10,
  },

  skeletonCircle: {
    backgroundColor: colors.surfaceSoft,
  },

  skeletonHeaderTitle: {
    width: 128,
    height: 16,
    borderRadius: 7,
  },

  skeletonMainImage: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
  },

  skeletonImageBadge: {
    position: "absolute",
    left: 14,
    bottom: 14,
    height: 30,
    width: 126,
    borderRadius: 15,
    paddingHorizontal: 12,
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  skeletonBadgeLine: {
    width: 92,
    height: 9,
    borderRadius: 5,
  },

  skeletonCountBadge: {
    position: "absolute",
    right: 14,
    bottom: 14,
    height: 30,
    width: 48,
    borderRadius: 15,
    paddingHorizontal: 9,
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  skeletonCountLine: {
    width: 30,
    height: 9,
    borderRadius: 5,
  },

  skeletonThumbnail: {
    width: 68,
    height: 68,
    borderRadius: 12,
    marginRight: 9,
  },

  skeletonBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 13,
  },

  skeletonSmallBadge: {
    width: 64,
    height: 24,
    borderRadius: 8,
  },

  skeletonProductTitle: {
    width: "88%",
    height: 19,
    borderRadius: 7,
  },

  skeletonRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 13,
    gap: 9,
  },

  skeletonRating: {
    width: 82,
    height: 24,
    borderRadius: 8,
  },

  skeletonReviewCount: {
    width: 78,
    height: 11,
    borderRadius: 6,
  },

  skeletonDivider: {
    height: 1,
    width: "100%",
    backgroundColor: colors.borderLight,
    marginVertical: 17,
  },

  skeletonPrice: {
    width: 112,
    height: 28,
    borderRadius: 8,
  },

  skeletonPriceSub: {
    width: 170,
    height: 12,
    borderRadius: 6,
    marginTop: 8,
  },

  skeletonInfoBox: {
    marginTop: 17,
    padding: 12,
    borderRadius: 13,
    backgroundColor: colors.surfaceSoft,
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonInfoTitle: {
    width: 110,
    height: 12,
    borderRadius: 6,
  },

  skeletonInfoText: {
    width: "80%",
    height: 9,
    borderRadius: 5,
    marginTop: 7,
  },

  skeletonSectionTitle: {
    width: 118,
    height: 14,
    borderRadius: 7,
    marginTop: 22,
    marginBottom: 11,
  },

  skeletonOptionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },

  skeletonOption: {
    width: 64,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  skeletonOptionActive: {
    width: 72,
    borderColor: colors.primary,
  },

  skeletonQuantity: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 13,
    marginTop: 1,
  },

  skeletonQuantityValue: {
    width: 30,
    height: 15,
    borderRadius: 6,
  },

  skeletonFeatureList: {
    marginTop: 20,
    gap: 13,
  },

  skeletonFeatureRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonFeatureTitle: {
    width: 118,
    height: 11,
    borderRadius: 6,
  },

  skeletonFeatureText: {
    width: "65%",
    height: 9,
    borderRadius: 5,
    marginTop: 6,
  },

  skeletonSectionCard: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  skeletonCardTitle: {
    width: 120,
    height: 16,
    borderRadius: 7,
    marginBottom: 15,
  },

  skeletonParagraph: {
    width: "96%",
    height: 10,
    borderRadius: 5,
    marginBottom: 9,
  },

  skeletonReviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  skeletonReviewButton: {
    width: 84,
    height: 36,
    borderRadius: 10,
  },

  skeletonReviewSummary: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 16,
  },

  skeletonBigRating: {
    width: 88,
    height: 72,
    borderRadius: 12,
  },

  skeletonDistributionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 7,
  },

  skeletonDistributionStar: {
    width: 18,
    height: 8,
    borderRadius: 4,
  },

  skeletonDistributionBar: {
    flex: 1,
    height: 7,
    borderRadius: 4,
  },

  skeletonReviewCard: {
    paddingTop: 15,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  skeletonReviewerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonReviewerName: {
    width: 110,
    height: 11,
    borderRadius: 6,
  },

  skeletonReviewerStars: {
    width: 70,
    height: 9,
    borderRadius: 5,
    marginTop: 6,
  },

  skeletonReviewLine: {
    width: "91%",
    height: 9,
    borderRadius: 5,
    marginTop: 12,
  },

  skeletonBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },

  skeletonCartButton: {
    flex: 1,
    height: 48,
    borderRadius: 13,
  },

  skeletonBuyButton: {
    flex: 1,
    height: 48,
    borderRadius: 13,
  },

  errorTitle: {
    marginTop: 16,
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
  },

  errorText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    color: colors.textSecondary,
  },

  backButton: {
    marginTop: 24,
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  backButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  /* =====================================================
       HEADER
    ===================================================== */

  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  compactStickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  headerTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },

  compactProductInfo: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  compactProductImage: {
    width: 46,
    height: 46,
    borderRadius: 9,
    backgroundColor: colors.surfaceSoft,
  },

  compactProductText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 9,
    justifyContent: "center",
  },

  compactProductTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.text,
  },

  compactPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },

  compactPrice: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.primary,
  },

  compactMrp: {
    marginLeft: 7,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },

  headerActions: {
    flexDirection: "row",
    gap: 8,
  },

  /* =====================================================
       IMAGE
    ===================================================== */

  imageSection: {
    backgroundColor: "#ffffff",
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 0,
  },

  mainGalleryFrame: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.02,
    position: "relative",
    backgroundColor: "#111111",
  },

  mainGalleryScroll: {
    flex: 1,
  },

  mainImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.02,
    backgroundColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  mainImage: {
    width: "100%",
    height: "100%",
  },

  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  noImageText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
  },

  imageTopControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  imageTopActions: {
    flexDirection: "row",
    gap: 9,
  },

  imageTopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: "rgba(20,20,40,0.06)",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },

  zoomBadge: {
    position: "absolute",
    left: 16,
    bottom: 16,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(17,24,39,0.72)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  zoomBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  imageCountBadge: {
    position: "absolute",
    right: 16,
    bottom: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "rgba(17,24,39,0.72)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  imageCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  thumbnailList: {
    paddingHorizontal: 12,
    gap: 8,
    paddingTop: 8,
  },

  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
  },

  thumbnailActive: {
    borderWidth: 2,
    borderColor: colors.primary,
  },

  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  /* =====================================================
       PRODUCT
    ===================================================== */

  contentCard: {
    marginTop: 0,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingTop: 10,
  },

  badgeList: {
    gap: 7,
    paddingBottom: 10,
  },

  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.blueSoft,
  },

  badgeText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  brandText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "700",
    marginBottom: 6,
  },

  productTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: colors.text,
  },

  shortDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  ratingSummary: {
    marginTop: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  ratingPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: colors.success,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  ratingNumber: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },

  reviewCountText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },

  divider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 18,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 9,
  },

  price: {
    fontSize: 23,
    fontWeight: "900",
    color: colors.text,
  },

  originalPrice: {
    fontSize: 15,
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },

  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: "#DCFCE7",
  },

  discountText: {
    color: "#15803D",
    fontSize: 11,
    fontWeight: "800",
  },

  stockRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  stockText: {
    fontSize: 13,
    fontWeight: "700",
  },

  /* =====================================================
       VARIANTS
    ===================================================== */

  variantSection: {
    marginTop: 22,
  },

  variantGroup: {
    marginBottom: 18,
  },

  sectionLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 9,
  },

  optionList: {
    gap: 8,
  },

  option: {
    minHeight: 42,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft,
  },

  optionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  optionTextActive: {
    color: colors.primary,
    fontWeight: "800",
  },

  /* =====================================================
       QUANTITY
    ===================================================== */

  quantitySection: {
    marginTop: 4,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
  },

  quantityHint: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 3,
  },

  quantityControl: {
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },

  quantityButton: {
    width: 42,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  quantityValue: {
    minWidth: 38,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },

  /* =====================================================
       INFO
    ===================================================== */

  infoSection: {
    marginTop: 22,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },

  description: {
    marginTop: 9,
    fontSize: 14,
    lineHeight: 22,
    color: colors.textSecondary,
  },

  detailsGrid: {
    marginTop: 12,
    gap: 10,
  },

  detailItem: {
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.surfaceSoft,
  },

  detailLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
  },

  detailValue: {
    marginTop: 4,
    fontSize: 14,
    color: colors.text,
    fontWeight: "700",
  },

  /* =====================================================
       SERVICES
    ===================================================== */

  serviceCard: {
    marginTop: 22,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    gap: 15,
  },

  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  serviceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  serviceContent: {
    flex: 1,
    marginLeft: 11,
  },

  serviceTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  serviceText: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  /* =====================================================
       SELLER
    ===================================================== */

  sellerCard: {
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    flexDirection: "row",
    alignItems: "center",
  },

  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  sellerAvatarImage: {
    width: "100%",
    height: "100%",
  },

  sellerInfo: {
    flex: 1,
    marginLeft: 11,
  },

  sellerLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },

  sellerName: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },

  /* =====================================================
       REVIEWS
    ===================================================== */

  reviewsSection: {
    marginTop: 28,
    paddingBottom: 10,
  },

  reviewsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  reviewsSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: colors.textMuted,
  },

  writeReviewButton: {
    minHeight: 40,
    paddingHorizontal: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  writeReviewText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  ratingOverview: {
    marginTop: 18,
    flexDirection: "row",
  },

  bigRating: {
    width: 105,
    alignItems: "center",
    justifyContent: "center",
  },

  bigRatingNumber: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.text,
  },

  totalRatingText: {
    marginTop: 5,
    fontSize: 11,
    color: colors.textMuted,
  },

  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },

  distribution: {
    flex: 1,
    paddingLeft: 12,
    justifyContent: "center",
    gap: 4,
  },

  distributionRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 17,
  },

  distributionStar: {
    width: 12,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "700",
  },

  progressBackground: {
    flex: 1,
    height: 6,
    borderRadius: 4,
    marginHorizontal: 7,
    backgroundColor: colors.surfaceSoft,
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.warning,
  },

  distributionCount: {
    width: 25,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "right",
  },

  emptyReviews: {
    alignItems: "center",
    paddingVertical: 30,
  },

  emptyReviewTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },

  emptyReviewText: {
    marginTop: 5,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
  },

  reviewCard: {
    paddingVertical: 16,
  },

  reviewBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },

  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  reviewerImage: {
    width: "100%",
    height: "100%",
  },

  reviewerInitial: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primary,
  },

  reviewerInfo: {
    flex: 1,
    marginLeft: 10,
  },

  reviewerName: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  reviewMeta: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  verifiedText: {
    fontSize: 10,
    color: colors.success,
    fontWeight: "700",
  },

  deleteReviewButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  reviewComment: {
    marginTop: 11,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  reviewImages: {
    marginTop: 10,
    gap: 8,
  },

  reviewImagePressable: {
    width: 82,
    height: 82,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },

  reviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
  },

  reviewImageOverlay: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 27,
    height: 27,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.48)",
  },

  reviewBottom: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  reviewDate: {
    fontSize: 11,
    color: colors.textMuted,
  },

  helpfulButton: {
    minHeight: 34,
    paddingHorizontal: 9,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.surfaceSoft,
  },

  helpfulText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  helpfulCount: {
    minWidth: 18,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSecondary,
  },

  /* =====================================================
       BOTTOM BAR
    ===================================================== */

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    flexDirection: "row",
    gap: 10,
  },

  purchaseShine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 56,
    borderRadius: 12,
    backgroundColor: "rgba(129, 140, 248, 0.32)",
    borderRightWidth: 2,
    borderRightColor: "rgba(255,255,255,0.78)",
  },
  purchaseShineBuy: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRightColor: "rgba(255,255,255,0.65)",
  },
  cartButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.surface,
  },

  cartStepper: {
    justifyContent: "space-between",
    paddingHorizontal: 6,
    overflow: "visible",
  },

  cartStepperAction: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  cartStepperValue: {
    minWidth: 28,
    textAlign: "center",
    color: colors.primary,
    fontSize: 16,
    fontWeight: "900",
  },

  cartButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },

  buyButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
    backgroundColor: colors.primary,
  },

  disabledBuyButton: {
    backgroundColor: colors.textMuted,
  },

  buyButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  /* =====================================================
       FULL SCREEN VIEWER
    ===================================================== */

  viewerContainer: {
    flex: 1,
    backgroundColor: "#000",
  },

  viewerHeader: {
    position: "absolute",
    zIndex: 20,
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  viewerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  viewerControls: {
    flexDirection: "row",
    gap: 7,
  },

  viewerCounter: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },

  viewerScroll: {
    flex: 1,
  },

  viewerPage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  viewerImageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    alignItems: "center",
    justifyContent: "center",
  },

  viewerImage: {
    width: "100%",
    height: "100%",
  },

  viewerFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
  },

  viewerHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "600",
  },

  /* =====================================================
       REVIEW MODAL
    ===================================================== */

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  reviewModal: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  modalHandle: {
    width: 42,
    height: 4,
    borderRadius: 3,
    alignSelf: "center",
    backgroundColor: colors.borderLight,
    marginBottom: 15,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },

  modalSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },

  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  ratingQuestion: {
    marginTop: 22,
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  ratingLabel: {
    marginTop: 7,
    fontSize: 12,
    color: colors.textSecondary,
  },

  inputLabel: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
  },

  reviewInput: {
    minHeight: 125,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 13,
    padding: 13,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surfaceSoft,
  },

  characterCount: {
    marginTop: 5,
    textAlign: "right",
    fontSize: 10,
    color: colors.textMuted,
  },

  mediaActionRow: {
    marginTop: 12,
  },

  mediaAddButton: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.blueSoft,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  mediaAddIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },

  mediaAddTextWrap: {
    flex: 1,
  },

  mediaAddTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  mediaAddSubtitle: {
    marginTop: 2,
    fontSize: 10,
    color: colors.textSecondary,
  },

  selectedMediaList: {
    paddingTop: 10,
    gap: 8,
  },

  selectedMedia: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surfaceSoft,
    position: "relative",
  },

  selectedMediaImage: {
    width: "100%",
    height: "100%",
  },

  selectedVideoBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
  },

  removeMediaButton: {
    position: "absolute",
    right: 5,
    top: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,24,39,0.75)",
  },

  viewerTouchHint: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 19,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.15)",
  },

  viewerTouchHintText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  viewerSwipeHint: {
    marginTop: 4,
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
  },

  submitReviewButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  submitReviewText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  disabledButton: {
    opacity: 0.45,
  },
});
