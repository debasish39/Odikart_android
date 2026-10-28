import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../theme/colors";
import { useAuth } from "../../context/AuthContext";
import {
  Address,
  getMyAddresses,
} from "../../api/address";
import api from "../../api/api";
import { clearCart } from "../../api/cart";

/* =========================================================
   TYPES
========================================================= */

type CartItem = {
  productId?: string;
  product?: any;
  variant?: any;
  selectedVariant?: any;
  variants?: any[];
  variantSku?: string;
  sellerId?: string | null;
  attributes?: Record<string, any>;
  slug?: string;
  brand?: string;
  category?: string;
  offer?: any;
  discountAmount?: number;
  discountPercentage?: number;
  originalPrice?: number;
  offerLabel?: string;
  taxPercentage?: number;
  tax?: number;
  quantity: number;
  price: number;
  image?: string;
  name?: string;
};

type PaymentMethod = "cod" | "online";

type AvailableCoupon = {
  code: string;
  discountType?: "PERCENTAGE" | "FIXED" | string;
  discountValue?: number;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  expiryDate?: string | null;
  isActive?: boolean;
};

type ToastType = "success" | "error" | "info";

type ToastState = {
  visible: boolean;
  type: ToastType;
  message: string;
};

/* =========================================================
   SKELETON
========================================================= */

function SkeletonBlock({
  width = "100%",
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: any;
}) {
  const opacity = useRef(
    new Animated.Value(0.45)
  ).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 650,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeletonBlock,
        {
          width,
          height,
          borderRadius: radius,
          opacity,
        },
        style,
      ]}
    />
  );
}

function CheckoutSkeleton() {
  return (
    <SafeAreaView
      style={styles.skeletonContainer}
      edges={["top", "bottom"]}
    >
      <View style={styles.skeletonHeader}>
        <SkeletonBlock
          width={42}
          height={42}
          radius={14}
        />

        <View style={styles.skeletonHeaderCenter}>
          <SkeletonBlock
            width={105}
            height={18}
            radius={7}
          />

          <SkeletonBlock
            width={82}
            height={10}
            radius={5}
            style={{ marginTop: 7 }}
          />
        </View>

        <SkeletonBlock
          width={42}
          height={42}
          radius={14}
        />
      </View>

      <View style={styles.skeletonProgress}>
        <SkeletonBlock
          width="72%"
          height={4}
          radius={4}
          style={styles.skeletonProgressLine}
        />

        {[1, 2, 3].map((item) => (
          <View
            key={item}
            style={styles.skeletonProgressStep}
          >
            <SkeletonBlock
              width={29}
              height={29}
              radius={15}
            />

            <SkeletonBlock
              width={45}
              height={8}
              radius={4}
              style={{ marginTop: 6 }}
            />
          </View>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.skeletonContent
        }
      >
        {[1, 2, 3, 4, 5].map((section) => (
          <View
            key={section}
            style={styles.skeletonSection}
          >
            <SkeletonBlock
              width={
                section === 1
                  ? 145
                  : section === 2
                  ? 160
                  : 125
              }
              height={16}
              radius={6}
            />

            <SkeletonBlock
              width="62%"
              height={10}
              radius={5}
              style={{ marginTop: 7 }}
            />

            {section === 1 && (
              <View
                style={styles.skeletonAddressCard}
              >
                <View
                  style={styles.skeletonAddressTop}
                >
                  <SkeletonBlock
                    width={39}
                    height={39}
                    radius={13}
                  />

                  <View
                    style={{
                      flex: 1,
                      marginLeft: 10,
                    }}
                  >
                    <SkeletonBlock
                      width="48%"
                      height={12}
                      radius={5}
                    />

                    <SkeletonBlock
                      width="26%"
                      height={9}
                      radius={4}
                      style={{ marginTop: 7 }}
                    />
                  </View>
                </View>

                <SkeletonBlock
                  width="92%"
                  height={10}
                  radius={5}
                  style={{ marginTop: 14 }}
                />

                <SkeletonBlock
                  width="68%"
                  height={10}
                  radius={5}
                  style={{ marginTop: 7 }}
                />
              </View>
            )}

            {section === 3 &&
              [1, 2].map((item) => (
                <View
                  key={item}
                  style={styles.skeletonProductRow}
                >
                  <SkeletonBlock
                    width={72}
                    height={74}
                    radius={14}
                  />

                  <View
                    style={{
                      flex: 1,
                      marginLeft: 11,
                    }}
                  >
                    <SkeletonBlock
                      width="86%"
                      height={11}
                      radius={5}
                    />

                    <SkeletonBlock
                      width="58%"
                      height={10}
                      radius={5}
                      style={{ marginTop: 8 }}
                    />

                    <SkeletonBlock
                      width="30%"
                      height={9}
                      radius={4}
                      style={{ marginTop: 8 }}
                    />
                  </View>
                </View>
              ))}

            {section === 4 && (
              <View
                style={styles.skeletonCouponRow}
              >
                <SkeletonBlock
                  width="68%"
                  height={43}
                  radius={10}
                />

                <SkeletonBlock
                  width={78}
                  height={42}
                  radius={12}
                />
              </View>
            )}

            {section === 5 && (
              <>
                <SkeletonBlock
                  width="100%"
                  height={72}
                  radius={18}
                  style={{ marginTop: 12 }}
                />

                <SkeletonBlock
                  width="100%"
                  height={72}
                  radius={18}
                  style={{ marginTop: 10 }}
                />
              </>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.skeletonBottomBar}>
        <View>
          <SkeletonBlock
            width={76}
            height={9}
            radius={4}
          />

          <SkeletonBlock
            width={88}
            height={20}
            radius={6}
            style={{ marginTop: 7 }}
          />
        </View>

        <SkeletonBlock
          width="55%"
          height={54}
          radius={17}
        />
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   SCREEN
========================================================= */

export default function CheckoutScreen() {
  const router = useRouter();
  const { user } = useAuth();

  /* =======================================================
     STATE
  ======================================================= */

  const [addresses, setAddresses] =
    useState<Address[]>([]);

  const [selectedAddress, setSelectedAddress] =
    useState<Address | null>(null);

  const [
    addressSelectorVisible,
    setAddressSelectorVisible,
  ] = useState(false);

  const [cartItems, setCartItems] =
    useState<CartItem[]>([]);

  const [subtotal, setSubtotal] =
    useState(0);

  const [couponCode, setCouponCode] =
    useState("");

  // Coupon code returned by the backend after successful validation.
  // This is the code that should be sent with the order.
  const [appliedCouponCode, setAppliedCouponCode] =
    useState("");

  const [couponDiscount, setCouponDiscount] =
    useState(0);

  const [couponLoading, setCouponLoading] =
    useState(false);

  const [couponError, setCouponError] =
    useState("");

  const [couponSuccess, setCouponSuccess] =
    useState("");

  // Customer-safe coupons returned by GET /coupons/available.
  const [availableCoupons, setAvailableCoupons] =
    useState<AvailableCoupon[]>([]);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cod");

  const [loading, setLoading] =
    useState(true);

  const [placingOrder, setPlacingOrder] =
    useState(false);

  const [leavingCheckout, setLeavingCheckout] =
    useState(false);

  const [serviceability, setServiceability] =
    useState({
      checking: false,
      checked: false,
      postalCode: "",
      serviceableItems: [] as any[],
      unavailableItems: [] as any[],
      message: "",
    });

  /* =======================================================
     TOAST
  ======================================================= */

  const [toast, setToast] =
    useState<ToastState>({
      visible: false,
      type: "info",
      message: "",
    });

  const toastTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = "info"
    ) => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
      }

      setToast({
        visible: true,
        type,
        message,
      });

      toastTimerRef.current =
        setTimeout(() => {
          setToast((previous) => ({
            ...previous,
            visible: false,
          }));
        }, 2600);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(
          toastTimerRef.current
        );
      }
    };
  }, []);

  /* =======================================================
     HELPERS
  ======================================================= */

  const roundMoney = (value: any) =>
    Math.round(
      (Number(value || 0) +
        Number.EPSILON) *
        100
    ) / 100;

  /* =======================================================
     OFFER
  ======================================================= */

  const getBackendOfferInfo =
    useCallback((item: CartItem) => {
      const variant =
        item?.variant ||
        item?.selectedVariant ||
        null;

      const offer =
        item?.offer ||
        item?.product?.offer ||
        null;

      const discountPercentage =
        Number(
          item?.discountPercentage ??
            variant?.discountPercentage ??
            item?.product
              ?.discountPercentage ??
            offer?.value ??
            0
        );

      const originalPrice =
        Number(
          item?.originalPrice ??
            variant?.originalPrice ??
            item?.product
              ?.originalPrice ??
            0
        );

      const discountAmount =
        Number(
          item?.discountAmount ??
            variant?.discountAmount ??
            item?.product
              ?.discountAmount ??
            0
        );

      const offerLabel =
        String(
          item?.offerLabel ||
            offer?.name ||
            offer?.title ||
            offer?.label ||
            ""
        ).trim();

      return {
        discountPercentage:
          Number.isFinite(
            discountPercentage
          )
            ? discountPercentage
            : 0,

        originalPrice:
          Number.isFinite(originalPrice)
            ? originalPrice
            : 0,

        discountAmount:
          Number.isFinite(discountAmount)
            ? discountAmount
            : 0,

        offerLabel,
      };
    }, []);

  /* =======================================================
     PRICING
  ======================================================= */

  const shippingCharge = 0;

  const itemTax = useMemo(
    () =>
      roundMoney(
        cartItems.reduce(
          (sum, item) =>
            sum +
            Number(item?.tax || 0),
          0
        )
      ),
    [cartItems]
  );

  const amountBeforeCoupon =
    useMemo(
      () =>
        roundMoney(
          subtotal +
            itemTax +
            shippingCharge
        ),
      [subtotal, itemTax]
    );

  const finalTotal = useMemo(
    () =>
      roundMoney(
        Math.max(
          0,
          amountBeforeCoupon -
            Number(
              couponDiscount || 0
            )
        )
      ),
    [
      amountBeforeCoupon,
      couponDiscount,
    ]
  );

  /* =======================================================
     FORMAT ADDRESS
  ======================================================= */

  const formatAddress = (
    address: Address
  ) => {
    return [
      address.houseNumber,
      address.street,
      address.area,
      address.landmark,
      address.postOffice,
      address.city,
      address.district,
      address.state,
      address.postalCode,
    ]
      .filter(Boolean)
      .join(", ");
  };

  /* =======================================================
     LOAD CHECKOUT
  ======================================================= */

  const loadCheckout =
    useCallback(async () => {
      try {
        setLoading(true);

        console.log(
          "GET MY ADDRESSES"
        );

        const addressResponse =
          await getMyAddresses();

        console.log(
          "GET ADDRESSES RESPONSE:",
          addressResponse
        );

        const addressList: Address[] =
          Array.isArray(
            addressResponse?.addresses
          )
            ? addressResponse.addresses
            : Array.isArray(
                addressResponse?.data
              )
            ? addressResponse.data
            : addressResponse?.data &&
              !Array.isArray(
                addressResponse.data
              ) &&
              Array.isArray(
                addressResponse.data
                  .addresses
              )
            ? addressResponse.data
                .addresses
            : [];

        setAddresses(addressList);

        const defaultAddress =
          addressList.find(
            (item) =>
              item.isDefault
          ) ||
          addressList[0] ||
          null;

        setSelectedAddress(
          defaultAddress
        );

        console.log("GET CART");

        const cartResponse =
          await api.get("/cart");

        console.log(
          "GET CART RESPONSE:",
          cartResponse.data
        );

        const items =
          cartResponse?.data?.items ||
          cartResponse?.data?.cart
            ?.items ||
          [];

        const normalizedItems:
          CartItem[] = items.map(
          (item: any) => ({
            ...item,

            productId:
              item.productId ||
              item.product?._id ||
              item.product?.id,

            quantity: Number(
              item.quantity || 0
            ),

            price: Number(
              item.price || 0
            ),

            name:
              item.name ||
              item.product?.name ||
              item.product?.title ||
              item.productName ||
              "Product",

            image:
              item.image ||
              item.product?.media
                ?.thumbnail ||
              item.product?.media
                ?.images?.[0],

            variantSku:
              item.variantSku || "",

            sellerId:
              item.sellerId ||
              item.product?.sellerId ||
              item.product?.seller?._id ||
              null,
          })
        );

        setCartItems(
          normalizedItems
        );

        const calculatedSubtotal =
          normalizedItems.reduce(
            (sum, item) =>
              sum +
              Number(
                item.price || 0
              ) *
                Number(
                  item.quantity || 0
                ),
            0
          );

        setSubtotal(
          calculatedSubtotal
        );

        // Load customer-safe coupon suggestions independently.
        await loadAvailableCoupons();
      } catch (error: any) {
        console.log(
          "CHECKOUT LOAD ERROR:",
          error?.response?.data ||
            error?.message ||
            error
        );

        showToast(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Unable to load checkout.",
          "error"
        );
      } finally {
        setLoading(false);
      }
    }, [loadAvailableCoupons, showToast]);

  useFocusEffect(
    useCallback(() => {
      if (!leavingCheckout) {
        loadCheckout();
      }
    }, [
      loadCheckout,
      leavingCheckout,
    ])
  );

  /* =======================================================
     ADDRESS
  ======================================================= */

  const handleChangeAddress =
    () => {
      setAddressSelectorVisible(
        true
      );
    };

  const handleSelectAddress = (
    address: Address
  ) => {
    setSelectedAddress(
      address
    );

    setAddressSelectorVisible(
      false
    );

    setServiceability({
      checking: false,
      checked: false,
      postalCode: "",
      serviceableItems: [],
      unavailableItems: [],
      message: "",
    });

    console.log(
      "CHECKOUT ADDRESS SELECTED:",
      address?._id
    );
  };

  const handleAddNewAddress =
    () => {
      setAddressSelectorVisible(
        false
      );

      router.push(
        "/checkout/add-address"
      );
    };

  const handleEditAddress = (
    address: Address
  ) => {
    setAddressSelectorVisible(
      false
    );

    router.push({
      pathname:
        "/checkout/add-address",
      params: {
        addressId: String(
          address._id
        ),
      },
    });
  };

  /* =======================================================
     COUPON
  ======================================================= */

  const loadAvailableCoupons = useCallback(async () => {
    try {
      const response = await api.get("/coupons/available");
      const data = response?.data;

      const list: AvailableCoupon[] =
        Array.isArray(data?.coupons)
          ? data.coupons
          : Array.isArray(data?.data?.coupons)
          ? data.data.coupons
          : Array.isArray(data?.data)
          ? data.data
          : [];

      const now = new Date();

      const active = list.filter((coupon) => {
        if (!coupon?.code || coupon.isActive === false) return false;
        if (coupon.expiryDate) {
          const expiry = new Date(coupon.expiryDate);
          if (!Number.isNaN(expiry.getTime()) && expiry <= now) {
            return false;
          }
        }
        return true;
      });

      setAvailableCoupons(active);
    } catch (error: any) {
      // Coupon suggestions are optional. Never block checkout if this call fails.
      console.log(
        "AVAILABLE COUPONS ERROR:",
        error?.response?.data || error?.message || error
      );
      setAvailableCoupons([]);
    }
  }, []);

  const suggestedCoupons = useMemo(() => {
    const eligible = availableCoupons.filter((coupon) =>
      Number(coupon.minOrderAmount || 0) <= Number(subtotal || 0)
    );

    return [...eligible]
      .sort((a, b) => {
        const aValue = Number(a.discountValue || 0);
        const bValue = Number(b.discountValue || 0);

        // Show the most useful-looking offers first without changing
        // the backend's coupon validation or discount calculation.
        if (a.discountType === b.discountType) return bValue - aValue;
        return a.discountType === "PERCENTAGE" ? -1 : 1;
      })
      .slice(0, 3);
  }, [availableCoupons, subtotal]);

  const clearCoupon = useCallback(() => {
    setCouponCode("");
    setAppliedCouponCode("");
    setCouponDiscount(0);
    setCouponError("");
    setCouponSuccess("");
  }, []);

  const applyCoupon = async (codeOverride?: string) => {
    const code = String(
      codeOverride ?? couponCode ?? ""
    )
      .trim()
      .toUpperCase();

    if (!code) {
      setCouponError(
        "Please enter a coupon code."
      );

      setCouponSuccess("");
      setCouponDiscount(0);
      setAppliedCouponCode("");
      return;
    }

    if (!subtotal || subtotal <= 0) {
      setCouponError(
        "Your order total is not valid."
      );

      setCouponSuccess("");
      setCouponDiscount(0);
      setAppliedCouponCode("");
      return;
    }

    try {
      setCouponLoading(true);
      setCouponError("");
      setCouponSuccess("");

      /*
       * Coupons are validated against the product subtotal.
       * Tax and delivery are added separately below.
       */
      const response =
        await api.post(
          "/coupons/apply",
          {
            code,
            total: roundMoney(subtotal),
          }
        );

      const data =
        response.data;

      if (data?.success === false) {
        throw new Error(
          data?.message ||
            "Failed to apply coupon"
        );
      }

      const discount =
        roundMoney(
          Number(
            data?.discount || 0
          )
        );

      const backendCouponCode =
        String(
          data?.couponCode ||
            code
        )
          .trim()
          .toUpperCase();

      if (
        !backendCouponCode ||
        discount <= 0
      ) {
        throw new Error(
          "The coupon did not return a valid discount."
        );
      }

      setAppliedCouponCode(
        backendCouponCode
      );

      setCouponCode(
        backendCouponCode
      );

      setCouponDiscount(
        Math.min(
          discount,
          amountBeforeCoupon
        )
      );

      setCouponSuccess(
        data?.message ||
          `Coupon ${backendCouponCode} applied successfully`
      );

      showToast(
        data?.message ||
          `You saved ₹${discount.toFixed(
            2
          )}`,
        "success"
      );
    } catch (error: any) {
      console.log(
        "COUPON ERROR:",
        error?.response?.data ||
          error?.message ||
          error
      );

      setCouponDiscount(0);
      setAppliedCouponCode("");
      setCouponSuccess("");

      setCouponError(
        error?.response?.data
          ?.message ||
          error?.message ||
          "Failed to apply coupon"
      );

      showToast(
        error?.response?.data
          ?.message ||
          error?.message ||
          "Failed to apply coupon",
        "error"
      );
    } finally {
      setCouponLoading(false);
    }
  };

  /* =======================================================
     SERVICEABILITY
  ======================================================= */

  const checkServiceability =
    async () => {
      if (!selectedAddress) {
        showToast(
          "Please select a delivery address first.",
          "error"
        );

        return false;
      }

      const postalCode =
        String(
          selectedAddress.postalCode ||
            ""
        ).trim();

      if (
        !/^[1-9][0-9]{5}$/.test(
          postalCode
        )
      ) {
        showToast(
          "Enter a valid 6-digit PIN code.",
          "error"
        );

        setServiceability({
          checking: false,
          checked: false,
          postalCode: "",
          serviceableItems: [],
          unavailableItems: [],
          message: "",
        });

        return false;
      }

      if (!cartItems.length) {
        showToast(
          "Your cart is empty.",
          "error"
        );

        return false;
      }

      try {
        setServiceability(
          (previous) => ({
            ...previous,
            checking: true,
            checked: false,
            postalCode,
            serviceableItems: [],
            unavailableItems: [],
            message: "",
          })
        );

        const response =
          await api.post(
            "/serviceability/cart",
            {
              postalCode,

              items:
                cartItems.map(
                  (item) => ({
                    productId:
                      item.productId,

                    variantSku:
                      item.variantSku ||
                      "",

                    quantity:
                      Number(
                        item.quantity ||
                          1
                      ),

                    sellerId:
                      item.sellerId ||
                      null,
                  })
                ),
            }
          );

        const data =
          response.data;

        if (
          data?.success === false
        ) {
          throw new Error(
            data?.message ||
              data?.error ||
              "Unable to check delivery availability"
          );
        }

        const unavailable =
          Array.isArray(
            data?.unavailableItems
          )
            ? data.unavailableItems
            : Array.isArray(
                data?.items
              )
            ? data.items.filter(
                (item: any) =>
                  item.serviceable ===
                  false
              )
            : [];

        const available =
          Array.isArray(
            data?.serviceableItems
          )
            ? data.serviceableItems
            : Array.isArray(
                data?.items
              )
            ? data.items.filter(
                (item: any) =>
                  item.serviceable !==
                  false
              )
            : [];

        setServiceability({
          checking: false,
          checked: true,
          postalCode,
          serviceableItems:
            available,
          unavailableItems:
            unavailable,
          message:
            data?.message || "",
        });

        if (
          unavailable.length > 0
        ) {
          showToast(
            `${unavailable.length} item${
              unavailable.length > 1
                ? "s are"
                : " is"
            } not deliverable to ${postalCode}.`,
            "error"
          );

          return false;
        }

        showToast(
          `All items are deliverable to ${postalCode}.`,
          "success"
        );

        return true;
      } catch (error: any) {
        console.log(
          "SERVICEABILITY ERROR:",
          error?.response?.data ||
            error?.message ||
            error
        );

        setServiceability(
          (previous) => ({
            ...previous,
            checking: false,
            checked: false,
            postalCode,
            serviceableItems: [],
            unavailableItems: [],
            message:
              error?.response?.data
                ?.message ||
              error?.message ||
              "Unable to check delivery availability",
          })
        );

        showToast(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Unable to check delivery availability",
          "error"
        );

        return false;
      }
    };

  /* =======================================================
     REMOVE UNAVAILABLE
  ======================================================= */

  const handleRemoveUnavailable =
    async (item: any) => {
      const productId =
        item?.productId?._id ||
        item?.productId ||
        item?._id ||
        item?.product?._id;

      if (!productId) {
        showToast(
          "Could not identify this cart item.",
          "error"
        );

        return;
      }

      const variantSku =
        item?.variantSku ||
        item?.variant?.sku ||
        "";

      try {
        await api.delete(
          "/cart/remove",
          {
            data: {
              productId:
                String(productId),
              variantSku:
                variantSku || "",
            },
          }
        );

        setCartItems(
          (previous) =>
            previous.filter(
              (cartItem) =>
                !(
                  String(
                    cartItem.productId
                  ) ===
                    String(
                      productId
                    ) &&
                  String(
                    cartItem.variantSku ||
                      ""
                  ) ===
                    String(
                      variantSku ||
                        ""
                    )
                )
            )
        );

        setServiceability(
          (previous) => ({
            ...previous,
            unavailableItems:
              previous.unavailableItems.filter(
                (unavailable: any) =>
                  String(
                    unavailable?.productId
                      ?._id ||
                      unavailable?.productId ||
                      unavailable?._id
                  ) !==
                  String(
                    productId
                  )
              ),
          })
        );

        showToast(
          "Item removed from cart.",
          "success"
        );
      } catch (error: any) {
        showToast(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Unable to remove item.",
          "error"
        );
      }
    };

  /* =======================================================
     ORDER ITEMS
  ======================================================= */

  const buildOrderItems =
    () => {
      return cartItems.map(
        (item) => ({
          productId:
            item.productId,

          sellerId:
            item.sellerId || null,

          variantSku:
            item.variantSku || "",

          attributes:
            item.attributes || {},

          title:
            item.name ||
            item.product?.title ||
            item.product?.name ||
            "",

          slug:
            item.slug || "",

          image:
            item.image ||
            item.product?.media
              ?.thumbnail ||
            item.product?.media
              ?.images?.[0] ||
            "",

          brand:
            item.brand ||
            item.product?.brand ||
            "",

          category:
            item.category ||
            item.product?.category ||
            "",

          price: Number(
            item.price || 0
          ),

          quantity: Number(
            item.quantity || 1
          ),
        })
      );
    };

  /* =======================================================
     PLACE ORDER
  ======================================================= */

  const handlePlaceOrder =
    async () => {
      if (
        placingOrder ||
        leavingCheckout
      ) {
        return;
      }

      /* LOGIN */

      if (!user) {
        showToast(
          "Please login before placing your order.",
          "error"
        );

        setTimeout(() => {
          router.push(
            "/(auth)/login"
          );
        }, 500);

        return;
      }

      /* ADDRESS */

      if (!selectedAddress) {
        showToast(
          "Please select a delivery address.",
          "error"
        );

        return;
      }

      /* CART */

      if (!cartItems.length) {
        showToast(
          "Your cart is empty.",
          "error"
        );

        setTimeout(() => {
          router.replace(
            "/(tabs)/cart"
          );
        }, 500);

        return;
      }

      /* VALIDATE ITEMS */

      const invalidItem =
        cartItems.find(
          (item) =>
            !item.productId ||
            !item.variantSku ||
            Number(
              item.quantity
            ) <= 0
        );

      if (invalidItem) {
        showToast(
          "One or more products in your cart are invalid.",
          "error"
        );

        return;
      }

      try {
        setPlacingOrder(true);

        /* SERVICEABILITY */

        const serviceableNow =
          serviceability.checked &&
          serviceability.postalCode ===
            String(
              selectedAddress.postalCode ||
                ""
            ).trim() &&
          serviceability
            .unavailableItems
            .length === 0;

        if (!serviceableNow) {
          const ok =
            await checkServiceability();

          if (!ok) {
            setPlacingOrder(
              false
            );

            return;
          }
        }

        /* ADDRESS MODEL NORMALIZATION */
        // The Address model contains only these address fields:
        // houseNumber, street, area, landmark, city, district,
        // state, postalCode, country, postOffice, etc.
        // The Order model still expects addressLine1, so derive it
        // from the Address model instead of reading a non-existent
        // selectedAddress.addressLine1 field.
        const normalizedHouseNumber =
          String(selectedAddress.houseNumber || "").trim();

        const normalizedStreet =
          String(selectedAddress.street || "").trim();

        const normalizedArea =
          String(selectedAddress.area || "").trim();

        const normalizedCity =
          String(selectedAddress.city || "").trim();

        const normalizedDistrict =
          String(selectedAddress.district || "").trim();

        const normalizedState =
          String(selectedAddress.state || "").trim();

        const normalizedPostalCode =
          String(selectedAddress.postalCode || "").trim();

        const normalizedFullName =
          String(
            selectedAddress.fullName ||
              `${user?.firstName || ""} ${
                user?.lastName || ""
              }`.trim()
          ).trim();

        const normalizedPhone =
          String(
            selectedAddress.phone ||
              user?.phone ||
              ""
          ).trim();

        const normalizedEmail =
          String(
            selectedAddress.email ||
              user?.email ||
              ""
          )
            .trim()
            .toLowerCase();

        // addressLine1 is an Order snapshot field, not an Address model field.
        const normalizedAddressLine1 = [
          normalizedHouseNumber,
          normalizedStreet,
        ]
          .filter(Boolean)
          .join(", ");

        if (
          !normalizedFullName ||
          !normalizedPhone ||
          !normalizedEmail ||
          !normalizedHouseNumber ||
          !normalizedStreet ||
          !normalizedArea ||
          !normalizedCity ||
          !normalizedDistrict ||
          !normalizedState ||
          !/^[1-9][0-9]{5}$/.test(
            normalizedPostalCode
          ) ||
          !normalizedAddressLine1
        ) {
          console.log(
            "INVALID CHECKOUT ADDRESS MODEL:",
            selectedAddress
          );

          showToast(
            "Your saved address is incomplete. Please edit and save the address again.",
            "error"
          );

          setPlacingOrder(false);
          return;
        }

        const orderItems =
          buildOrderItems();

        /* PRICING */

        const orderSubtotal =
          roundMoney(subtotal);

        const orderTax =
          roundMoney(itemTax);

        const orderShipping =
          roundMoney(
            shippingCharge
          );

        const orderCouponDiscount =
          roundMoney(
            Number(
              couponDiscount || 0
            )
          );

        const orderTotalBeforeCoupon =
          roundMoney(
            orderSubtotal +
              orderTax +
              orderShipping
          );

        const orderFinalTotal =
          roundMoney(
            Math.max(
              0,
              orderTotalBeforeCoupon -
                orderCouponDiscount
            )
          );

        if (
          !Number.isFinite(
            orderFinalTotal
          ) ||
          orderFinalTotal <= 0
        ) {
          throw new Error(
            "Invalid order total. Please refresh your cart."
          );
        }

        /* PAYMENT */

        const backendPaymentMethod =
          paymentMethod === "cod"
            ? "COD"
            : "Razorpay";

        /* CUSTOMER CONTACT */

        const customerEmail =
          normalizedEmail;

        /* ORDER PAYLOAD */

        const orderPayload = {
          userId: user?._id,

          user:
            normalizedFullName,

          email:
            normalizedEmail,

          phone:
            normalizedPhone,

          items:
            orderItems,

          deliveryAddress: {
            customer: {
              fullName:
                normalizedFullName,

              phone:
                normalizedPhone,

              alternatePhone:
                String(
                  selectedAddress.alternatePhone ||
                    ""
                ).trim(),

              email:
                normalizedEmail,
            },

            /*
             * These fields are kept in the ORDER SNAPSHOT
             * because your order backend can still store
             * the historical delivery structure.
             */
            address: {
              // Order snapshot field derived from the Address model.
              // Address model itself does not contain addressLine1.
              addressLine1:
                normalizedAddressLine1,

              houseNumber:
                normalizedHouseNumber,

              street:
                normalizedStreet,

              area:
                normalizedArea,

              landmark:
                String(
                  selectedAddress.landmark ||
                    ""
                ).trim(),

              city:
                normalizedCity,

              district:
                normalizedDistrict,

              state:
                normalizedState,

              postalCode:
                normalizedPostalCode,

              country:
                String(
                  selectedAddress.country ||
                    "India"
                ).trim() ||
                "India",

              postOffice:
                String(
                  selectedAddress.postOffice ||
                    ""
                ).trim(),

              label:
                selectedAddress.label ||
                "Home",
            },

            location: {
              latitude:
                selectedAddress.location
                  ?.latitude ??
                null,

              longitude:
                selectedAddress.location
                  ?.longitude ??
                null,
            },

            preference: {
              addressType:
                selectedAddress.label ||
                "Home",

              deliveryInstructions:
                String(
                  selectedAddress.deliveryInstructions ||
                    ""
                ).trim(),

              isDefault:
                Boolean(
                  selectedAddress.isDefault
                ),
            },
          },

          subtotal:
            orderSubtotal,

          shippingCharge:
            orderShipping,

          tax:
            orderTax,

          couponCode:
            String(
              appliedCouponCode || ""
            ).trim(),

          couponDiscount:
            orderCouponDiscount,

          total:
            orderFinalTotal,

          paymentMethod:
            backendPaymentMethod,
        };

        console.log(
          "===================================="
        );

        console.log(
          "PLACE ORDER PAYMENT METHOD:",
          backendPaymentMethod
        );

        console.log(
          "PLACE ORDER EMAIL:",
          customerEmail
        );

        console.log(
          "PLACE ORDER PAYLOAD:"
        );

        console.log(
          JSON.stringify(
            orderPayload,
            null,
            2
          )
        );

        console.log(
          "===================================="
        );

        /* CREATE ORDER */

        const response =
          await api.post(
            "/save-order",
            orderPayload
          );

        console.log(
          "SAVE ORDER RESPONSE:",
          response.data
        );

        if (
          !response.data?.success
        ) {
          throw new Error(
            response.data?.message ||
              "Order could not be placed."
          );
        }

        const order =
          response.data?.order;

        /* =================================================
           COD SUCCESS
        ================================================= */

        if (
          paymentMethod ===
          "cod"
        ) {
          console.log(
            "COD ORDER SUCCESS:",
            order?._id
          );

          /*
           * Mark checkout as leaving BEFORE
           * changing navigation. This prevents
           * useFocusEffect from trying to reload
           * the checkout screen.
           */
          setLeavingCheckout(
            true
          );

          /*
           * Clear cart after successful
           * order creation.
           */
          try {
            await clearCart();

            setCartItems([]);
            setSubtotal(0);

            console.log(
              "CART CLEARED AFTER SUCCESSFUL COD ORDER"
            );
          } catch (
            cartError: any
          ) {
            /*
             * Order already exists.
             * Cart cleanup failure must NOT
             * make the order look failed.
             */
            console.log(
              "CLEAR CART AFTER ORDER ERROR:",
              cartError?.response
                ?.data ||
                cartError?.message ||
                cartError
            );
          }

          /*
           * Show success toast briefly.
           */
          showToast(
            `Order ${
              order?.orderNumber
                ? `#${order.orderNumber} `
                : ""
            }placed successfully 🎉`,
            "success"
          );

          /*
           * IMPORTANT:
           *
           * router.replace()
           * removes checkout from the
           * current navigation position.
           *
           * Therefore user will NOT return
           * to an empty checkout screen.
           */
          setTimeout(() => {
            if (order?._id) {
              router.replace({
                pathname:
                  "/orders/[id]",
                params: {
                  id: String(
                    order._id
                  ),
                },
              });
            } else {
              router.replace(
                "/orders"
              );
            }
          }, 500);

          return;
        }

        /* =================================================
           RAZORPAY
        ================================================= */

        const razorpayData =
          response.data
            ?.razorpay;

        if (
          razorpayData
        ) {
          console.log(
            "RAZORPAY DATA:",
            razorpayData
          );

          router.push({
            pathname:
              "/checkout/payment",

            params: {
              orderId:
                String(
                  order?._id || ""
                ),

              orderNumber:
                String(
                  order?.orderNumber ||
                    ""
                ),

              razorpayOrderId:
                String(
                  razorpayData.orderId ||
                    ""
                ),

              amount:
                String(
                  razorpayData.amount ||
                    0
                ),

              currency:
                String(
                  razorpayData.currency ||
                    "INR"
                ),
            },
          });

          return;
        }

        showToast(
          "Online payment information was not returned by the server.",
          "error"
        );
      } catch (
        error: any
      ) {
        console.log(
          "PLACE ORDER ERROR:",
          error?.response?.data ||
            error?.message ||
            error
        );

        showToast(
          error?.response?.data
            ?.message ||
            error?.message ||
            "Something went wrong while placing your order.",
          "error"
        );
      } finally {
        setPlacingOrder(
          false
        );
      }
    };

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return <CheckoutSkeleton />;
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.container}
      edges={[
        "top",
        "bottom",
      ]}
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <View style={styles.header}>
        <Pressable
          onPress={() =>
            router.back()
          }
          style={({ pressed }) => [
            styles.headerButton,
            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color={colors.text}
          />
        </Pressable>

        <View
          style={styles.headerCenter}
        >
          <Text
            style={styles.headerTitle}
          >
            Checkout
          </Text>

          <View
            style={styles.secureRow}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={12}
              color={colors.success}
            />

            <Text
              style={styles.secureText}
            >
              Secure checkout
            </Text>
          </View>
        </View>

        <View
          style={styles.headerButton}
        >
          <Ionicons
            name="lock-closed-outline"
            size={18}
            color={
              colors.textSecondary
            }
          />
        </View>
      </View>

      {/* =================================================
          PROGRESS
      ================================================= */}

      <View
        style={styles.progressWrap}
      >
        <View
          style={styles.progressLine}
        />

        <View
          style={styles.progressStep}
        >
          <View
            style={
              styles.progressDotActive
            }
          >
            <Text
              style={
                styles.progressNumberActive
              }
            >
              1
            </Text>
          </View>

          <Text
            style={
              styles.progressLabelActive
            }
          >
            Address
          </Text>
        </View>

        <View
          style={styles.progressStep}
        >
          <View
            style={
              styles.progressDotActive
            }
          >
            <Text
              style={
                styles.progressNumberActive
              }
            >
              2
            </Text>
          </View>

          <Text
            style={
              styles.progressLabelActive
            }
          >
            Review
          </Text>
        </View>

        <View
          style={styles.progressStep}
        >
          <View
            style={styles.progressDot}
          >
            <Text
              style={
                styles.progressNumber
              }
            >
              3
            </Text>
          </View>

          <Text
            style={styles.progressLabel}
          >
            Payment
          </Text>
        </View>
      </View>

      {/* =================================================
          CONTENT
      ================================================= */}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* ===============================================
            ADDRESS
        =============================================== */}

        <View
          style={styles.section}
        >
          <View
            style={styles.sectionHeader}
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Delivery Address
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Where should we deliver your
                order?
              </Text>
            </View>

            <Pressable
              onPress={
                handleChangeAddress
              }
            >
              <Text
                style={styles.changeText}
              >
                Change
              </Text>
            </Pressable>
          </View>

          {selectedAddress ? (
            <View
              style={
                styles.addressCard
              }
            >
              <View
                style={
                  styles.addressTop
                }
              >
                <View
                  style={
                    styles.addressLabelRow
                  }
                >
                  <View
                    style={
                      styles.homeIcon
                    }
                  >
                    <Ionicons
                      name="location-outline"
                      size={20}
                      color={
                        colors.primary
                      }
                    />
                  </View>

                  <Text
                    style={
                      styles.addressName
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      selectedAddress.fullName
                    }
                  </Text>

                  <View
                    style={
                      styles.labelBadge
                    }
                  >
                    <Text
                      style={
                        styles.labelBadgeText
                      }
                    >
                      {selectedAddress.label ||
                        "Home"}
                    </Text>
                  </View>
                </View>

                {selectedAddress.isDefault && (
                  <View
                    style={
                      styles.defaultBadge
                    }
                  >
                    <Text
                      style={
                        styles.defaultBadgeText
                      }
                    >
                      Default
                    </Text>
                  </View>
                )}
              </View>

              <Text
                style={
                  styles.addressText
                }
              >
                {formatAddress(
                  selectedAddress
                )}
              </Text>

              <View
                style={styles.phoneRow}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={
                    colors.textSecondary
                  }
                />

                <Text
                  style={
                    styles.phoneText
                  }
                >
                  {
                    selectedAddress.phone
                  }
                </Text>
              </View>

              {selectedAddress.email ? (
                <View
                  style={
                    styles.emailRow
                  }
                >
                  <Ionicons
                    name="mail-outline"
                    size={15}
                    color={
                      colors.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.emailText
                    }
                    numberOfLines={1}
                  >
                    {
                      selectedAddress.email
                    }
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable
              style={
                styles.addAddressCard
              }
              onPress={
                handleChangeAddress
              }
            >
              <Ionicons
                name="add-circle-outline"
                size={28}
                color={
                  colors.primary
                }
              />

              <View>
                <Text
                  style={
                    styles.addAddressTitle
                  }
                >
                  Add delivery address
                </Text>

                <Text
                  style={
                    styles.addAddressSubtitle
                  }
                >
                  Add an address to continue
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  colors.textMuted
                }
              />
            </Pressable>
          )}
        </View>

        {/* ===============================================
            SERVICEABILITY
        =============================================== */}

        {selectedAddress && (
          <View
            style={styles.section}
          >
            <View
              style={
                styles.sectionHeader
              }
            >
              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Delivery Availability
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Check delivery for PIN{" "}
                  {
                    selectedAddress.postalCode
                  }
                </Text>
              </View>

              <Pressable
                style={[
                  styles.checkButton,
                  serviceability.checking &&
                    styles.placeOrderDisabled,
                ]}
                disabled={
                  serviceability.checking
                }
                onPress={
                  checkServiceability
                }
              >
                {serviceability.checking ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.checkButtonText
                    }
                  >
                    Check
                  </Text>
                )}
              </Pressable>
            </View>

            {serviceability.checked &&
              serviceability
                .unavailableItems
                .length === 0 && (
                <View
                  style={
                    styles.successBox
                  }
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={
                      colors.success
                    }
                  />

                  <Text
                    style={
                      styles.successBoxText
                    }
                  >
                    All items are deliverable
                    to{" "}
                    {
                      serviceability.postalCode
                    }
                  </Text>
                </View>
              )}

            {serviceability
              .unavailableItems
              .length > 0 && (
              <View
                style={
                  styles.warningBox
                }
              >
                <Text
                  style={
                    styles.warningTitle
                  }
                >
                  Some items are not
                  deliverable
                </Text>

                {serviceability.unavailableItems.map(
                  (
                    item: any,
                    index: number
                  ) => (
                    <View
                      key={`unavailable-${index}`}
                      style={
                        styles.unavailableRow
                      }
                    >
                      <Text
                        style={
                          styles.unavailableText
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {item?.title ||
                          item?.name ||
                          item?.product
                            ?.name ||
                          "Unavailable product"}
                      </Text>

                      <Pressable
                        onPress={() =>
                          handleRemoveUnavailable(
                            item
                          )
                        }
                      >
                        <Text
                          style={
                            styles.removeText
                          }
                        >
                          Remove
                        </Text>
                      </Pressable>
                    </View>
                  )
                )}
              </View>
            )}
          </View>
        )}

        {/* ===============================================
            ORDER SUMMARY
        =============================================== */}

        <View
          style={styles.section}
        >
          <Text
            style={styles.sectionTitle}
          >
            Order Summary
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            {cartItems.length}{" "}
            {cartItems.length === 1
              ? "item"
              : "items"}{" "}
            in your order
          </Text>

          {cartItems.map(
            (item, index) => (
              <View
                key={`${item.productId}-${item.variantSku}-${index}`}
                style={
                  styles.productRow
                }
              >
                <View
                  style={
                    styles.productImage
                  }
                >
                  {item.image ? (
                    <Image
                      source={{
                        uri: item.image,
                      }}
                      style={
                        styles.productImageActual
                      }
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons
                      name="cube-outline"
                      size={26}
                      color={
                        colors.primary
                      }
                    />
                  )}
                </View>

                <View
                  style={
                    styles.productInfo
                  }
                >
                  <Text
                    style={
                      styles.productName
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {item.name ||
                      "Product"}
                  </Text>

                  {item.variantSku ? (
                    <Text
                      style={
                        styles.variantText
                      }
                    >
                      {
                        item.variantSku
                      }
                    </Text>
                  ) : null}

                  {(() => {
                    const offerInfo =
                      getBackendOfferInfo(
                        item
                      );

                    const hasOffer =
                      offerInfo.discountPercentage >
                        0 ||
                      offerInfo.discountAmount >
                        0 ||
                      Boolean(
                        offerInfo.offerLabel
                      );

                    if (!hasOffer) {
                      return null;
                    }

                    return (
                      <View
                        style={
                          styles.offerRow
                        }
                      >
                        <View
                          style={
                            styles.offerBadge
                          }
                        >
                          <Ionicons
                            name="pricetag"
                            size={11}
                            color="#166534"
                          />

                          <Text
                            style={
                              styles.offerBadgeText
                            }
                          >
                            {offerInfo.discountPercentage >
                            0
                              ? `${offerInfo.discountPercentage}% OFF`
                              : "SPECIAL OFFER"}
                          </Text>
                        </View>

                        {offerInfo.offerLabel ? (
                          <Text
                            style={
                              styles.offerLabelText
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              offerInfo.offerLabel
                            }
                          </Text>
                        ) : null}
                      </View>
                    );
                  })()}

                  <Text
                    style={
                      styles.quantityText
                    }
                  >
                    Qty:{" "}
                    {item.quantity}
                  </Text>
                </View>

                <View
                  style={
                    styles.productPriceWrap
                  }
                >
                  {(() => {
                    const offerInfo =
                      getBackendOfferInfo(
                        item
                      );

                    return (
                      <>
                        {offerInfo.originalPrice >
                        0 ? (
                          <Text
                            style={
                              styles.originalPrice
                            }
                          >
                            ₹
                            {offerInfo.originalPrice.toFixed(
                              2
                            )}
                          </Text>
                        ) : null}

                        <Text
                          style={
                            styles.productPrice
                          }
                        >
                          ₹
                          {(
                            Number(
                              item.price
                            ) *
                            Number(
                              item.quantity
                            )
                          ).toFixed(2)}
                        </Text>
                      </>
                    );
                  })()}
                </View>
              </View>
            )
          )}
        </View>

        {/* ===============================================
            COUPON
        =============================================== */}

        <View
          style={styles.section}
        >
          <View
            style={styles.couponTitleRow}
          >
            <View style={styles.couponTitleIcon}>
              <Ionicons
                name={
                  appliedCouponCode
                    ? "checkmark-circle-outline"
                    : "ticket-outline"
                }
                size={19}
                color={
                  appliedCouponCode
                    ? colors.success
                    : colors.primary
                }
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={styles.sectionTitle}
              >
                {appliedCouponCode
                  ? "Coupon applied"
                  : "Have a coupon?"}
              </Text>

              <Text
                style={styles.sectionSubtitle}
              >
                {appliedCouponCode
                  ? `You are saving with ${appliedCouponCode}`
                  : "Enter your code and save more on this order"}
              </Text>
            </View>

            {appliedCouponCode ? (
              <Pressable
                onPress={clearCoupon}
                disabled={couponLoading}
                hitSlop={8}
              >
                <Text
                  style={styles.removeCouponText}
                >
                  Remove
                </Text>
              </Pressable>
            ) : null}
          </View>

          {!appliedCouponCode && suggestedCoupons.length > 0 && (
            <View style={styles.suggestedCouponWrap}>
              <View style={styles.suggestedCouponHeader}>
                <View style={styles.suggestedCouponHeaderLeft}>
                  <Ionicons
                    name="sparkles-outline"
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={styles.suggestedCouponTitle}>
                    Available for you
                  </Text>
                </View>
                <Text style={styles.suggestedCouponHint}>
                  Tap to apply
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestedCouponList}
              >
                {suggestedCoupons.map((coupon) => {
                  const type = String(coupon.discountType || "").toUpperCase();
                  const value = Number(coupon.discountValue || 0);
                  const minOrder = Number(coupon.minOrderAmount || 0);

                  const discountText =
                    type === "PERCENTAGE"
                      ? `${value}% OFF`
                      : `₹${value.toFixed(0)} OFF`;

                  return (
                    <Pressable
                      key={coupon.code}
                      onPress={() => {
                        const code = String(coupon.code).toUpperCase();
                        setCouponCode(code);
                        setCouponError("");
                        setCouponSuccess("");
                        applyCoupon(code);
                      }}
                      style={({ pressed }) => [
                        styles.suggestedCouponCard,
                        pressed && styles.suggestedCouponPressed,
                      ]}
                    >
                      <View style={styles.suggestedCouponTop}>
                        <View style={styles.suggestedCouponTag}>
                          <Ionicons
                            name="pricetag-outline"
                            size={12}
                            color={colors.primary}
                          />
                          <Text style={styles.suggestedCouponCode}>
                            {coupon.code}
                          </Text>
                        </View>
                        <View style={styles.suggestedApplyPill}>
                          <Text style={styles.suggestedApplyText}>
                            Apply
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.suggestedDiscount}>
                        {discountText}
                      </Text>

                      <Text style={styles.suggestedMinimum} numberOfLines={1}>
                        {minOrder > 0
                          ? `On orders above ₹${minOrder.toFixed(0)}`
                          : "No minimum order"}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {!appliedCouponCode && !couponError && (
            <View style={styles.couponInfoBox}>
              <Ionicons
                name="information-circle-outline"
                size={15}
                color={colors.primary}
              />

              <Text style={styles.couponInfoText}>
                Enter a valid coupon code to get an additional
                discount on your order.
              </Text>
            </View>
          )}

          <View
            style={[
              styles.couponRow,
              appliedCouponCode &&
                styles.couponAppliedRow,
            ]}
          >
            <View
              style={styles.couponInputWrap}
            >
              <Ionicons
                name={
                  appliedCouponCode
                    ? "checkmark-circle"
                    : "ticket-outline"
                }
                size={18}
                color={
                  appliedCouponCode
                    ? colors.success
                    : colors.textSecondary
                }
              />

              <TextInput
                value={couponCode}
                onChangeText={(
                  value
                ) => {
                  /*
                   * If the customer edits an already-applied
                   * coupon, immediately invalidate the local
                   * discount so an old discount cannot remain
                   * visible while a new code is being typed.
                   */
                  if (
                    appliedCouponCode &&
                    value
                      .trim()
                      .toUpperCase() !==
                      appliedCouponCode
                  ) {
                    setAppliedCouponCode("");
                    setCouponDiscount(0);
                  }

                  setCouponCode(
                    value.toUpperCase()
                  );

                  setCouponError("");
                  setCouponSuccess("");
                }}
                placeholder="Enter coupon code"
                placeholderTextColor={
                  colors.textMuted
                }
                autoCapitalize="characters"
                autoCorrect={false}
                editable={
                  !couponLoading
                }
                style={
                  styles.couponInput
                }
              />
            </View>

            {!appliedCouponCode ? (
              <Pressable
                style={[
                  styles.applyCouponButton,
                  couponLoading &&
                    styles.placeOrderDisabled,
                ]}
                disabled={
                  couponLoading
                }
                onPress={
                  applyCoupon
                }
              >
                {couponLoading ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.applyCouponText
                    }
                  >
                    Apply
                  </Text>
                )}
              </Pressable>
            ) : (
              <View
                style={
                  styles.appliedBadge
                }
              >
                <Text
                  style={
                    styles.appliedBadgeText
                  }
                >
                  Applied
                </Text>
              </View>
            )}
          </View>

          {!!couponError && (
            <View
              style={styles.couponMessageRow}
            >
              <Ionicons
                name="alert-circle-outline"
                size={15}
                color={colors.error}
              />

              <Text
                style={
                  styles.couponError
                }
              >
                {couponError}
              </Text>
            </View>
          )}

          {!!couponSuccess && (
            <View
              style={
                styles.couponSuccessBox
              }
            >
              <Ionicons
                name="checkmark-circle"
                size={17}
                color={colors.success}
              />

              <Text
                style={
                  styles.couponSuccess
                }
              >
                {couponSuccess}
              </Text>
            </View>
          )}

          {couponDiscount > 0 && (
            <View
              style={
                styles.couponSavingsCard
              }
            >
              <Ionicons
                name="gift-outline"
                size={18}
                color={
                  colors.success
                }
              />

              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={
                    styles.couponSavingsTitle
                  }
                >
                  Extra savings unlocked 🎉
                </Text>

                <Text
                  style={
                    styles.couponSavingsText
                  }
                >
                  You save ₹
                  {couponDiscount.toFixed(
                    2
                  )}{" "}
                  with {appliedCouponCode || "this coupon"}.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ===============================================
            PAYMENT
        =============================================== */}

        <View
          style={styles.section}
        >
          <Text
            style={styles.sectionTitle}
          >
            Payment Method
          </Text>

          <Text
            style={
              styles.sectionSubtitle
            }
          >
            Choose how you want to pay
          </Text>

          {/* COD */}

          <Pressable
            style={[
              styles.paymentCard,
              paymentMethod ===
                "cod" &&
                styles.paymentCardSelected,
            ]}
            onPress={() =>
              setPaymentMethod(
                "cod"
              )
            }
          >
            <View
              style={[
                styles.radio,
                paymentMethod ===
                  "cod" &&
                  styles.radioSelected,
              ]}
            >
              {paymentMethod ===
                "cod" && (
                <View
                  style={
                    styles.radioDot
                  }
                />
              )}
            </View>

            <View
              style={
                styles.paymentIcon
              }
            >
              <Ionicons
                name="cash-outline"
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.paymentInfo
              }
            >
              <Text
                style={
                  styles.paymentTitle
                }
              >
                Cash on Delivery
              </Text>

              <Text
                style={
                  styles.paymentSubtitle
                }
              >
                Pay when your order
                arrives
              </Text>
            </View>
          </Pressable>

          {/* ONLINE */}

          <Pressable
            style={[
              styles.paymentCard,
              paymentMethod ===
                "online" &&
                styles.paymentCardSelected,
            ]}
            onPress={() =>
              setPaymentMethod(
                "online"
              )
            }
          >
            <View
              style={[
                styles.radio,
                paymentMethod ===
                  "online" &&
                  styles.radioSelected,
              ]}
            >
              {paymentMethod ===
                "online" && (
                <View
                  style={
                    styles.radioDot
                  }
                />
              )}
            </View>

            <View
              style={
                styles.paymentIcon
              }
            >
              <Ionicons
                name="card-outline"
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.paymentInfo
              }
            >
              <Text
                style={
                  styles.paymentTitle
                }
              >
                Online Payment
              </Text>

              <Text
                style={
                  styles.paymentSubtitle
                }
              >
                Pay securely using
                Razorpay
              </Text>
            </View>
          </Pressable>
        </View>

        {/* ===============================================
            PRICE DETAILS
        =============================================== */}

        <View
          style={styles.section}
        >
          <Text
            style={styles.sectionTitle}
          >
            Price Details
          </Text>

          <View
            style={styles.priceRow}
          >
            <Text
              style={styles.priceLabel}
            >
              Subtotal
            </Text>

            <Text
              style={styles.priceValue}
            >
              ₹
              {subtotal.toFixed(
                2
              )}
            </Text>
          </View>

          <View
            style={
              styles.offerSummaryBox
            }
          >
            <View
              style={
                styles.offerSummaryIcon
              }
            >
              <Ionicons
                name="sparkles"
                size={16}
                color="#166534"
              />
            </View>

            <View
              style={{ flex: 1 }}
            >
              <Text
                style={
                  styles.offerSummaryTitle
                }
              >
                Special offer prices applied
              </Text>

              <Text
                style={
                  styles.offerSummaryText
                }
              >
                Product and seller offers
                are already included in the
                prices above.
              </Text>
            </View>
          </View>

          <View
            style={styles.priceRow}
          >
            <Text
              style={styles.priceLabel}
            >
              Tax
            </Text>

            <Text
              style={styles.priceValue}
            >
              ₹
              {itemTax.toFixed(
                2
              )}
            </Text>
          </View>

          <View
            style={styles.priceRow}
          >
            <Text
              style={styles.priceLabel}
            >
              Delivery
            </Text>

            <Text
              style={[
                styles.priceValue,
                styles.freeText,
              ]}
            >
              FREE
            </Text>
          </View>

          {couponDiscount > 0 && (
            <View
              style={styles.priceRow}
            >
              <Text
                style={
                  styles.priceLabel
                }
              >
                Coupon Discount
              </Text>

              <Text
                style={
                  styles.discountValue
                }
              >
                -₹
                {couponDiscount.toFixed(
                  2
                )}
              </Text>
            </View>
          )}

          <View
            style={styles.divider}
          />

          <View
            style={styles.totalRow}
          >
            <Text
              style={styles.totalLabel}
            >
              Payable Total
            </Text>

            <Text
              style={styles.totalValue}
            >
              ₹
              {finalTotal.toFixed(
                2
              )}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* =================================================
          TOAST
      ================================================= */}

      {toast.visible && (
        <View
          pointerEvents="none"
          style={[
            styles.toast,
            toast.type ===
              "success" &&
              styles.toastSuccess,
            toast.type ===
              "error" &&
              styles.toastError,
            toast.type ===
              "info" &&
              styles.toastInfo,
          ]}
        >
          <View
            style={styles.toastIcon}
          >
            <Ionicons
              name={
                toast.type ===
                "success"
                  ? "checkmark"
                  : toast.type ===
                    "error"
                  ? "close"
                  : "information"
              }
              size={16}
              color="#FFFFFF"
            />
          </View>

          <Text
            style={styles.toastText}
          >
            {toast.message}
          </Text>
        </View>
      )}

      {/* =================================================
          ADDRESS SELECTOR
      ================================================= */}

      <Modal
        visible={
          addressSelectorVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setAddressSelectorVisible(
            false
          )
        }
      >
        <View
          style={
            styles.addressModalOverlay
          }
        >
          <Pressable
            style={
              styles.addressModalBackdrop
            }
            onPress={() =>
              setAddressSelectorVisible(
                false
              )
            }
          />

          <View
            style={
              styles.addressModalSheet
            }
          >
            <View
              style={
                styles.addressModalHandle
              }
            />

            <View
              style={
                styles.addressModalHeader
              }
            >
              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={
                    styles.addressModalTitle
                  }
                >
                  Select delivery address
                </Text>

                <Text
                  style={
                    styles.addressModalSubtitle
                  }
                >
                  Choose where you want this
                  order delivered
                </Text>
              </View>

              <Pressable
                style={
                  styles.addressModalClose
                }
                onPress={() =>
                  setAddressSelectorVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={20}
                  color={
                    colors.text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.addressModalList
              }
            >
              {addresses
                .filter(
                  (address) =>
                    address?.isDeleted !==
                    true
                )
                .map(
                  (address) => {
                    const isSelected =
                      String(
                        selectedAddress?._id ||
                          ""
                      ) ===
                      String(
                        address?._id ||
                          ""
                      );

                    return (
                      <Pressable
                        key={String(
                          address._id
                        )}
                        style={[
                          styles.selectorAddressCard,
                          isSelected &&
                            styles.selectorAddressCardSelected,
                        ]}
                        onPress={() =>
                          handleSelectAddress(
                            address
                          )
                        }
                      >
                        <View
                          style={[
                            styles.selectorRadio,
                            isSelected &&
                              styles.selectorRadioSelected,
                          ]}
                        >
                          {isSelected && (
                            <View
                              style={
                                styles.selectorRadioDot
                              }
                            />
                          )}
                        </View>

                        <View
                          style={
                            styles.selectorAddressContent
                          }
                        >
                          <View
                            style={
                              styles.selectorAddressTitleRow
                            }
                          >
                            <Text
                              style={
                                styles.selectorAddressName
                              }
                              numberOfLines={
                                1
                              }
                            >
                              {address.fullName ||
                                "Delivery Address"}
                            </Text>

                            <View
                              style={
                                styles.selectorLabelBadge
                              }
                            >
                              <Text
                                style={
                                  styles.selectorLabelText
                                }
                              >
                                {address.label ||
                                  "Home"}
                              </Text>
                            </View>

                            {address.isDefault && (
                              <View
                                style={
                                  styles.selectorDefaultBadge
                                }
                              >
                                <Text
                                  style={
                                    styles.selectorDefaultText
                                  }
                                >
                                  Default
                                </Text>
                              </View>
                            )}
                          </View>

                          <Text
                            style={
                              styles.selectorAddressText
                            }
                            numberOfLines={
                              3
                            }
                          >
                            {formatAddress(
                              address
                            )}
                          </Text>

                          <View
                            style={
                              styles.selectorPhoneRow
                            }
                          >
                            <Ionicons
                              name="call-outline"
                              size={13}
                              color={
                                colors.textSecondary
                              }
                            />

                            <Text
                              style={
                                styles.selectorPhoneText
                              }
                            >
                              {
                                address.phone
                              }
                            </Text>
                          </View>

                          <View
                            style={
                              styles.selectorActions
                            }
                          >
                            {isSelected ? (
                              <View
                                style={
                                  styles.selectedForOrderBadge
                                }
                              >
                                <Ionicons
                                  name="checkmark-circle"
                                  size={15}
                                  color={
                                    colors.primary
                                  }
                                />

                                <Text
                                  style={
                                    styles.selectedForOrderText
                                  }
                                >
                                  Selected for this
                                  order
                                </Text>
                              </View>
                            ) : (
                              <Text
                                style={
                                  styles.tapToSelectText
                                }
                              >
                                Tap to select
                              </Text>
                            )}

                            <Pressable
                              style={
                                styles.editAddressButton
                              }
                              onPress={() =>
                                handleEditAddress(
                                  address
                                )
                              }
                              hitSlop={8}
                            >
                              <Ionicons
                                name="create-outline"
                                size={15}
                                color={
                                  colors.primary
                                }
                              />

                              <Text
                                style={
                                  styles.editAddressText
                                }
                              >
                                Edit
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  }
                )}

              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.newAddressButton,
                  pressed &&
                    styles.pressed,
                ]}
                onPress={
                  handleAddNewAddress
                }
              >
                <View
                  style={
                    styles.newAddressIcon
                  }
                >
                  <Ionicons
                    name="add"
                    size={22}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={{ flex: 1 }}
                >
                  <Text
                    style={
                      styles.newAddressTitle
                    }
                  >
                    Add a new address
                  </Text>

                  <Text
                    style={
                      styles.newAddressSubtitle
                    }
                  >
                    Add another delivery
                    location
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color={
                    colors.textMuted
                  }
                />
              </Pressable>
            </ScrollView>

            <View
              style={
                styles.addressModalBottom
              }
            >
              <Pressable
                style={[
                  styles.deliverHereButton,
                  !selectedAddress &&
                    styles.placeOrderDisabled,
                ]}
                disabled={
                  !selectedAddress
                }
                onPress={() =>
                  setAddressSelectorVisible(
                    false
                  )
                }
              >
                <Ionicons
                  name="location"
                  size={18}
                  color={
                    colors.textWhite
                  }
                />

                <Text
                  style={
                    styles.deliverHereText
                  }
                >
                  Deliver to this address
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* =================================================
          BOTTOM CTA
      ================================================= */}

      <View
        style={styles.bottomBar}
      >
        <View>
          <Text
            style={styles.bottomLabel}
          >
            Total Amount
          </Text>

          <Text
            style={styles.bottomTotal}
          >
            ₹
            {finalTotal.toFixed(
              2
            )}
          </Text>
        </View>

        <Pressable
          style={[
            styles.placeOrderButton,
            (placingOrder ||
              leavingCheckout) &&
              styles.placeOrderDisabled,
          ]}
          disabled={
            placingOrder ||
            leavingCheckout
          }
          onPress={
            handlePlaceOrder
          }
        >
          {placingOrder ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <>
              <Text
                style={
                  styles.placeOrderText
                }
              >
                {paymentMethod ===
                "cod"
                  ? "Place Order"
                  : "Continue to Pay"}
              </Text>

              <Ionicons
                name="arrow-forward"
                size={19}
                color="#FFFFFF"
              />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles = StyleSheet.create({
  /* =======================================================
     SKELETON
  ======================================================= */

  skeletonContainer: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  skeletonBlock: {
    backgroundColor: "#E5EAF2",
  },

  skeletonHeader: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 9,
    backgroundColor:
      colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderBottomWidth: 1,
    borderBottomColor:
      "#EEF2F7",
  },

  skeletonHeaderCenter: {
    alignItems: "center",
  },

  skeletonProgress: {
    height: 74,
    paddingHorizontal: 36,
    backgroundColor:
      colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderBottomWidth: 1,
    borderBottomColor:
      "#EEF2F7",
    position: "relative",
  },

  skeletonProgressLine: {
    position: "absolute",
    left: 65,
    right: 65,
    top: 25,
  },

  skeletonProgressStep: {
    alignItems: "center",
    zIndex: 2,
  },

  skeletonContent: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 125,
  },

  skeletonSection: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      "#E9EEF5",
  },

  skeletonAddressCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor:
      "#F5F8FF",
    borderWidth: 1,
    borderColor:
      "#DCE7FF",
  },

  skeletonAddressTop: {
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonProductRow: {
    minHeight: 94,
    marginTop: 11,
    padding: 10,
    borderRadius: 17,
    backgroundColor:
      "#F8FAFC",
    borderWidth: 1,
    borderColor:
      "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
  },

  skeletonCouponRow: {
    minHeight: 51,
    marginTop: 14,
    padding: 4,
    borderRadius: 15,
    backgroundColor:
      "#F8FAFC",
    borderWidth: 1,
    borderColor:
      "#E6EBF2",
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  skeletonBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 88,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor:
      "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor:
      "#E8EDF3",
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 12,
  },

  /* =======================================================
     CONTAINER
  ======================================================= */

  container: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  /* =======================================================
     HEADER
  ======================================================= */

  header: {
    minHeight: 70,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 9,
    backgroundColor:
      colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderBottomWidth: 1,
    borderBottomColor:
      "#EEF2F7",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor:
      "#F6F8FC",
    alignItems: "center",
    justifyContent:
      "center",
  },

  headerCenter: {
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.35,
    color: colors.text,
  },

  secureRow: {
    marginTop: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  secureText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.success,
  },

  /* =======================================================
     PROGRESS
  ======================================================= */

  progressWrap: {
    height: 74,
    paddingHorizontal: 36,
    backgroundColor:
      colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderBottomWidth: 1,
    borderBottomColor:
      "#EEF2F7",
  },

  progressLine: {
    position: "absolute",
    left: 65,
    right: 65,
    top: 25,
    height: 3,
    borderRadius: 3,
    backgroundColor:
      "#E8EDF5",
  },

  progressStep: {
    alignItems: "center",
    zIndex: 2,
  },

  progressDotActive: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor:
      colors.primary,
    alignItems: "center",
    justifyContent:
      "center",
    borderWidth: 3,
    borderColor:
      colors.surface,
    shadowColor:
      colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 3,
  },

  progressDot: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor:
      "#F4F6FA",
    alignItems: "center",
    justifyContent:
      "center",
    borderWidth: 1,
    borderColor:
      "#E2E8F0",
  },

  progressNumberActive: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textWhite,
  },

  progressNumber: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.textMuted,
  },

  progressLabelActive: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: "900",
    color: colors.primary,
  },

  progressLabel: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
  },

  /* =======================================================
     CONTENT
  ======================================================= */

  content: {
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 145,
  },

  section: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor:
      colors.surface,
    borderWidth: 1,
    borderColor:
      "#E9EEF5",
    shadowColor:
      "#64748B",
    shadowOpacity: 0.055,
    shadowRadius: 14,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 13,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.2,
    color: colors.text,
  },

  sectionSubtitle: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  changeText: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor:
      colors.blueSoft,
    fontSize: 11,
    fontWeight: "900",
    color: colors.primary,
  },

  /* =======================================================
     ADDRESS
  ======================================================= */

  addressCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor:
      "#F5F8FF",
    borderWidth: 1,
    borderColor:
      "#DCE7FF",
  },

  addressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  addressLabelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  homeIcon: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor:
      colors.surface,
    alignItems: "center",
    justifyContent:
      "center",
  },

  addressName: {
    maxWidth: "46%",
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  labelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor:
      colors.surface,
  },

  labelBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.primary,
  },

  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor:
      "#DCFCE7",
  },

  defaultBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#166534",
  },

  addressText: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  phoneRow: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor:
      "#DCE7FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  phoneText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
  },

  emailRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  emailText: {
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  addAddressCard: {
    minHeight: 72,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor:
      "#F5F8FF",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor:
      colors.primary,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },

  addAddressTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  addAddressSubtitle: {
    marginTop: 3,
    fontSize: 10,
    color: colors.textSecondary,
  },

  /* =======================================================
     SERVICEABILITY
  ======================================================= */

  checkButton: {
    minWidth: 68,
    height: 39,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor:
      colors.primary,
    alignItems: "center",
    justifyContent:
      "center",
  },

  checkButtonText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.textWhite,
  },

  successBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor:
      "#F0FDF4",
    borderWidth: 1,
    borderColor:
      "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  successBoxText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    color: "#166534",
  },

  warningBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor:
      "#FFFBEB",
    borderWidth: 1,
    borderColor:
      "#FDE68A",
  },

  warningTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "900",
    color: "#92400E",
  },

  unavailableRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor:
      "#FDE68A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    gap: 10,
  },

  unavailableText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    color: colors.text,
  },

  removeText: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.error,
  },

  /* =======================================================
     PRODUCTS
  ======================================================= */

  productRow: {
    minHeight: 94,
    marginTop: 11,
    padding: 10,
    borderRadius: 17,
    backgroundColor:
      "#F8FAFC",
    borderWidth: 1,
    borderColor:
      "#EEF2F7",
    flexDirection: "row",
    alignItems: "center",
  },

  productImage: {
    width: 72,
    height: 74,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor:
      colors.blueSoft,
    alignItems: "center",
    justifyContent:
      "center",
  },

  productImageActual: {
    width: "100%",
    height: "100%",
  },

  productInfo: {
    flex: 1,
    marginLeft: 11,
    marginRight: 8,
  },

  productName: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    color: colors.text,
  },

  variantText: {
    marginTop: 4,
    fontSize: 9,
    color: colors.textSecondary,
  },

  quantityText: {
    marginTop: 5,
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
  },

  productPriceWrap: {
    minWidth: 74,
    alignItems: "flex-end",
    justifyContent:
      "center",
  },

  originalPrice: {
    marginBottom: 2,
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
    textDecorationLine:
      "line-through",
  },

  productPrice: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.primary,
  },

  offerRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },

  offerBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor:
      "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },

  offerBadgeText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#166534",
  },

  offerLabelText: {
    flex: 1,
    fontSize: 8,
    fontWeight: "800",
    color: "#15803D",
  },

  offerSummaryBox: {
    marginBottom: 12,
    padding: 11,
    borderRadius: 14,
    backgroundColor:
      "#F0FDF4",
    borderWidth: 1,
    borderColor:
      "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  offerSummaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor:
      "#DCFCE7",
    alignItems: "center",
    justifyContent:
      "center",
  },

  offerSummaryTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#166534",
  },

  offerSummaryText: {
    marginTop: 2,
    fontSize: 9,
    lineHeight: 13,
    color: "#15803D",
  },

  /* =======================================================
     COUPON
  ======================================================= */

  suggestedCouponWrap: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 15,
    backgroundColor: "#F7F9FF",
    borderWidth: 1,
    borderColor: "#E1E8FF",
  },

  suggestedCouponHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 9,
  },

  suggestedCouponHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  suggestedCouponTitle: {
    fontSize: 10.5,
    fontWeight: "900",
    color: colors.text,
  },

  suggestedCouponHint: {
    fontSize: 8.5,
    fontWeight: "700",
    color: colors.textMuted,
  },

  suggestedCouponList: {
    gap: 8,
    paddingRight: 2,
  },

  suggestedCouponCard: {
    width: 190,
    minHeight: 88,
    padding: 10,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#DCE4FA",
  },

  suggestedCouponPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.985 }],
  },

  suggestedCouponTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  suggestedCouponTag: {
    maxWidth: 125,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  suggestedCouponCode: {
    fontSize: 10,
    fontWeight: "900",
    color: colors.primary,
  },

  suggestedApplyPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.blueSoft,
  },

  suggestedApplyText: {
    fontSize: 8,
    fontWeight: "900",
    color: colors.primary,
  },

  suggestedDiscount: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "900",
    color: colors.text,
  },

  suggestedMinimum: {
    marginTop: 3,
    fontSize: 8.5,
    color: colors.textSecondary,
  },

  couponRow: {
    minHeight: 51,
    padding: 4,
    borderRadius: 15,
    backgroundColor:
      "#F8FAFC",
    borderWidth: 1,
    borderColor:
      "#E6EBF2",
    flexDirection: "row",
    alignItems: "center",
  },

  couponInput: {
    flex: 1,
    height: 43,
    paddingHorizontal: 13,
    fontSize: 12,
    fontWeight: "800",
    color: colors.text,
  },

  couponInputWrap: {
    flex: 1,
    minWidth: 0,
    height: 43,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  couponAppliedRow: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
  },

  couponTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 13,
  },

  couponTitleIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },

  couponInfoBox: {
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E6EBF2",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  couponInfoText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  removeCouponText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.error,
  },

  appliedBadge: {
    minWidth: 68,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },

  appliedBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#166534",
  },

  couponMessageRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  couponSuccessBox: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#DCFCE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  applyCouponButton: {
    minWidth: 78,
    height: 42,
    paddingHorizontal: 13,
    borderRadius: 12,
    backgroundColor:
      colors.primary,
    alignItems: "center",
    justifyContent:
      "center",
  },

  applyCouponText: {
    fontSize: 11,
    fontWeight: "900",
    color: colors.textWhite,
  },

  couponError: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "700",
    color: colors.error,
  },

  couponSuccess: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    color: "#166534",
  },

  couponSavingsCard: {
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
    backgroundColor:
      "#F0FDF4",
    borderWidth: 1,
    borderColor:
      "#BBF7D0",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  couponSavingsTitle: {
    fontSize: 10,
    fontWeight: "900",
    color: "#166534",
  },

  couponSavingsText: {
    marginTop: 2,
    fontSize: 9,
    color: "#15803D",
  },

  /* =======================================================
     PAYMENT
  ======================================================= */

  paymentCard: {
    minHeight: 76,
    marginTop: 10,
    padding: 12,
    borderRadius: 18,
    backgroundColor:
      "#F8FAFC",
    borderWidth: 1.5,
    borderColor:
      "#E6EBF2",
    flexDirection: "row",
    alignItems: "center",
  },

  paymentCardSelected: {
    backgroundColor:
      "#F3F7FF",
    borderColor:
      colors.primary,
    shadowColor:
      colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1.6,
    borderColor:
      colors.textMuted,
    alignItems: "center",
    justifyContent:
      "center",
  },

  radioSelected: {
    borderColor:
      colors.primary,
  },

  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor:
      colors.primary,
  },

  paymentIcon: {
    width: 44,
    height: 44,
    marginLeft: 10,
    borderRadius: 14,
    backgroundColor:
      colors.surface,
    alignItems: "center",
    justifyContent:
      "center",
  },

  paymentInfo: {
    flex: 1,
    marginLeft: 10,
  },

  paymentTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  paymentSubtitle: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 15,
    color: colors.textSecondary,
  },

  /* =======================================================
     PRICE
  ======================================================= */

  priceRow: {
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
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
    fontWeight: "900",
    color: colors.success,
  },

  freeText: {
    fontWeight: "900",
    color: colors.success,
  },

  divider: {
    height: 1,
    marginVertical: 6,
    backgroundColor:
      "#E8EDF3",
  },

  totalRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text,
  },

  totalValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
    color: colors.primary,
  },

  /* =======================================================
     TOAST
  ======================================================= */

  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 102,
    minHeight: 52,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 9999,
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
  },

  toastSuccess: {
    backgroundColor: "#166534",
  },

  toastError: {
    backgroundColor: "#B91C1C",
  },

  toastInfo: {
    backgroundColor: "#1D4ED8",
  },

  toastIcon: {
    width: 30,
    height: 30,
    marginRight: 10,
    borderRadius: 10,
    backgroundColor:
      "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent:
      "center",
  },

  toastText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* =======================================================
     ADDRESS MODAL
  ======================================================= */

  addressModalOverlay: {
    flex: 1,
    justifyContent:
      "flex-end",
    backgroundColor:
      "rgba(15,23,42,0.42)",
  },

  addressModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  addressModalSheet: {
    maxHeight: "90%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor:
      colors.surface,
    overflow: "hidden",
  },

  addressModalHandle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    marginTop: 9,
    borderRadius: 5,
    backgroundColor:
      "#D9E0EA",
  },

  addressModalHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor:
      "#EEF2F7",
  },

  addressModalTitle: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
    color: colors.text,
  },

  addressModalSubtitle: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  addressModalClose: {
    width: 39,
    height: 39,
    marginLeft: 10,
    borderRadius: 13,
    backgroundColor:
      "#F5F7FA",
    alignItems: "center",
    justifyContent:
      "center",
  },

  addressModalList: {
    padding: 15,
    paddingBottom: 12,
  },

  selectorAddressCard: {
    marginBottom: 10,
    padding: 14,
    borderRadius: 18,
    backgroundColor:
      "#F8FAFC",
    borderWidth: 1.5,
    borderColor:
      "#E6EBF2",
    flexDirection: "row",
  },

  selectorAddressCardSelected: {
    backgroundColor:
      "#F3F7FF",
    borderColor:
      colors.primary,
  },

  selectorRadio: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 11,
    borderWidth: 1.7,
    borderColor:
      colors.textMuted,
    alignItems: "center",
    justifyContent:
      "center",
  },

  selectorRadioSelected: {
    borderColor:
      colors.primary,
  },

  selectorRadioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor:
      colors.primary,
  },

  selectorAddressContent: {
    flex: 1,
    marginLeft: 11,
  },

  selectorAddressTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  selectorAddressName: {
    maxWidth: "55%",
    fontSize: 13,
    fontWeight: "900",
    color: colors.text,
  },

  selectorLabelBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor:
      colors.surface,
  },

  selectorLabelText: {
    fontSize: 8,
    fontWeight: "900",
    color: colors.textSecondary,
  },

  selectorDefaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
    backgroundColor:
      "#DCFCE7",
  },

  selectorDefaultText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#166534",
  },

  selectorAddressText: {
    marginTop: 8,
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  selectorPhoneRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  selectorPhoneText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  selectorActions: {
    marginTop: 10,
    minHeight: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  selectedForOrderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  selectedForOrderText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.primary,
  },

  tapToSelectText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.textMuted,
  },

  editAddressButton: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor:
      colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  editAddressText: {
    fontSize: 9,
    fontWeight: "900",
    color: colors.primary,
  },

  newAddressButton: {
    minHeight: 66,
    marginTop: 2,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor:
      colors.surface,
    borderWidth: 1.5,
    borderColor:
      "#CFE0FF",
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
  },

  newAddressIcon: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 13,
    backgroundColor:
      colors.blueSoft,
    alignItems: "center",
    justifyContent:
      "center",
  },

  newAddressTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.text,
  },

  newAddressSubtitle: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  addressModalBottom: {
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor:
      colors.surface,
    borderTopWidth: 1,
    borderTopColor:
      "#EEF2F7",
  },

  deliverHereButton: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor:
      colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    gap: 8,
    shadowColor:
      colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  deliverHereText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textWhite,
  },

  /* =======================================================
     BOTTOM BAR
  ======================================================= */

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 88,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 18,
    backgroundColor:
      "rgba(255,255,255,0.98)",
    borderTopWidth: 1,
    borderTopColor:
      "#E8EDF3",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor:
      "#64748B",
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: {
      width: 0,
      height: -6,
    },
    elevation: 12,
  },

  bottomLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
  },

  bottomTotal: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
    color: colors.text,
  },

  placeOrderButton: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor:
      colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    gap: 8,
    shadowColor:
      colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 11,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 5,
  },

  placeOrderDisabled: {
    opacity: 0.55,
  },

  placeOrderText: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textWhite,
  },

  pressed: {
    opacity: 0.82,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },
});