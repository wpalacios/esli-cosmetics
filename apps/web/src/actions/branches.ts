"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  BranchWithRelations,
  CreateBranchRequest,
  UpdateBranchRequest,
  BranchesResponse,
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
    // Example: "API Error: 409 - Branch with this name already exists"
    const parts = error.message.split(" - ");
    if (parts.length > 1) {
      return parts.slice(1).join(" - ").trim();
    }
  }
  // Fallback to error.message or generic
  return error?.message || "An unexpected error occurred";
}

export interface BranchesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getBranches(
  params: BranchesParams = {}
): Promise<BranchesResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/branches?${queryString}` : "/branches";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching branches:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function getBranch(id: string): Promise<BranchWithRelations> {
  try {

    const response = await apiClient.get(`/branches/${id}`);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching branch:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function createBranch(
  data: CreateBranchRequest
): Promise<BranchWithRelations> {
  try {

    const response = await apiClient.post("/branches", data);


    return response;
  } catch (error: any) {
    console.error("❌ Server Action - Error creating branch:", error);
    const message = getErrorMessage(error);
    throw new Error(message);
  }
}

export async function updateBranch(
  id: string,
  data: UpdateBranchRequest
): Promise<BranchWithRelations> {
  try {

    const response = await apiClient.patch(`/branches/${id}`, data);


    return response;
  } catch (error: any) {
    console.error("❌ Server Action - Error updating branch:", error);
    const message = getErrorMessage(error);
    throw new Error(message);
  }
}

export async function deleteBranch(id: string): Promise<void> {
  try {

    await apiClient.delete(`/branches/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting branch:", error);
    throw new Error(getErrorMessage(error));
  }
}
