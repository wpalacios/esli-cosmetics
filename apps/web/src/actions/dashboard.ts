"use server";

import { serverApiClient as apiClient } from "@/lib/api/server-api-client";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

export interface DashboardStatsResponse {
  activeStores: number;
  salesUnits: {
    today: number;
    month: number;
  };
  salesAmount: {
    today: number;
    month: number;
  };
  inventory: {
    items: number;
    value: number;
    lowStock: number;
  };
  customersTotal: number;
}

export async function getDashboardStats(
  locationId?: string
): Promise<DashboardStatsResponse> {
  try {
    const searchParams = new URLSearchParams();
    if (locationId) {
      searchParams.append("locationId", locationId);
    }

    const query = searchParams.toString();
    const endpoint = query
      ? "/reports/dashboard/stats?" + query
      : "/reports/dashboard/stats";
    return apiClient.get(endpoint);
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching dashboard stats:", error);
    return {
      activeStores: 0,
      salesUnits: { today: 0, month: 0 },
      salesAmount: { today: 0, month: 0 },
      inventory: { items: 0, value: 0, lowStock: 0 },
      customersTotal: 0,
    };
  }
}

export interface DashboardSalesTrendPoint {
  date: string;
  sales: number;
  count: number;
}

export interface DashboardRevenuePoint {
  date: string;
  revenue: number;
}

export interface DashboardTopProductRow {
  name: string;
  quantity: number;
  revenue: number;
}

export interface DashboardStockInCostPoint {
  date: string;
  cost: number;
}

export async function getDashboardSalesTrend(params: {
  from: string;
  to: string;
  locationId?: string;
}): Promise<DashboardSalesTrendPoint[]> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("from", params.from);
    searchParams.append("to", params.to);
    if (params.locationId) {
      searchParams.append("locationId", params.locationId);
    }
    return apiClient.get(
      "/reports/dashboard/sales-trend?" + searchParams.toString()
    );
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching dashboard sales trend:", error);
    return [];
  }
}

export async function getDashboardRevenue(params: {
  from: string;
  to: string;
  branchId?: string;
}): Promise<DashboardRevenuePoint[]> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("from", params.from);
    searchParams.append("to", params.to);
    if (params.branchId) {
      searchParams.append("branchId", params.branchId);
    }
    return apiClient.get(
      "/reports/dashboard/revenue?" + searchParams.toString()
    );
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching dashboard revenue:", error);
    return [];
  }
}

export async function getDashboardTopProducts(params: {
  from: string;
  to: string;
  locationId?: string;
}): Promise<DashboardTopProductRow[]> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("from", params.from);
    searchParams.append("to", params.to);
    if (params.locationId) {
      searchParams.append("locationId", params.locationId);
    }
    return apiClient.get(
      "/reports/dashboard/top-products?" + searchParams.toString()
    );
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching dashboard top products:", error);
    return [];
  }
}

export async function getDashboardStockInCost(params: {
  from: string;
  to: string;
  locationId?: string;
}): Promise<DashboardStockInCostPoint[]> {
  try {
    const searchParams = new URLSearchParams();
    searchParams.append("from", params.from);
    searchParams.append("to", params.to);
    if (params.locationId) {
      searchParams.append("locationId", params.locationId);
    }
    return apiClient.get(
      "/reports/dashboard/stock-in-cost?" + searchParams.toString()
    );
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching dashboard stock-in cost:", error);
    return [];
  }
}
