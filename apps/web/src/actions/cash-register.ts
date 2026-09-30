"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  CashMovement,
  CashMovementsResponse,
  CashRegister,
  CashRegistersResponse,
  CashSession,
  CashSessionsResponse,
  CloseCashSessionRequest,
  CreateCashMovementRequest,
  OpenCashSessionRequest,
} from "@esli-cosmetics/types";
import { revalidatePath } from "next/cache";
import { formatDateTimeWithTimezone } from "@esli-cosmetics/utils";
import { getCurrentUser } from "@/actions/auth";

const apiClient = new ServerApiClient();

export async function getCashRegisters(params?: {
  locationId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<CashRegistersResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.locationId) {
      searchParams.set("locationId", params.locationId);
    }
    if (params?.isActive !== undefined) {
      searchParams.set("isActive", params.isActive.toString());
    }
    if (params?.search) searchParams.set("search", params.search);
    if (params?.page) searchParams.set("page", params.page.toString());
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/cash-registers?${queryString}`
      : "/cash-registers";

    const response = await apiClient.get(endpoint);

    // Handle both paginated and non-paginated responses
    if (response.data && response.pagination) {
      return {
        data: response.data,
        pagination: {
          page: response.pagination.page || 1,
          limit: response.pagination.limit || 10,
          total: response.pagination.total || 0,
          total_pages: response.pagination.totalPages || 0,
          has_next: response.pagination.hasNext || false,
          has_prev: response.pagination.hasPrev || false,
        },
      };
    }

    // Fallback for non-paginated response
    const data = Array.isArray(response) ? response : response.data || [];
    return {
      data,
      pagination: {
        page: params?.page || 1,
        limit: params?.limit || 10,
        total: data.length,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    };
  } catch (error) {
    console.error("Error fetching cash registers:", error);
    throw new Error("Failed to fetch cash registers");
  }
}

export async function getCashRegister(id: string): Promise<CashRegister> {
  try {
    const response = await apiClient.get(`/cash-registers/${id}`);
    return response;
  } catch (error) {
    console.error("Error fetching cash register:", error);
    throw new Error("Failed to fetch cash register");
  }
}

export async function getCurrentCashSession(): Promise<CashSession | null> {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser?.employee?.id) {
      return null;
    }

    let response: CashSession | null = null;
    try {
      response = await apiClient.get("/cash-sessions/current");
    } catch (error: any) {
      if (
        error instanceof SyntaxError ||
        error?.message?.includes("Unexpected end of JSON input")
      ) {
        return null;
      }
      throw error;
    }

    if (!response) return null;
    if (typeof response === "object" && Object.keys(response).length === 0)
      return null;
    return response;
  } catch (error: any) {
    if (error?.status === 400 || error?.status === 404) {
      return null;
    }
    console.error("Error fetching current cash session:", error);
    return null;
  }
}

export async function getCashSession(id: string): Promise<CashSession> {
  try {
    const response = await apiClient.get(`/cash-sessions/${id}`);
    return response;
  } catch (error) {
    console.error("Error fetching cash session:", error);
    throw new Error("Failed to fetch cash session");
  }
}

export async function openCashRegisterSession(
  data: OpenCashSessionRequest
): Promise<CashSession> {
  try {
    // Get current user to retrieve employee ID
    const currentUser = await getCurrentUser();

    if (!currentUser?.employee?.id) {
      throw new Error(
        "User must be associated with an employee to open a cash session"
      );
    }

    const openedAt = data.openedAt;

    // Include employeeId and openedAt in the request body
    const response = await apiClient.post("/cash-sessions/open", {
      ...data,
      employeeId: currentUser.employee.id,
      openedAt,
    });
    revalidatePath("/sales/pos/register");
    return response;
  } catch (error) {
    console.error("Error opening cash session:", error);
    throw error;
  }
}

export async function closeCashRegisterSession(
  sessionId: string,
  data: CloseCashSessionRequest
): Promise<CashSession> {
  try {
    // Use provided datetime (should be generated on client with user timezone)
    // Fallback to server timezone if not provided (not ideal, but for backward compatibility)
    const closedAt = data.closedAt;

    const response = await apiClient.post(`/cash-sessions/${sessionId}/close`, {
      ...data,
      closedAt,
    });
    revalidatePath("/sales/pos/register");
    return response;
  } catch (error) {
    console.error("Error closing cash session:", error);
    throw error;
  }
}

export async function getCashMovements(params?: {
  cashSessionId?: string;
  type?: "IN" | "OUT";
}): Promise<CashMovement[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.cashSessionId) {
      searchParams.set("cashSessionId", params.cashSessionId);
    }
    if (params?.type) searchParams.set("type", params.type);

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/cash-movements?${queryString}`
      : "/cash-movements";

    const response = await apiClient.get(endpoint);
    return response.data || response || [];
  } catch (error) {
    console.error("Error fetching cash movements:", error);
    throw new Error("Failed to fetch cash movements");
  }
}

export async function createCashRegisterMovement(
  data: CreateCashMovementRequest
): Promise<CashMovement> {
  try {
    const response = await apiClient.post("/cash-movements", data);
    revalidatePath("/sales/pos/register");
    return response;
  } catch (error) {
    console.error("Error creating cash movement:", error);
    throw error;
  }
}

// CRUD operations for cash registers
export async function createCashRegister(data: {
  locationId?: string;
  name: string;
  code?: string;
  isActive?: boolean;
}): Promise<CashRegister> {
  try {
    const response = await apiClient.post("/cash-registers", data);
    revalidatePath("/admin/cash-registers");
    revalidatePath("/sales/pos/register");
    return response;
  } catch (error) {
    console.error("Error creating cash register:", error);
    throw error;
  }
}

export async function updateCashRegister(
  id: string,
  data: {
    locationId?: string;
    name?: string;
    code?: string;
    isActive?: boolean;
  }
): Promise<CashRegister> {
  try {
    const response = await apiClient.patch(`/cash-registers/${id}`, data);
    revalidatePath("/admin/cash-registers");
    revalidatePath("/sales/pos/register");
    return response;
  } catch (error) {
    console.error("Error updating cash register:", error);
    throw error;
  }
}

export async function deleteCashRegister(id: string): Promise<void> {
  try {
    await apiClient.delete(`/cash-registers/${id}`);
    revalidatePath("/admin/cash-registers");
    revalidatePath("/sales/pos/register");
  } catch (error) {
    console.error("Error deleting cash register:", error);
    throw error;
  }
}

// Export cash session PDF
export async function exportCashSessionPdf(
  sessionId: string,
  options?: { timeZone?: string }
): Promise<{ fileName: string; base64: string; mimeType: string }> {
  try {
    const endpoint = `/reports/cash-sessions/export/pdf`;
    const { arrayBuffer, headers } = await apiClient.postBinary(endpoint, {
      sessionId,
      ...(options?.timeZone ? { timeZone: options.timeZone } : {}),
    });

    const cd = headers.get("Content-Disposition") ?? null;
    const fileName =
      cd?.match(/filename="([^"]+)"/)?.[1] ?? `reporte-caja-${sessionId}.pdf`;

    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return {
      fileName,
      base64,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error(
      "❌ Server Action - Error exporting cash session PDF:",
      error
    );
    throw error;
  }
}

export async function getCashSessions(params?: {
  cashRegisterId?: string;
  employeeId?: string;
  closedBy?: string;
  status?: string;
  locationId?: string;
}): Promise<CashSession[]> {
  try {
    const searchParams = new URLSearchParams();
    if (params?.cashRegisterId)
      searchParams.set("cashRegisterId", params.cashRegisterId);
    if (params?.employeeId) searchParams.set("employeeId", params.employeeId);
    if (params?.closedBy) searchParams.set("closedBy", params.closedBy);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.locationId) searchParams.set("locationId", params.locationId);

    const queryString = searchParams.toString();
    const endpoint = queryString
      ? `/cash-sessions?${queryString}`
      : "/cash-sessions";

    const response = await apiClient.get(endpoint);
    return response.data || response || [];
  } catch (error) {
    console.error("Error fetching cash sessions:", error);
    throw new Error("Failed to fetch cash sessions");
  }
}
