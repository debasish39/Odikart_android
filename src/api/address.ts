import api from "./api";

/* ============================================================
   LOCATION
============================================================ */

export type AddressLocation = {
  latitude: number | null;
  longitude: number | null;
};

/* ============================================================
   ADDRESS PAYLOAD
============================================================ */

export type AddressPayload = {
  // Contact
  fullName: string;
  phone: string;
  email: string;
  alternatePhone?: string;

  // Address
  houseNumber: string;
  street: string;
  area: string;
  landmark?: string;

  // Location
  city: string;
  district: string;
  state: string;
  postalCode: string;
  country?: string;
  postOffice?: string;
  
  // Delivery
  deliveryInstructions?: string;

  // Settings
  label?: string;
  isDefault?: boolean;

  // GPS
  location?: AddressLocation;
};

/* ============================================================
   ADDRESS
============================================================ */

export type Address = AddressPayload & {
  _id: string;

  userId?: string;

  createdAt?: string;
  updatedAt?: string;

  isDeleted?: boolean;
};

/* ============================================================
   API RESPONSE TYPES
============================================================ */

export type AddressListResponse = {
  success?: boolean;
  message?: string;
  addresses?: Address[];

  data?:
    | Address[]
    | {
        addresses?: Address[];
      };
};

export type AddressMutationResponse = {
  success?: boolean;
  message?: string;
  address?: Address;
  data?: Address;
};

/* ============================================================
   DEFAULT LOCATION
============================================================ */

const defaultLocation: AddressLocation = {
  latitude: null,
  longitude: null,
};

/* ============================================================
   NORMALIZE ADDRESS
============================================================ */

const normalizeAddressPayload = (
  payload: AddressPayload
): AddressPayload => {
  return {
    /* --------------------------------------------------------
       CONTACT
    -------------------------------------------------------- */

    fullName: payload.fullName.trim(),

    phone: payload.phone.trim(),

    email: payload.email.trim().toLowerCase(),

    alternatePhone:
      payload.alternatePhone?.trim() || "",

    /* --------------------------------------------------------
       ADDRESS
    -------------------------------------------------------- */

    houseNumber:
      payload.houseNumber.trim(),

    street:
      payload.street.trim(),

    area:
      payload.area.trim(),

    landmark:
      payload.landmark?.trim() || "",

    /* --------------------------------------------------------
       LOCATION
    -------------------------------------------------------- */

    city:
      payload.city.trim(),

    district:
      payload.district.trim(),

    state:
      payload.state.trim(),

    postalCode:
      payload.postalCode.trim(),

    country:
      payload.country?.trim() || "India",

    postOffice:
      payload.postOffice?.trim() || "",

    /* --------------------------------------------------------
       DELIVERY
    -------------------------------------------------------- */

    deliveryInstructions:
      payload.deliveryInstructions?.trim() || "",

    /* --------------------------------------------------------
       SETTINGS
    -------------------------------------------------------- */

    label:
      payload.label?.trim() || "Home",

    isDefault:
      Boolean(payload.isDefault),

    /* --------------------------------------------------------
       GPS
    -------------------------------------------------------- */

    location:
      payload.location || defaultLocation,
  };
};

/* ============================================================
   GET MY ADDRESSES
============================================================ */

export const getMyAddresses = async (): Promise<
  AddressListResponse
> => {
  try {
    console.log("GET MY ADDRESSES");

    const response =
      await api.get("/addresses");

    console.log(
      "GET ADDRESSES RESPONSE:",
      response.data
    );

    return response.data;
  } catch (error: any) {
    console.log(
      "GET ADDRESSES ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    throw error;
  }
};

/* ============================================================
   ADD ADDRESS
============================================================ */

export const addAddress = async (
  payload: AddressPayload
): Promise<AddressMutationResponse> => {
  try {
    const cleanPayload =
      normalizeAddressPayload(payload);

    console.log(
      "ADD ADDRESS PAYLOAD:",
      cleanPayload
    );

    const response =
      await api.post(
        "/addresses",
        cleanPayload
      );

    console.log(
      "ADD ADDRESS RESPONSE:",
      response.data
    );

    return response.data;
  } catch (error: any) {
    console.log(
      "ADD ADDRESS ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    throw error;
  }
};

/* ============================================================
   UPDATE ADDRESS
============================================================ */

export const updateAddress = async (
  id: string,
  payload: AddressPayload
): Promise<AddressMutationResponse> => {
  try {
    if (!id) {
      throw new Error(
        "Address ID is required."
      );
    }

    const cleanPayload =
      normalizeAddressPayload(payload);

    console.log(
      "UPDATE ADDRESS ID:",
      id
    );

    console.log(
      "UPDATE ADDRESS PAYLOAD:",
      cleanPayload
    );

    const response =
      await api.put(
        `/addresses/${id}`,
        cleanPayload
      );

    console.log(
      "UPDATE ADDRESS RESPONSE:",
      response.data
    );

    return response.data;
  } catch (error: any) {
    console.log(
      "UPDATE ADDRESS ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    throw error;
  }
};

/* ============================================================
   DELETE ADDRESS
============================================================ */

export const deleteAddress = async (
  id: string
): Promise<AddressMutationResponse> => {
  try {
    if (!id) {
      throw new Error(
        "Address ID is required."
      );
    }

    console.log(
      "DELETE ADDRESS ID:",
      id
    );

    const response =
      await api.delete(
        `/addresses/${id}`
      );

    console.log(
      "DELETE ADDRESS RESPONSE:",
      response.data
    );

    return response.data;
  } catch (error: any) {
    console.log(
      "DELETE ADDRESS ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    throw error;
  }
};