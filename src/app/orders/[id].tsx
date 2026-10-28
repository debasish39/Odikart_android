import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { StatusBar } from "expo-status-bar";

import api, { BACKEND_URL } from "../../api/api";
import { cancelOrder } from "../../api/orders";
import { colors } from "../../theme/colors";

/* =========================================================
   SHINE EFFECT
========================================================= */

const ShineSweep = () => {
  const translateX = React.useRef(new Animated.Value(-260)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 460,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(700),
        Animated.timing(translateX, {
          toValue: -260,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [translateX]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFillObject,
        {
          overflow: "hidden",
          transform: [{ translateX }],
        },
      ]}
    >
      <View
        style={{
          width: 70,
          height: "140%",
          marginTop: "-20%",
          backgroundColor: "rgba(255,255,255,0.18)",
          transform: [{ skewX: "-18deg" }],
        }}
      />
    </Animated.View>
  );
};

/* =========================================================
   TYPES
========================================================= */

type OrderItem = {
  _id?: string;
  productId?: string;
  name?: string;
  title?: string;
  productName?: string;

  quantity?: number;

  price?: number;
  total?: number;

  image?: string;
  thumbnail?: string;

  product?: {
    _id?: string;
    id?: string;
    name?: string;
    title?: string;
    image?: string;
    thumbnail?: string;
    media?: {
      thumbnail?: string;
      images?: string[];
    };
  };

  variant?: {
    name?: string;
    sku?: string;
    price?: number;
  };

  variantSku?: string;
  sku?: string;
};

type TimelineItem = {
  status?: string;
  message?: string;
  date?: string;
  createdAt?: string;
  timestamp?: string;
};

type Address = {
  fullName?: string;
  phone?: string;
  email?: string;

  alternatePhone?: string;

  houseNumber?: string;
  street?: string;
  addressLine1?: string;
  addressLine2?: string;
  address?: string;
  locality?: string;
  village?: string;
  block?: string;
  tehsil?: string;
  area?: string;
  landmark?: string;

  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  pinCode?: string;
  zipCode?: string;
  country?: string;
  postOffice?: string;

  deliveryInstructions?: string;

  label?: string;
};

type Order = {
  _id?: string;
  id?: string;

  orderNumber?: string;

  status?: string;
  orderStatus?: string;

  createdAt?: string;
  updatedAt?: string;
  deliveredAt?: string;
  date?: string;

  fullname?: string;
  firstName?: string;
  lastName?: string;

  email?: string;
  phone?: string;

  items?: OrderItem[];
  orderItems?: OrderItem[];

  pricing?: {
    subtotal?: number;
    total?: number;
    grandTotal?: number;
    finalAmount?: number;
    payableAmount?: number;
    discount?: number;
    couponDiscount?: number;
    shippingCharge?: number;
    tax?: number;
  };

  total?: number;
  totalAmount?: number;
  grandTotal?: number;

  payment?: {
    method?: string;
    paymentMethod?: string;
    status?: string;
    paymentStatus?: string;
    transactionId?: string;
    razorpayPaymentId?: string;
  };

  paymentMethod?: string;
  paymentStatus?: string;

  deliveryAddress?: Address;
  shipping?: {
    address?: Address;
    fullName?: string;
    phone?: string;
    email?: string;

    houseNumber?: string;
    street?: string;
    area?: string;
    landmark?: string;

    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    postOffice?: string;
  };

  statusHistory?: TimelineItem[];

  cancellation?: any;
  refund?: any;
  returnDetails?: any;
  trackingId?: string;
  trackingNumber?: string;
  shipment?: {
    trackingId?: string;
    courierName?: string;
    courierPhone?: string;
    courier?: any;
  };
  courier?: any;
  courierDetails?: any;
  assignedCourier?: any;
  courierPhone?: string;
};

/* =========================================================
   HELPERS
========================================================= */

const getOrderId = (order: Order) => {
  return String(order?._id || order?.id || "");
};

const getOrderNumber = (order: Order) => {
  return (
    order?.orderNumber || getOrderId(order).slice(-8).toUpperCase() || "ORDER"
  );
};

const getStatus = (order: Order) => {
  return String(order?.status || order?.orderStatus || "Pending");
};

const getStatusColor = (status: string) => {
  const value = status.toLowerCase();

  if (
    value.includes("deliver") ||
    value.includes("complete") ||
    value.includes("success")
  ) {
    return colors.success;
  }

  if (
    value.includes("cancel") ||
    value.includes("fail") ||
    value.includes("refund")
  ) {
    return colors.error;
  }

  if (value.includes("pending") || value.includes("confirm")) {
    return colors.warning;
  }

  return colors.primary;
};

const getAmount = (order: Order) => {
  const pricing = order?.pricing;

  const amount =
    pricing?.grandTotal ??
    pricing?.finalAmount ??
    pricing?.payableAmount ??
    pricing?.total ??
    order?.grandTotal ??
    order?.totalAmount ??
    order?.total ??
    0;

  return Number(amount) || 0;
};

const getPaymentMethod = (order: Order) => {
  return String(
    order?.paymentMethod ||
      order?.payment?.method ||
      order?.payment?.paymentMethod ||
      "COD",
  );
};

const getPaymentStatus = (order: Order) => {
  return String(
    order?.paymentStatus ||
      order?.payment?.status ||
      order?.payment?.paymentStatus ||
      "",
  );
};

const formatDate = (value?: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getItemName = (item: OrderItem) => {
  return (
    item?.name ||
    item?.title ||
    item?.productName ||
    item?.product?.name ||
    item?.product?.title ||
    "Product"
  );
};

const getItemImage = (item: OrderItem) => {
  return (
    item?.image ||
    item?.thumbnail ||
    item?.product?.image ||
    item?.product?.thumbnail ||
    item?.product?.media?.thumbnail ||
    item?.product?.media?.images?.[0] ||
    null
  );
};

const normalizeImageUrl = (image?: string | null) => {
  if (!image) {
    return null;
  }

  const value = String(image).trim();

  if (!value) {
    return null;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("/")) {
    return `${BACKEND_URL}${value}`;
  }

  return `${BACKEND_URL}/${value}`;
};

const getItemPrice = (item: OrderItem) => {
  return Number(item?.price ?? item?.variant?.price ?? item?.total ?? 0);
};

const getItemQuantity = (item: OrderItem) => {
  return Number(item?.quantity || 1);
};

/* =========================================================
   SCREEN
========================================================= */

export default function OrderDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id?: string | string[];
  }>();

  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [designedAlert, setDesignedAlert] = useState<{
    title: string;
    message?: string;
    buttons?: {
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }[];
  } | null>(null);

  const showDesignedAlert = (
    title: string,
    message?: string,
    buttons?: {
      text: string;
      style?: "cancel" | "destructive" | "default";
      onPress?: () => void;
    }[],
  ) => setDesignedAlert({ title, message, buttons });

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [cancelling, setCancelling] = useState(false);

  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnComment, setReturnComment] = useState("");
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnReasonError, setReturnReasonError] = useState("");
  const [trackingExpanded, setTrackingExpanded] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewImages, setReviewImages] = useState<
    ImagePicker.ImagePickerAsset[]
  >([]);
  const [selectedReviewProductId, setSelectedReviewProductId] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [addressModalVisible, setAddressModalVisible] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressDraft, setAddressDraft] = useState<Address>({});

  /* =====================================================
     LOAD ORDER
  ===================================================== */

  const loadOrder = useCallback(
    async (showLoader = true) => {
      if (!orderId) {
        setLoading(false);
        return;
      }

      try {
        if (showLoader) {
          // Use the last successful response immediately, then refresh it.
          try {
            const cached = await AsyncStorage.getItem(
              `odikart:order-details:${orderId}`,
            );
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && typeof parsed === "object") {
                setOrder(parsed as Order);
                setLoading(false);
              }
            }
          } catch (cacheError) {
            console.log("ORDER CACHE READ ERROR:", cacheError);
          }
          // Keep cached content visible while the network refresh runs.
        }

        console.log("LOADING ORDER:", orderId);

        const response = await api.get(`/order/${orderId}`);

        console.log("ORDER DETAILS RESPONSE:", response?.data);

        const data = response?.data;

        const orderData =
          data?.order || data?.data?.order || data?.data || data;

        if (orderData && typeof orderData === "object") {
          setOrder(orderData as Order);
          try {
            await AsyncStorage.setItem(
              `odikart:order-details:${orderId}`,
              JSON.stringify(orderData),
            );
          } catch (cacheError) {
            console.log("ORDER CACHE WRITE ERROR:", cacheError);
          }
        } else {
          setOrder(null);
        }
      } catch (error: any) {
        console.log("ORDER DETAILS ERROR:", error);

        setOrder((current) => {
          if (current) return current;
          showDesignedAlert(
            "Unable to load order",
            error?.response?.data?.message ||
              error?.message ||
              "Please try again.",
          );
          return null;
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId],
  );

  useEffect(() => {
    loadOrder(true);
  }, [loadOrder]);

  /* =====================================================
     REFRESH
  ===================================================== */

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadOrder(false);
  };

  /* =====================================================
     CANCEL
  ===================================================== */

  const handleCancel = () => {
    if (!orderId) {
      return;
    }

    showDesignedAlert(
      "Cancel Order",
      `Are you sure you want to cancel order #${getOrderNumber(order || {})}?`,
      [
        {
          text: "Keep Order",
          style: "cancel",
        },
        {
          text: "Cancel Order",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);

              const response = await cancelOrder(orderId);

              showDesignedAlert(
                "Order Cancelled",
                response?.message || "Your order has been cancelled.",
              );

              await loadOrder(false);
            } catch (error: any) {
              console.log("CANCEL ERROR:", error);

              showDesignedAlert(
                "Unable to cancel",
                error?.response?.data?.message ||
                  error?.message ||
                  "Please try again.",
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  /* =====================================================
     RETURN REQUEST
  ===================================================== */

  const returnReasons = [
    "Damaged or defective product",
    "Wrong product received",
    "Missing item or parts",
    "Product not as described",
    "Quality issue",
    "Other",
  ];

  const handleSubmitReturn = async () => {
    if (!orderId) return;
    if (!returnReason) {
      setReturnReasonError("Please select a reason for return.");
      return;
    }

    try {
      setSubmittingReturn(true);
      const response = await api.put(`/return/request/${orderId}`, {
        reason: returnReason,
        comment: returnComment.trim(),
        images: [],
        videos: [],
      });

      const responseOrder = response?.data?.order;
      if (responseOrder && typeof responseOrder === "object") {
        setOrder(responseOrder as Order);
        try {
          await AsyncStorage.setItem(
            `odikart:order-details:${orderId}`,
            JSON.stringify(responseOrder),
          );
        } catch (cacheError) {
          console.log("ORDER CACHE WRITE ERROR:", cacheError);
        }
      } else {
        await loadOrder(false);
      }

      setReturnModalVisible(false);
      setReturnReason("");
      setReturnComment("");
      setReturnReasonError("");
      showDesignedAlert(
        "Return request submitted",
        response?.data?.message ||
          "Your return request has been sent to Odikart.",
      );
    } catch (error: any) {
      showDesignedAlert(
        "Unable to request return",
        error?.response?.data?.message || error?.message || "Please try again.",
      );
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Resolve a real MongoDB product _id without converting objects to "[object Object]".
  const getValidProductId = (value: any, depth = 0): string => {
    if (value == null || depth > 4) return "";

    if (typeof value === "string") {
      const candidate = value.trim();
      return /^[a-f\d]{24}$/i.test(candidate) ? candidate : "";
    }

    if (typeof value !== "object") return "";

    // BSON ObjectId instances may expose toHexString().
    if (typeof value.toHexString === "function") {
      try {
        const hex = value.toHexString();
        if (typeof hex === "string" && /^[a-f\d]{24}$/i.test(hex)) {
          return hex;
        }
      } catch {
        // Continue checking regular object fields.
      }
    }

    // Prefer explicit ID fields. Do not use an order-line item's own _id as the product ID.
    for (const candidate of [value._id, value.id, value.productId]) {
      const resolved = getValidProductId(candidate, depth + 1);
      if (resolved) return resolved;
    }

    return "";
  };

  const reviewableItems = (order?.items || order?.orderItems || [])
    .map((item) => ({
      item,
      // productId can be a string, ObjectId, or populated product object.
      productId:
        getValidProductId(item?.productId) || getValidProductId(item?.product),
    }))
    .filter((entry) => /^[a-f\d]{24}$/i.test(entry.productId));

  const pickReviewImages = async () => {
    if (reviewImages.length >= 5) {
      showDesignedAlert("Image limit", "You can upload up to 5 review images.");
      return;
    }
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showDesignedAlert(
          "Permission needed",
          "Allow photo library access to attach product photos.",
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 5 - reviewImages.length,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        setReviewImages((current) =>
          [...current, ...result.assets].slice(0, 5),
        );
      }
    } catch (error) {
      console.log("REVIEW IMAGE PICKER ERROR:", error);
      showDesignedAlert("Unable to select images", "Please try again.");
    }
  };

  const handleSubmitReview = async () => {
    if (!orderId) return;

    if (reviewableItems.length === 0) {
      showDesignedAlert(
        "Product unavailable",
        "We couldn't find a valid product ID. Please refresh your order.",
      );
      return;
    }

    const selectedItem =
      reviewableItems.find(
        (entry) => entry.productId === selectedReviewProductId,
      ) || reviewableItems[0];

    const productId = getValidProductId(selectedItem?.productId);

    // MongoDB ObjectId validation
    if (!/^[a-f\d]{24}$/i.test(productId)) {
      console.log("INVALID REVIEW PRODUCT ID:", {
        productId,
        selectedReviewProductId,
        reviewableItems: reviewableItems.map(({ item, productId }) => ({
          productName: getItemName(item),
          productId,
          rawProductIdType: typeof item?.productId,
          rawProductId: item?.productId,
          populatedProductId: item?.product?._id ?? item?.product?.id ?? null,
        })),
      });

      showDesignedAlert(
        "Invalid product",
        "The product ID is invalid. Refresh your order and try again.",
      );
      return;
    }

    if (reviewRating < 1 || reviewRating > 5) {
      showDesignedAlert("Add a rating", "Please choose between 1 and 5 stars.");
      return;
    }

    if (reviewComment.trim().length < 3) {
      showDesignedAlert(
        "Write a review",
        "Please write at least 3 characters in your review.",
      );
      return;
    }

    try {
      setSubmittingReview(true);

      const formData = new FormData();
      formData.append("rating", String(reviewRating));
      formData.append("comment", reviewComment.trim());

      reviewImages.forEach((asset, index) => {
        if (!asset.uri) return;

        formData.append("images", {
          uri: asset.uri,
          name: asset.fileName || `review-${Date.now()}-${index}.jpg`,
          type: asset.mimeType || "image/jpeg",
        } as any);
      });

      console.log("SUBMITTING REVIEW:", {
        productId,
        rating: reviewRating,
        imageCount: reviewImages.length,
      });

      const response = await api.post(
        `/products/${productId}/review`,
        formData,
      );

      if (response?.data?.success === false) {
        throw new Error(response?.data?.message || "Review submission failed.");
      }

      setReviewSubmitted(true);
      showDesignedAlert(
        "Thank you!",
        "Your product review has been submitted.",
      );
    } catch (error: any) {
      console.log(
        "SUBMIT REVIEW ERROR:",
        error?.response?.data || error?.message || error,
      );

      showDesignedAlert(
        "Couldn't submit review",
        error?.response?.data?.message ||
          error?.message ||
          "Please check your connection and try again.",
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  // Normalize defensively: older orders may have no status/orderStatus field.
  const normalizedStatus = String(
    order?.status || order?.orderStatus || "Pending",
  )
    .toLowerCase()
    .trim();

  // Address changes are available only during the first 30 minutes and
  // only while the order has not entered processing/packing/dispatch.
  const ADDRESS_CHANGE_WINDOW_MS = 30 * 60 * 1000;
  const orderPlacedAt = order?.createdAt || order?.date;
  const orderPlacedTime = orderPlacedAt
    ? new Date(orderPlacedAt).getTime()
    : Number.NaN;
  const hasValidOrderPlacedTime = Number.isFinite(orderPlacedTime);
  const addressChangeWindowOpen =
    hasValidOrderPlacedTime &&
    Date.now() >= orderPlacedTime &&
    Date.now() - orderPlacedTime <= ADDRESS_CHANGE_WINDOW_MS;
  const addressStatusAllowsEdit = [
    "pending",
    "placed",
    "confirmed",
    "order placed",
  ].includes(normalizedStatus);
  const canEditAddress = addressStatusAllowsEdit && addressChangeWindowOpen;
  const courier =
    order?.assignedCourier ||
    order?.courierDetails ||
    order?.courier ||
    order?.shipment?.courier ||
    {};
  const courierName =
    courier?.name ||
    courier?.fullName ||
    courier?.company ||
    order?.shipment?.courierName ||
    "Odikart Delivery Partner";
  const courierPhone =
    courier?.phone ||
    courier?.mobile ||
    courier?.phoneNumber ||
    order?.shipment?.courierPhone ||
    order?.courierPhone ||
    "";

  const handleShareOrder = async () => {
    try {
      await Share.share({
        title: `Odikart order #${getOrderNumber(order || {})}`,
        message: `Odikart Order #${getOrderNumber(order || {})}\nStatus: ${status}\nAmount: ₹${getAmount(order || {}).toLocaleString("en-IN")}\nTrack your order in the Odikart app.`,
      });
    } catch {
      showDesignedAlert("Unable to share", "Please try again.");
    }
  };

  const openAddressEditor = () => {
    if (!canEditAddress) {
      showDesignedAlert(
        "Address locked",
        "The delivery address can only be changed before dispatch.",
      );
      return;
    }
    setAddressDraft({
      fullName:
        address?.fullName ||
        order?.fullname ||
        [order?.firstName, order?.lastName].filter(Boolean).join(" "),
      phone: address?.phone || order?.phone || "",
      houseNumber: address?.houseNumber || "",
      street: address?.street || "",
      addressLine1: address?.addressLine1 || "",
      addressLine2: address?.addressLine2 || "",
      area: address?.area || address?.locality || "",
      locality: address?.locality || "",
      village: address?.village || "",
      block: address?.block || "",
      tehsil: address?.tehsil || "",
      landmark: address?.landmark || "",
      city: address?.city || "",
      district: address?.district || "",
      state: address?.state || "",
      postalCode:
        address?.postalCode || address?.pinCode || address?.zipCode || "",
      country: address?.country || "India",
      deliveryInstructions: address?.deliveryInstructions || "",
      label: address?.label || "",
    });
    setAddressModalVisible(true);
  };

  const updateAddressField = (key: keyof Address, value: string) =>
    setAddressDraft((current) => ({ ...current, [key]: value }));

  const handleSaveAddress = async () => {
    if (!orderId) return;
    if (
      !addressDraft.fullName?.trim() ||
      !addressDraft.phone?.trim() ||
      !addressDraft.houseNumber?.trim() ||
      !addressDraft.city?.trim() ||
      !addressDraft.state?.trim() ||
      !addressDraft.postalCode?.trim()
    ) {
      showDesignedAlert(
        "Missing details",
        "Fill in name, phone, house/building, city, state and PIN code.",
      );
      return;
    }
    if (
      !/^[0-9+\s()-]{8,16}$/.test(addressDraft.phone.trim()) ||
      !/^[0-9]{6}$/.test(addressDraft.postalCode.trim())
    ) {
      showDesignedAlert(
        "Check details",
        "Enter a valid phone number and 6-digit PIN code.",
      );
      return;
    }
    try {
      setSavingAddress(true);
      // Backend must validate order ownership and reject changes after dispatch.
      const response = await api.put(`/order/${orderId}/address`, {
        deliveryAddress: addressDraft,
      });
      const updated =
        response?.data?.order ||
        response?.data?.data?.order ||
        response?.data?.data ||
        response?.data;
      if (
        updated &&
        typeof updated === "object" &&
        (updated._id ||
          updated.id ||
          updated.deliveryAddress ||
          updated.shipping)
      ) {
        setOrder(updated as Order);
        await AsyncStorage.setItem(
          `odikart:order-details:${orderId}`,
          JSON.stringify(updated),
        );
      } else {
        await loadOrder(false);
      }
      setAddressModalVisible(false);
      showDesignedAlert(
        "Address updated",
        "Your delivery address has been updated.",
      );
    } catch (error: any) {
      showDesignedAlert(
        "Couldn't update address",
        error?.response?.data?.message ||
          "The backend must support PUT /order/:id/address and enforce the order-status restriction.",
      );
    } finally {
      setSavingAddress(false);
    }
  };

  /* =====================================================
     ADDRESS
  ===================================================== */

  const address = useMemo(() => {
    if (!order) return null;

    // Current order schema stores the recipient, address fields, and
    // delivery preferences in separate nested objects:
    // deliveryAddress.customer, deliveryAddress.address,
    // and deliveryAddress.preference.
    const delivery: any = order.deliveryAddress;

    if (delivery?.address && typeof delivery.address === "object") {
      const nestedAddress = delivery.address;
      const customer = delivery.customer || {};
      const preference = delivery.preference || {};

      return {
        ...nestedAddress,
        fullName:
          customer.fullName ||
          order.fullname ||
          [order.firstName, order.lastName].filter(Boolean).join(" ") ||
          "Customer",
        phone: customer.phone || order.phone || "",
        alternatePhone: customer.alternatePhone || "",
        email: customer.email || order.email || "",
        deliveryInstructions:
          preference.deliveryInstructions ||
          nestedAddress.deliveryInstructions ||
          "",
        label: nestedAddress.label || preference.addressType || "",
      } as Address;
    }

    // Backward compatibility with older flat-address records and orders
    // that store the address under shipping.
    return (delivery ||
      order.shipping?.address ||
      order.shipping ||
      null) as Address | null;
  }, [order]);

  const addressLines = useMemo(() => {
    if (!address) return [];
    const unique = (values: unknown[]) => [
      ...new Set(
        values.map((value) => String(value || "").trim()).filter(Boolean),
      ),
    ];
    const line1 = unique([
      address.addressLine1,
      [address.houseNumber, address.street].filter(Boolean).join(", "),
      address.address,
    ]).join(", ");
    const line2 = unique([
      address.addressLine2,
      [address.area, address.locality, address.village]
        .filter(Boolean)
        .join(", "),
    ]).join(", ");
    const line3 = unique([
      address.landmark ? `Near ${address.landmark}` : "",
      address.postOffice ? `Post Office: ${address.postOffice}` : "",
    ]).join(" • ");
    const line4 = unique([
      [address.block, address.tehsil].filter(Boolean).join(", "),
      [address.city, address.district].filter(Boolean).join(", "),
    ]).join(", ");
    const line5 = unique([
      address.state,
      address.postalCode || address.pinCode || address.zipCode
        ? `PIN ${address.postalCode || address.pinCode || address.zipCode}`
        : "",
      address.country || "India",
    ]).join(" • ");
    return unique([line1, line2, line3, line4, line5]);
  }, [address]);

  const status = order ? getStatus(order) : "Pending";

  const statusColor = getStatusColor(status);

  const deliveredHistoryEntry = order?.statusHistory?.find((entry) =>
    /delivered/i.test(String(entry?.status || "")),
  );
  const deliveryTimestamp =
    order?.deliveredAt ||
    deliveredHistoryEntry?.createdAt ||
    deliveredHistoryEntry?.date ||
    deliveredHistoryEntry?.timestamp;

  const deliveryTime = deliveryTimestamp
    ? new Date(deliveryTimestamp).getTime()
    : Number.NaN;
  const hasValidDeliveryTime = Number.isFinite(deliveryTime);

  const isReturnAlreadyStarted =
    /return requested|return approved|return pickup|return picked|received by admin|inspection|refund processing|refund completed|return rejected/i.test(
      status,
    );
  // Show the return action for delivered orders even if older order records
  // lack deliveredAt. The backend remains responsible for final eligibility.
  const canRequestReturn =
    status.toLowerCase().trim() === "delivered" &&
    !isReturnAlreadyStarted &&
    (!hasValidDeliveryTime ||
      Date.now() <= deliveryTime + 7 * 24 * 60 * 60 * 1000);

  const paymentMethod = order ? getPaymentMethod(order) : "COD";

  const paymentStatus = order ? getPaymentStatus(order) : "";

  const items = order?.items || order?.orderItems || [];

  const canCancel = ![
    "cancelled",
    "canceled",
    "delivered",
    "completed",
    "shipped",
    "out for delivery",
  ].some((item) => status.toLowerCase().includes(item));

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <Text style={styles.topBarTitle}>Order Details</Text>

          <View style={styles.topBarSpacer} />
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.loadingContent}
        >
          <View style={styles.skeletonHero} />

          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLineWide} />

            <View style={styles.skeletonLineMedium} />

            <View style={styles.skeletonLineSmall} />
          </View>

          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLineWide} />

            <View style={styles.skeletonProduct} />

            <View style={styles.skeletonProduct} />
          </View>

          <View style={styles.skeletonCard}>
            <View style={styles.skeletonLineWide} />

            <View style={styles.skeletonLineMedium} />

            <View style={styles.skeletonLineMedium} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =====================================================
     ERROR / NOT FOUND
  ===================================================== */

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
        <View style={styles.topBar}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <Text style={styles.topBarTitle}>Order Details</Text>

          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.notFound}>
          <View style={styles.notFoundIcon}>
            <Ionicons name="receipt-outline" size={44} color={colors.primary} />
          </View>

          <Text style={styles.notFoundTitle}>Order not found</Text>

          <Text style={styles.notFoundText}>
            We couldn't load the details for this order.
          </Text>

          <Pressable style={styles.retryButton} onPress={() => loadOrder(true)}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />
      {/* TOP BAR */}

      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>

        <Text style={styles.topBarTitle}>Order Details</Text>

        <Pressable style={styles.headerRefresh} onPress={handleRefresh}>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* ODIKART ORDER SUMMARY HERO */}
        <ImageBackground
          source={require("../../../assets/images/odikart-order-banner.png")}
          imageStyle={styles.deliveryBannerImage}
          style={styles.deliveryBanner}
          resizeMode="cover"
        >
          <View pointerEvents="none" style={styles.bannerTextScrim} />
          <View style={styles.deliveryBannerContent}>
            <View style={styles.deliveryBannerPill}>
              <Ionicons name="bag-check-outline" size={13} color="#4338CA" />
              <Text style={styles.deliveryBannerPillText}>ODIKART ORDER</Text>
            </View>
            <Text style={styles.deliveryBannerTitle} numberOfLines={2}>
              Order #{getOrderNumber(order)}
            </Text>
            <Text style={styles.deliveryBannerSubtitle}>
              Placed on{" "}
              {formatDateTime(order.createdAt || order.date) ||
                "Date unavailable"}
            </Text>
            <View style={styles.deliveryBannerTrust}>
              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
              <Text style={styles.deliveryBannerTrustText}>
                {paymentStatus ||
                  (paymentMethod.toLowerCase().includes("cod")
                    ? "Cash on Delivery"
                    : "Payment details available")}
              </Text>
            </View>
          </View>
        </ImageBackground>

        {/* =================================================
            TRACKING TIMELINE
        ================================================= */}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="navigate-outline"
                size={19}
                color={colors.primary}
              />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Order Tracking</Text>

              <Text style={styles.sectionSubtitle}>
                Follow your order status
              </Text>
            </View>
          </View>

          <View style={styles.progressSteps}>
            {[
              {
                label: "Placed",
                icon: "receipt-outline",
                keys: [
                  "pending",
                  "placed",
                  "confirmed",
                  "processing",
                  "packed",
                  "shipped",
                  "out for delivery",
                  "delivered",
                ],
              },
              {
                label: "Packed",
                icon: "cube-outline",
                keys: ["packed", "shipped", "out for delivery", "delivered"],
              },
              {
                label: "Shipped",
                icon: "car-outline",
                keys: ["shipped", "out for delivery", "delivered"],
              },
              {
                label: "On the way",
                icon: "bicycle-outline",
                keys: ["out for delivery", "delivered"],
              },
              {
                label: "Delivered",
                icon: "checkmark-done-outline",
                keys: ["delivered"],
              },
            ].map((step, index, allSteps) => {
              const current = status.toLowerCase();
              const currentStage =
                current.includes("deliver") || current.includes("complete")
                  ? 4
                  : current.includes("out for delivery")
                    ? 3
                    : current.includes("ship") || current.includes("transit")
                      ? 2
                      : current.includes("pack") ||
                          current.includes("ready for pickup")
                        ? 1
                        : 0;
              const completed = index <= currentStage;
              const active = index === currentStage;
              return (
                <React.Fragment key={step.label}>
                  <View style={styles.progressStep}>
                    <View
                      style={[
                        styles.progressStepIcon,
                        completed && styles.progressStepDone,
                        active && styles.progressStepActive,
                      ]}
                    >
                      <Ionicons
                        name={step.icon as any}
                        size={16}
                        color={completed || active ? "#FFFFFF" : "#9CA3AF"}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.progressStepLabel,
                        (completed || active) && styles.progressStepLabelActive,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                  {index < allSteps.length - 1 ? (
                    <View
                      style={[
                        styles.progressConnector,
                        completed && styles.progressConnectorDone,
                      ]}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </View>
          <Pressable
            style={styles.historyToggle}
            onPress={() => setTrackingExpanded((value) => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: trackingExpanded }}
          >
            <Text style={styles.historyToggleText}>
              {trackingExpanded
                ? "Hide tracking history"
                : "View tracking history"}
            </Text>
            <Ionicons
              name={trackingExpanded ? "chevron-up" : "chevron-down"}
              size={17}
              color={colors.primary}
            />
          </Pressable>
          {trackingExpanded ? (
            <View style={styles.timeline}>
              {([
                ...(order.statusHistory || []),
                ...(
                  order.returnDetails?.statusHistory ||
                  order.returnDetails?.timeline ||
                  order.returnDetails?.history ||
                  []
                ).map((entry: any) => ({
                  ...entry,
                  status:
                    entry.status ||
                    entry.stage ||
                    entry.event ||
                    "Return update",
                  message: entry.message || entry.note,
                })),
              ].length > 0
                ? [
                    ...(order.statusHistory || []),
                    ...(
                      order.returnDetails?.statusHistory ||
                      order.returnDetails?.timeline ||
                      order.returnDetails?.history ||
                      []
                    ).map((entry: any) => ({
                      ...entry,
                      status:
                        entry.status ||
                        entry.stage ||
                        entry.event ||
                        "Return update",
                      message: entry.message || entry.note,
                    })),
                  ]
                : [{ status, createdAt: order.updatedAt || order.createdAt }]
              ).map((history, index, array) => {
                const historyStatus = String(history?.status || "Updated");

                const historyColor = getStatusColor(historyStatus);

                const isLast = index === array.length - 1;

                return (
                  <View
                    key={`${historyStatus}-${index}`}
                    style={styles.timelineRow}
                  >
                    <View style={styles.timelineLeft}>
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            backgroundColor: historyColor,
                          },
                        ]}
                      />

                      {!isLast ? (
                        <View
                          style={[
                            styles.timelineLine,
                            {
                              backgroundColor: `${historyColor}30`,
                            },
                          ]}
                        />
                      ) : null}
                    </View>

                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineTitle}>{historyStatus}</Text>

                      {history.message ? (
                        <Text style={styles.timelineMessage}>
                          {history.message}
                        </Text>
                      ) : null}

                      {history.createdAt ||
                      history.date ||
                      history.timestamp ? (
                        <Text style={styles.timelineDate}>
                          {formatDateTime(
                            history.createdAt ||
                              history.date ||
                              history.timestamp,
                          )}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.courierCard}>
          <View style={styles.courierLogo}>
            <Ionicons name="bicycle-outline" size={25} color="#4338CA" />
          </View>
          <View style={styles.courierInfo}>
            <Text style={styles.courierEyebrow}>DELIVERY PARTNER</Text>
            <Text style={styles.courierName}>{courierName}</Text>
            <Text style={styles.courierTracking} numberOfLines={2}>
              {courierPhone
                ? `Contact: ${courierPhone}`
                : "Courier contact appears after a delivery partner is assigned"}
            </Text>
            {!!(
              order?.trackingId ||
              order?.trackingNumber ||
              order?.shipment?.trackingId
            ) && (
              <Text style={styles.courierTracking} numberOfLines={1}>
                Tracking ID:{" "}
                {order?.trackingId ||
                  order?.trackingNumber ||
                  order?.shipment?.trackingId}
              </Text>
            )}
          </View>
          {courierPhone ? (
            <Pressable
              style={styles.courierCallButton}
              accessibilityRole="button"
              accessibilityLabel="Call delivery partner"
              onPress={() =>
                Linking.openURL(
                  `tel:${String(courierPhone).replace(/[^0-9+]/g, "")}`,
                ).catch(() =>
                  showDesignedAlert(
                    "Unable to call",
                    "Your device could not open the phone dialer.",
                  ),
                )
              }
            >
              <Ionicons name="call" size={17} color="#FFFFFF" />
              <Text style={styles.trackButtonText}>Call</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.shareOrderRow}>
          <View style={styles.shareOrderCopy}>
            <Text style={styles.shareOrderTitle}>Keep your order handy</Text>
            <Text style={styles.shareOrderSubtitle}>
              Share the order number and current status.
            </Text>
          </View>
          <Pressable style={styles.shareOrderButton} onPress={handleShareOrder}>
            <Ionicons
              name="share-social-outline"
              size={17}
              color={colors.primary}
            />
            <Text style={styles.shareOrderButtonText}>Share</Text>
          </Pressable>
        </View>

        {/* =================================================
            ITEMS
        ================================================= */}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="bag-outline" size={19} color={colors.primary} />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Items</Text>

              <Text style={styles.sectionSubtitle}>
                {items.length} {items.length === 1 ? "product" : "products"} •{" "}
                {items.reduce((sum, item) => sum + getItemQuantity(item), 0)}{" "}
                {items.reduce((sum, item) => sum + getItemQuantity(item), 0) ===
                1
                  ? "unit"
                  : "units"}
              </Text>
            </View>
          </View>

          {items.length === 0 ? (
            <View style={styles.noItems}>
              <Ionicons
                name="cube-outline"
                size={25}
                color={colors.textMuted}
              />

              <Text style={styles.noItemsText}>
                Product information unavailable
              </Text>
            </View>
          ) : (
            items.map((item, index) => {
              const image = getItemImage(item);

              const name = getItemName(item);

              const quantity = getItemQuantity(item);

              const price = getItemPrice(item);

              return (
                <View
                  key={String(item?._id || item?.productId || index)}
                  style={styles.productRow}
                >
                  <View style={styles.productImage}>
                    {normalizeImageUrl(image) ? (
                      <Image
                        source={{
                          uri: normalizeImageUrl(image) || undefined,
                        }}
                        style={styles.productImageActual}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.productImageFallback}>
                        <Ionicons
                          name="cube-outline"
                          size={25}
                          color={colors.textMuted}
                        />
                      </View>
                    )}

                    {quantity > 1 ? (
                      <View style={styles.quantityBadge}>
                        <Text style={styles.quantityBadgeText}>
                          ×{quantity}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {name}
                    </Text>

                    {item.variantSku || item.sku || item.variant?.sku ? (
                      <Text style={styles.variantText}>
                        SKU: {item.variantSku || item.sku || item.variant?.sku}
                      </Text>
                    ) : null}

                    <Text style={styles.quantityText}>Qty: {quantity}</Text>
                  </View>

                  <Text style={styles.productPrice}>
                    ₹{(price * quantity).toLocaleString("en-IN")}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* =================================================
            DELIVERY ADDRESS
        ================================================= */}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="location-outline"
                size={19}
                color={colors.primary}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Delivery Address</Text>
              <Text style={styles.sectionSubtitle}>
                {canEditAddress
                  ? "You can edit this address for 30 minutes after placing the order"
                  : !addressStatusAllowsEdit
                    ? "Address locked because order processing has started"
                    : !hasValidOrderPlacedTime
                      ? "Address locked because the order time is unavailable"
                      : "Address changes are available only in the first 30 minutes"}
              </Text>
            </View>
            <Pressable
              style={[
                styles.editAddressButton,
                !canEditAddress && styles.editAddressButtonDisabled,
              ]}
              onPress={openAddressEditor}
              disabled={!canEditAddress}
              accessibilityRole="button"
              accessibilityLabel={
                canEditAddress
                  ? "Edit delivery address"
                  : "Delivery address locked"
              }
            >
              <Ionicons
                name={canEditAddress ? "create-outline" : "lock-closed-outline"}
                size={15}
                color={canEditAddress ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.editAddressText,
                  !canEditAddress && { color: colors.textMuted },
                ]}
              >
                {canEditAddress ? "Edit" : "Locked"}
              </Text>
            </Pressable>
          </View>

          {address ? (
            <View style={styles.addressBox}>
              <View style={styles.addressTop}>
                <Text style={styles.addressName}>
                  {address.fullName ||
                    order.fullname ||
                    [order.firstName, order.lastName]
                      .filter(Boolean)
                      .join(" ") ||
                    "Customer"}
                </Text>

                {address.label ? (
                  <View style={styles.addressLabel}>
                    <Text style={styles.addressLabelText}>{address.label}</Text>
                  </View>
                ) : null}
              </View>

              {addressLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.addressLine}>
                  {line}
                </Text>
              ))}

              {address.phone || order.phone ? (
                <View style={styles.contactRow}>
                  <Ionicons
                    name="call-outline"
                    size={15}
                    color={colors.textSecondary}
                  />

                  <Text style={styles.contactText}>
                    {address.phone || order.phone}
                  </Text>
                </View>
              ) : null}

              {address.email || order.email ? (
                <View style={styles.contactRow}>
                  <Ionicons
                    name="mail-outline"
                    size={15}
                    color={colors.textSecondary}
                  />

                  <Text style={styles.contactText}>
                    {address.email || order.email}
                  </Text>
                </View>
              ) : null}

              {address.deliveryInstructions ? (
                <View style={styles.instructionsBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={17}
                    color={colors.primary}
                  />

                  <Text style={styles.instructionsText}>
                    {address.deliveryInstructions}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.noAddress}>Delivery address unavailable.</Text>
          )}
        </View>

        {/* =================================================
            PAYMENT
        ================================================= */}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="card-outline" size={19} color={colors.primary} />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Payment</Text>

              <Text style={styles.sectionSubtitle}>Payment information</Text>
            </View>
          </View>

          <View style={styles.paymentRow}>
            <View style={styles.paymentIcon}>
              <Ionicons
                name={
                  paymentMethod.toLowerCase().includes("cod")
                    ? "cash-outline"
                    : "card-outline"
                }
                size={21}
                color={colors.primary}
              />
            </View>

            <View style={styles.paymentInfo}>
              <Text style={styles.paymentMethod}>
                {paymentMethod.toUpperCase()}
              </Text>

              <Text style={styles.paymentSubtext}>
                {paymentStatus || "Payment information"}
              </Text>
            </View>

            {paymentStatus ? (
              <View style={styles.paidBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={colors.success}
                />

                <Text style={styles.paidText}>{paymentStatus}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* =================================================
            PRICE SUMMARY
        ================================================= */}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons
                name="receipt-outline"
                size={19}
                color={colors.primary}
              />
            </View>

            <View>
              <Text style={styles.sectionTitle}>Price Summary</Text>

              <Text style={styles.sectionSubtitle}>
                Order payment breakdown
              </Text>
            </View>
          </View>

          <View style={styles.priceRows}>
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>

              <Text style={styles.priceValue}>
                ₹{Number(order.pricing?.subtotal ?? 0).toLocaleString("en-IN")}
              </Text>
            </View>

            {Number(
              order.pricing?.discount ?? order.pricing?.couponDiscount ?? 0,
            ) > 0 ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Discount</Text>

                <Text style={styles.discountValue}>
                  -₹
                  {Number(
                    order.pricing?.discount ??
                      order.pricing?.couponDiscount ??
                      0,
                  ).toLocaleString("en-IN")}
                </Text>
              </View>
            ) : null}

            {Number(order.pricing?.shippingCharge ?? 0) > 0 ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery</Text>

                <Text style={styles.priceValue}>
                  ₹
                  {Number(order.pricing?.shippingCharge ?? 0).toLocaleString(
                    "en-IN",
                  )}
                </Text>
              </View>
            ) : (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Delivery</Text>

                <Text style={styles.freeText}>FREE</Text>
              </View>
            )}

            {Number(order.pricing?.tax ?? 0) > 0 ? (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Tax</Text>

                <Text style={styles.priceValue}>
                  ₹{Number(order.pricing?.tax ?? 0).toLocaleString("en-IN")}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.finalTotalRow}>
            <View>
              <Text style={styles.finalTotalLabel}>Total Amount</Text>

              <Text style={styles.finalTotalSubtext}>
                Inclusive of applicable charges
              </Text>
            </View>

            <Text style={styles.finalTotal}>
              ₹{getAmount(order).toLocaleString("en-IN")}
            </Text>
          </View>
        </View>

        {/* =================================================
            CANCEL
        ================================================= */}

        {canCancel ? (
          <Pressable
            style={[styles.cancelButton, cancelling && styles.disabledButton]}
            disabled={cancelling}
            onPress={handleCancel}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons
                  name="close-circle-outline"
                  size={19}
                  color={colors.error}
                />

                <Text style={styles.cancelButtonText}>Cancel Order</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {/* RETURN / REFUND STATUS */}
        {isReturnAlreadyStarted ? (
          <View style={styles.returnStatusCard}>
            <View style={styles.returnStatusIcon}>
              <Ionicons
                name="return-down-back-outline"
                size={22}
                color={colors.primary}
              />
            </View>
            <View style={styles.returnStatusContent}>
              <Text style={styles.returnStatusTitle}>Return & refund</Text>
              <Text style={styles.returnStatusText}>
                {status === "Return Rejected"
                  ? "Your return request was rejected. Contact support if you need help."
                  : status === "Refund Completed"
                    ? "Your refund has been marked as completed."
                    : `Current status: ${status}`}
              </Text>
              {!!order.returnDetails?.reason && (
                <Text style={styles.returnReasonSummary}>
                  Reason: {order.returnDetails.reason}
                </Text>
              )}
              {!!order.returnDetails?.refundAmount && (
                <Text style={styles.returnReasonSummary}>
                  Refund amount: ₹
                  {Number(order.returnDetails.refundAmount).toLocaleString(
                    "en-IN",
                  )}
                </Text>
              )}
            </View>
          </View>
        ) : canRequestReturn ? (
          <Pressable
            style={styles.returnButton}
            onPress={() => setReturnModalVisible(true)}
          >
            <Ionicons
              name="return-down-back-outline"
              size={19}
              color={colors.primary}
            />
            <Text style={styles.returnButtonText}>Return / Request Refund</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </Pressable>
        ) : status.toLowerCase().trim() === "delivered" &&
          hasValidDeliveryTime &&
          Date.now() > deliveryTime + 7 * 24 * 60 * 60 * 1000 ? (
          <View style={styles.returnInfoCard}>
            <Ionicons name="time-outline" size={19} color={colors.textMuted} />
            <Text style={styles.returnInfoText}>
              The 7-day return window has ended for this order. If there is a
              product issue, please contact Odikart support.
            </Text>
          </View>
        ) : null}

        {status.toLowerCase().trim() === "delivered" ? (
          <View style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={styles.reviewIcon}>
                <Ionicons name="star" size={21} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>
                  {reviewSubmitted
                    ? "Thanks for your feedback!"
                    : "How was your order?"}
                </Text>
                <Text style={styles.reviewSubtitle}>
                  {reviewSubmitted
                    ? "Your review has been submitted."
                    : "Your review helps other Odikart shoppers."}
                </Text>
              </View>
              {reviewSubmitted ? (
                <Ionicons name="checkmark-circle" size={24} color="#16A34A" />
              ) : null}
            </View>
            {!reviewSubmitted ? (
              <>
                {reviewableItems.length > 1 ? (
                  <>
                    <Text style={styles.reviewPrompt}>
                      Choose a product to review
                    </Text>
                    <View style={styles.reviewProductChoices}>
                      {reviewableItems.map(({ item, productId }) => {
                        const selected =
                          (selectedReviewProductId ||
                            reviewableItems[0]?.productId) === productId;
                        return (
                          <Pressable
                            key={productId}
                            onPress={() =>
                              setSelectedReviewProductId(productId)
                            }
                            style={[
                              styles.reviewProductChoice,
                              selected && styles.reviewProductChoiceSelected,
                            ]}
                          >
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.reviewProductChoiceText,
                                selected &&
                                  styles.reviewProductChoiceTextSelected,
                              ]}
                            >
                              {getItemName(item)}
                            </Text>
                            {selected ? (
                              <Ionicons
                                name="checkmark-circle"
                                size={17}
                                color={colors.primary}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
                <Text style={styles.reviewPrompt}>Rate your experience</Text>
                <View style={styles.reviewStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => setReviewRating(star)}
                      accessibilityRole="button"
                      accessibilityLabel={`${star} star${star > 1 ? "s" : ""}`}
                      style={styles.reviewStarButton}
                    >
                      <Ionicons
                        name={star <= reviewRating ? "star" : "star-outline"}
                        size={31}
                        color={star <= reviewRating ? "#F59E0B" : "#CBD5E1"}
                      />
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.reviewRatingHint}>
                  {reviewRating === 0
                    ? "Tap a star to rate your experience"
                    : [
                        "",
                        "We’re sorry it wasn’t great.",
                        "We’ll work to do better.",
                        "Thanks for your feedback!",
                        "Glad you enjoyed it!",
                        "Awesome! Thanks for loving Odikart!",
                      ][reviewRating]}
                </Text>
                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Write your review (at least 3 characters)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  maxLength={600}
                  textAlignVertical="top"
                  style={styles.reviewInput}
                />
                <View style={styles.reviewUploadHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewPrompt}>Add product photos</Text>
                    <Text style={styles.reviewUploadHint}>
                      Optional • Up to 5 images
                    </Text>
                  </View>
                  <Pressable
                    style={styles.reviewAddPhotoButton}
                    onPress={pickReviewImages}
                    disabled={submittingReview || reviewImages.length >= 5}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={17}
                      color={colors.primary}
                    />
                    <Text style={styles.reviewAddPhotoText}>Add photos</Text>
                  </Pressable>
                </View>
                {reviewImages.length ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.reviewImageList}
                  >
                    {reviewImages.map((asset, index) => (
                      <View
                        key={`${asset.uri}-${index}`}
                        style={styles.reviewImagePreviewWrap}
                      >
                        <Image
                          source={{ uri: asset.uri }}
                          style={styles.reviewImagePreview}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Remove review image"
                          style={styles.reviewImageRemove}
                          onPress={() =>
                            setReviewImages((current) =>
                              current.filter(
                                (_, imageIndex) => imageIndex !== index,
                              ),
                            )
                          }
                        >
                          <Ionicons name="close" size={13} color="#FFFFFF" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
                <Pressable
                  style={[
                    styles.reviewSubmitButton,
                    submittingReview && styles.disabledButton,
                  ]}
                  disabled={submittingReview}
                  onPress={handleSubmitReview}
                >
                  {submittingReview ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={17} color="#FFFFFF" />
                      <Text style={styles.reviewSubmitText}>Submit Review</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}

        <Modal
          visible={addressModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => !savingAddress && setAddressModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.addressModal}>
              <View style={styles.modalHandle} />
              <View style={styles.returnModalHeader}>
                <View style={styles.returnModalIcon}>
                  <Ionicons
                    name="location-outline"
                    size={23}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.returnModalTitle}>
                    Edit delivery address
                  </Text>
                  <Text style={styles.returnModalSubtitle}>
                    Only before dispatch
                  </Text>
                </View>
                <Pressable
                  disabled={savingAddress}
                  onPress={() => setAddressModalVisible(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={21} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {(
                  [
                    ["fullName", "Full name *"],
                    ["phone", "Phone number *"],
                    ["houseNumber", "House / building *"],
                    ["street", "Street"],
                    ["area", "Area / locality"],
                    ["landmark", "Landmark"],
                    ["city", "City *"],
                    ["district", "District"],
                    ["state", "State *"],
                    ["postalCode", "6-digit PIN code *"],
                    ["deliveryInstructions", "Delivery instructions"],
                  ] as [keyof Address, string][]
                ).map(([key, label]) => (
                  <View key={key} style={styles.addressFieldWrap}>
                    <Text style={styles.formLabel}>{label}</Text>
                    <TextInput
                      value={String(addressDraft[key] || "")}
                      onChangeText={(value) => updateAddressField(key, value)}
                      placeholder={label.replace(" *", "")}
                      placeholderTextColor={colors.textMuted}
                      keyboardType={
                        key === "phone" || key === "postalCode"
                          ? "phone-pad"
                          : "default"
                      }
                      multiline={key === "deliveryInstructions"}
                      maxLength={key === "deliveryInstructions" ? 180 : 100}
                      style={[
                        styles.addressField,
                        key === "deliveryInstructions" && {
                          minHeight: 68,
                          textAlignVertical: "top",
                        },
                      ]}
                    />
                  </View>
                ))}
                <View style={styles.returnPolicyNote}>
                  <Ionicons
                    name="information-circle-outline"
                    size={17}
                    color={colors.primary}
                  />
                  <Text style={styles.returnPolicyText}>
                    Address changes are disabled once the order enters packing,
                    shipping, delivery, cancellation or completion.
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.submitReturnButton,
                    savingAddress && styles.disabledButton,
                  ]}
                  disabled={savingAddress}
                  onPress={handleSaveAddress}
                >
                  {savingAddress ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.submitReturnText}>
                        Save new address
                      </Text>
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </>
                  )}
                </Pressable>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={returnModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() =>
            !submittingReturn && setReturnModalVisible(false)
          }
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.returnModal}>
              <View style={styles.modalHandle} />
              <View style={styles.returnModalHeader}>
                <View style={styles.returnModalIcon}>
                  <Ionicons
                    name="return-down-back-outline"
                    size={23}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.returnModalTitle}>Request a return</Text>
                  <Text style={styles.returnModalSubtitle}>
                    Order #{getOrderNumber(order)}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel="Close return form"
                  disabled={submittingReturn}
                  onPress={() => setReturnModalVisible(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={21} color={colors.text} />
                </Pressable>
              </View>

              <Text style={styles.formLabel}>
                Why are you returning this order?
              </Text>
              {returnReasons.map((reason) => (
                <Pressable
                  key={reason}
                  style={[
                    styles.reasonOption,
                    returnReason === reason && styles.reasonOptionSelected,
                  ]}
                  onPress={() => {
                    setReturnReason(reason);
                    setReturnReasonError("");
                  }}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      returnReason === reason && styles.radioOuterSelected,
                    ]}
                  >
                    {returnReason === reason ? (
                      <View style={styles.radioInner} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.reasonText,
                      returnReason === reason && styles.reasonTextSelected,
                    ]}
                  >
                    {reason}
                  </Text>
                </Pressable>
              ))}
              {!!returnReasonError && (
                <Text style={styles.formError}>{returnReasonError}</Text>
              )}

              <Text style={styles.formLabel}>
                Additional details (optional)
              </Text>
              <TextInput
                value={returnComment}
                onChangeText={setReturnComment}
                placeholder="Tell us a little more about the issue..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={styles.returnCommentInput}
              />
              <Text style={styles.commentCounter}>
                {returnComment.length}/500
              </Text>

              <View style={styles.returnPolicyNote}>
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={colors.primary}
                />
                <Text style={styles.returnPolicyText}>
                  Returns are available within 7 days of delivery, subject to
                  eligibility and review.
                </Text>
              </View>

              <Pressable
                style={[
                  styles.submitReturnButton,
                  submittingReturn && styles.disabledButton,
                ]}
                disabled={submittingReturn}
                onPress={handleSubmitReturn}
              >
                {submittingReturn ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitReturnText}>
                      Submit return request
                    </Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={!!designedAlert}
          transparent
          animationType="fade"
          onRequestClose={() => setDesignedAlert(null)}
        >
          <View style={styles.alertBackdrop}>
            <View style={styles.alertCard}>
              <View style={styles.alertIconWrap}>
                <Ionicons
                  name={
                    /unable|couldn't|invalid|error|missing|failed|limit|locked/i.test(
                      designedAlert?.title || "",
                    )
                      ? "alert-circle-outline"
                      : /cancel/i.test(designedAlert?.title || "")
                        ? "close-circle-outline"
                        : /thank|success|updated|submitted/i.test(
                              designedAlert?.title || "",
                            )
                          ? "checkmark-circle-outline"
                          : "information-circle-outline"
                  }
                  size={30}
                  color={
                    /unable|couldn't|invalid|error|missing|failed|limit|locked/i.test(
                      designedAlert?.title || "",
                    )
                      ? "#DC2626"
                      : colors.primary
                  }
                />
              </View>
              <Text style={styles.alertTitle}>{designedAlert?.title}</Text>
              {!!designedAlert?.message && (
                <Text style={styles.alertMessage}>{designedAlert.message}</Text>
              )}
              <View style={styles.alertActions}>
                {(designedAlert?.buttons?.length
                  ? designedAlert.buttons
                  : [{ text: "Got it" }]
                ).map((button, index, all) => (
                  <Pressable
                    key={`${button.text}-${index}`}
                    style={[
                      styles.alertButton,
                      index > 0 && styles.alertSecondaryButton,
                      button.style === "destructive" &&
                        styles.alertDestructiveButton,
                      all.length > 1 && styles.alertButtonMultiple,
                    ]}
                    onPress={() => {
                      setDesignedAlert(null);
                      button.onPress?.();
                    }}
                  >
                    <Text
                      style={[
                        styles.alertButtonText,
                        index > 0 && styles.alertSecondaryButtonText,
                        button.style === "destructive" &&
                          styles.alertDestructiveButtonText,
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

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  topBar: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  topBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
  },

  topBarSpacer: {
    width: 42,
  },

  headerRefresh: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  deliveryBanner: {
    height: 164,
    borderRadius: 22,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 14,
    backgroundColor: "#EEEAFE",
    position: "relative",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E1FF",
  },
  deliveryBannerImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    borderRadius: 22,
    resizeMode: "contain",
  },
  bannerTextScrim: {
    ...StyleSheet.absoluteFillObject,
    width: "68%",
    backgroundColor: "rgba(250,249,255,0.76)",
    borderTopLeftRadius: 22,
    borderBottomLeftRadius: 22,
  },
  deliveryBannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  deliveryBannerContent: {
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: "47%",
    zIndex: 2,
  },
  deliveryBannerPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.82)",
    marginBottom: 7,
  },
  deliveryBannerPillText: {
    color: "#4338CA",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  deliveryBannerTitle: {
    color: "#17145B",
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  deliveryBannerSubtitle: {
    color: "#4B5563",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 5,
    maxWidth: 210,
  },
  deliveryBannerTrust: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 7,
    gap: 5,
  },
  deliveryBannerTrustText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "800",
  },
  deliveryBannerArt: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    width: 88,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  deliveryBannerArtCircle: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.17)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-8deg" }],
  },
  deliveryBannerSparkle: {
    position: "absolute",
    top: 32,
    right: 0,
    width: 29,
    height: 29,
    borderRadius: 10,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.75)",
  },

  /* =====================================================
       HERO
    ===================================================== */

  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,

    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 3,
  },

  heroIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  heroContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  heroLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.textMuted,
    letterSpacing: 1,
  },

  heroOrderNumber: {
    marginTop: 2,
    fontSize: 17,
    fontWeight: "900",
    color: colors.text,
  },

  heroDate: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textSecondary,
  },

  heroStatus: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    maxWidth: 105,
  },

  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },

  heroStatusText: {
    fontSize: 10,
    fontWeight: "800",
    flexShrink: 1,
  },

  /* =====================================================
       CARD
    ===================================================== */

  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,

    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },

  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
  },

  sectionSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textSecondary,
  },

  /* =====================================================
       TIMELINE
    ===================================================== */

  progressSteps: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 4,
    marginBottom: 18,
  },
  progressStep: { width: 53, alignItems: "center" },
  progressStepIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  progressStepDone: { backgroundColor: "#22C55E", borderColor: "#22C55E" },
  progressStepActive: {
    backgroundColor: "#4F46E5",
    borderColor: "#C7D2FE",
    borderWidth: 3,
    width: 40,
    height: 40,
    borderRadius: 20,
    marginTop: -3,
  },
  progressStepLabel: {
    marginTop: 7,
    fontSize: 9,
    color: "#9CA3AF",
    fontWeight: "700",
    textAlign: "center",
  },
  progressStepLabelActive: { color: colors.text },
  progressConnector: {
    flex: 1,
    height: 3,
    marginTop: 15,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
  },
  progressConnectorDone: { backgroundColor: "#22C55E" },
  historyToggle: {
    minHeight: 39,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F5F3FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  historyToggleText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  timeline: {
    paddingLeft: 2,
  },

  timelineRow: {
    flexDirection: "row",
    minHeight: 65,
  },

  timelineLeft: {
    width: 28,
    alignItems: "center",
  },

  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 3,
    marginBottom: -2,
  },

  timelineContent: {
    flex: 1,
    paddingLeft: 7,
    paddingBottom: 16,
  },

  timelineTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  timelineMessage: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textSecondary,
  },

  timelineDate: {
    marginTop: 5,
    fontSize: 10,
    color: colors.textMuted,
  },

  courierCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    marginBottom: 14,
    borderRadius: 19,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  courierLogo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  courierInfo: { flex: 1, minWidth: 0 },
  courierEyebrow: {
    color: "#6366F1",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  courierName: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "900",
    color: "#17145B",
  },
  courierTracking: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 14,
    color: "#5B6478",
  },
  trackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#4F46E5",
  },
  trackButtonText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  courierCallButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#16A34A",
  },
  shareOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    marginBottom: 14,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  shareOrderCopy: { flex: 1 },
  shareOrderTitle: { fontSize: 12, fontWeight: "800", color: colors.text },
  shareOrderSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
    color: colors.textSecondary,
  },
  shareOrderButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: colors.blueSoft,
  },
  shareOrderButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
  },

  /* =====================================================
       PRODUCTS
    ===================================================== */

  productRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSoft,
  },

  productImage: {
    width: 68,
    height: 68,
    borderRadius: 15,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  productImageActual: {
    width: "100%",
    height: "100%",
  },

  productImageFallback: {
    flex: 1,
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSoft,
  },

  quantityBadge: {
    position: "absolute",
    right: 5,
    bottom: 5,
    minWidth: 25,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 8,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },

  quantityBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.textWhite,
  },

  productInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  productName: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: colors.text,
  },

  variantText: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textMuted,
  },

  quantityText: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },

  productPrice: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  noItems: {
    minHeight: 70,
    borderRadius: 15,
    backgroundColor: colors.surfaceSoft,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },

  noItemsText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* =====================================================
       ADDRESS
    ===================================================== */

  editAddressButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.blueSoft,
  },
  editAddressButtonDisabled: { backgroundColor: colors.surfaceSoft },
  editAddressText: { fontSize: 11, fontWeight: "800", color: colors.primary },
  addressBox: {
    backgroundColor: "#F8FAFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E4E9F5",
  },

  addressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  addressName: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "900",
    color: "#172033",
  },

  addressLabel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.blueSoft,
  },

  addressLabelText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
  },

  addressLine: {
    fontSize: 12,
    lineHeight: 19,
    color: "#4B5568",
    marginBottom: 2,
    flexShrink: 1,
  },

  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 10,
    gap: 8,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: "#E5EAF4",
  },

  contactText: {
    flex: 1,
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#344054",
    fontWeight: "600",
  },

  instructionsBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
    flexDirection: "row",
    gap: 7,
  },

  instructionsText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  noAddress: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 15,
  },

  /* =====================================================
       PAYMENT
    ===================================================== */

  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  paymentIcon: {
    width: 45,
    height: 45,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  paymentInfo: {
    flex: 1,
    marginLeft: 11,
  },

  paymentMethod: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  paymentSubtext: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: "capitalize",
  },

  paidBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  paidText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.success,
    textTransform: "capitalize",
  },

  /* =====================================================
       PRICE
    ===================================================== */

  priceRows: {
    gap: 12,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  priceLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  priceValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
  },

  discountValue: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.success,
  },

  freeText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.success,
  },

  totalDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 15,
  },

  finalTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  finalTotalLabel: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.text,
  },

  finalTotalSubtext: {
    marginTop: 3,
    fontSize: 9,
    color: colors.textMuted,
  },

  finalTotal: {
    fontSize: 21,
    fontWeight: "900",
    color: colors.primary,
  },

  reviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E6E8F4",
    shadowColor: "#172554",
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F8",
  },
  reviewIcon: {
    width: 43,
    height: 43,
    borderRadius: 15,
    backgroundColor: "#FFF7E6",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewTitle: { fontSize: 15, fontWeight: "900", color: colors.text },
  reviewSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  reviewPrompt: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 9,
  },
  reviewStars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
    padding: 12,
    borderRadius: 15,
    backgroundColor: "#FFFBEB",
    alignSelf: "flex-start",
  },
  reviewStarButton: { padding: 3 },
  reviewRatingHint: {
    fontSize: 11,
    lineHeight: 16,
    color: "#8A5A00",
    fontWeight: "700",
    marginTop: -8,
    marginBottom: 14,
  },
  reviewProductChoices: { gap: 8, marginBottom: 15 },
  reviewProductChoice: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: "#FAFAFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  reviewProductChoiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft,
  },
  reviewProductChoiceText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  reviewProductChoiceTextSelected: { color: colors.primary, fontWeight: "800" },
  reviewUploadHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  reviewUploadHint: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: -4,
    marginBottom: 5,
  },
  reviewAddPhotoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft,
  },
  reviewAddPhotoText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  reviewImageList: { gap: 10, paddingBottom: 12 },
  reviewImagePreviewWrap: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: "visible",
    position: "relative",
  },
  reviewImagePreview: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
  },
  reviewImageRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  reviewInput: {
    minHeight: 100,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: "#E1E6F0",
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
    backgroundColor: "#FAFBFE",
    marginBottom: 13,
  },
  reviewSubmitButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewSubmitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  /* =====================================================
       CANCEL
    ===================================================== */

  cancelButton: {
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: `${colors.error}35`,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 2,
  },

  disabledButton: {
    opacity: 0.55,
  },

  cancelButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.error,
  },

  returnButton: {
    minHeight: 52,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${colors.primary}35`,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    marginBottom: 4,
  },
  returnButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
  },
  returnStatusCard: {
    flexDirection: "row",
    gap: 12,
    padding: 15,
    borderRadius: 17,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 12,
  },
  returnStatusIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  returnStatusContent: { flex: 1 },
  returnStatusTitle: { fontSize: 13, fontWeight: "900", color: colors.text },
  returnStatusText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  returnReasonSummary: { marginTop: 6, fontSize: 11, color: colors.textMuted },
  returnInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: 12,
  },
  returnInfoText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(10,16,35,0.58)",
  },
  addressModal: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 26,
  },
  addressFieldWrap: { marginBottom: 10 },
  addressField: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 13,
  },
  returnModal: {
    maxHeight: "92%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 4,
    backgroundColor: colors.borderLight,
    marginBottom: 18,
  },
  returnModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 22,
  },
  returnModalIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  returnModalTitle: { fontSize: 18, fontWeight: "900", color: colors.text },
  returnModalSubtitle: {
    marginTop: 3,
    fontSize: 11,
    color: colors.textSecondary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 10,
    marginTop: 2,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    marginBottom: 7,
  },
  reasonOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.blueSoft,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonText: { flex: 1, fontSize: 12, color: colors.textSecondary },
  reasonTextSelected: { color: colors.primary, fontWeight: "800" },
  formError: { color: colors.error, fontSize: 11, marginBottom: 8 },
  returnCommentInput: {
    minHeight: 82,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 13,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 12,
  },
  commentCounter: {
    textAlign: "right",
    marginTop: 5,
    marginBottom: 12,
    fontSize: 10,
    color: colors.textMuted,
  },
  returnPolicyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
    marginBottom: 14,
  },
  returnPolicyText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  submitReturnButton: {
    minHeight: 49,
    borderRadius: 15,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  submitReturnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "900" },

  alertBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    backgroundColor: "rgba(12,18,38,0.58)",
  },
  alertCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E7EAF2",
    shadowColor: "#0F172A",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  alertIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 21,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  alertTitle: {
    color: "#172033",
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "900",
  },
  alertMessage: {
    marginTop: 8,
    color: "#667085",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  alertActions: {
    flexDirection: "row",
    width: "100%",
    gap: 9,
    marginTop: 22,
  },
  alertButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: colors.primary,
  },
  alertButtonMultiple: { flex: 1 },
  alertSecondaryButton: {
    backgroundColor: "#F1F4F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  alertDestructiveButton: { backgroundColor: "#DC2626" },
  alertButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  alertSecondaryButtonText: { color: "#344054" },
  alertDestructiveButtonText: { color: "#FFFFFF" },

  bottomSpace: {
    height: 20,
  },

  /* =====================================================
       NOT FOUND
    ===================================================== */

  notFound: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
  },

  notFoundIcon: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  notFoundTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: colors.text,
  },

  notFoundText: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },

  retryButton: {
    marginTop: 22,
    height: 46,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  retryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },

  /* =====================================================
       SKELETON
    ===================================================== */

  loadingContent: {
    padding: 16,
  },

  skeletonHero: {
    height: 92,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    marginBottom: 14,
  },

  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  skeletonLineWide: {
    width: "65%",
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.surfaceSoft,
    marginBottom: 14,
  },

  skeletonLineMedium: {
    width: "45%",
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.surfaceSoft,
    marginBottom: 10,
  },

  skeletonLineSmall: {
    width: "30%",
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.surfaceSoft,
  },

  skeletonProduct: {
    height: 75,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    marginTop: 12,
  },
});
