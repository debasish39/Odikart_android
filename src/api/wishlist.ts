import api from "./api";

export interface WishlistProduct {
  _id: string;
  name?: string;
  price?: number;
  image?: string;
  originalPrice?: number;
  discount?: number;
  rating?: number;
  reviewCount?: number;
}

export interface WishlistItem {
  _id?: string;

  productId:
    | string
    | WishlistProduct;

  createdAt?: string;
  updatedAt?: string;
}

export interface WishlistResponse {
  success?: boolean;

  items?: WishlistItem[];

  wishlist?: {
    items?: WishlistItem[];
  };

  message?: string;
}

/**
 * Get the current user's wishlist
 */
export const getWishlist = async (): Promise<WishlistItem[]> => {
  const response = await api.get<WishlistResponse>("/wishlist");

  const items =
    response.data?.items ??
    response.data?.wishlist?.items ??
    [];

  return items;
};

/**
 * Add a product to the wishlist
 */
export const addToWishlist = async (
  productId: string
) => {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  const response = await api.post("/wishlist/add", {
    productId,
  });

  return response.data;
};

/**
 * Remove a product from the wishlist
 */
export const removeFromWishlist = async (
  productId: string
) => {
  if (!productId) {
    throw new Error("Product ID is required");
  }

  const response = await api.delete("/wishlist/remove", {
    data: {
      productId,
    },
  });

  return response.data;
};

/**
 * Clear the entire wishlist
 */
export const clearWishlist = async () => {
  const response = await api.delete("/wishlist/clear");

  return response.data;
};

/**
 * Check whether a product exists in the wishlist
 */
export const isProductInWishlist = (
  wishlist: WishlistItem[],
  productId: string
): boolean => {
  return wishlist.some((item) => {
    const id =
      typeof item.productId === "object"
        ? item.productId?._id
        : item.productId;

    return String(id) === String(productId);
  });
};

/**
 * Get only wishlist product IDs
 */
export const getWishlistProductIds = (
  wishlist: WishlistItem[]
): string[] => {
  return wishlist
    .map((item) => {
      if (typeof item.productId === "object") {
        return item.productId?._id;
      }

      return item.productId;
    })
    .filter(Boolean)
    .map(String);
};