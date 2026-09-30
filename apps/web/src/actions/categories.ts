"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  CategoryWithRelations,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryFilters,
  CategoriesResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export async function getCategories(
  params: { page?: number; limit?: number } = {}
): Promise<CategoriesResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/categories?${queryString}` : "/categories";


    const apiResponse = await apiClient.get(endpoint);
    const defaultPage = params.page || 1;
    const defaultLimit = 1000;
    if (!apiResponse || !apiResponse.data || !apiResponse.pagination) {
      console.error(
        "❌ API Response Error: Invalid or missing pagination structure."
      );

      return {
        data: [],
        pagination: {
          page: defaultPage,
          limit: defaultLimit,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
    const normalizedResponse: CategoriesResponse = {
      data: apiResponse.data,
      pagination: {
        page: apiResponse.pagination.page ?? defaultPage,
        limit: apiResponse.pagination.limit ?? defaultLimit,
        total: apiResponse.pagination.total ?? 0,
        totalPages: apiResponse.pagination.totalPages ?? 0,
        hasNext: apiResponse.pagination.hasNext ?? false,
        hasPrev: apiResponse.pagination.hasPrev ?? false,
      },
    };
    return normalizedResponse;
  } catch (error) {
    console.error("❌ Server Action - Error fetching categories:", error);
    throw new Error("Failed to fetch categories");
  }
}

export async function searchCategoriesByName(
  name: string,
  page = 1,
  limit = 10
): Promise<CategoriesResponse> {
  try {

    const query = new URLSearchParams({
      name,
      page: page.toString(),
      limit: limit.toString(),
    });

    const apiResponse = await apiClient.get(`/categories/search?${query}`);


    const defaultPage = page || 1;
    const defaultLimit = limit || 10;

    if (!apiResponse || !apiResponse.data || !apiResponse.pagination) {
      console.warn("⚠️ Invalid API response structure for search.");

      const categoriesArray = Array.isArray(apiResponse)
        ? apiResponse
        : apiResponse?.data || [];

      return {
        data: categoriesArray,
        pagination: {
          page: defaultPage,
          limit: defaultLimit,
          total: categoriesArray.length,
          totalPages: categoriesArray.length > 0 ? 1 : 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    const normalizedResponse: CategoriesResponse = {
      data: apiResponse.data,
      pagination: {
        page: apiResponse.pagination.page ?? defaultPage,
        limit: apiResponse.pagination.limit ?? defaultLimit,
        total: apiResponse.pagination.total ?? 0,
        totalPages: apiResponse.pagination.totalPages ?? 0,
        hasNext: apiResponse.pagination.hasNext ?? false,
        hasPrev: apiResponse.pagination.hasPrev ?? false,
      },
    };


    return normalizedResponse;
  } catch (error) {
    console.error("❌ Server Action - Error searching categories:", error);
    throw new Error("Failed to search categories");
  }
}

export async function getCategoryById(
  id: string
): Promise<CategoryWithRelations> {
  try {

    const response = await apiClient.get(`/categories/${id}`);


    return response;
  } catch (error) {
    console.error(`❌ Server Action - Error fetching category [${id}]:`, error);
    throw new Error("Failed to fetch category");
  }
}

export async function createCategory(
  data: CreateCategoryRequest
): Promise<CategoryWithRelations> {
  try {

    const payload: any = {
      ...data,
      parentId: data.parentId ?? null,
    };

    const category: CategoryWithRelations = await apiClient.post(
      "/categories",
      payload
    );

    if (!category?.id || !category.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return category;
  } catch (error) {
    console.error("❌ Server Action - Error creating category:", error);
    throw new Error("Failed to create category");
  }
}

export async function updateCategory(
  id: string,
  data: UpdateCategoryRequest
): Promise<CategoryWithRelations> {
  try {

    const payload: any = {
      ...data,
      parentId: data.parentId ?? null,
    };


    const category: CategoryWithRelations = await apiClient.put(
      `/categories/${id}`,
      payload
    );

    if (!category?.id || !category.name) {
      throw new Error("Invalid response format: missing required fields");
    }

    return category;
  } catch (error) {
    console.error("❌ Server Action - Error updating category:", error);
    throw new Error("Failed to update category");
  }
}

export async function checkCategoryNameExists(
  name: string,
  excludeId?: string
): Promise<boolean> {
  try {

    const searchParams = new URLSearchParams({ name });
    if (excludeId) {
      searchParams.set("excludeId", excludeId);
    }

    const response: { exists: boolean } = await apiClient.get(
      `/categories/check-name?${searchParams.toString()}`
    );


    return response.exists;
  } catch (error) {
    console.error("❌ Server Action - Error checking category name:", error);
    return false;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {

    const response = await apiClient.delete(`/categories/${id}`);

    if (response?.status && response.status !== 204) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

  } catch (error) {
    console.error("❌ Server Action - Error deleting category:", error);
    throw new Error("Failed to delete category");
  }
}
