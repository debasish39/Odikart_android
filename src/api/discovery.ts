import api from "./api";

export type DiscoveryResponse<T = any> = {
  success: boolean;
  type?: string;
  count?: number;
  products: T[];
};

export const getTrendingProducts = async (limit = 20) => {
  const response = await api.get<DiscoveryResponse>(
    "/products/trending",
    {
      params: { limit },
    }
  );

  return response.data;
};

export const getPopularProducts = async (limit = 20) => {
  const response = await api.get<DiscoveryResponse>(
    "/products/popular",
    {
      params: { limit },
    }
  );

  return response.data;
};

export const getRecentlyViewedProducts = async (
  limit = 20
) => {
  const response = await api.get<DiscoveryResponse>(
    "/products/recently-viewed",
    {
      params: { limit },
      withCredentials: true,
    }
  );

  return response.data;
};

export const getNewArrivalProducts = async (
  limit = 20
) => {
  const response = await api.get<DiscoveryResponse>(
    "/products/new-arrivals",
    {
      params: { limit },
    }
  );

  return response.data;
};