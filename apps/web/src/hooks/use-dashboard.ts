"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getDashboardStats,
  getDashboardSalesTrend,
  getDashboardRevenue,
  getDashboardTopProducts,
  getDashboardStockInCost,
} from "@/actions/dashboard";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: (locationId?: string) =>
    [...dashboardKeys.all, "stats", locationId ?? "all"] as const,
  salesTrend: (p: { from: string; to: string; locationId?: string }) =>
    [...dashboardKeys.all, "sales-trend", p] as const,
  revenue: (p: { from: string; to: string; branchId?: string }) =>
    [...dashboardKeys.all, "revenue", p] as const,
  topProducts: (p: { from: string; to: string; locationId?: string }) =>
    [...dashboardKeys.all, "top-products", p] as const,
  stockInCost: (p: { from: string; to: string; locationId?: string }) =>
    [...dashboardKeys.all, "stock-in-cost", p] as const,
};

export function useDashboardStats(locationId?: string) {
  return useQuery({
    queryKey: dashboardKeys.stats(locationId),
    queryFn: () => getDashboardStats(locationId),
    staleTime: 0,
  });
}

export function useDashboardSalesTrend(params: {
  from: string;
  to: string;
  locationId?: string;
}) {
  return useQuery({
    queryKey: dashboardKeys.salesTrend(params),
    queryFn: () => getDashboardSalesTrend(params),
    enabled: Boolean(params.from && params.to),
    staleTime: 0,
  });
}

export function useDashboardRevenue(params: {
  from: string;
  to: string;
  branchId?: string;
}) {
  return useQuery({
    queryKey: dashboardKeys.revenue(params),
    queryFn: () => getDashboardRevenue(params),
    enabled: Boolean(params.from && params.to),
    staleTime: 0,
  });
}

export function useDashboardTopProducts(params: {
  from: string;
  to: string;
  locationId?: string;
}) {
  return useQuery({
    queryKey: dashboardKeys.topProducts(params),
    queryFn: () => getDashboardTopProducts(params),
    enabled: Boolean(params.from && params.to),
    staleTime: 0,
  });
}

export function useDashboardStockInCost(params: {
  from: string;
  to: string;
  locationId?: string;
}) {
  return useQuery({
    queryKey: dashboardKeys.stockInCost(params),
    queryFn: () => getDashboardStockInCost(params),
    enabled: Boolean(params.from && params.to),
    staleTime: 0,
  });
}

/** UTC calendar month as YYYY-MM-DD (first and last day). */
export function getDefaultDashboardChartRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1));
  const last = new Date(Date.UTC(y, m + 1, 0));
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}
