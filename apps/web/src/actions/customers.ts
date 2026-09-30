"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  CreateCustomerRequest,
  CustomersResponse,
  UpdateCustomerRequest,
} from "@esli-cosmetics/types";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export interface CustomersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getCustomers(
  params: CustomersParams = {}
): Promise<CustomersResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.search) searchParams.append("search", params.search);

    const queryString = searchParams.toString();
    const url = `/customers${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);

    return response;
  } catch (error) {
    console.error("❌ Server Action - Error fetching customers:", error);

    // Handle session expiration - return empty data
    if (isSessionExpiredError(error)) {
      console.warn("⚠️ Session expired, returning empty customers");
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

    throw new Error("Failed to fetch customers");
  }
}

export async function getCustomer(id: string): Promise<any> {
  try {
    const response = await apiClient.get(`/customers/${id}`);
    return response;
  } catch (error) {
    console.error("❌ Server Action - Failed to fetch customer:", error);
    throw new Error("Failed to fetch customer");
  }
}

export async function createCustomer(
  data: CreateCustomerRequest
): Promise<any> {
  try {
    const response = await apiClient.post("/customers", data);
    return response;
  } catch (error) {
    console.error("Failed to create customer:", error);
    // Re-throw the original error to preserve API error details
    throw error;
  }
}

export async function updateCustomer(
  id: string,
  data: UpdateCustomerRequest
): Promise<any> {
  try {
    const response = await apiClient.patch(`/customers/${id}`, data);
    return response;
  } catch (error) {
    console.error("Failed to update customer:", error);
    // Re-throw the original error to preserve API error details
    throw error;
  }
}

export async function deleteCustomer(id: string): Promise<any> {
  try {
    const response = await apiClient.delete(`/customers/${id}`);
    return response;
  } catch (error) {
    console.error("Failed to delete customer:", error);
    throw new Error("Failed to delete customer");
  }
}

export async function getCustomerOutstandingCredits(
  id: string
): Promise<{ outstandingAmount: number; creditLimit: number | null }> {
  try {
    const response = await apiClient.get(
      `/customers/${id}/outstanding-credits`
    );
    return response;
  } catch (error) {
    console.error(
      "❌ Server Action - Failed to fetch customer outstanding credits:",
      error
    );
    throw new Error("Failed to fetch customer outstanding credits");
  }
}

export interface AccountStatementParams {
  customerId: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  transactionType?: string;
}

export async function getCustomerAccountStatement(
  params: AccountStatementParams
): Promise<any> {
  try {
    const searchParams = new URLSearchParams();
    if (params.from) searchParams.append("from", params.from);
    if (params.to) searchParams.append("to", params.to);
    if (params.page) searchParams.append("page", params.page.toString());
    if (params.limit) searchParams.append("limit", params.limit.toString());
    if (params.transactionType)
      searchParams.append("transactionType", params.transactionType);

    const queryString = searchParams.toString();
    const url = `/customers/${params.customerId}/account-statement${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get(url);
    return response;
  } catch (error) {
    console.error(
      "❌ Server Action - Failed to fetch account statement:",
      error
    );
    throw error;
  }
}

export interface CreateCustomerPaymentRequest {
  amount: number;
  paymentType: "CASH" | "CARD" | "TRANSFER";
  provider?: string;
  transactionReference?: string;
}

export interface ReversePaymentRequest {
  reason: string;
}

export interface ManualPaymentReversalEntryRequest {
  targetType: "OPENING_BALANCE" | "INSTALLMENT";
  creditInstallmentId?: string;
  amount: number;
}

export interface ManualPaymentReversalRequest {
  reason: string;
  entries: ManualPaymentReversalEntryRequest[];
}

const LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE =
  "LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL";

type ReversePaymentActionResult =
  | Record<string, unknown>
  | {
      manualRequired: true;
      code: string;
      message: string;
    };

function parseLegacyCodeFromActionError(error: unknown): {
  code: string | undefined;
  message: string | undefined;
} {
  const maybeError = error as
    | {
        code?: string;
        response?: { code?: string; message?: string | string[] };
        message?: string;
        errorText?: string;
      }
    | undefined;

  const code = maybeError?.code ?? maybeError?.response?.code;
  let message =
    typeof maybeError?.message === "string" ? maybeError.message : undefined;
  const fromResponse = maybeError?.response?.message;
  if (Array.isArray(fromResponse)) {
    message = fromResponse.join(" ");
  } else if (typeof fromResponse === "string") {
    message = fromResponse;
  }
  if (code) return { code, message };

  if (typeof maybeError?.errorText === "string" && maybeError.errorText) {
    try {
      const parsed = JSON.parse(maybeError.errorText) as {
        code?: string;
        message?: string | string[];
      };
      const parsedMessage = Array.isArray(parsed.message)
        ? parsed.message.join(" ")
        : parsed.message;
      return { code: parsed.code, message: parsedMessage };
    } catch {
      return { code: undefined, message };
    }
  }
  return { code: undefined, message };
}

export async function createCustomerPayment(
  customerId: string,
  data: CreateCustomerPaymentRequest
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/customers/${customerId}/payments`,
      data
    );
    return response;
  } catch (error) {
    console.error(
      "❌ Server Action - Failed to create customer payment:",
      error
    );
    throw error;
  }
}

export async function exportPaymentReceiptPdf(
  paymentId: string,
  options?: { timeZone?: string }
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {

    const endpoint = `/reports/payment-receipt/export/pdf`;
    const { arrayBuffer, headers } = await apiClient.postBinary(
      endpoint,
      {
        paymentId,
        ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
      },
      "application/pdf"
    );

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ?? `recibo-pago-${paymentId}.pdf`;

    const base64 = Buffer.from(arrayBuffer).toString("base64");


    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error(
      "❌ Server Action - Error exporting payment receipt PDF:",
      error
    );
    throw error;
  }
}

export async function createCustomerRefund(
  customerId: string,
  data: CreateCustomerPaymentRequest
): Promise<any> {
  try {
    const response = await apiClient.post(
      `/customers/${customerId}/refunds`,
      data
    );
    return response;
  } catch (error) {
    console.error(
      "❌ Server Action - Failed to create customer refund:",
      error
    );
    throw error;
  }
}

export async function reversePayment(
  paymentId: string,
  data: ReversePaymentRequest
): Promise<ReversePaymentActionResult> {
  try {
    return await apiClient.post(`/payments/${paymentId}/reverse`, data);
  } catch (error) {
    console.error("❌ Server Action - Failed to reverse payment:", error);
    const parsed = parseLegacyCodeFromActionError(error);
    if (parsed.code === LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE) {
      return {
        manualRequired: true,
        code: LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE,
        message:
          parsed.message ||
          "Legacy payment without allocations cannot be auto-reversed. Use manual accounting reversal.",
      };
    }
    throw error;
  }
}

export async function manualReversePayment(
  paymentId: string,
  data: ManualPaymentReversalRequest
): Promise<any> {
  try {
    return await apiClient.post(`/payments/${paymentId}/manual-reversal`, data);
  } catch (error) {
    console.error(
      "❌ Server Action - Failed to manually reverse payment:",
      error
    );
    throw error;
  }
}
