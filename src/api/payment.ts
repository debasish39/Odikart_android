import api from "./api";

export type VerifyPaymentPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const verifyRazorpayPayment = async (
  payload: VerifyPaymentPayload
) => {
  console.log("=================================");
  console.log("VERIFY PAYMENT API");
  console.log("Order ID:", payload.razorpay_order_id);
  console.log("Payment ID:", payload.razorpay_payment_id);
  console.log("=================================");

  const response = await api.post(
    "/verify-payment",
    payload
  );

  return response.data;
};