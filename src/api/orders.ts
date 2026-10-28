import api from "./api";

export const getMyOrders = async () => {
  const response = await api.get("/my-orders");
  return response.data;
};

export const getOrderById = async (id: string) => {
  const response = await api.get(`/order/${id}`);
  return response.data;
};

export const cancelOrder = async (id: string) => {
  const response = await api.put(`/order/cancel/${id}`);
  return response.data;
};