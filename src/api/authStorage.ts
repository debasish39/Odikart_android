import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "odikart_auth_token";
const USER_KEY = "odikart_auth_user";

export const saveAuth = async (token: string, user: any = null) => {
  console.log("SECURE STORE:", SecureStore);
  
  if (typeof SecureStore.setItemAsync !== "function") {
    throw new Error("SecureStore.setItemAsync is unavailable");
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);

  if (user) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } else {
    await SecureStore.deleteItemAsync(USER_KEY);
  }
};

export const getToken = async () => {
  console.log(
    "SecureStore.getItemAsync:",
    typeof SecureStore.getItemAsync
  );

  if (typeof SecureStore.getItemAsync !== "function") {
    throw new Error("SecureStore.getItemAsync is unavailable");
  }

  return await SecureStore.getItemAsync(TOKEN_KEY);
};

export const getUser = async () => {
  if (typeof SecureStore.getItemAsync !== "function") {
    throw new Error("SecureStore.getItemAsync is unavailable");
  }

  const value = await SecureStore.getItemAsync(USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};


export const clearAuth = async () => {
  if (
    typeof SecureStore.deleteItemAsync !== "function" ||
    typeof SecureStore.getItemAsync !== "function"
  ) {
    throw new Error("SecureStore is unavailable");
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);

  const remainingToken = await SecureStore.getItemAsync(TOKEN_KEY);
  const remainingUser = await SecureStore.getItemAsync(USER_KEY);

  if (remainingToken !== null || remainingUser !== null) {
    throw new Error("Authentication data was not fully cleared");
  }

  console.log("AUTH STORAGE: Token and user data cleared");
};
