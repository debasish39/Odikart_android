import api from "./api";

export type ProductDiscoveryResponse<T = any> = {
  success?: boolean;
  type?: string;
  count?: number;
  products?: T[];
  message?: string;
};

const logRequest = async <T>(
  label: string,
  request: () => Promise<T>,
): Promise<T> => {
  const startedAt = Date.now();
  try {
    const result = await request();
    console.log(`[${label} API] ${Date.now() - startedAt}ms`);
    return result;
  } catch (error: any) {
    console.log(
      `[${label} API Error] ${Date.now() - startedAt}ms`,
      error?.response?.status ?? error?.message,
    );
    throw error;
  }
};

export const getProducts = async (search = "") => {
  const normalizedSearch = search.trim();
  return logRequest("Products", async () => {
    const response = await api.get("/products", {
      params: normalizedSearch ? { search: normalizedSearch } : {},
    });
    return response.data;
  });
};

// These public discovery endpoints are defined in the existing Express product router.
const getDiscoveryProducts = (path: string, label: string) =>
  logRequest<ProductDiscoveryResponse>(label, async () => {
    const response = await api.get(path);
    return response.data;
  });

export const getTrendingProducts = () =>
  getDiscoveryProducts("/products/trending", "Trending Products");

export const getBestSellerProducts = () =>
  getDiscoveryProducts("/products/best-sellers", "Best Seller Products");

export const getPopularProducts = () =>
  getDiscoveryProducts("/products/popular", "Popular Products");

export const getTopRatedProducts = () =>
  getDiscoveryProducts("/products/top-rated", "Top Rated Products");

export const getNewArrivalProducts = () =>
  getDiscoveryProducts("/products/new-arrivals", "New Arrival Products");

export const getFeaturedProducts = () =>
  getDiscoveryProducts("/products/featured", "Featured Products");

export const getRecommendedProducts = () =>
  getDiscoveryProducts("/products/recommended", "Recommended Products");

export const getFlashSaleProducts = () =>
  getDiscoveryProducts("/products/flash-sales", "Flash Sale Products");

export const getDealProducts = () =>
  getDiscoveryProducts("/products/deals", "Deal Products");

export const getLowStockProducts = () =>
  getDiscoveryProducts("/products/low-stock", "Low Stock Products");

/**
 * Recently Viewed Products
 *
 * Note: These endpoints rely on the backend's visitor-cookie
 * mechanism. React Native may need cookie persistence or a
 * visitor-ID based approach for reliable tracking.
 */

export const getRecentlyViewedProducts = async () =>
  logRequest<ProductDiscoveryResponse>("Recently Viewed Products", async () => {
    const response = await api.get("/products/recently-viewed");
    return response.data;
  });

export const addRecentlyViewedProduct = async (productId: string) =>
  logRequest("Add Recently Viewed Product", async () => {
    const response = await api.post(`/products/recently-viewed/${productId}`);
    return response.data;
  });

export const removeRecentlyViewedProduct = async (productId: string) =>
  logRequest("Remove Recently Viewed Product", async () => {
    const response = await api.delete(`/products/recently-viewed/${productId}`);
    return response.data;
  });

export const clearRecentlyViewedProducts = async () =>
  logRequest("Clear Recently Viewed Products", async () => {
    const response = await api.delete("/products/recently-viewed");
    return response.data;
  });

/**
 * Product event tracking
 * Supported events: view, wishlist, cart, sale, order
 */
export type ProductEvent = "view" | "wishlist" | "cart" | "sale" | "order";

export const trackProductEvent = async (
  productId: string,
  event: ProductEvent,
) =>
  logRequest("Product Event", async () => {
    const response = await api.post(`/products/${productId}/track-event`, {
      event,
    });
    return response.data;
  });
