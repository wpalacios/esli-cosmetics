"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  TaxRate,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  PaginatedTaxRates,
  DeleteTaxRatesDto,
  TaxRatesResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();
const ENDPOINT = "/tax-rates";

const createEmptyTaxRatesResponse = (
  page: number,
  limit: number
): PaginatedTaxRates => ({
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

export async function getTaxRates(
  params: { page?: number; limit?: number; search?: string } = {}
): Promise<PaginatedTaxRates> {
  const defaultPage = params.page || 1;
  const defaultLimit = params.limit || 10;
  const searchTerm = params.search?.trim();
  try {
    const searchParams = new URLSearchParams();

    searchParams.set("page", defaultPage.toString());
    searchParams.set("limit", defaultLimit.toString());

    if (searchTerm) {
      searchParams.set("search", searchTerm);
    }

    const queryString = searchParams.toString();
    const baseEndpoint = searchTerm ? `${ENDPOINT}/search` : ENDPOINT;
    const endpoint = queryString
      ? `${baseEndpoint}?${queryString}`
      : baseEndpoint;
    const apiResponse: PaginatedTaxRates = await apiClient.get(endpoint);

    if (
      !apiResponse ||
      !Array.isArray(apiResponse.data) ||
      !apiResponse.pagination ||
      typeof apiResponse.pagination.total !== "number"
    ) {
      console.error(
        "❌ API Response Error: Invalid or missing tax rate list/total structure.",
        { rawResponse: apiResponse }
      );

      return createEmptyTaxRatesResponse(defaultPage, defaultLimit);
    }

    const normalizedResponse: PaginatedTaxRates = {
      data: apiResponse.data,
      pagination: {
        total: apiResponse.pagination.total,
        page: apiResponse.pagination.page ?? defaultPage,
        limit: apiResponse.pagination.limit ?? defaultLimit,
        totalPages: apiResponse.pagination.totalPages,
        hasNext: apiResponse.pagination.hasNext,
        hasPrev: apiResponse.pagination.hasPrev,
      },
    };


    return normalizedResponse;
  } catch (error) {
    console.error("❌ Server Action - Error fetching tax rates:", error);
    throw new Error("Failed to fetch tax rates");
  }
}

export async function getTaxRateById(id: string): Promise<TaxRate> {
  try {

    const response: TaxRate = await apiClient.get(`${ENDPOINT}/${id}`);

    if (!response?.id) {
      throw new Error("Invalid response format: missing required fields");
    }

    return response;
  } catch (error) {
    console.error(`❌ Server Action - Error fetching tax rate [${id}]:`, error);
    throw new Error("Failed to fetch tax rate");
  }
}

export async function createTaxRate(data: CreateTaxRateDto): Promise<TaxRate> {
  try {

    const taxRate: TaxRate = await apiClient.post(ENDPOINT, data);

    if (!taxRate?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return taxRate;
  } catch (error) {
    console.error("❌ Server Action - Error creating tax rate:", error);
    throw new Error("Failed to create tax rate");
  }
}

export async function updateTaxRate(
  id: string,
  data: UpdateTaxRateDto
): Promise<TaxRate> {
  try {

    const taxRate: TaxRate = await apiClient.put(`${ENDPOINT}/${id}`, data);

    if (!taxRate?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return taxRate;
  } catch (error) {
    console.error("❌ Server Action - Error updating tax rate:", error);
    throw new Error("Failed to update tax rate");
  }
}

export async function deleteTaxRates(data: DeleteTaxRatesDto): Promise<void> {
  try {
    await apiClient.post(`${ENDPOINT}/batch-delete`, data);
  } catch (error) {
    console.error("❌ Server Action - Error deleting tax rates:", error);
    throw new Error("Failed to delete multiple tax rates");
  }
}

export async function deleteTaxRate(id: string): Promise<void> {
  try {

    await apiClient.delete(`${ENDPOINT}/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting tax rate:", error);
    throw new Error("Failed to delete tax rate");
  }
}
