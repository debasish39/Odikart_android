import api from "./api";

export const forgotPassword = async (email: string) => {
  const response = await api.post("/auth/forgot-password", {
    email: email.trim().toLowerCase(),
  });

  return response.data;
};

export const verifyResetOTP = async (
  email: string,
  otp: string
) => {
  const response = await api.post("/auth/verify-reset-otp", {
    email: email.trim().toLowerCase(),
    otp: otp.replace(/\D/g, "").slice(0, 6),
  });

  return response.data;
};

export const resetPassword = async (
  email: string,
  otp: string,
  newPassword: string
) => {
  const response = await api.put("/auth/reset-password", {
    email: email.trim().toLowerCase(),
    otp: otp.replace(/\D/g, "").slice(0, 6),
    newPassword,
  });

  return response.data;
};