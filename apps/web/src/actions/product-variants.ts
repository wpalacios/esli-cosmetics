"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  ApiProductVariant,
  CreateApiProductVariantRequest,
  UpdateApiProductVariantRequest,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

// Helper to extract error message from API errors
function getErrorMessage(error: any): string {
  // Try to parse error.response if it's a string (JSON)
  if (typeof error?.response === "string") {
    try {
      const parsed = JSON.parse(error.response);
      if (parsed?.message) return parsed.message;
    } catch {
      // Not JSON, continue
    }
  }
  // If error.response is an object and has data.message
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  // If error.message starts with "API Error:"
  if (
    typeof error?.message === "string" &&
    error.message.startsWith("API Error:")
  ) {
    // Example: "API Error: 409 - Variant with this name already exists"
    const parts = error.message.split(" - ");
    if (parts.length > 1) {
      return parts.slice(1).join(" - ").trim();
    }
  }
  // Fallback to error.message or generic
  return error?.message || "An unexpected error occurred";
}

function removeUndefinedProperties(
  obj: Record<string, any>
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

export async function createProductVariant({
  productId,
  data,
}: {
  productId: string;
  data: CreateApiProductVariantRequest;
}): Promise<ApiProductVariant> {
  try {

    const cleanedPayload = removeUndefinedProperties(data);

    const endpoint = `/products/${productId}/variants`;

    const variant: ApiProductVariant = await apiClient.post(
      endpoint,
      cleanedPayload
    );

    if (!variant?.id) {
      throw new Error("Invalid response format: missing variant ID");
    }


    return variant;
  } catch (error: any) {
    console.error("❌ Server Action - Error creating product variant:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function updateProductVariant({
  productId,
  variantId,
  data,
}: {
  productId: string;
  variantId: string;
  data: UpdateApiProductVariantRequest;
}): Promise<ApiProductVariant> {
  try {

    const cleanedPayload = removeUndefinedProperties(data);

    const endpoint = `/products/${productId}/variants/${variantId}`;

    const variant: ApiProductVariant = await apiClient.put(
      endpoint,
      cleanedPayload
    );

    if (!variant?.id) {
      throw new Error("Invalid response format: missing variant ID");
    }


    return variant;
  } catch (error: any) {
    console.error("❌ Server Action - Error updating product variant:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteProductVariant({
  variantId,
}: {
  variantId: string;
}): Promise<void> {
  try {

    const endpoint = `/products/variants/${variantId}`;

    await apiClient.delete(endpoint);

  } catch (error: any) {
    console.error("❌ Server Action - Error deleting product variant:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function getProductVariant({
  variantId,
}: {
  variantId: string;
}): Promise<ApiProductVariant> {
  try {

    const endpoint = `/products/variants/${variantId}`;

    const variant: ApiProductVariant = await apiClient.get(endpoint);

    if (!variant?.id) {
      throw new Error("Invalid response format: missing variant ID");
    }


    return variant;
  } catch (error: any) {
    console.error("❌ Server Action - Error getting product variant:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function searchProductVariants({
  query,
  locationId,
}: {
  query: string;
  locationId?: string;
}): Promise<any[]> {
  try {

    const searchParams = new URLSearchParams();
    searchParams.set("query", query);
    if (locationId) {
      searchParams.set("locationId", locationId);
    }

    const endpoint = `/products/variants/search?${searchParams.toString()}`;

    const variants = await apiClient.get(endpoint);


    return Array.isArray(variants) ? variants : [];
  } catch (error) {
    console.error(
      "❌ Server Action - Error searching product variants:",
      error
    );
    throw new Error(getErrorMessage(error));
  }
}

export async function listProductVariantsPaginated({
  productId,
  page = 1,
  limit = 10,
}: {
  productId: string;
  page?: number;
  limit?: number;
}): Promise<{
  data: ApiProductVariant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  try {
    // Validate productId to prevent invalid API calls
    if (!productId || productId.trim() === "") {
      console.warn(
        "⚠️ Server Action - listProductVariantsPaginated called with empty productId"
      );
      return {
        data: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const endpoint = `/products/${productId}/variants?page=${page}&limit=${limit}`;
    return await apiClient.get(endpoint);
  } catch (error) {
    console.error(
      "❌ Server Action - Error listing product variants paginated:",
      error
    );
    throw new Error(getErrorMessage(error));
  }
}

// Get all product variants (all brands) with global stock, paginated & searchable
export async function getAllVariantsWithStock(
  page: number = 1,
  limit: number = 10,
  search?: string
): Promise<any> {
  try {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    if (search) {
      params.set("search", search);
    }

    const endpoint = `/products/variants/all-with-stock?${params.toString()}`;


    const response = await apiClient.get(endpoint);
    return response;
  } catch (error) {
    console.error("❌ Error fetching all variants with stock:", error);
    throw new Error("Failed to fetch variants with stock");
  }
}
