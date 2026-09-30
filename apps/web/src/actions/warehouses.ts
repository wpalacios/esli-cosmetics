"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  WarehouseWithRelations,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
  WarehousesResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface WarehousesParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getWarehouses(
  params: WarehousesParams = {}
): Promise<WarehousesResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/warehouses?${queryString}` : "/warehouses";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching warehouses:", error);
    throw new Error("Failed to fetch warehouses");
  }
}

export async function getWarehouse(
  id: string
): Promise<WarehouseWithRelations> {
  try {

    const response = await apiClient.get(`/warehouses/${id}`);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching warehouse:", error);
    throw new Error("Failed to fetch warehouse");
  }
}

export async function createWarehouse(
  data: CreateWarehouseRequest
): Promise<WarehouseWithRelations> {
  try {

    // Transform the data to match backend DTO format
    const createData = {
      name: data.name,
      branchId: data.branch_id,
      address: data.address,
      contact: data.contact,
    };

    const response = await apiClient.post("/warehouses", createData);


    return response;
  } catch (error: any) {
    console.error("❌ Server Action - Error creating warehouse:", error);

    if (error?.response?.message) {
      throw new Error(error.response.message);
    }

    throw new Error("Failed to create warehouse");
  }
}

export async function updateWarehouse(
  id: string,
  data: UpdateWarehouseRequest
): Promise<WarehouseWithRelations> {
  try {

    // Transform the data to match backend DTO format
    const updateData = {
      name: data.name,
      branchId: data.branch_id,
      address: data.address,
      contact: data.contact,
    };

    const response = await apiClient.patch(`/warehouses/${id}`, updateData);


    return response;
  } catch (error: any) {
    console.error("❌ Server Action - Error updating warehouse:", error);

    if (error?.response?.message) {
      throw new Error(error.response.message);
    }
    if (error?.message) {
      throw new Error(error.message);
    }

    throw new Error("Failed to update warehouse");
  }
}

export async function deleteWarehouse(id: string): Promise<void> {
  try {

    await apiClient.delete(`/warehouses/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting warehouse:", error);
    throw new Error("Failed to delete warehouse");
  }
}
