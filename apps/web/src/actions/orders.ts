"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export interface CreateOrderItem {
  productVariantId: string;
  priceTypeId?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  // [KIT INTEGRATION]
  type?: "KIT" | "STANDARD"; // Identify if the item is a KIT
  kitItems?: Array<{
    productVariantId: string;
    quantity: number;
  }>;
}

export interface CreatePayment {
  paymentType: string;
  provider?: string;
  amount: number;
  transactionReference?: string;
}

export interface CreateOrderRequest {
  customerId?: string;
  branchId?: string | null;
  locationId: string;
  sellerId?: string;
  cashierId: string;
  cashSessionId?: string;
  discountCodeId?: string;
  discountCodeValue?: number;
  manualDiscount?: number;
  itemsDiscountTotal?: number;
  discountAmount?: number;
  includeTax: boolean;
  items: CreateOrderItem[];
  payments: CreatePayment[];
  paymentMethod?: "CASH" | "CREDIT";
  creditType?: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";
  paymentFrequency?: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
  durationDays?: number;
  firstDueDate?: string;
  initialPayment?: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  branchId: string;
  locationId: string;
  employeeId?: string;
  status?: string;
  totalAmount: number;
  subtotal: number;
  taxes: number;
  discountCodeValue?: number;
  manualDiscount?: number;
  itemsDiscountTotal?: number;
  discountAmount?: number;
  createdAt: string;
  items?: Array<{
    id: string;
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    discountAmount: number;
    taxAmount: number;
    lineTotal: number;
    annulledQuantity?: number;
    annulledAmount?: number;
    annulledAt?: string | null;
    annulledBy?: string | null;
    annulmentReason?: string | null;
    annulments?: Array<{
      id: string;
      quantity: number;
      amount: number;
      reason?: string | null;
      createdAt: string;
      createdBy: string;
      creator?: {
        id: string;
        name: string;
      } | null;
    }>;
    productVariant?: {
      id: string;
      name: string;
      sku?: string;
      barcode?: string;
      product?: {
        id: string;
        name: string;
        brand?: {
          id: string;
          name: string;
        };
        // [KIT INTEGRATION]
        type?: "KIT" | "STANDARD";
        kitItems?: Array<{
          productVariantId: string;
          quantity: number;
          productVariant?: {
            id: string;
            name: string;
            sku?: string;
          };
        }>;
      };
    };
  }>;
  payments?: Array<{
    id: string;
    paymentType: string;
    provider?: string;
    amount: number;
    transactionReference?: string;
    creditInstallmentId?: string | null;
    status?: "POSTED" | "REVERSED";
    reversedAt?: string | null;
  }>;
  customer?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  seller?: {
    id: string;
    name: string;
  };
  cashier?: {
    id: string;
    name: string;
  };
  location?: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  cashSession?: {
    id: string;
    status: string;
    closedAt?: string | null;
  };
  paymentMethod?: "CASH" | "CREDIT";
  credit?: {
    id: string;
    creditType: string;
    paymentFrequency: string;
    durationDays: number | null;
    installmentCount: number;
    principalAmount: number;
    outstandingAmount: number;
    firstDueDate: string;
    lastDueDate: string;
    status: string;
    installments?: Array<{
      id: string;
      installmentNo: number;
      dueDate: string;
      amount: number;
      paidAmount: number;
      status: string;
    }>;
  };
  adjustments?: Array<{
    id: string;
    type: string;
    amount: number;
    reason?: string | null;
    createdAt: string;
    createdBy: string;
    creator?: {
      id: string;
      name: string;
    } | null;
  }>;
}

export interface AnnulOrderItemRequest {
  quantity: number;
  reason?: string;
  refundMethod?: "CASH" | "NONE";
}

export async function annulOrderItem(
  orderId: string,
  orderItemId: string,
  data: AnnulOrderItemRequest
): Promise<Order> {
  try {
    const order: Order = await apiClient.post(
      `/orders/${orderId}/items/${orderItemId}/annul`,
      data
    );
    return order;
  } catch (error) {
    console.error("Error annulling order item:", error);
    throw error;
  }
}

export interface BulkAnnulOrderItemsRequest {
  items: Array<{
    orderItemId: string;
    quantity: number;
  }>;
  reason?: string;
  refundMethod?: "CASH" | "NONE";
}

export async function bulkAnnulOrderItems(
  orderId: string,
  data: BulkAnnulOrderItemsRequest
): Promise<Order> {
  try {
    const order: Order = await apiClient.post(
      `/orders/${orderId}/items/bulk-annul`,
      data
    );
    return order;
  } catch (error) {
    console.error("Error bulk annulling order items:", error);
    throw error;
  }
}

export async function createOrder(data: CreateOrderRequest): Promise<Order> {
  try {

    const order: Order = await apiClient.post("/orders", data);

    if (!order?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return order;
  } catch (error) {
    console.error("❌ Server Action - Error creating order:", error);
    throw error;
  }
}

export async function getOrder(id: string): Promise<Order | null> {
  try {

    const order: Order = await apiClient.get(`/orders/${id}`);

    if (!order?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return order;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("❌ Server Action - Error fetching order:", error);
    return null;
  }
}

export interface OrdersResponse {
  data: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface GetOrdersParams {
  orderNumber?: string;
  locationId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export async function getOrders(
  params: GetOrdersParams = {}
): Promise<OrdersResponse> {
  try {

    const queryParams = new URLSearchParams();
    if (params.orderNumber) {
      queryParams.append("orderNumber", params.orderNumber);
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
    const url = `/orders${queryString ? `?${queryString}` : ""}`;

    const response: OrdersResponse = await apiClient.get(url);


    return response;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("❌ Server Action - Error fetching orders:", error);
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

export async function annulOrder(id: string): Promise<Order> {
  try {

    const order: Order = await apiClient.patch(`/orders/${id}/annul`, {});

    if (!order?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return order;
  } catch (error) {
    console.error("❌ Server Action - Error annulling order:", error);
    throw error;
  }
}

export async function approveOrder(id: string): Promise<Order> {
  try {

    const order: Order = await apiClient.patch(`/orders/${id}/approve`, {});

    if (!order?.id) {
      throw new Error("Invalid response format: missing required fields");
    }


    return order;
  } catch (error) {
    console.error("❌ Server Action - Error approving order:", error);
    throw error;
  }
}

// Export receipt PDF by orderId
export async function exportReceiptPdf(
  orderId: string,
  options?: { timeZone?: string }
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {

    const endpoint = `/reports/receipt/export/pdf`;
    const { arrayBuffer, headers } = await apiClient.postBinary(endpoint, {
      orderId,
      ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
    });

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ?? `recibo-${orderId}.pdf`;

    const base64 = Buffer.from(arrayBuffer).toString("base64");


    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error("❌ Server Action - Error exporting receipt PDF:", error);
    throw error;
  }
}

export interface PayInstallmentRequest {
  installmentId: string;
  amount: number;
  paymentType: "CASH" | "CARD" | "TRANSFER";
  provider?: string;
  transactionReference?: string;
}

export interface PaymentItem {
  paymentType: "CASH" | "CARD" | "TRANSFER";
  amount: number;
  provider?: string;
  transactionReference?: string;
}

export interface PayOrderRequest {
  payments: PaymentItem[];
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

export async function payInstallment(
  orderId: string,
  installmentId: string,
  data: PayInstallmentRequest
): Promise<Order> {
  try {
    const response: Order = await apiClient.post(
      `/orders/${orderId}/installments/${installmentId}/pay`,
      data
    );
    return response;
  } catch (error) {
    console.error("Error paying installment:", error);
    throw error;
  }
}

export async function payOrder(
  orderId: string,
  data: PayOrderRequest
): Promise<Order> {
  try {
    const response: Order = await apiClient.post(
      `/orders/${orderId}/pay`,
      data
    );
    return response;
  } catch (error) {
    console.error("Error paying order:", error);
    throw error;
  }
}

export async function exportInstallmentReceiptPdf(
  installmentId: string,
  options?: { timeZone?: string }
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {

    const endpoint = `/reports/installment-receipt/export/pdf`;
    const { arrayBuffer, headers } = await apiClient.postBinary(
      endpoint,
      {
        installmentId,
        ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
      },
      "application/pdf"
    );

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ??
      `recibo-cuota-${installmentId}.pdf`;

    const base64 = Buffer.from(arrayBuffer).toString("base64");


    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error(
      "❌ Server Action - Error exporting installment receipt PDF:",
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

export async function reversePayment(
  paymentId: string,
  data: ReversePaymentRequest
): Promise<ReversePaymentActionResult> {
  try {
    return await apiClient.post(`/payments/${paymentId}/reverse`, data);
  } catch (error) {
    console.error("Error reversing payment:", error);
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
    console.error("Error on manual payment reversal:", error);
    throw error;
  }
}
