import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import RazorpayCheckout from "react-native-razorpay";
import { SafeAreaView } from "react-native-safe-area-context";

import { clearCart } from "../../api/cart";
import { verifyRazorpayPayment } from "../../api/payment";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

export default function PaymentScreen() {
  const params = useLocalSearchParams<{
    orderId?: string;
    orderNumber?: string;
    razorpayOrderId?: string;
    amount?: string;
    currency?: string;
  }>();

  const { user } = useAuth();

  const [processing, setProcessing] = useState(false);

  /*
   * ============================================================
   * RAZORPAY AMOUNT
   * ============================================================
   *
   * Razorpay expects amount in PAISE.
   *
   * Example:
   *
   * ₹471.59
   *
   * Razorpay:
   *
   * 47159 paise
   *
   * Therefore:
   *
   * amountInPaise  = 47159
   * amountInRupees = 471.59
   *
   * IMPORTANT:
   * Never send amountInRupees to Razorpay.
   */

  const razorpayOrderId = String(params.razorpayOrderId || "").trim();

  // IMPORTANT:
  // This amount comes from the backend-created Razorpay order.
  // Product/seller offers and coupon discounts must already be reflected
  // in the backend final amount. This screen does not recalculate discounts.
  // Backend-authoritative final payable amount.
  // Product/seller offers are already reflected in the backend selling prices,
  // and any coupon discount is applied before this amount is created.
  // This screen NEVER calculates product discounts or coupon discounts.
  const amountInPaise = Number(params.amount || 0);

  const amountInRupees = amountInPaise / 100;

  const currency = String(params.currency || "INR").trim();

  const orderId = String(params.orderId || "").trim();

  const orderNumber = String(params.orderNumber || "").trim();

  /*
   * ============================================================
   * FORMAT CUSTOMER PHONE
   * ============================================================
   */

  const getCustomerPhone = () => {
    const phone = String(
      user?.phone || user?.mobile || user?.contact || "",
    ).trim();

    if (!phone) {
      return "";
    }

    /*
     * Razorpay prefill normally expects
     * the customer's phone number.
     *
     * Remove spaces and country formatting.
     */

    const cleaned = phone.replace(/\D/g, "");

    if (cleaned.startsWith("91") && cleaned.length === 12) {
      return cleaned.substring(2);
    }

    return cleaned;
  };

  /*
   * ============================================================
   * OPEN RAZORPAY
   * ============================================================
   */

  const handlePayment = async () => {
    if (processing) {
      return;
    }

    /*
     * -----------------------------------------
     * VALIDATE RAZORPAY ORDER
     * -----------------------------------------
     */

    if (!razorpayOrderId) {
      Alert.alert(
        "Payment Error",
        "Razorpay order ID is missing. Please try again.",
      );
      return;
    }

    /*
     * -----------------------------------------
     * VALIDATE AMOUNT
     * -----------------------------------------
     */

    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      Alert.alert(
        "Payment Error",
        "Invalid payment amount. Please return to checkout and try again.",
      );
      return;
    }

    /*
     * -----------------------------------------
     * VALIDATE CURRENCY
     * -----------------------------------------
     */

    if (!currency) {
      Alert.alert("Payment Error", "Payment currency is missing.");
      return;
    }

    try {
      setProcessing(true);

      /*
       * ========================================================
       * CUSTOMER DETAILS
       * ========================================================
       */

      const customerName = String(
        user?.name ||
          user?.fullName ||
          `${user?.firstName || ""} ${user?.lastName || ""}`.trim() ||
          "",
      ).trim();

      const customerEmail = String(user?.email || "").trim();

      const customerPhone = getCustomerPhone();

      /*
       * ========================================================
       * RAZORPAY OPTIONS
       * ========================================================
       *
       * IMPORTANT:
       *
       * amount MUST remain in paise.
       *
       * Example:
       *
       * amountInPaise = 47159
       *
       * User sees:
       *
       * ₹471.59
       *
       * Razorpay receives:
       *
       * 47159
       */

      const options = {
        description: orderNumber
          ? `OdiKart Order #${orderNumber}`
          : "OdiKart Order Payment",

        image:
          "https://res.cloudinary.com/dqyltwn9z/image/upload/v1785478585/logo_shi1c4.png",

        currency: currency,

        /*
         * ======================================================
         * RAZORPAY KEY ID
         * ======================================================
         *
         * Use your PUBLIC Razorpay Key ID here.
         *
         * NEVER put RAZORPAY_SECRET here.
         *
         * For testing, use:
         *
         * rzp_test_XXXXXXXX
         *
         * For production:
         *
         * rzp_live_XXXXXXXX
         */

        key: "rzp_live_TADe5aXmemucmK",

        /*
         * Razorpay expects PAISE.
         */

        amount: amountInPaise,

        name: "OdiKart",

        /*
         * This MUST be the Razorpay order
         * generated by your backend.
         */

        order_id: razorpayOrderId,

        /*
         * ======================================================
         * CUSTOMER PREFILL
         * ======================================================
         */

        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },

        /*
         * ======================================================
         * THEME
         * ======================================================
         */

        theme: {
          color: colors.primary,
        },

        /*
         * ======================================================
         * MODAL
         * ======================================================
         */

        modal: {
          confirm_close: true,

          ondismiss: () => {
            console.log("RAZORPAY CHECKOUT DISMISSED");

            setProcessing(false);
          },
        },
      };

      /*
       * ========================================================
       * DEBUG
       * ========================================================
       */

      console.log("=================================");

      console.log("OPENING RAZORPAY");

      console.log("OdiKart Order ID:", orderId);

      console.log("OdiKart Order Number:", orderNumber);

      console.log("Razorpay Order ID:", razorpayOrderId);

      console.log("Amount in Paise:", amountInPaise);

      console.log("Amount in Rupees:", amountInRupees);

      console.log("Currency:", currency);

      console.log("Customer:", customerName);

      console.log("=================================");

      /*
       * ========================================================
       * OPEN NATIVE RAZORPAY CHECKOUT
       * ========================================================
       */

      const paymentData = await RazorpayCheckout.open(options);

      /*
       * ========================================================
       * PAYMENT SUCCESS CALLBACK
       * ========================================================
       */

      console.log("=================================");

      console.log("RAZORPAY PAYMENT SUCCESS");

      console.log(paymentData);

      console.log("=================================");

      /*
       * ========================================================
       * VALIDATE CALLBACK DATA
       * ========================================================
       */

      if (!paymentData?.razorpay_payment_id) {
        throw new Error("Razorpay payment ID was not returned.");
      }

      if (!paymentData?.razorpay_order_id) {
        throw new Error("Razorpay order ID was not returned.");
      }

      if (!paymentData?.razorpay_signature) {
        throw new Error("Razorpay payment signature was not returned.");
      }

      /*
       * ========================================================
       * VERIFY PAYMENT ON BACKEND
       * ========================================================
       *
       * NEVER trust the mobile app alone.
       *
       * Backend verifies:
       *
       * razorpay_order_id
       * razorpay_payment_id
       * razorpay_signature
       */

      console.log("VERIFYING PAYMENT ON SERVER...");

      const verification = await verifyRazorpayPayment({
        razorpay_order_id: paymentData.razorpay_order_id,

        razorpay_payment_id: paymentData.razorpay_payment_id,

        razorpay_signature: paymentData.razorpay_signature,
      });

      if (!verification?.success) {
        throw new Error(
          verification?.message || "The server could not verify this payment.",
        );
      }

      console.log("=================================");

      console.log("PAYMENT VERIFICATION RESPONSE:", verification);

      console.log("=================================");

      /*
       * ========================================================
       * VERIFY RESULT
       * ========================================================
       */

      if (!verification?.success || !verification?.verified) {
        throw new Error(
          verification?.message || "Payment verification failed.",
        );
      }

      /*
       * ========================================================
       * PAYMENT VERIFIED
       * ========================================================
       */

      console.log("PAYMENT VERIFIED SUCCESSFULLY");

      /*
       * ========================================================
       * CLEAR CART
       * ========================================================
       *
       * IMPORTANT:
       *
       * Clear cart ONLY after successful
       * server-side payment verification.
       */

      try {
        await clearCart();

        console.log("CART CLEARED AFTER SUCCESSFUL PAYMENT");
      } catch (cartError: any) {
        /*
         * Payment is already successful.
         *
         * Therefore don't tell the customer
         * that payment failed just because
         * cart clearing had a problem.
         */

        console.log(
          "CLEAR CART ERROR:",
          cartError?.response?.data || cartError?.message || cartError,
        );
      }

      /*
       * ========================================================
       * SUCCESS MESSAGE
       * ========================================================
       */

      Alert.alert(
        "Payment Successful 🎉",
        orderNumber
          ? `Payment for order #${orderNumber} was verified successfully.`
          : "Your payment has been verified successfully.",
        [
          {
            text: "View Order",
            onPress: () => {
              /*
               * If we have the local OdiKart
               * order ID, open that exact order.
               */

              if (orderId) {
                router.replace({
                  pathname: "/orders/[id]",
                  params: {
                    id: orderId,
                  },
                });
              } else {
                router.replace("/orders");
              }
            },
          },
        ],
      );
    } catch (error: any) {
      console.log("=================================");

      console.log("RAZORPAY PAYMENT ERROR:", error);

      console.log("ERROR CODE:", error?.code);

      console.log("ERROR DESCRIPTION:", error?.description);

      console.log("ERROR MESSAGE:", error?.message);

      console.log("=================================");

      /*
       * ========================================================
       * PAYMENT CANCELLED
       * ========================================================
       */

      const isCancelled =
        error?.code === 0 ||
        error?.code === "0" ||
        error?.description?.toLowerCase()?.includes("cancel") ||
        error?.message?.toLowerCase()?.includes("cancel");

      if (isCancelled) {
        Alert.alert(
          "Payment Cancelled",
          "You cancelled the payment. Your order is still pending payment.",
        );

        return;
      }

      /*
       * ========================================================
       * PAYMENT FAILED
       * ========================================================
       */

      Alert.alert(
        "Payment Failed",
        error?.description ||
          error?.message ||
          "Unable to complete payment. Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  };

  /*
   * ============================================================
   * SCREEN
   * ============================================================
   */

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (!processing) {
                router.back();
              }
            }}
            disabled={processing}
            style={({ pressed }) => [
              styles.backButton,
              pressed && !processing && styles.pressed,
              processing && styles.disabledButton,
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.title}>Payment</Text>

            <View style={styles.secureHeaderRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={13}
                color={colors.success}
              />

              <Text style={styles.secureHeaderText}>Secure checkout</Text>
            </View>
          </View>

          <View style={styles.headerSpacer} />
        </View>

        {/* ================================================== */}
        {/* PAYMENT CARD */}
        {/* ================================================== */}

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="card-outline" size={30} color={colors.primary} />
          </View>

          <Text style={styles.cardTitle}>Secure Payment</Text>

          <Text style={styles.cardSubtitle}>
            Complete your payment securely using Razorpay.
          </Text>

          {/* ============================================== */}
          {/* AMOUNT */}
          {/* ============================================== */}

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Amount to Pay</Text>

            <Text style={styles.amount}>₹{amountInRupees.toFixed(2)}</Text>
          </View>
        </View>

        {/* ================================================== */}
        {/* PAYMENT METHODS INFO */}
        {/* ================================================== */}

        <View style={styles.methodsCard}>
          <View style={styles.methodsIcon}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          </View>

          <View style={styles.methodsContent}>
            <Text style={styles.methodsTitle}>Multiple payment options</Text>

            <Text style={styles.methodsText}>
              Pay using UPI, cards, net banking and other payment methods
              available through Razorpay.
            </Text>
          </View>
        </View>

        {/* ================================================== */}
        {/* SECURITY */}
        {/* ================================================== */}

        <View style={styles.securityCard}>
          <Ionicons
            name="shield-checkmark-outline"
            size={22}
            color={colors.success}
          />

          <View style={styles.securityContent}>
            <Text style={styles.securityTitle}>Secure & Protected</Text>

            <Text style={styles.securityText}>
              Your payment is securely processed through Razorpay.
            </Text>
          </View>
        </View>

        {/* ================================================== */}
        {/* BOTTOM */}
        {/* ================================================== */}

        <View style={styles.bottom}>
          {/* ============================================== */}
          {/* TOTAL */}
          {/* ============================================== */}

          <View style={styles.bottomAmountRow}>
            <Text style={styles.bottomAmountLabel}>Total</Text>

            <Text style={styles.bottomAmount}>
              ₹{amountInRupees.toFixed(2)}
            </Text>
          </View>

          {/* ============================================== */}
          {/* PAY BUTTON */}
          {/* ============================================== */}

          <Pressable
            onPress={handlePayment}
            disabled={processing}
            style={({ pressed }) => [
              styles.payButton,

              pressed && !processing && styles.pressed,

              processing && styles.disabled,
            ]}
          >
            {processing ? (
              <>
                <ActivityIndicator size="small" color={colors.textWhite} />

                <Text style={styles.payText}>Processing...</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.textWhite}
                />

                <Text style={styles.payText}>
                  Pay ₹{amountInRupees.toFixed(2)}
                </Text>

                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color={colors.textWhite}
                />
              </>
            )}
          </Pressable>

          <View style={styles.poweredRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={12}
              color={colors.textMuted}
            />

            <Text style={styles.powered}>Securely powered by Razorpay</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

/*
 * ============================================================
 * STYLES
 * ============================================================
 */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 15,
  },

  /*
   * HEADER
   */

  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  headerCenter: {
    alignItems: "center",
  },

  headerSpacer: {
    width: 42,
  },

  title: {
    fontSize: 21,
    fontWeight: "800",
    color: colors.text,
  },

  secureHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },

  secureHeaderText: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.success,
  },

  /*
   * PAYMENT CARD
   */

  card: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  cardTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
  },

  cardSubtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: colors.textSecondary,
  },

  /*
   * AMOUNT
   */

  amountBox: {
    width: "100%",
    marginTop: 22,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
  },

  amountLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  amount: {
    marginTop: 5,
    fontSize: 30,
    fontWeight: "900",
    color: colors.primary,
  },

  /*
   * PAYMENT METHODS
   */

  methodsCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  methodsIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.blueSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  methodsContent: {
    flex: 1,
    marginLeft: 12,
  },

  methodsTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  methodsText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  /*
   * SECURITY
   */

  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },

  securityContent: {
    flex: 1,
    marginLeft: 12,
  },

  securityTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
  },

  securityText: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  /*
   * BOTTOM
   */

  bottom: {
    marginTop: "auto",
  },

  bottomAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 3,
  },

  bottomAmountLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },

  bottomAmount: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.text,
  },

  /*
   * PAY BUTTON
   */

  payButton: {
    minHeight: 56,
    borderRadius: 15,
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 18,
  },

  payText: {
    color: colors.textWhite,
    fontSize: 16,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.6,
  },

  disabledButton: {
    opacity: 0.5,
  },

  /*
   * POWERED
   */

  poweredRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },

  powered: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
