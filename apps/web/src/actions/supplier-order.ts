"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  SupplierOrder,
  CreateSupplierOrderRequest,
  UpdateSupplierOrderRequest,
  PaginatedSupplierOrdersResponse,
  DeleteSupplierOrderResponse,
} from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface SupplierOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
}

// Get paginated supplier orders (with optional search)
export async function getSupplierOrders(
  params: SupplierOrdersParams = {}
): Promise<PaginatedSupplierOrdersResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());
    if (params.search) searchParams.set("search", params.search);

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/supplier-orders${params.search ? "/search" : ""}?${queryString}`
      : "/supplier-orders";


    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching supplier orders:", error);
    throw new Error("Failed to fetch supplier orders");
  }
}

// Search product variants for global stock level (global stock, prices, etc)
export async function getVariantsByBrand(
  brandId: string,
  page: number = 1,
  limit: number = 10
): Promise<any> {
  try {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    const endpoint = `/supplier-orders/by-brand/${brandId}?${params.toString()}`;


    const response = await apiClient.get(endpoint);
    return response;
  } catch (error) {
    console.error("❌ Error fetching variants by brand:", error);
    throw new Error("Failed to fetch variants");
  }
}

// Search supplier orders (explicit)
export async function searchSupplierOrders(
  search: string,
  page = 1,
  limit = 10
): Promise<PaginatedSupplierOrdersResponse> {
  try {
    const params = new URLSearchParams();
    params.set("search", search);
    params.set("page", page.toString());
    params.set("limit", limit.toString());

    const endpoint = `/supplier-orders/search?${params.toString()}`;

    const response = await apiClient.get(endpoint);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error searching supplier orders:", error);
    throw new Error("Failed to search supplier orders");
  }
}

// Get supplier order by ID
export async function getSupplierOrderById(id: string): Promise<SupplierOrder> {
  try {

    const response = await apiClient.get(`/supplier-orders/${id}`);


    return response;
  } catch (error) {
    console.error(
      "❌ Server Action - Error fetching supplier order by ID:",
      error
    );
    throw new Error("Failed to fetch supplier order");
  }
}

// Create supplier order
export async function createSupplierOrder(
  data: CreateSupplierOrderRequest
): Promise<SupplierOrder> {
  try {

    const response = await apiClient.post("/supplier-orders", data);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error creating supplier order:", error);
    throw new Error("Failed to create supplier order");
  }
}

// Update supplier order
export async function updateSupplierOrder(
  id: string,
  data: UpdateSupplierOrderRequest
): Promise<SupplierOrder> {
  try {

    const response = await apiClient.put(`/supplier-orders/${id}`, data);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error updating supplier order:", error);
    throw new Error("Failed to update supplier order");
  }
}

// Delete supplier order
export async function deleteSupplierOrder(
  id: string
): Promise<DeleteSupplierOrderResponse> {
  try {

    const response = await apiClient.delete(`/supplier-orders/${id}`);


    return response;
  } catch (error) {
    console.error("❌ Server Action - Error deleting supplier order:", error);
    throw new Error("Failed to delete supplier order");
  }
}

// Export supplier order PDF
export async function exportSupplierOrderPdf(
  orderId: string
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {
    const endpoint = `/reports/supplier-order/export/pdf`;

    const { arrayBuffer, headers } = await apiClient.postBinary(endpoint, {
      orderId,
    });

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ?? `supplier-order-${orderId}.pdf`;
    const base64 = Buffer.from(arrayBuffer).toString("base64");


    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error(
      "❌ Server Action - Error exporting supplier order PDF:",
      error
    );
    throw error;
  }
}
