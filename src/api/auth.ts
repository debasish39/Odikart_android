import api from "./api";

export type AuthUser = {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  image?: string;
  role?: string;
  sellerStatus?: string | null;
  sellerVerificationStatus?: string | null;
  isVerified?: boolean;
  isEmailVerified?: boolean;
  isPhoneVerified?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
  activeMode?: string;
};

export type LoginResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
  app: string;
};

export const loginWithPassword = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await api.post("/auth/signin-password", {
    email: email.trim().toLowerCase(),
    password,
    app: "customer",
  });

  return response.data;
};