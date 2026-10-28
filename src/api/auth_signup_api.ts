// src/api/auth_signup_api.ts

import api from "./api";

export type SignupData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  referralCode?: string;
};

export const signup = async (data: SignupData) => {
  const response = await api.post("/auth/signup", {
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim().toLowerCase(),
    password: data.password,
    phone: data.phone?.trim() || "",
    referralCode: data.referralCode?.trim() || "",
    app: "customer",
  });

  return response.data;
};

export const verifySignupOTP = async (
  email: string,
  otp: string
) => {
  const response = await api.post("/auth/verify-signup-otp", {
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  });

  return response.data;
};

export const resendSignupOTP = async (email: string) => {
  const response = await api.post("/auth/resend-otp", {
    email: email.trim().toLowerCase(),
  });

  return response.data;
};