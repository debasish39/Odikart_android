import api from "./api";

export const getCategories = async () => {
  const response = await api.get("/category");

  return response.data;
};