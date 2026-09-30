"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  SupplierWithRelations,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SuppliersResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface SuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getSuppliers(
  params: SuppliersParams = {}
): Promise<SuppliersResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString ? `/suppliers?${queryString}` : "/suppliers";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching suppliers:", error);
    throw new Error("Failed to fetch suppliers");
  }
}

export async function getSupplier(id: string): Promise<SupplierWithRelations> {
  try {

    const response = await apiClient.get(`/suppliers/${id}`);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching supplier:", error);
    throw new Error("Failed to fetch supplier");
  }
}

export async function createSupplier(
  data: CreateSupplierRequest
): Promise<SupplierWithRelations> {
  try {

    // Transform the data to match backend DTO format
    const createData = {
      name: data.name,
      contactName: data.contact_name || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      brandIds: data.brand_ids || undefined,
    };

    const response = await apiClient.post("/suppliers", createData);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error creating supplier:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to create supplier");
  }
}
export async function updateSupplier(
  id: string,
  data: UpdateSupplierRequest
): Promise<SupplierWithRelations> {
  try {

    // Transform the data to match backend DTO format
    // Convert empty strings to undefined for optional fields
    const updateData = {
      name: data.name,
      contactName: data.contact_name || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      brandIds: data.brand_ids || undefined,
    };

    const response = await apiClient.patch(`/suppliers/${id}`, updateData);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error updating supplier:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to update supplier");
  }
}

export async function deleteSupplier(id: string): Promise<void> {
  try {

    await apiClient.delete(`/suppliers/${id}`);

  } catch (error) {
    console.error("❌ Server Action - Error deleting supplier:", error);
    throw new Error("Failed to delete supplier");
  }
}
