"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  CreatePermissionRequest,
  PermissionsResponse,
  UpdatePermissionRequest,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface PermissionsParams {
  page?: number;
  limit?: number;
}

export async function getPermissions(
  params: PermissionsParams = {}
): Promise<PermissionsResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const url = `/permissions${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);

    // Transform backend response to match frontend format
    const totalPages = Math.ceil(
      (response.total || 0) / (response.limit || 10)
    );

    return {
      data: response.permissions || [],
      pagination: {
        page: response.page || 1,
        limit: response.limit || 10,
        total: response.total || 0,
        totalPages,
        hasNext: (response.page || 1) < totalPages,
        hasPrev: (response.page || 1) > 1,
      },
    };
  } catch (error) {
    console.error("❌ Server Action - Error fetching permissions:", error);
    throw new Error("Failed to fetch permissions");
  }
}

export async function getPermission(id: string): Promise<any> {
  try {
    const response = await apiClient.get(`/permissions/${id}`);
    return response;
  } catch (error) {
    console.error("❌ Server Action - Failed to fetch permission:", error);
    throw new Error("Failed to fetch permission");
  }
}

export async function createPermission(
  data: CreatePermissionRequest
): Promise<any> {
  try {
    const response = await apiClient.post("/permissions", data);
    return response;
  } catch (error) {
    console.error("Failed to create permission:", error);
    throw error;
  }
}

export async function updatePermission(
  id: string,
  data: UpdatePermissionRequest
): Promise<any> {
  try {
    const response = await apiClient.patch(`/permissions/${id}`, data);
    return response;
  } catch (error) {
    console.error("Failed to update permission:", error);
    throw error;
  }
}

export async function deletePermission(id: string): Promise<any> {
  try {
    const response = await apiClient.delete(`/permissions/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to delete permission:", error);
    throw new Error("Failed to delete permission");
  }
}
