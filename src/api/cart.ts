import api from "./api";

export type CartItem = {
  productId: string;
  variantSku?: string;
  quantity: number;
  price: number;
  name?: string;
  title?: string;
  variant?: {
  image?: string;
};
  image?: string;
  product?: any;
  discountAmount?: number;
discountPercentage?: number;
variants?: any;
selectedVariant?: any;
offer?: any;
originalPrice?: number;
};

/**
 * Convert MongoDB Extended JSON / normal MongoDB IDs into a string.
 *
 * Supports:
 * "6a94faf467d6c5c0f96e6418"
 * { $oid: "6a94faf467d6c5c0f96e6418" }
 * { _id: { $oid: "6a94faf467d6c5c0f96e6418" } }
 */
const normalizeProductId = (id: any): string => {
  if (!id) return "";

  if (typeof id === "string") {
    return id.trim();
  }

  if (typeof id === "object") {
    if (typeof id.$oid === "string") {
      return id.$oid.trim();
    }

    if (id._id) {
      return normalizeProductId(id._id);
    }
  }

  return "";
};

const getCartItems = (data: any): CartItem[] => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.cart?.items)) return data.cart.items;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.data?.cart?.items)) return data.data.cart.items;

  return [];
};

export const getCart = async (): Promise<CartItem[]> => {
  const response = await api.get("/cart");

  console.log(
    "GET CART RESPONSE:",
    JSON.stringify(response.data, null, 2)
  );

  return getCartItems(response.data);
};

type AddToCartParams = {
  productId: any;
  variantSku?: string;
  quantity?: number;
  image?: string;
};

export const addToCart = async ({
  productId,
  variantSku = "",
  quantity = 1,
  image = "",
}: AddToCartParams) => {
  const normalizedProductId = normalizeProductId(productId);

  console.log("ADD TO CART ID:", {
    originalProductId: productId,
    normalizedProductId,
    variantSku,
    quantity,
  });

  if (!normalizedProductId) {
    throw new Error("Invalid product ID");
  }

  const response = await api.post("/cart/add", {
    productId: normalizedProductId,
    variantSku: variantSku || "",
    quantity: Number(quantity),
    image: image || "",
  });

  console.log(
    "ADD CART RESPONSE:",
    JSON.stringify(response.data, null, 2)
  );

  return response.data;
};

type CartItemParams = {
  productId: any;
  variantSku?: string;
};

export const increaseCartItem = async ({
  productId,
  variantSku = "",
}: CartItemParams) => {
  const normalizedProductId = normalizeProductId(productId);

  if (!normalizedProductId) {
    throw new Error("Invalid product ID");
  }

  const response = await api.put("/cart/increase", {
    productId: normalizedProductId,
    variantSku: variantSku || "",
  });

  return response.data;
};

export const decreaseCartItem = async ({
  productId,
  variantSku = "",
}: CartItemParams) => {
  const normalizedProductId = normalizeProductId(productId);

  if (!normalizedProductId) {
    throw new Error("Invalid product ID");
  }

  const response = await api.put("/cart/decrease", {
    productId: normalizedProductId,
    variantSku: variantSku || "",
  });

  return response.data;
};

export const removeCartItem = async ({
  productId,
  variantSku = "",
}: CartItemParams) => {
  const normalizedProductId = normalizeProductId(productId);

  if (!normalizedProductId) {
    throw new Error("Invalid product ID");
  }

  const response = await api.delete("/cart/remove", {
    data: {
      productId: normalizedProductId,
      variantSku: variantSku || "",
    },
  });

  return response.data;
};

export const clearCart = async () => {
  const response = await api.delete("/cart/clear");
  return response.data;
};
