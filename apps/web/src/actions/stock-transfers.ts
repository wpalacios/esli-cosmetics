"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export interface CreateTransferRequest {
  fromLocationId: string;
  toLocationId: string;
  senderId?: string;
  receiverId?: string;
  items: Array<{
    productId: string;
    productVariantId?: string;
    quantityRequested: number;
  }>;
}

export interface UpdateTransferStatusRequest {
  status: string;
  note?: string;
}

export interface DispatchTransferRequest {
  items: Array<{
    itemId: string;
    quantitySent: number;
  }>;
  note?: string;
}

export interface ReceiveTransferRequest {
  items: Array<{
    itemId: string;
    quantityReceived: number;
    discrepancyType?: "DAMAGE" | "NOT_RECEIVED";
  }>;
  note?: string;
}

export interface StockTransfer {
  id: string;
  trackingNumber: string;
  status: string;
  fromLocationId: string;
  toLocationId: string;
  createdById: string;
  senderId?: string;
  receiverId?: string;
  createdAt: string;
  dispatchedAt?: string;
  receivedAt?: string;
  items: Array<{
    id: string;
    transferId: string;
    productId: string;
    productVariantId?: string;
    quantityRequested: number;
    quantitySent?: number;
    quantityReceived?: number;
    product?: any;
    productVariant?: any;
  }>;
  logs?: Array<{
    id: string;
    transferId: string;
    userId: string;
    previousStatus: string;
    newStatus: string;
    note: string;
    createdAt: string;
    user?: any;
  }>;
  movements?: Array<any>;
  fromLocation?: any;
  toLocation?: any;
  createdBy?: any;
  sender?: any;
  receiver?: any;
}

export interface StockTransfersResponse {
  data: StockTransfer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface GetStockTransfersParams {
  status?: string;
  fromLocationId?: string;
  toLocationId?: string;
  trackingNumber?: string;
  page?: number;
  limit?: number;
}

function getErrorMessage(error: any): string {
  if (error?.message) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

export async function createTransfer(
  data: CreateTransferRequest
): Promise<StockTransfer> {
  try {
    const response = await apiClient.post("/stock-transfers", data);
    return response;
  } catch (error) {
    console.error("❌ Server Action - Error creating transfer:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function getStockTransfers(
  params: GetStockTransfersParams = {}
): Promise<StockTransfersResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params.status) searchParams.set("status", params.status);
    if (params.fromLocationId)
      searchParams.set("fromLocationId", params.fromLocationId);
    if (params.toLocationId)
      searchParams.set("toLocationId", params.toLocationId);
    if (params.trackingNumber)
      searchParams.set("trackingNumber", params.trackingNumber);
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.limit) searchParams.set("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/stock-transfers?${queryString}`
      : "/stock-transfers";


    const response = await apiClient.get(endpoint);

    return response;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("❌ Server Action - Error fetching transfers:", error);
    return {
      data: [],
      pagination: {
        page: params.page || 1,
        limit: params.limit || 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

export async function getStockTransfer(
  id: string
): Promise<StockTransfer | null> {
  try {
    const response = await apiClient.get(`/stock-transfers/${id}`);
    return response;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("❌ Server Action - Error fetching transfer:", error);
    return null;
  }
}

export async function updateTransferStatus(
  id: string,
  data: UpdateTransferStatusRequest
): Promise<StockTransfer> {
  try {
    const response = await apiClient.patch(
      `/stock-transfers/${id}/status`,
      data
    );
    return response;
  } catch (error) {
    console.error("❌ Server Action - Error updating transfer status:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function dispatchTransfer(
  id: string,
  data: DispatchTransferRequest
): Promise<StockTransfer> {
  try {
    const response = await apiClient.post(
      `/stock-transfers/${id}/dispatch`,
      data
    );
    return response;
  } catch (error) {
    console.error("❌ Server Action - Error dispatching transfer:", error);
    throw new Error(getErrorMessage(error));
  }
}

export async function receiveTransfer(
  id: string,
  data: ReceiveTransferRequest
): Promise<StockTransfer> {
  try {
    const response = await apiClient.post(
      `/stock-transfers/${id}/receive`,
      data
    );
    return response;
  } catch (error) {
    console.error("❌ Server Action - Error receiving transfer:", error);
    throw new Error(getErrorMessage(error));
  }
}

// Export transfer PDF by transferId
export async function exportTransferPdf(
  transferId: string
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {

    const endpoint = `/reports/transfer/export/pdf`;
    const { arrayBuffer, headers } = await apiClient.postBinary(endpoint, {
      transferId,
    });

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ?? `transferencia-${transferId}.pdf`;

    const base64 = Buffer.from(arrayBuffer).toString("base64");


    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error("❌ Server Action - Error exporting transfer PDF:", error);
    throw error;
  }
}

export async function cancelTransfer(id: string): Promise<StockTransfer> {
  try {
    const response = await apiClient.post(`/stock-transfers/${id}/cancel`, {});
    return response;
  } catch (error) {
    console.error("❌ Server Action - Error cancelling transfer:", error);
    throw new Error(getErrorMessage(error));
  }
}
