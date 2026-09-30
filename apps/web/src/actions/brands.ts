"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import { ApiError } from "@/lib/errors/api-error";
import {
  BrandWithRelations,
  CreateBrandRequest,
  UpdateBrandRequest,
  BrandsResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export async function getBrands(
  params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}
): Promise<BrandsResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/brands?${queryString}` : "/brands";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching brands:", error);
    throw new Error("Failed to fetch brands");
  }
}

export async function getBrand(id: string): Promise<BrandWithRelations> {
  try {

    const brand: BrandWithRelations = await apiClient.get(`/brands/${id}`);

    if (!brand?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return brand;
  } catch (error) {
    console.error("❌ Server Action - Error fetching brand:", error);
    throw new Error("Failed to fetch brand");
  }
}

export async function createBrand(
  data: CreateBrandRequest
): Promise<BrandWithRelations> {
  try {

    const brand: BrandWithRelations = await apiClient.post("/brands", data);

    if (!brand?.id || !brand.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return brand;
  } catch (error) {
    console.error("❌ Server Action - Error creating brand:", error);
    throw error;
  }
}

export async function updateBrand(
  id: string,
  data: UpdateBrandRequest
): Promise<BrandWithRelations> {
  try {

    const brand: BrandWithRelations = await apiClient.patch(
      `/brands/${id}`,
      data
    );

    if (!brand?.id || !brand.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return brand;
  } catch (error) {
    console.error("❌ Server Action - Error updating brand:", error);
    throw error;
  }
}

export async function checkBrandNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  try {

    const searchParams = new URLSearchParams({ name });
    if (excludeId) {
      searchParams.set("excludeId", excludeId);
    }

    const response: { exists: boolean } = await apiClient.get(
      `/brands/check-name?${searchParams.toString()}`
    );


    return response.exists;
  } catch (error) {
    console.error("❌ Server Action - Error checking brand name:", error);
    return false;
  }
}

export async function deleteBrand(id: string): Promise<void> {
  try {

    await apiClient.delete(`/brands/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting brand:", error);

    // Preserve status code if available (ServerApiClient attaches it)
    if (error instanceof Error && "status" in error) {
      const status = (error as any).status;
      const response = (error as any).response;

      // Create ApiError to preserve status code through server action serialization
      throw new ApiError(error.message, status, response, error);
    }

    throw error;
  }
}
