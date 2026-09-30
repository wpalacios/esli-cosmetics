"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  PriceType,
  CreatePriceRequest,
  PricesResponse,
  PricesFilters,
  UpdatePriceRequest,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

const createEmptyPricesResponse = (
  page: number,
  limit: number
): PricesResponse => ({
  data: [],
  pagination: {
    total: 0,
    page: page,
    limit: limit,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
});

export async function getPrices(
  params: { page?: number; limit?: number } = {}
): Promise<PricesResponse> {
  const defaultPage = params.page || 1;
  const defaultLimit = params.limit || 10;

  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", defaultPage.toString());
    if (params.limit) searchParams.set("limit", defaultLimit.toString());

    const queryString = searchParams.toString();

    const endpoint = queryString ? `/prices?${queryString}` : `/prices`;


    const apiResponse = await apiClient.get(endpoint);

    if (
      !apiResponse ||
      !Array.isArray(apiResponse.data) ||
      !apiResponse.pagination ||
      typeof apiResponse.pagination.total !== "number"
    ) {
      console.error(
        "❌ API Response Error: Invalid or missing price list/total structure.",
        { rawResponse: apiResponse }
      );
      return createEmptyPricesResponse(defaultPage, defaultLimit);
    }

    const normalizedResponse: PricesResponse = {
      data: apiResponse.data,
      pagination: {
        total: apiResponse.pagination.total,
        page: apiResponse.pagination.page ?? defaultPage,
        limit: apiResponse.pagination.limit ?? defaultLimit,
        totalPages: apiResponse.pagination.totalPages ?? 0,
        hasNext: apiResponse.pagination.hasNext ?? false,
        hasPrev: apiResponse.pagination.hasPrev ?? false,
      },
    };

    return normalizedResponse;
  } catch (error) {
    console.error("❌ Server Action - Error fetching price types:", error);
    throw error;
  }
}

export async function searchPrice(
  search: string,
  page = 1,
  limit = 10
): Promise<PricesResponse> {
  try {

    const params = new URLSearchParams();

    if (search) params.append("search", search);

    params.append("page", page.toString());
    params.append("limit", limit.toString());

    const apiResponse = await apiClient.get(
      `/prices/search?${params.toString()}`
    );

    const defaultPage = page || 1;
    const defaultLimit = limit || 10;

    if (
      !apiResponse ||
      !Array.isArray(apiResponse.data) ||
      !apiResponse.pagination ||
      typeof apiResponse.pagination.total !== "number"
    ) {
      console.warn(
        "⚠️ Invalid API response structure for price search. Returning empty result."
      );
      return createEmptyPricesResponse(defaultPage, defaultLimit);
    }

    const normalizedResponse: PricesResponse = {
      data: apiResponse.data,
      pagination: {
        total: apiResponse.pagination.total,
        page: apiResponse.pagination.page ?? defaultPage,
        limit: apiResponse.pagination.limit ?? defaultLimit,
        totalPages: apiResponse.pagination.totalPages ?? 0,
        hasNext: apiResponse.pagination.hasNext ?? false,
        hasPrev: apiResponse.pagination.hasPrev ?? false,
      },
    };


    return normalizedResponse;
  } catch (error: any) {
    console.error("❌ Server Action - Error searching prices:", error);
    throw error;
  }
}

export async function getPriceById(id: string): Promise<PriceType> {
  try {
    const priceType: PriceType = await apiClient.get(`/prices/${id}`);

    if (!priceType?.id) {
      throw new Error("Invalid response format: missing price ID");
    }


    return priceType;
  } catch (error) {
    console.error(
      `❌ Server Action - Error fetching price type [${id}]:`,
      error
    );
    throw error;
  }
}

export async function createPrice(
  data: CreatePriceRequest
): Promise<PriceType> {
  try {

    const priceType: PriceType = await apiClient.post("/prices", data);

    if (!priceType?.id || !priceType.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return priceType;
  } catch (error) {
    console.error("❌ Server Action - Error creating price type:", error);
    throw error;
  }
}

export async function updatePrice(
  id: string,
  data: UpdatePriceRequest
): Promise<PriceType> {
  try {

    const priceType: PriceType = await apiClient.put(`/prices/${id}`, data);

    if (!priceType?.id || !priceType.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return priceType;
  } catch (error) {
    console.error("❌ Server Action - Error updating price type:", error);
    throw error;
  }
}

export async function deletePrice(id: string): Promise<void> {
  try {

    await apiClient.delete(`/prices/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting price type:", error);
    throw error;
  }
}
