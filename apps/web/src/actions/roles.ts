"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  CreateRoleRequest,
  RolesResponse,
  UpdateRoleRequest,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface RolesParams {
  page?: number;
  limit?: number;
}

export async function getRoles(
  params: RolesParams = {}
): Promise<RolesResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const url = `/roles${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);

    // Transform backend response to match frontend format
    const totalPages = Math.ceil(
      (response.total || 0) / (response.limit || 10)
    );

    return {
      data: response.roles || [],
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
    console.error("❌ Server Action - Error fetching roles:", error);
    throw new Error("Failed to fetch roles");
  }
}

export async function getRole(id: string): Promise<any> {
  try {
    const response = await apiClient.get(`/roles/${id}`);
    return response;
  } catch (error) {
    console.error("❌ Server Action - Failed to fetch role:", error);
    throw new Error("Failed to fetch role");
  }
}

export async function createRole(data: CreateRoleRequest): Promise<any> {
  try {
    const response = await apiClient.post("/roles", data);
    return response;
  } catch (error) {
    console.error("Failed to create role:", error);
    throw error;
  }
}

export async function updateRole(
  id: string,
  data: UpdateRoleRequest
): Promise<any> {
  try {
    const response = await apiClient.patch(`/roles/${id}`, data);
    return response;
  } catch (error) {
    console.error("Failed to update role:", error);
    throw error;
  }
}

export async function deleteRole(id: string): Promise<any> {
  try {
    const response = await apiClient.delete(`/roles/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to delete role:", error);
    throw new Error("Failed to delete role");
  }
}

export async function assignPermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<any> {
  try {
    const response = await apiClient.post(`/roles/${roleId}/permissions`, {
      permissionKeys,
    });
    return response;
  } catch (error) {
    console.error("Failed to assign permissions:", error);
    throw error;
  }
}
