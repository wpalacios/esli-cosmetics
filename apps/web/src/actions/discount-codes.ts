"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  DiscountCode,
  CreateDiscountCodeRequest,
  UpdateDiscountCodeRequest,
  DiscountCodesResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export async function getDiscountCodes(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
): Promise<DiscountCodesResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/discount-codes?${queryString}`
      : "/discount-codes";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching discount codes:", error);
    throw new Error("Failed to fetch discount codes");
  }
}

export async function getDiscountCode(id: string): Promise<DiscountCode> {
  try {

    const discountCode: DiscountCode = await apiClient.get(
      `/discount-codes/${id}`
    );

    if (!discountCode?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return discountCode;
  } catch (error) {
    console.error("❌ Server Action - Error fetching discount code:", error);
    throw new Error("Failed to fetch discount code");
  }
}

export async function createDiscountCode(
  data: CreateDiscountCodeRequest
): Promise<DiscountCode> {
  try {

    const discountCode: DiscountCode = await apiClient.post(
      "/discount-codes",
      data
    );

    if (!discountCode?.id || !discountCode.code) {
      throw new Error("Invalid response format: missing required fields");
    }


    return discountCode;
  } catch (error) {
    console.error("❌ Server Action - Error creating discount code:", error);
    throw error;
  }
}

export async function updateDiscountCode(
  id: string,
  data: UpdateDiscountCodeRequest
): Promise<DiscountCode> {
  try {

    const discountCode: DiscountCode = await apiClient.patch(
      `/discount-codes/${id}`,
      data
    );

    if (!discountCode?.id || !discountCode.code) {
      throw new Error("Invalid response format: missing required fields");
    }


    return discountCode;
  } catch (error) {
    console.error("❌ Server Action - Error updating discount code:", error);
    throw error;
  }
}

export async function deleteDiscountCode(id: string): Promise<void> {
  try {

    await apiClient.delete(`/discount-codes/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting discount code:", error);
    throw error;
  }
}

export interface ValidateDiscountCodeResponse {
  valid: boolean;
  discountCode?: DiscountCode;
  calculatedDiscount?: number;
  message?: string;
}

export async function validateDiscountCode(
  code: string,
  params: {
    customerId?: string;
    orderAmount: number;
  }
): Promise<ValidateDiscountCodeResponse> {
  try {

    const searchParams = new URLSearchParams();
    searchParams.set("orderAmount", params.orderAmount.toString());
    if (params.customerId) {
      searchParams.set("customerId", params.customerId);
    }

    const endpoint = `/discount-codes/validate/${encodeURIComponent(code)}?${searchParams.toString()}`;

    const response: ValidateDiscountCodeResponse =
      await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error validating discount code:", error);
    throw error;
  }
}
