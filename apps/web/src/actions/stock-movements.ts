"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  StockMovementsResponse,
  StockMovementWithRelations,
  CreateStockMovementRequest,
  UpdateStockMovementRequest,
  type ResolveVariantDisplayNamesRequest,
  type ResolveVariantDisplayNamesResponse,
  type BulkPurchaseImportRequest,
  type BulkPurchaseImportResponse,
} from "@esli-cosmetics/types";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export interface StockMovementFilters {
  fromLocationId?: string;
  toLocationId?: string;
  startDate?: string;
  endDate?: string;
}

function appendMovementFilters(
  params: URLSearchParams,
  filters?: StockMovementFilters
): void {
  if (filters?.fromLocationId) {
    params.set("fromLocationId", filters.fromLocationId);
  }
  if (filters?.toLocationId) {
    params.set("toLocationId", filters.toLocationId);
  }
  if (filters?.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters?.endDate) {
    params.set("endDate", filters.endDate);
  }
}

export async function getStockMovements(
  page: number = 1,
  limit: number = 10,
  filters?: StockMovementFilters
): Promise<StockMovementsResponse> {
  try {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    appendMovementFilters(params, filters);

    const result = await apiClient.get(`/stock-movements?${params.toString()}`);

    return {
      stockMovements: result.data || [],
      page: result.pagination?.page || page,
      limit: result.pagination?.limit || limit,
      total: result.pagination?.total || 0,
      totalPages: result.pagination?.totalPages || 0,
    };
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock movements:", error);
    return {
      stockMovements: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    };
  }
}

export async function searchStockMovements(
  search: string,
  page: number = 1,
  limit: number = 10,
  filters?: StockMovementFilters
): Promise<StockMovementsResponse> {
  try {
    const params = new URLSearchParams({
      search,
      page: String(page),
      limit: String(limit),
    });
    appendMovementFilters(params, filters);

    const result = await apiClient.get(
      `/stock-movements/search?${params.toString()}`
    );

    return {
      stockMovements: result.data || [],
      page: result.pagination?.page || page,
      limit: result.pagination?.limit || limit,
      total: result.pagination?.total || 0,
      totalPages: result.pagination?.totalPages || 0,
    };
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error searching stock movements:", error);
    return {
      stockMovements: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    };
  }
}

export async function getStockMovementById(
  id: string
): Promise<StockMovementWithRelations | null> {
  try {
    return await apiClient.get(`/stock-movements/${id}`);
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock movement by ID:", error);
    return null;
  }
}

export async function createStockMovement(
  data: CreateStockMovementRequest
): Promise<StockMovementWithRelations> {
  return await apiClient.post(`/stock-movements`, data);
}

export async function updateStockMovement(
  id: string,
  data: UpdateStockMovementRequest
): Promise<StockMovementWithRelations> {
  return await apiClient.put(`/stock-movements/${id}`, data);
}

export async function deleteStockMovement(id: string): Promise<void> {
  await apiClient.delete(`/stock-movements/${id}`);
}

export async function resolveVariantDisplayNames(
  body: ResolveVariantDisplayNamesRequest
): Promise<ResolveVariantDisplayNamesResponse> {
  return await apiClient.post(
    `/stock-movements/resolve-variant-display-names`,
    body
  );
}

export async function bulkPurchaseImport(
  body: BulkPurchaseImportRequest
): Promise<BulkPurchaseImportResponse> {
  return await apiClient.post(`/stock-movements/bulk-purchase-import`, body);
}
