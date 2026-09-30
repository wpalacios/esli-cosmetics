"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  CreateUserRequest,
  UsersResponse,
  UpdateUserRequest,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface UsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getUsers(
  params: UsersParams = {}
): Promise<UsersResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.search) searchParams.append("search", params.search);

    const queryString = searchParams.toString();
    const url = `/users${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);

    // Transform backend response to match frontend format
    const totalPages = Math.ceil(
      (response.total || 0) / (response.limit || 10)
    );

    return {
      data: response.users || [],
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
    console.error("❌ Server Action - Error fetching users:", error);
    throw new Error("Failed to fetch users");
  }
}

export async function getUser(id: string): Promise<any> {
  try {
    const response = await apiClient.get(`/users/${id}`);
    return response;
  } catch (error) {
    console.error("❌ Server Action - Failed to fetch user:", error);
    throw new Error("Failed to fetch user");
  }
}

export async function createUser(data: CreateUserRequest): Promise<any> {
  try {
    const response = await apiClient.post("/users", data);
    return response;
  } catch (error) {
    console.error("Failed to create user:", error);
    throw error;
  }
}

export async function updateUser(
  id: string,
  data: UpdateUserRequest
): Promise<any> {
  try {
    const response = await apiClient.patch(`/users/${id}`, data);
    return response;
  } catch (error) {
    console.error("Failed to update user:", error);
    throw error;
  }
}

export async function deleteUser(id: string): Promise<any> {
  try {
    const response = await apiClient.delete(`/users/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to delete user:", error);
    throw new Error("Failed to delete user");
  }
}
