"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  StockLevelsResponse,
  StockLevelWithRelations,
  CreateStockLevelRequest,
  UpdateStockLevelRequest,
} from "@esli-cosmetics/types";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export interface StockLevelFilters {
  locationId?: string;
  startDate?: string;
  endDate?: string;
}

function appendStockLevelFilters(
  params: URLSearchParams,
  filters?: StockLevelFilters
): void {
  if (filters?.locationId) {
    params.set("locationId", filters.locationId);
  }
  if (filters?.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters?.endDate) {
    params.set("endDate", filters.endDate);
  }
}

export async function getStockLevels(
  page: number = 1,
  limit: number = 10,
  filters?: StockLevelFilters
): Promise<StockLevelsResponse> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    appendStockLevelFilters(params, filters);

    const result = await apiClient.get(`/stock-levels?${params.toString()}`);

    return {
      stockLevels: result.data || [],
      page: result.pagination?.page || page,
      limit: result.pagination?.limit || limit,
      total: result.pagination?.total || 0,
      totalPages: result.pagination?.totalPages || 0,
    };
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock levels:", error);
    return {
      stockLevels: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    };
  }
}

export async function searchStockLevels(
  search: string,
  page: number = 1,
  limit: number = 10,
  filters?: StockLevelFilters
): Promise<StockLevelsResponse> {
  try {
    const params = new URLSearchParams({
      search,
      page: String(page),
      limit: String(limit),
    });
    appendStockLevelFilters(params, filters);

    const result = await apiClient.get(
      `/stock-levels/search?${params.toString()}`
    );

    return {
      stockLevels: result.data || [],
      page: result.pagination?.page || page,
      limit: result.pagination?.limit || limit,
      total: result.pagination?.total || 0,
      totalPages: result.pagination?.totalPages || 0,
    };
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error searching stock levels:", error);
    return {
      stockLevels: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    };
  }
}

export async function getStockLevelById(
  id: string
): Promise<StockLevelWithRelations | null> {
  try {
    return await apiClient.get(`/stock-levels/${id}`);
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock level by ID:", error);
    return null;
  }
}

export async function createStockLevel(
  data: CreateStockLevelRequest
): Promise<StockLevelWithRelations> {
  return await apiClient.post(`/stock-levels`, data);
}

export async function updateStockLevel(
  id: string,
  data: UpdateStockLevelRequest
): Promise<StockLevelWithRelations> {
  return await apiClient.put(`/stock-levels/${id}`, data);
}

export async function deleteStockLevel(id: string): Promise<void> {
  await apiClient.delete(`/stock-levels/${id}`);
}

export async function getStockLevelsByProductVariant(
  productVariantId: string
): Promise<StockLevelWithRelations[]> {
  try {
    return await apiClient.get(
      `/stock-levels/${productVariantId}/all-locations-availability`
    );
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock levels by product variant:", error);
    return [];
  }
}

export async function getStockLevelsByProductVariantsAndLocation(
  productVariantIds: string[],
  locationId: string
): Promise<StockLevelWithRelations[]> {
  if (productVariantIds.length === 0) {
    return [];
  }

  try {
    return await apiClient.post(`/stock-levels/batch/by-location`, {
      productVariantIds,
      locationId,
    });
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error(
      "Error fetching stock levels by product variants and location:",
      error
    );
    return [];
  }
}

export async function getStockLevelByLocationAndProduct(
  locationId: string,
  productVariantId?: string,
  productId?: string
): Promise<StockLevelWithRelations | null> {
  if (!productVariantId && !productId) {
    return null;
  }

  try {
    // Use the product variant endpoint and filter by location
    if (productVariantId) {
      const stockLevels =
        await getStockLevelsByProductVariant(productVariantId);
      return stockLevels.find(sl => sl.locationId === locationId) || null;
    }

    // For product-only, we need to search all stock levels
    // This is a fallback - ideally we'd have a dedicated endpoint
    const result = await apiClient.get(`/stock-levels?page=1&limit=1000`);
    const stockLevels = result.data || [];
    return (
      stockLevels.find(
        (sl: StockLevelWithRelations) =>
          sl.productId === productId && sl.locationId === locationId
      ) || null
    );
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock level by location and product:", error);
    return null;
  }
}

/**
 * Get kit stock levels grouped by location, resolving kit components in backend.
 */
export async function getKitStockLevelsByLocation(
  kitVariantIds: string[]
): Promise<
  Array<{
    kitVariantId: string;
    locationId: string;
    locationName: string;
    stocks: Record<string, number>;
    kitsAvailable: number;
  }>
> {
  if (!kitVariantIds?.length) return [];

  try {
    return await apiClient.post(`/stock-levels/kit-availability`, {
      kitVariantIds,
    });
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching kit stock levels by location:", error);
    return [];
  }
}
