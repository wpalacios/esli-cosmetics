"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  ProductWithRelations,
  CreateProductRequest,
  UpdateProductRequest,
  ProductsFilters,
  ProductsResponse,
  ProductType,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

// Helper to extract a clean error message from various error formats
function getErrorMessage(error: any): string {
  // Check if this is an HTML error response (e.g., Cloudflare 502)
  if (error?.isHtmlError && error?.response?.message) {
    return error.response.message;
  }

  // If error.response is an object and has data.message
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  // If error.response is an object and has message (from ServerApiClient)
  if (error?.response?.message) {
    return error.response.message;
  }

  // If error.message starts with "API Error:"
  if (
    typeof error?.message === "string" &&
    error.message.startsWith("API Error:")
  ) {
    // Example: "API Error: 409 - Product with this SKU already exists"
    const parts = error.message.split(" - ");
    if (parts.length > 1) {
      return parts.slice(1).join(" - ").trim();
    }
  }

  // Fallback to error.message or a generic message
  return error?.message || "An unexpected error occurred";
}

export async function getProducts(
  params: {
    page?: number;
    limit?: number;
    excludeTypes?: ProductType[];
    brandId?: string;
    categoryId?: string;
  } = {}
): Promise<ProductsResponse> {
  try {
    const searchParams = new URLSearchParams();
    const defaultPage = params.page || 1;
    const defaultLimit = params.limit || 10;

    if (params.page) searchParams.set("page", defaultPage.toString());
    if (params.limit) searchParams.set("limit", defaultLimit.toString());
    if (params.excludeTypes && params.excludeTypes.length > 0) {
      searchParams.set("excludeTypes", params.excludeTypes.join(","));
    }
    if (params.brandId) searchParams.set("brandId", params.brandId);
    if (params.categoryId) searchParams.set("categoryId", params.categoryId);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/products?${queryString}` : `/products`;


    const apiResponse = await apiClient.get(endpoint);

    if (
      !apiResponse ||
      !Array.isArray(apiResponse.data) ||
      !apiResponse.pagination ||
      typeof apiResponse.pagination.total !== "number"
    ) {
      console.error(
        "❌ API Response Error: Invalid or missing product list/total structure.",
        {
          rawResponse: apiResponse,
        }
      );

      return {
        products: [],
        total: 0,
        page: defaultPage,
        limit: defaultLimit,
      };
    }

    const normalizedResponse: ProductsResponse = {
      products: apiResponse.data,
      total: apiResponse.pagination.total,
      page: apiResponse.pagination.page ?? defaultPage,
      limit: apiResponse.pagination.limit ?? defaultLimit,
    };


    return normalizedResponse;
  } catch (error) {
    console.error("❌ Server Action - Error fetching products:", error);
    throw new Error(getErrorMessage(error));
  }
}

//Searching products by name, sku or barcode
export async function searchProduct(
  search: string,
  page = 1,
  limit = 10,
  excludeTypes?: ProductType[],
  brandId?: string,
  categoryId?: string
): Promise<ProductsResponse> {
  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    params.append("page", page.toString());
    params.append("limit", limit.toString());
    if (excludeTypes && excludeTypes.length > 0) {
      params.append("excludeTypes", excludeTypes.join(","));
    }
    if (brandId) params.append("brandId", brandId);
    if (categoryId) params.append("categoryId", categoryId);


    const apiResponse = await apiClient.get(
      `/products/search?${params.toString()}`
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
        "⚠️ Invalid API response structure for product search. Returning empty result."
      );

      const productsArray = Array.isArray(apiResponse?.data)
        ? apiResponse.data
        : [];

      const totalCount = apiResponse?.pagination?.total ?? productsArray.length;

      return {
        products: productsArray,
        total: totalCount,
        page: defaultPage,
        limit: defaultLimit,
      };
    }

    const normalizedResponse: ProductsResponse = {
      products: apiResponse.data,
      total: apiResponse.pagination.total,
      page: apiResponse.pagination.page ?? defaultPage,
      limit: apiResponse.pagination.limit ?? defaultLimit,
    };


    return normalizedResponse;
  } catch (error: any) {
    const message = getErrorMessage(error);

    if (message.includes("At least one search parameter")) {
      console.warn("⚠️ No search parameters provided");
      return { products: [], total: 0, page: page, limit: limit };
    }

    console.error("❌ Server Action - Error searching products:", error);
    throw new Error(message);
  }
}

export async function getProductById(
  id: string
): Promise<ProductWithRelations> {
  try {

    const response = await apiClient.get(`/products/${id}`);

    return response;
  } catch (error) {
    console.error(`❌ Server Action - Error fetching product [${id}]:`, error);
    throw new Error(getErrorMessage(error));
  }
}

export async function createProduct(
  data: CreateProductRequest
): Promise<ProductWithRelations> {
  try {

    const product: ProductWithRelations = await apiClient.post(
      "/products",
      data
    );


    if (!product?.id || !product.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return product;
  } catch (error: any) {
    console.error("❌ Server Action - Error creating product:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function updateProduct(
  id: string,
  data: UpdateProductRequest
): Promise<ProductWithRelations> {
  try {


    const product: ProductWithRelations = await apiClient.put(
      `/products/${id}`,
      data
    );

    if (!product?.id || !product.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return product;
  } catch (error: any) {
    console.error("❌ Server Action - Error updating product:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {

    await apiClient.delete(`/products/${id}`);
  } catch (error: any) {
    console.error("❌ Server Action - Error deleting product:", error);
    throw new Error(getErrorMessage(error));
  }
}
