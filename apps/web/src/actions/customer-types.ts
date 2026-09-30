"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  SessionExpiredError,
  isSessionExpiredError,
} from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();
import {
  CustomerType,
  CreateCustomerTypeRequest,
  UpdateCustomerTypeRequest,
  PaginatedCustomerTypesResponse,
} from "@esli-cosmetics/types";

const createEmptyCustomerTypesResponse = (
  page: number,
  limit: number
): PaginatedCustomerTypesResponse => ({
  data: [],
  total: 0,
  page,
  limit,
  totalPages: 0,
});

export async function getCustomerTypes(
  params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    isDeleted?: boolean;
  } = {}
): Promise<PaginatedCustomerTypesResponse> {
  const defaultPage = params.page || 1;
  const defaultLimit = params.limit || 10;

  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", defaultPage.toString());
    if (params.limit) searchParams.set("limit", defaultLimit.toString());
    if (params.isActive !== undefined)
      searchParams.set("isActive", params.isActive.toString());
    if (params.isDeleted !== undefined)
      searchParams.set("isDeleted", params.isDeleted.toString());

    const queryString = searchParams.toString();

    const endpoint = queryString
      ? `/customer-types?${queryString}`
      : `/customer-types`;


    const apiResponse = await apiClient.get(endpoint);

    if (
      !apiResponse ||
      !Array.isArray(apiResponse.data) ||
      typeof apiResponse.total !== "number"
    ) {
      console.error(
        "❌ API Response Error: Invalid or missing customer types list/total structure.",
        { rawResponse: apiResponse }
      );
      return createEmptyCustomerTypesResponse(defaultPage, defaultLimit);
    }

    const normalizedResponse: PaginatedCustomerTypesResponse = {
      data: apiResponse.data,
      total: apiResponse.total,
      page: apiResponse.page ?? defaultPage,
      limit: apiResponse.limit ?? defaultLimit,
      totalPages: apiResponse.totalPages ?? 0,
    };

    return normalizedResponse;
  } catch (error) {
    console.error("❌ Server Action - Error fetching customer types:", error);

    // Handle session expiration - return empty data
    // The page will check authentication and redirect if needed
    if (isSessionExpiredError(error)) {
      console.warn("⚠️ Session expired, returning empty customer types");
      return createEmptyCustomerTypesResponse(defaultPage, defaultLimit);
    }

    // For other errors, return empty data instead of throwing
    // This prevents the page from crashing
    console.warn("⚠️ Returning empty customer types due to error");
    return createEmptyCustomerTypesResponse(defaultPage, defaultLimit);
  }
}

export async function searchCustomerType(
  search: string,
  page = 1,
  limit = 10
): Promise<PaginatedCustomerTypesResponse> {
  try {

    // Use the findAll endpoint with search parameter instead of a separate search endpoint
    const params = new URLSearchParams();

    if (search) params.append("search", search);
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    const apiResponse = await apiClient.get(
      `/customer-types?${params.toString()}`
    );

    const defaultPage = page || 1;
    const defaultLimit = limit || 10;

    if (
      !apiResponse ||
      !Array.isArray(apiResponse.data) ||
      typeof apiResponse.total !== "number"
    ) {
      console.warn(
        "⚠️ Invalid API response structure for customer type search. Returning empty result."
      );
      return createEmptyCustomerTypesResponse(defaultPage, defaultLimit);
    }

    const normalizedResponse: PaginatedCustomerTypesResponse = {
      data: apiResponse.data,
      total: apiResponse.total,
      page: apiResponse.page ?? defaultPage,
      limit: apiResponse.limit ?? defaultLimit,
      totalPages: apiResponse.totalPages ?? 0,
    };


    return normalizedResponse;
  } catch (error: any) {
    console.error("❌ Server Action - Error searching customer types:", error);
    throw error;
  }
}

export async function getCustomerTypeById(id: string): Promise<CustomerType> {
  try {
    const customerType: CustomerType = await apiClient.get(
      `/customer-types/${id}`
    );

    if (!customerType?.id) {
      throw new Error("Invalid response format: missing customer type ID");
    }


    return customerType;
  } catch (error) {
    console.error(
      "❌ Server Action - Error fetching customer type by ID:",
      error
    );
    throw error;
  }
}

export async function createCustomerType(
  data: CreateCustomerTypeRequest
): Promise<CustomerType> {
  try {

    const customerType: CustomerType = await apiClient.post(
      "/customer-types",
      data
    );

    if (!customerType?.id || !customerType.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return customerType;
  } catch (error) {
    console.error("❌ Server Action - Error creating customer type:", error);
    throw error;
  }
}

export async function updateCustomerType(
  id: string,
  data: UpdateCustomerTypeRequest
): Promise<CustomerType> {
  try {

    const customerType: CustomerType = await apiClient.put(
      `/customer-types/${id}`,
      data
    );

    if (!customerType?.id || !customerType.name) {
      throw new Error("Invalid response format: missing required fields");
    }


    return customerType;
  } catch (error) {
    console.error("❌ Server Action - Error updating customer type:", error);
    throw error;
  }
}

export async function deleteCustomerType(
  id: string
): Promise<{ success: boolean; message: string }> {
  try {

    const response = await apiClient.delete(`/customer-types/${id}`);


    return {
      success: response.success || true,
      message: response.message || "Customer type deleted successfully",
    };
  } catch (error) {
    console.error("❌ Server Action - Error deleting customer type:", error);
    throw error;
  }
}
