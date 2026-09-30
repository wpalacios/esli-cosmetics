"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import type {
  Quote,
  CreateQuote,
  UpdateQuote,
  PaginatedQuotes,
  ConvertQuoteToOrder,
} from "@esli-cosmetics/types";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export interface GetQuotesParams {
  quoteNumber?: string;
  status?: string;
  customerId?: string;
  locationId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function createQuote(data: CreateQuote): Promise<Quote> {
  const response = await apiClient.post("/quotes", data);
  return response as Quote;
}

export async function getQuote(id: string): Promise<Quote | null> {
  try {
    const response = await apiClient.get(`/quotes/${id}`);
    return response as Quote;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching quote:", error);
    return null;
  }
}

export async function getQuotes(
  params: GetQuotesParams = {}
): Promise<PaginatedQuotes> {
  try {
    const queryParams = new URLSearchParams();

    if (params.quoteNumber) {
      queryParams.append("quoteNumber", params.quoteNumber);
    }
    if (params.status) {
      queryParams.append("status", params.status);
    }
    if (params.customerId) {
      queryParams.append("customerId", params.customerId);
    }
    if (params.locationId) {
      queryParams.append("locationId", params.locationId);
    }
    if (params.startDate) {
      queryParams.append("startDate", params.startDate);
    }
    if (params.endDate) {
      queryParams.append("endDate", params.endDate);
    }
    if (params.page) {
      queryParams.append("page", params.page.toString());
    }
    if (params.limit) {
      queryParams.append("limit", params.limit.toString());
    }

    const queryString = queryParams.toString();
    const url = `/quotes${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);
    return response as PaginatedQuotes;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching quotes:", error);
    return {
      data: [],
      total: 0,
      page: params.page || 1,
      limit: params.limit || 10,
      totalPages: 0,
    };
  }
}

export async function updateQuote(
  id: string,
  data: UpdateQuote
): Promise<Quote> {
  const response = await apiClient.patch(`/quotes/${id}`, data);
  return response as Quote;
}

export async function deleteQuote(id: string): Promise<void> {
  await apiClient.delete(`/quotes/${id}`);
}

export async function convertQuoteToOrder(
  id: string,
  data: ConvertQuoteToOrder
): Promise<any> {
  const response = await apiClient.post(`/quotes/${id}/convert-to-order`, data);
  return response;
}

export async function exportQuotePdf(
  quoteId: string,
  options?: { timeZone?: string }
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {

    const endpoint = `/reports/quote/export/pdf`;
    const { arrayBuffer, headers } = await apiClient.postBinary(endpoint, {
      quoteId,
      ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
    });

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ?? `cotizacion-${quoteId}.pdf`;

    const base64 = Buffer.from(arrayBuffer).toString("base64");


    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error("❌ Server Action - Error exporting quote PDF:", error);
    throw error;
  }
}

export async function approveQuote(id: string, userId: string): Promise<Quote> {
  if (!userId) {
    throw new Error("User ID is required to approve a quote.");
  }
  const response = await apiClient.post(`/quotes/${id}/approve`, { userId });
  return response as Quote;
}

export async function annulQuote(id: string, userId: string): Promise<Quote> {
  const response = await apiClient.post(`/quotes/${id}/annul`, { userId });
  return response as Quote;
}
