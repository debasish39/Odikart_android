import React, { useCallback, useMemo, useRef, useState } from "react";

import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { useFocusEffect, useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { cancelOrder, getMyOrders } from "../../api/orders";

import { BACKEND_URL } from "../../api/api";

import { colors } from "../../theme/colors";

/* =========================================================
   TYPES
========================================================= */

type OrderItem = {
  _id?: string;
  productId?: string;

  product?: {
    _id?: string;
    name?: string;
    title?: string;
    image?: string;
    thumbnail?: string;

    media?: {
      thumbnail?: string;
      images?: string[];
    };
  };

  name?: string;
  title?: string;
  productName?: string;

  quantity?: number;

  price?: number;
  total?: number;

  image?: string;
  thumbnail?: string;

  variantSku?: string;
  sku?: string;

  variant?: {
    name?: string;
    sku?: string;
    price?: number;
  };
};

type Order = {
  _id?: string;
  id?: string;

  orderNumber?: string;

  totalAmount?: number;
  total?: number;
  grandTotal?: number;

  status?: string;
  orderStatus?: string;

  createdAt?: string;
  date?: string;
  updatedAt?: string;

  paymentMethod?: string;
  paymentStatus?: string;

  payment?: {
    method?: string;
    paymentMethod?: string;
    status?: string;
    paymentStatus?: string;
    transactionId?: string;
    razorpayPaymentId?: string;
  };

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

  items?: OrderItem[];
  orderItems?: OrderItem[];

  deliveryAddress?: any;

  fullname?: string;
  email?: string;
  phone?: string;

  statusHistory?: Array<{
    status?: string;
    date?: string;
    createdAt?: string;
    timestamp?: string;
    message?: string;
  }>;

  cancellation?: any;
  refund?: any;
  returnDetails?: any;
};

/* =========================================================
   FILTERS
========================================================= */

const STATUS_FILTERS = [
  {
    key: "All",
    label: "All",
  },
  {
    key: "Active",
    label: "Active",
  },
  {
    key: "Delivered",
    label: "Delivered",
  },
  {
    key: "Cancelled",
    label: "Cancelled",
  },
  {
    key: "Pending",
    label: "Pending",
  },
];

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

const getDateValue = (order: Order) => {
  return order?.createdAt || order?.date || order?.updatedAt;
};

const getDate = (order: Order) => {
  const value = getDateValue(order);

  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getItems = (order: Order) => {
  const items = order?.items || order?.orderItems || [];

  return Array.isArray(items) ? items : [];
};

const getItemCount = (order: Order) => {
  const items = getItems(order);

  return items.reduce((total, item) => total + Number(item?.quantity || 1), 0);
};

const getItemName = (item?: OrderItem) => {
  if (!item) {
    return "Order item";
  }

  return (
    item?.name ||
    item?.title ||
    item?.productName ||
    item?.product?.name ||
    item?.product?.title ||
    "Product"
  );
};

const getItemImage = (item?: OrderItem) => {
  if (!item) {
    return null;
  }

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

/* =========================================================
   ORDER PRODUCT PREVIEW
========================================================= */

const getOrderPreviewItems = (order: Order) => {
  const items = getItems(order);

  return items.slice(0, 3);
};

const getRemainingItemCount = (order: Order) => {
  const items = getItems(order);

  return Math.max(items.length - 3, 0);
};

const getProductSummary = (order: Order) => {
  const items = getItems(order);

  if (items.length === 0) {
    return "Order items";
  }

  const firstName = getItemName(items[0]);

  if (items.length === 1) {
    return firstName;
  }

  return `${firstName} + ${items.length - 1} more ${
    items.length - 1 === 1 ? "item" : "items"
  }`;
};

/* =========================================================
   STATUS HELPERS
========================================================= */

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
    value.includes("canceled") ||
    value.includes("fail") ||
    value.includes("refund")
  ) {
    return colors.error;
  }

  if (value.includes("pending") || value.includes("confirm")) {
    return colors.warning;
  }

  if (
    value.includes("pack") ||
    value.includes("ship") ||
    value.includes("pickup") ||
    value.includes("out for")
  ) {
    return colors.primary;
  }

  return colors.primary;
};

const isActiveStatus = (status: string) => {
  const value = status.toLowerCase();

  return !["cancelled", "canceled", "delivered", "completed", "refunded"].some(
    (item) => value.includes(item),
  );
};

const canCancelOrder = (status: string) => {
  const value = status.toLowerCase();

  return ![
    "cancelled",
    "canceled",
    "delivered",
    "completed",
    "shipped",
    "out for delivery",
  ].some((item) => value.includes(item));
};

/* =========================================================
   COMPONENT
========================================================= */

export default function OrdersScreen() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const [filter, setFilter] = useState("All");

  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    kind: "info" | "success" | "error" | "confirm";
    confirmAction?: () => void;
  }>({ visible: false, title: "", message: "", kind: "info" });

  const showDialog = (
    title: string,
    message: string,
    kind: "info" | "success" | "error" = "info",
  ) => setDialog({ visible: true, title, message, kind });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  /* =====================================================
     FILTERED ORDERS
  ===================================================== */

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    /*
     * STATUS FILTER
     */

    if (filter !== "All") {
      if (filter === "Active") {
        result = result.filter((order) => isActiveStatus(getStatus(order)));
      } else {
        result = result.filter((order) =>
          getStatus(order).toLowerCase().includes(filter.toLowerCase()),
        );
      }
    }

    /*
     * SEARCH
     */

    const query = search.trim().toLowerCase();

    if (query) {
      result = result.filter((order) => {
        const orderNumber = getOrderNumber(order).toLowerCase();

        const status = getStatus(order).toLowerCase();

        const payment = getPaymentMethod(order).toLowerCase();

        const productNames = getItems(order)
          .map((item) => getItemName(item))
          .join(" ")
          .toLowerCase();

        return (
          orderNumber.includes(query) ||
          status.includes(query) ||
          payment.includes(query) ||
          productNames.includes(query)
        );
      });
    }

    return result;
  }, [orders, filter, search]);

  /* =====================================================
     LOAD ORDERS
  ===================================================== */

  const loadOrders = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) {
          setLoading(true);
        }

        const response = await getMyOrders();

        console.log("MY ORDERS RESPONSE:", response);

        const orderList =
          response?.orders || response?.data?.orders || response?.data || [];

        const safeOrders = Array.isArray(orderList) ? orderList : [];

        console.log("ORDERS COUNT:", safeOrders.length);

        setOrders(safeOrders);

        fadeAnim.setValue(0);

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      } catch (error: any) {
        console.log("LOAD ORDERS ERROR:", error);

        showDialog(
          "Couldn't load orders",
          error?.response?.data?.message ||
            error?.message ||
            "Please check your connection and try again.",
          "error",
        );
      } finally {
        setLoading(false);

        setRefreshing(false);
      }
    },
    [fadeAnim],
  );

  /* =====================================================
     SCREEN FOCUS
  ===================================================== */

  useFocusEffect(
    useCallback(() => {
      loadOrders(true);
    }, [loadOrders]),
  );

  /* =====================================================
     REFRESH
  ===================================================== */

  const handleRefresh = async () => {
    setRefreshing(true);

    await loadOrders(false);
  };

  /* =====================================================
     OPEN ORDER
  ===================================================== */

  const openOrder = (order: Order) => {
    const id = getOrderId(order);

    if (!id) {
      showDialog(
        "Order unavailable",
        "We couldn't find the ID for this order.",
        "error",
      );

      return;
    }

    router.push(`/orders/${id}` as any);
  };

  /* =====================================================
     CANCEL ORDER
  ===================================================== */

  const handleCancel = (order: Order) => {
    const id = getOrderId(order);
    if (!id) {
      showDialog(
        "Order unavailable",
        "We couldn't find the ID for this order.",
        "error",
      );
      return;
    }
    setDialog({
      visible: true,
      title: "Cancel this order?",
      message: `Order #${getOrderNumber(order)} will be cancelled. This action may not be reversible.`,
      kind: "confirm",
      confirmAction: async () => {
        setDialog((current) => ({ ...current, visible: false }));
        try {
          setCancellingId(id);
          const response = await cancelOrder(id);
          console.log("CANCEL ORDER RESPONSE:", response);
          await loadOrders(false);
          showDialog(
            "Order cancelled",
            response?.message || "Your order has been cancelled successfully.",
            "success",
          );
        } catch (error: any) {
          console.log("CANCEL ORDER ERROR:", error);
          showDialog(
            "Couldn't cancel order",
            error?.response?.data?.message ||
              error?.message ||
              "Please try again.",
            "error",
          );
        } finally {
          setCancellingId(null);
        }
      },
    });
  };

  const handleDialogConfirm = () => {
    const action = dialog.confirmAction;
    if (action) action();
    else setDialog((current) => ({ ...current, visible: false }));
  };

  /* =====================================================
     SKELETON
  ===================================================== */

  const renderSkeleton = () => {
    return (
      <View style={styles.skeletonContainer}>
        {[1, 2, 3, 4, 5].map((item) => (
          <View key={item} style={styles.skeletonRow}>
            <View style={styles.skeletonImage} />

            <View style={styles.skeletonInfo}>
              <View style={styles.skeletonLineLarge} />

              <View style={styles.skeletonLineMedium} />

              <View style={styles.skeletonLineSmall} />
            </View>

            <View style={styles.skeletonArrow} />
          </View>
        ))}
      </View>
    );
  };

  /* =====================================================
     ORDER ROW
  ===================================================== */

  const renderOrder = ({ item, index }: { item: Order; index: number }) => {
    const orderId = getOrderId(item);

    const status = getStatus(item);

    const statusColor = getStatusColor(status);

    const itemCount = getItemCount(item);

    const amount = getAmount(item);

    const paymentMethod = getPaymentMethod(item);

    const paymentStatus = getPaymentStatus(item);

    const cancelling = cancellingId === orderId;

    const previewItems = getOrderPreviewItems(item);

    const remaining = getRemainingItemCount(item);

    const isLast = index === filteredOrders.length - 1;

    return (
      <Animated.View
        style={[
          styles.orderRowWrapper,
          {
            opacity: fadeAnim,

            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],

                  outputRange: [8, 0],
                }),
              },
            ],
          },
        ]}
      >
        {/* MAIN ORDER ROW */}

        <Pressable
          style={styles.orderRow}
          android_ripple={{
            color: colors.blueSoft,
          }}
          onPress={() => openOrder(item)}
        >
          {/* =========================================
                MULTI PRODUCT PREVIEW
            ========================================= */}

          <View style={styles.productPreview}>
            {previewItems.map((orderItem, itemIndex) => {
              const image = normalizeImageUrl(getItemImage(orderItem));

              const previewLength = previewItems.length;

              return (
                <View
                  key={
                    orderItem?._id ||
                    orderItem?.productId ||
                    orderItem?.variantSku ||
                    String(itemIndex)
                  }
                  style={[
                    styles.previewImageBox,

                    previewLength === 1 && styles.previewImageSingle,

                    previewLength === 2 && styles.previewImageTwo,

                    previewLength >= 3 && styles.previewImageThree,

                    itemIndex > 0 && styles.previewImageOverlap,
                  ]}
                >
                  {image ? (
                    <Image
                      source={{
                        uri: image,
                      }}
                      style={styles.previewImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.previewImagePlaceholder}>
                      <Ionicons
                        name="cube-outline"
                        size={previewLength === 1 ? 30 : 20}
                        color={colors.textMuted}
                      />
                    </View>
                  )}
                </View>
              );
            })}

            {/* +N BADGE */}

            {remaining > 0 ? (
              <View style={styles.moreItemsBadge}>
                <Text style={styles.moreItemsText}>+{remaining}</Text>
              </View>
            ) : null}
          </View>

          {/* =========================================
                ORDER INFORMATION
            ========================================= */}

          <View style={styles.orderContent}>
            {/* STATUS + DATE */}

            <View style={styles.statusLine}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: statusColor,
                  },
                ]}
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color: statusColor,
                  },
                ]}
                numberOfLines={1}
              >
                {status}
              </Text>

              <Text style={styles.dateText} numberOfLines={1}>
                {getDate(item)}
              </Text>
            </View>

            {/* PRODUCT SUMMARY */}

            <Text style={styles.productName} numberOfLines={2}>
              {getProductSummary(item)}
            </Text>

            {/* ORDER NUMBER + ITEMS */}

            <View style={styles.metaRow}>
              <Text style={styles.orderNumberText} numberOfLines={1}>
                Order #{getOrderNumber(item)}
              </Text>

              <View style={styles.metaDivider} />

              <Text style={styles.metaText} numberOfLines={1}>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </Text>
            </View>

            {/* PRICE + PAYMENT */}

            <View style={styles.bottomInfoRow}>
              <Text style={styles.amountText}>
                ₹{amount.toLocaleString("en-IN")}
              </Text>

              <View style={styles.paymentPill}>
                <Ionicons
                  name={
                    paymentMethod.toLowerCase().includes("cod")
                      ? "cash-outline"
                      : "card-outline"
                  }
                  size={12}
                  color={colors.textSecondary}
                />

                <Text style={styles.paymentText} numberOfLines={1}>
                  {paymentMethod.toUpperCase()}
                </Text>
              </View>

              {paymentStatus ? (
                <Text style={styles.paymentStatusText} numberOfLines={1}>
                  {paymentStatus}
                </Text>
              ) : null}
            </View>
          </View>

          {/* =========================================
                ARROW
            ========================================= */}

          <View style={styles.arrowBox}>
            <Ionicons name="chevron-forward" size={21} color={colors.text} />
          </View>
        </Pressable>

        {/* =========================================
              CANCEL
          ========================================= */}

        {canCancelOrder(status) ? (
          <Pressable
            style={[
              styles.cancelMiniButton,
              cancelling && styles.cancelMiniButtonDisabled,
            ]}
            disabled={cancelling}
            onPress={() => handleCancel(item)}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Ionicons
                  name="close-circle-outline"
                  size={15}
                  color={colors.error}
                />

                <Text style={styles.cancelMiniText}>Cancel order</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {/* DIVIDER */}

        {!isLast ? <View style={styles.rowDivider} /> : null}
      </Animated.View>
    );
  };

  /* =====================================================
     EMPTY
  ===================================================== */

  const renderEmpty = () => {
    const isSearch = search.trim().length > 0;

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <Ionicons
            name={isSearch ? "search-outline" : "bag-handle-outline"}
            size={40}
            color={colors.primary}
          />
        </View>

        <Text style={styles.emptyTitle}>
          {isSearch
            ? "No matching orders"
            : filter !== "All"
              ? `No ${filter.toLowerCase()} orders`
              : "No orders yet"}
        </Text>

        <Text style={styles.emptyText}>
          {isSearch
            ? "Try another order number or product name."
            : filter !== "All"
              ? "Try another filter to see your orders."
              : "Your placed orders will appear here."}
        </Text>

        {isSearch ? (
          <Pressable style={styles.emptyButton} onPress={() => setSearch("")}>
            <Text style={styles.emptyButtonText}>Clear Search</Text>
          </Pressable>
        ) : filter !== "All" ? (
          <Pressable
            style={styles.emptyButton}
            onPress={() => setFilter("All")}
          >
            <Text style={styles.emptyButtonText}>Show All Orders</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.emptyButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.emptyButtonText}>Start Shopping</Text>

            <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    );
  };

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <View style={styles.headerTitleArea}>
            <Text style={styles.title}>My Orders</Text>

            <Text style={styles.subtitle}>Track and manage your orders</Text>
          </View>

          <View style={styles.headerIcon}>
            <Ionicons name="receipt-outline" size={21} color={colors.primary} />
          </View>
        </View>

        {renderSkeleton()}
      </SafeAreaView>
    );
  }

  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* ===============================================
          HEADER
      =============================================== */}

      <View style={styles.header}>
        <View style={styles.headerTitleArea}>
          <Text style={styles.title}>My Orders</Text>

          <Text style={styles.subtitle}>
            {orders.length === 0
              ? "Your orders will appear here"
              : `${orders.length} ${orders.length === 1 ? "order" : "orders"}`}
          </Text>
        </View>

        <Pressable style={styles.headerIcon} onPress={handleRefresh}>
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          )}
        </Pressable>
      </View>

      {/* ===============================================
          LIST
      =============================================== */}

      <FlatList
        data={filteredOrders}
        keyExtractor={(item, index) => getOrderId(item) || String(index)}
        renderItem={renderOrder}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          filteredOrders.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Pressable
              accessibilityRole="image"
              accessibilityLabel="Odikart banner: Shop Odisha, Support Local"
              style={styles.orderBanner}
            >
              <Image
                source={require("../../../assets/images/odikart-orders-banner.png")}
                style={styles.orderBannerImage}
                resizeMode="contain"
              />
            </Pressable>
            {/* SEARCH */}

            <View style={styles.searchContainer}>
              <Ionicons
                name="search-outline"
                size={21}
                color={colors.textSecondary}
              />

              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search your orders"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />

              {search.length > 0 ? (
                <Pressable onPress={() => setSearch("")} hitSlop={10}>
                  <Ionicons
                    name="close-circle"
                    size={19}
                    color={colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>

            {/* FILTER HEADER */}

            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Your orders</Text>

              {filter !== "All" || search.length > 0 ? (
                <Pressable
                  onPress={() => {
                    setFilter("All");
                    setSearch("");
                  }}
                >
                  <Text style={styles.clearText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>

            {/* FILTER CHIPS */}

            <FlatList
              horizontal
              data={STATUS_FILTERS}
              keyExtractor={(item) => item.key}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              renderItem={({ item }) => {
                const active = filter === item.key;

                return (
                  <Pressable
                    onPress={() => setFilter(item.key)}
                    style={[
                      styles.filterChip,
                      active && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active && styles.filterChipTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />

            {/* RESULT COUNT */}

            <View style={styles.resultRow}>
              <Text style={styles.resultText}>
                {filteredOrders.length}{" "}
                {filteredOrders.length === 1 ? "order" : "orders"}
              </Text>

              {search.trim().length > 0 ? (
                <Text style={styles.searchResultText} numberOfLines={1}>
                  Results for "{search}"
                </Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={renderEmpty}
      />
      <Modal
        transparent
        visible={dialog.visible}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setDialog((current) => ({ ...current, visible: false }))
        }
      >
        <View style={styles.dialogBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() =>
              setDialog((current) => ({ ...current, visible: false }))
            }
          />
          <View style={styles.dialogCard}>
            <View
              style={[
                styles.dialogIconWrap,
                dialog.kind === "success" && styles.dialogIconSuccess,
                dialog.kind === "error" && styles.dialogIconError,
                dialog.kind === "confirm" && styles.dialogIconConfirm,
              ]}
            >
              <Ionicons
                name={
                  dialog.kind === "success"
                    ? "checkmark-circle"
                    : dialog.kind === "error"
                      ? "alert-circle"
                      : dialog.kind === "confirm"
                        ? "help-circle"
                        : "information-circle"
                }
                size={31}
                color={
                  dialog.kind === "success"
                    ? "#16865A"
                    : dialog.kind === "error"
                      ? "#D64545"
                      : dialog.kind === "confirm"
                        ? "#D97706"
                        : colors.primary
                }
              />
            </View>
            <Text style={styles.dialogTitle}>{dialog.title}</Text>
            <Text style={styles.dialogMessage}>{dialog.message}</Text>
            <View style={styles.dialogActions}>
              {dialog.kind === "confirm" ? (
                <Pressable
                  style={styles.dialogSecondaryButton}
                  onPress={() =>
                    setDialog((current) => ({ ...current, visible: false }))
                  }
                >
                  <Text style={styles.dialogSecondaryText}>Keep order</Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[
                  styles.dialogPrimaryButton,
                  dialog.kind === "confirm" && styles.dialogDangerButton,
                  dialog.kind === "error" && styles.dialogErrorButton,
                ]}
                onPress={
                  dialog.kind === "confirm"
                    ? handleDialogConfirm
                    : () =>
                        setDialog((current) => ({ ...current, visible: false }))
                }
              >
                <Text style={styles.dialogPrimaryText}>
                  {dialog.kind === "confirm" ? "Yes, cancel" : "Got it"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  /* =====================================================
       CONTAINER
    ===================================================== */

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* =====================================================
       HEADER
    ===================================================== */

  header: {
    minHeight: 72,

    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",

    backgroundColor: colors.background,
  },

  headerTitleArea: {
    flex: 1,
  },

  title: {
    fontSize: 25,

    fontWeight: "800",

    color: colors.text,

    letterSpacing: -0.5,
  },

  subtitle: {
    marginTop: 3,

    fontSize: 12,

    color: colors.textSecondary,
  },

  headerIcon: {
    width: 42,
    height: 42,

    borderRadius: 14,

    backgroundColor: colors.blueSoft,

    alignItems: "center",

    justifyContent: "center",

    marginLeft: 12,
  },

  /* =====================================================
       LIST HEADER
    ===================================================== */

  listHeader: {
    paddingHorizontal: 16,

    paddingTop: 5,

    paddingBottom: 4,
  },

  orderBanner: {
    width: "100%",
    aspectRatio: 2.92,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 18,
    backgroundColor: "#F0EEFF",
    alignSelf: "center",
  },
  orderBannerImage: {
    width: "100%",
    height: "100%",
  },
  dialogBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 25,
    paddingBottom: 20,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  dialogIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    marginBottom: 15,
  },
  dialogIconSuccess: { backgroundColor: "#E8F8F0" },
  dialogIconError: { backgroundColor: "#FFF0F0" },
  dialogIconConfirm: { backgroundColor: "#FFF5E6" },
  dialogTitle: {
    color: "#172033",
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    fontWeight: "900",
    letterSpacing: -0.35,
  },
  dialogMessage: {
    marginTop: 9,
    color: "#667085",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  dialogActions: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
    marginTop: 23,
  },
  dialogPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
  },
  dialogDangerButton: { backgroundColor: "#D64545" },
  dialogErrorButton: { backgroundColor: "#D64545" },
  dialogPrimaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  dialogSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2F4F7",
    paddingHorizontal: 12,
  },
  dialogSecondaryText: { color: "#344054", fontSize: 13, fontWeight: "800" },

  /* =====================================================
       SEARCH
    ===================================================== */

  searchContainer: {
    height: 52,

    borderRadius: 16,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 15,

    shadowColor: colors.shadow,

    shadowOpacity: 0.04,

    shadowRadius: 8,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 1,
  },

  searchInput: {
    flex: 1,

    height: 52,

    marginLeft: 10,

    paddingVertical: 0,

    fontSize: 14,

    color: colors.text,
  },

  /* =====================================================
       FILTER
    ===================================================== */

  filterHeader: {
    marginTop: 19,

    marginBottom: 10,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "space-between",
  },

  filterTitle: {
    fontSize: 15,

    fontWeight: "800",

    color: colors.text,
  },

  clearText: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.primary,
  },

  filterRow: {
    paddingRight: 12,

    gap: 9,
  },

  filterChip: {
    height: 38,

    paddingHorizontal: 18,

    borderRadius: 12,

    backgroundColor: colors.surface,

    borderWidth: 1,

    borderColor: colors.borderLight,

    alignItems: "center",

    justifyContent: "center",
  },

  filterChipActive: {
    backgroundColor: colors.text,

    borderColor: colors.text,
  },

  filterChipText: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.textSecondary,
  },

  filterChipTextActive: {
    color: colors.textWhite,
  },

  /* =====================================================
       RESULT
    ===================================================== */

  resultRow: {
    flexDirection: "row",

    alignItems: "center",

    marginTop: 15,

    marginBottom: 4,
  },

  resultText: {
    fontSize: 11,

    fontWeight: "700",

    color: colors.textMuted,
  },

  searchResultText: {
    flex: 1,

    marginLeft: 10,

    fontSize: 11,

    color: colors.textMuted,

    textAlign: "right",
  },

  /* =====================================================
       LIST
    ===================================================== */

  listContent: {
    paddingBottom: 25,
  },

  emptyListContent: {
    flexGrow: 1,
  },

  /* =====================================================
       ORDER ROW
    ===================================================== */

  orderRowWrapper: {
    backgroundColor: colors.surface,
  },

  orderRow: {
    minHeight: 126,

    paddingHorizontal: 16,

    paddingVertical: 14,

    flexDirection: "row",

    alignItems: "center",

    backgroundColor: colors.surface,
  },

  /* =====================================================
       MULTI PRODUCT PREVIEW
    ===================================================== */

  productPreview: {
    width: 92,

    height: 92,

    borderRadius: 17,

    backgroundColor: colors.surfaceSoft,

    position: "relative",

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    flexShrink: 0,

    overflow: "hidden",
  },

  previewImageBox: {
    width: 52,

    height: 52,

    borderRadius: 11,

    backgroundColor: colors.surface,

    borderWidth: 2,

    borderColor: colors.surface,

    overflow: "hidden",

    alignItems: "center",

    justifyContent: "center",

    zIndex: 1,
  },

  previewImageSingle: {
    width: 92,

    height: 92,

    borderWidth: 0,

    borderRadius: 17,
  },

  previewImageTwo: {
    width: 62,

    height: 70,
  },

  previewImageThree: {
    width: 49,

    height: 65,
  },

  previewImageOverlap: {
    marginLeft: -13,
  },

  previewImage: {
    width: "100%",

    height: "100%",
  },

  previewImagePlaceholder: {
    width: "100%",

    height: "100%",

    alignItems: "center",

    justifyContent: "center",

    backgroundColor: colors.surfaceSoft,
  },

  moreItemsBadge: {
    position: "absolute",

    right: 5,

    bottom: 5,

    minWidth: 25,

    height: 25,

    paddingHorizontal: 5,

    borderRadius: 13,

    backgroundColor: colors.text,

    alignItems: "center",

    justifyContent: "center",

    borderWidth: 2,

    borderColor: colors.surface,

    zIndex: 10,
  },

  moreItemsText: {
    fontSize: 10,

    fontWeight: "900",

    color: colors.textWhite,
  },

  /* =====================================================
       ORDER CONTENT
    ===================================================== */

  orderContent: {
    flex: 1,

    minWidth: 0,

    marginLeft: 14,

    marginRight: 7,
  },

  statusLine: {
    flexDirection: "row",

    alignItems: "center",

    minWidth: 0,
  },

  statusDot: {
    width: 7,

    height: 7,

    borderRadius: 4,

    marginRight: 6,
  },

  statusText: {
    maxWidth: 90,

    fontSize: 11,

    fontWeight: "800",

    textTransform: "capitalize",
  },

  dateText: {
    flex: 1,

    marginLeft: 7,

    fontSize: 11,

    color: colors.textSecondary,

    textAlign: "right",
  },

  productName: {
    marginTop: 6,

    fontSize: 14,

    lineHeight: 19,

    fontWeight: "700",

    color: colors.text,

    letterSpacing: -0.1,
  },

  metaRow: {
    marginTop: 6,

    flexDirection: "row",

    alignItems: "center",

    minWidth: 0,
  },

  orderNumberText: {
    flexShrink: 1,

    fontSize: 10,

    color: colors.textMuted,
  },

  metaDivider: {
    width: 3,

    height: 3,

    borderRadius: 2,

    marginHorizontal: 7,

    backgroundColor: colors.textMuted,
  },

  metaText: {
    fontSize: 10,

    color: colors.textMuted,
  },

  bottomInfoRow: {
    marginTop: 7,

    flexDirection: "row",

    alignItems: "center",

    minWidth: 0,
  },

  amountText: {
    fontSize: 14,

    fontWeight: "900",

    color: colors.text,
  },

  paymentPill: {
    marginLeft: 8,

    paddingHorizontal: 7,

    paddingVertical: 4,

    borderRadius: 7,

    backgroundColor: colors.surfaceSoft,

    flexDirection: "row",

    alignItems: "center",

    maxWidth: 70,
  },

  paymentText: {
    marginLeft: 4,

    fontSize: 8,

    fontWeight: "800",

    color: colors.textSecondary,
  },

  paymentStatusText: {
    marginLeft: 7,

    fontSize: 9,

    fontWeight: "700",

    color: colors.success,

    textTransform: "capitalize",

    flexShrink: 1,
  },

  /* =====================================================
       ARROW
    ===================================================== */

  arrowBox: {
    width: 28,

    alignItems: "center",

    justifyContent: "center",

    flexShrink: 0,
  },

  /* =====================================================
       DIVIDER
    ===================================================== */

  rowDivider: {
    height: 1,

    backgroundColor: colors.borderLight,

    marginLeft: 16,
  },

  /* =====================================================
       CANCEL
    ===================================================== */

  cancelMiniButton: {
    height: 34,

    marginHorizontal: 16,

    marginBottom: 10,

    paddingHorizontal: 11,

    borderRadius: 9,

    alignSelf: "flex-start",

    borderWidth: 1,

    borderColor: `${colors.error}25`,

    backgroundColor: `${colors.error}06`,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 5,
  },

  cancelMiniButtonDisabled: {
    opacity: 0.55,
  },

  cancelMiniText: {
    fontSize: 10,

    fontWeight: "800",

    color: colors.error,
  },

  /* =====================================================
       EMPTY
    ===================================================== */

  emptyContainer: {
    flex: 1,

    alignItems: "center",

    justifyContent: "center",

    paddingHorizontal: 35,

    paddingTop: 65,

    paddingBottom: 80,
  },

  emptyIcon: {
    width: 82,

    height: 82,

    borderRadius: 27,

    backgroundColor: colors.blueSoft,

    alignItems: "center",

    justifyContent: "center",

    marginBottom: 18,
  },

  emptyTitle: {
    fontSize: 20,

    fontWeight: "900",

    color: colors.text,

    textAlign: "center",
  },

  emptyText: {
    marginTop: 8,

    maxWidth: 290,

    fontSize: 13,

    lineHeight: 20,

    color: colors.textSecondary,

    textAlign: "center",
  },

  emptyButton: {
    marginTop: 20,

    minHeight: 45,

    paddingHorizontal: 20,

    borderRadius: 13,

    backgroundColor: colors.primary,

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 7,
  },

  emptyButtonText: {
    fontSize: 13,

    fontWeight: "800",

    color: colors.textWhite,
  },

  /* =====================================================
       SKELETON
    ===================================================== */

  skeletonContainer: {
    backgroundColor: colors.surface,
  },

  skeletonRow: {
    minHeight: 126,

    paddingHorizontal: 16,

    paddingVertical: 14,

    flexDirection: "row",

    alignItems: "center",

    borderBottomWidth: 1,

    borderBottomColor: colors.borderLight,
  },

  skeletonImage: {
    width: 92,

    height: 92,

    borderRadius: 17,

    backgroundColor: colors.surfaceSoft,
  },

  skeletonInfo: {
    flex: 1,

    marginLeft: 14,
  },

  skeletonLineLarge: {
    width: "75%",

    height: 12,

    borderRadius: 6,

    backgroundColor: colors.surfaceSoft,
  },

  skeletonLineMedium: {
    width: "90%",

    height: 15,

    marginTop: 10,

    borderRadius: 7,

    backgroundColor: colors.surfaceSoft,
  },

  skeletonLineSmall: {
    width: "55%",

    height: 10,

    marginTop: 9,

    borderRadius: 5,

    backgroundColor: colors.surfaceSoft,
  },

  skeletonArrow: {
    width: 20,

    height: 20,

    marginLeft: 8,

    borderRadius: 10,

    backgroundColor: colors.surfaceSoft,
  },
});
