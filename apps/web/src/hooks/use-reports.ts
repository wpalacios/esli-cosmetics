"use client";

import { useCallback, useState, useEffect } from "react";
import type {
  ReportFilters,
  ReportPreviewResponse,
  SalesUiFilters,
  SalesItemsParams,
  SalesItemsResponse,
  SalesItemRow,
  CustomerItemRow,
  CustomerItemsParams,
  CustomerItemsResponse,
  StockMovementsPreviewFilters,
  ExportFile,
  PaginatedStockMovements,
  StockMovementPreviewRow,
} from "@esli-cosmetics/types";
import {
  previewCustomersReport,
  getCustomerItems,
  exportCustomersReportExcelBase64,
  exportCustomersReportPdfBase64,
  previewSalesByCustomerReport,
  exportSalesByCustomerReportExcelBase64,
  exportSalesByCustomerReportPdfBase64,
  previewSalesByProductReport,
  exportSalesByProductReportExcelBase64,
  exportSalesByProductReportPdfBase64,
  getSalesItems,
  exportStockMovementsPdfBase64,
  getStockMovementsPreview,
} from "@/actions/reports";
import { getReportExportMeta } from "@/lib/report-export-meta";

type ExportResponse = { fileName: string; base64: string };

/** Download a base64-encoded file (helper) */
function downloadBase64(
  fileName: string,
  base64: string,
  mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
) {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++)
    byteNumbers[i] = byteChars.charCodeAt(i);
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Returns true when at least one meaningful filter value is set (ignoring
 * pagination / export-meta keys like page, limit, maxRows).
 */
const hasActiveFilters = (filters: object): boolean =>
  Object.entries(filters).some(
    ([k, v]) =>
      !["page", "limit", "maxRows"].includes(k) &&
      v !== undefined &&
      v !== "" &&
      v !== null
  );

/**
 * Convert user's local date to UTC date string (YYYY-MM-DD) for backend queries
 *
 * When a user selects a date in their local timezone, we need to find all orders
 * that would display as that date when converted from UTC to their timezone.
 *
 * Strategy: Calculate the UTC date range that covers the selected local day.
 * Since the backend will query for the full UTC day (00:00:00 to 23:59:59 UTC),
 * we need to ensure the UTC date we send will capture all orders that fall within
 * the user's local day.
 *
 * Example: User in UTC-5 selects 29/01/2026
 * - Local day: 29/01/2026 00:00:00 UTC-5 to 29/01/2026 23:59:59 UTC-5
 * - UTC equivalent: 29/01/2026 05:00:00 UTC to 30/01/2026 04:59:59 UTC
 * - To capture this, we need to query both UTC days: 29/01 and 30/01
 *
 * Solution: Send the UTC date that represents the start of the local day.
 * The backend will query that UTC day, and we'll also need to include the next
 * UTC day to catch orders that fall in the latter part of the local day.
 *
 * Actually, simpler: Send the date range that spans the local day in UTC.
 * For "from" date, send the UTC date of the start of the local day.
 * For "to" date, send the UTC date of the end of the local day.
 */
function toDateISO(value?: Date | string): string | undefined {
  if (!value) return undefined;

  let localDate: Date;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    localDate = value;
  } else if (typeof value === "string" && value.trim() !== "") {
    // Parse YYYY-MM-DD string as local date
    const parts = value.trim().split("-").map(Number);
    if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
      const [y, m, d] = parts;
      if (y && m && d) {
        // Create date in local timezone (start of day)
        localDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        return value.trim();
      }
    } else {
      return value.trim();
    }
  } else {
    return undefined;
  }

  // Calculate what UTC date this local date represents
  // When user selects Jan 29 in UTC-5:
  // - Local Jan 29 00:00:00 = UTC Jan 29 05:00:00 (still Jan 29 in UTC)
  // - Local Jan 29 23:59:59 = UTC Jan 30 04:59:59 (Jan 30 in UTC)
  // So we need to query both Jan 29 and Jan 30 in UTC

  // Create a date object for the start of the local day
  const localStart = new Date(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    0,
    0,
    0,
    0
  );

  // Get the UTC date components from this local date
  // The Date object already represents a moment in time, we just need UTC components
  const utcDate = localStart;

  // Return the UTC date (YYYY-MM-DD)
  // The backend will expand the "to" date to include the next UTC day
  // to ensure we capture orders that fall in the latter part of the local day
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utcDate.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Simple debounce hook */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

//Customers export (preview/export)

export type CustomersUiFilters = {
  name?: string;
  from?: Date | string;
  to?: Date | string;
};
type CustomersHookFilters = ReportFilters | CustomersUiFilters;

function normalizeCustomerFilters(input: CustomersHookFilters): ReportFilters {
  const anyInput = input as any;
  const rawSearch: unknown =
    anyInput.search !== undefined ? anyInput.search : anyInput.name;
  const orderNumber =
    typeof rawSearch === "string" ? rawSearch.trim() || undefined : undefined;
  const from = toDateISO(anyInput.from);
  const to = toDateISO(anyInput.to);

  const result: ReportFilters = {
    ...(orderNumber ? { orderNumber } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  return result;
}

export function useCustomersExportReportExcel(options?: { pageSize?: number }) {
  const [preview, setPreview] = useState<CustomerItemsResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingExportPdf, setLoadingExportPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreview = useCallback(async (filters: CustomersHookFilters) => {
    setLoadingPreview(true);
    setError(null);
    try {
      const mapped = normalizeCustomerFilters(filters);
      const data = await previewCustomersReport(mapped);
      setPreview(data);
      return data;
    } catch (e: any) {
      console.error("previewCustomersReport failed", e);
      setError(e?.message ?? "Preview error");
      throw e;
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const exportReportExcel = useCallback(
    async (filters: CustomersHookFilters) => {
      setLoadingExport(true);
      setError(null);
      try {
        const mapped = normalizeCustomerFilters(filters);
        const exportFilters =
          !hasActiveFilters(mapped) && options?.pageSize
            ? { ...mapped, maxRows: options.pageSize }
            : mapped;
        const { fileName, base64 }: ExportResponse =
          await exportCustomersReportExcelBase64(exportFilters);
        downloadBase64(fileName, base64);
        return { fileName };
      } catch (e: any) {
        console.error("exportCustomersReportExcelBase64 failed", e);
        setError(e?.message ?? "Export error");
        throw e;
      } finally {
        setLoadingExport(false);
      }
    },
    [options?.pageSize]
  );

  const exportReportPdf = useCallback(
    async (filters: CustomersHookFilters) => {
      setLoadingExportPdf(true);
      setError(null);
      try {
        const mapped = normalizeCustomerFilters(filters);
        const exportFilters =
          !hasActiveFilters(mapped) && options?.pageSize
            ? { ...mapped, maxRows: options.pageSize }
            : mapped;
        const meta = getReportExportMeta();
        const { fileName, base64 }: ExportResponse =
          await exportCustomersReportPdfBase64({
            ...exportFilters,
            ...meta,
          });
        downloadBase64(fileName, base64, "application/pdf");
        return { fileName };
      } catch (e: any) {
        console.error("exportCustomersReportPdfBase64 failed", e);
        setError(e?.message ?? "Export PDF error");
        throw e;
      } finally {
        setLoadingExportPdf(false);
      }
    },
    [options?.pageSize]
  );

  return {
    preview,
    loadingPreview,
    loadingExport,
    loadingExportPdf,
    loadingAnyExport: loadingExport || loadingExportPdf,
    error,
    getPreview,
    exportReportExcel,
    exportReportPdf,
    reset: () => setPreview(null),
  };
}

/**
 * Manages reactive state for the Customers report table including server-side pagination.
 */
export function useCustomersList(initial?: {
  page?: number;
  limit?: number;
  initialItems?: CustomerItemRow[];
  initialTotal?: number;
  initialTotalPages?: number;
}) {
  const [items, setItems] = useState<CustomerItemRow[]>(
    initial?.initialItems ?? []
  );
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({
    page: initial?.page ?? 1,
    limit: initial?.limit ?? 10,
    total: initial?.initialTotal ?? 0,
    totalPages: initial?.initialTotalPages ?? 0,
  });
  const [filters, setFilters] = useState<CustomersUiFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedOnce, setFetchedOnce] = useState(!!initial?.initialItems);

  const load = useCallback(
    async (override?: {
      filters?: CustomersUiFilters;
      page?: number;
      limit?: number;
    }) => {
      const nextFilters = override?.filters ?? filters;
      const nextPage = override?.page ?? pagination.page;
      const nextLimit = override?.limit ?? pagination.limit;
      setLoading(true);
      setError(null);
      try {
        const mapped = normalizeCustomerFilters(nextFilters);
        const params: CustomerItemsParams = {
          page: nextPage,
          limit: nextLimit,
        };
        if (mapped.orderNumber) params.search = mapped.orderNumber;
        if (mapped.from) params.from = mapped.from;
        if (mapped.to) params.to = mapped.to;
        const res: CustomerItemsResponse = await getCustomerItems(params);
        const { page, limit, total, totalPages } = res.pagination;
        setItems(res.data);
        setPagination({ page, limit, total, totalPages });
        setFilters(nextFilters);
        setFetchedOnce(true);
        return res;
      } catch (e: any) {
        console.error("getCustomerItems failed", e);
        setError(e?.message ?? "Load error");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.page, pagination.limit]
  );

  const search = useCallback(
    async (nextFilters: CustomersUiFilters): Promise<void> => {
      await load({ filters: nextFilters, page: 1 });
    },
    [load]
  );

  const setPage = useCallback(
    async (page: number): Promise<void> => {
      await load({ page });
    },
    [load]
  );

  const setLimit = useCallback(
    async (limit: number): Promise<void> => {
      await load({ limit, page: 1 });
    },
    [load]
  );

  const refresh = useCallback(async (): Promise<void> => {
    await load();
  }, [load]);

  return {
    items,
    pagination: {
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      totalItems: pagination.total,
      onPageChange: setPage,
    },
    pageSize: pagination.limit,
    loading,
    error,
    search,
    setPage,
    setLimit,
    refresh,
    filters,
    fetchedOnce,
  };
}

//Sales by customer (preview/export)

type SalesHookFilters = ReportFilters | SalesUiFilters;

function normalizeSalesFilters(input: SalesHookFilters): ReportFilters {
  const anyInput = input as any;

  // DEBUG: show incoming dropdown/search values for sales-by-customer
  console.debug("[normalizeSalesFilters] input:", {
    search: anyInput.search,
    customerName: anyInput.customerName,
    orderNumberCandidate:
      typeof anyInput.search === "string" ? anyInput.search.trim() : undefined,
    branchId: anyInput.branchId,
    customerId: anyInput.customerId,
    employeeId: anyInput.employeeId,
  });

  const rawSearch =
    anyInput.search !== undefined ? anyInput.search : anyInput.customerName;
  const orderNumber =
    typeof rawSearch === "string" ? rawSearch.trim() || undefined : undefined;
  const from = toDateISO(anyInput.from);
  const to = toDateISO(anyInput.to);

  const branchId =
    typeof anyInput.branchId === "string"
      ? (anyInput.branchId as string).trim() || undefined
      : typeof anyInput.branchId === "number"
        ? String(anyInput.branchId)
        : undefined;

  const customerId =
    typeof anyInput.customerId === "string"
      ? (anyInput.customerId as string).trim() || undefined
      : typeof anyInput.customerId === "number"
        ? String(anyInput.customerId)
        : undefined;

  const employeeId =
    typeof anyInput.employeeId === "string"
      ? (anyInput.employeeId as string).trim() || undefined
      : typeof anyInput.employeeId === "number"
        ? String(anyInput.employeeId)
        : undefined;

  const paymentMethod =
    anyInput.paymentMethod === "CASH" || anyInput.paymentMethod === "CREDIT"
      ? anyInput.paymentMethod
      : undefined;

  const locationId =
    typeof anyInput.locationId === "string"
      ? (anyInput.locationId as string).trim() || undefined
      : typeof anyInput.locationId === "number"
        ? String(anyInput.locationId)
        : undefined;

  const orderStatus =
    typeof anyInput.orderStatus === "string"
      ? (anyInput.orderStatus as string).trim() || undefined
      : undefined;

  const result: ReportFilters = {
    ...(orderNumber ? { orderNumber } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(branchId ? { branchId } : {}),
    ...(customerId ? { customerId } : {}),
    ...(employeeId ? { employeeId } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(locationId ? { locationId } : {}),
    ...(orderStatus ? { orderStatus } : {}),
  };
  return result;
}

export function useSalesByCustomerExportExcel() {
  const [preview, setPreview] = useState<SalesItemsResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingExportPdf, setLoadingExportPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreview = useCallback(async (filters: SalesHookFilters) => {
    setLoadingPreview(true);
    setError(null);
    try {
      const mapped = normalizeSalesFilters(filters);
      const data = await previewSalesByCustomerReport(mapped);
      setPreview(data);
      return data;
    } catch (e: any) {
      console.error("previewSalesByCustomerReport failed", e);
      setError(e?.message ?? "Preview error");
      throw e;
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  const exportReportExcel = useCallback(async (filters: SalesHookFilters) => {
    setLoadingExport(true);
    setError(null);
    try {
      const mapped = normalizeSalesFilters(filters);
      const { fileName, base64 }: ExportResponse =
        await exportSalesByCustomerReportExcelBase64(mapped);
      downloadBase64(fileName, base64);
      return { fileName };
    } catch (e: any) {
      console.error("exportSalesByCustomerReportExcelBase64 failed", e);
      setError(e?.message ?? "Export error");
      throw e;
    } finally {
      setLoadingExport(false);
    }
  }, []);

  const exportReportPdf = useCallback(async (filters: SalesHookFilters) => {
    setLoadingExportPdf(true);
    setError(null);
    try {
      const mapped = normalizeSalesFilters(filters);
      const meta = getReportExportMeta();
      const { fileName, base64 }: ExportResponse =
        await exportSalesByCustomerReportPdfBase64({ ...mapped, ...meta });
      downloadBase64(fileName, base64, "application/pdf");
      return { fileName };
    } catch (e: any) {
      console.error("exportSalesByCustomerReportPdfBase64 failed", e);
      setError(e?.message ?? "Export PDF error");
      throw e;
    } finally {
      setLoadingExportPdf(false);
    }
  }, []);

  return {
    preview,
    loadingPreview,
    loadingExport,
    loadingExportPdf,
    loadingAnyExport: loadingExport || loadingExportPdf,
    error,
    getPreview,
    exportReportExcel,
    exportReportPdf,
    reset: () => setPreview(null),
  };
}

//Sales list (server-side pagination)

export type SalesListUiFilters = SalesUiFilters & {
  customerId?: string | number;
  orderNumber?: string;
  productName?: string;
  productVariantName?: string;
  productVariantSku?: string;
  brandId?: string;
  productId?: string;
  productVariantId?: string;
  paymentMethod?: "CASH" | "CREDIT";
  locationId?: string | number;
  orderStatus?: string;
};

function buildSalesItemsParams(
  input: SalesUiFilters,
  page?: number,
  limit?: number
): SalesItemsParams {
  // DEBUG: show relevant incoming values for the paginated items builder
  console.debug("[buildSalesItemsParams] input summary:", {
    search: (input as any).search,
    productName: (input as any).productName,
    productVariantName: (input as any).productVariantName,
    productVariantSku: (input as any).productVariantSku,
    brandId: (input as any).brandId,
    branchId: (input as any).branchId,
    employeeId: (input as any).employeeId,
  });

  const base: ReportFilters = normalizeSalesFilters(input);

  const params: SalesItemsParams = {};
  if (typeof page === "number") params.page = page;
  if (typeof limit === "number") params.limit = limit;

  const orderNumber = (base.orderNumber ??
    (typeof input.orderNumber === "string"
      ? input.orderNumber.trim()
      : undefined)) as string | undefined;
  if (orderNumber) params.orderNumber = orderNumber;

  if (base.from) params.from = base.from;
  if (base.to) params.to = base.to;
  if (base.branchId) params.branchId = base.branchId;
  if (base.customerId) params.customerId = base.customerId;
  if (base.employeeId) params.employeeId = base.employeeId;
  if (base.paymentMethod) params.paymentMethod = base.paymentMethod;
  if ((base as any).locationId)
    (params as any).locationId = (base as any).locationId;
  if ((base as any).orderStatus)
    (params as any).orderStatus = (base as any).orderStatus;

  const search =
    typeof (input as any).search === "string" &&
    (input as any).search.trim() !== ""
      ? (input as any).search.trim()
      : undefined;

  if (search) {
    const looksLikeOrderNumber =
      /^[A-Za-z]{2,}\d/.test(search) ||
      /^ORD-/i.test(search) ||
      /^ESL/i.test(search);

    if (looksLikeOrderNumber) {
      params.orderNumber = search;
    } else {
      params.productName = search;
      params.productVariantName = search;
      params.productVariantSku = search;
    }
  } else {
    if (
      typeof input.productName === "string" &&
      input.productName.trim() !== ""
    )
      params.productName = input.productName.trim();
    if (
      typeof input.productVariantName === "string" &&
      input.productVariantName.trim() !== ""
    )
      params.productVariantName = input.productVariantName.trim();
    if (
      typeof input.productVariantSku === "string" &&
      input.productVariantSku.trim() !== ""
    )
      params.productVariantSku = input.productVariantSku.trim();
  }

  if (typeof input.brandId === "string" && input.brandId.trim() !== "")
    params.brandId = input.brandId.trim();
  if (typeof input.productId === "string" && input.productId.trim() !== "")
    params.productId = input.productId.trim();
  if (
    typeof input.productVariantId === "string" &&
    input.productVariantId.trim() !== ""
  )
    params.productVariantId = input.productVariantId.trim();

  return params;
}

export function useSalesList(initial?: {
  page?: number;
  limit?: number;
  initialItems?: SalesItemRow[];
  initialTotal?: number;
  initialTotalPages?: number;
  reportType?: "customers" | "products";
}) {
  const [items, setItems] = useState<SalesItemRow[]>(
    initial?.initialItems ?? []
  );
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }>({
    page: initial?.page ?? 1,
    limit: initial?.limit ?? 10,
    total: initial?.initialTotal ?? 0,
    totalPages: initial?.initialTotalPages ?? 0,
  });
  const [filters, setFilters] = useState<SalesUiFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedOnce, setFetchedOnce] = useState(!!initial?.initialItems);

  const load = useCallback(
    async (override?: {
      filters?: SalesUiFilters;
      page?: number;
      limit?: number;
    }) => {
      const nextFilters = override?.filters ?? filters;
      const nextPage = override?.page ?? pagination.page;
      const nextLimit = override?.limit ?? pagination.limit;
      setLoading(true);
      setError(null);
      try {
        const params = buildSalesItemsParams(nextFilters, nextPage, nextLimit);
        console.debug("[useSalesList] getSalesItems params:", params);
        const res: SalesItemsResponse = await getSalesItems(
          params,
          initial?.reportType ?? "customers"
        );
        const { page, limit, total, totalPages } = res.pagination;
        setItems(res.data);
        setPagination({ page, limit, total, totalPages });
        setFilters(nextFilters);
        setFetchedOnce(true);
        return res;
      } catch (e: any) {
        console.error("getSalesItems failed", e);
        setError(e?.message ?? "Load error");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.page, pagination.limit]
  );

  const search = useCallback(
    async (nextFilters: SalesUiFilters): Promise<void> => {
      await load({ filters: nextFilters, page: 1 });
    },
    [load]
  );

  const setPage = useCallback(
    async (page: number): Promise<void> => {
      await load({ page });
    },
    [load]
  );

  const setLimit = useCallback(
    async (limit: number): Promise<void> => {
      await load({ limit, page: 1 });
    },
    [load]
  );

  const refresh = useCallback(async (): Promise<void> => {
    await load();
  }, [load]);

  const exportReportExcel = useCallback(async () => {
    const mapped = normalizeSalesFilters(filters);
    const exportFilters = !hasActiveFilters(mapped)
      ? { ...mapped, maxRows: pagination.limit }
      : mapped;
    const { fileName, base64 }: ExportResponse =
      await exportSalesByCustomerReportExcelBase64(exportFilters);
    downloadBase64(fileName, base64);
    return { fileName };
  }, [filters, pagination.limit]);

  const exportReportPdf = useCallback(async () => {
    const mapped = normalizeSalesFilters(filters);
    const exportFilters = !hasActiveFilters(mapped)
      ? { ...mapped, maxRows: pagination.limit }
      : mapped;
    const meta = getReportExportMeta();
    const { fileName, base64 }: ExportResponse =
      await exportSalesByCustomerReportPdfBase64({
        ...exportFilters,
        ...meta,
      });
    downloadBase64(fileName, base64, "application/pdf");
    return { fileName };
  }, [filters, pagination.limit]);

  return {
    items,
    pagination: {
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      totalItems: pagination.total,
      onPageChange: setPage,
    },
    pageSize: pagination.limit,
    loading,
    error,
    search,
    setPage,
    setLimit,
    refresh,
    exportReportExcel,
    exportReportPdf,
    filters,
    fetchedOnce,
  };
}

//Sales by product (preview/export) helpers
function normalizeSalesByProductFilters(
  input: ReportFilters | SalesUiFilters
): SalesItemsParams {
  const result: SalesItemsParams = {};

  const inputAny = input as any;
  // DEBUG: show incoming dropdown/search values for sales-by-product
  console.debug("[normalizeSalesByProductFilters] input:", {
    orderNumber: inputAny.orderNumber,
    branchId: inputAny.branchId,
    brandId: inputAny.brandId,
    employeeId: inputAny.employeeId,
    productName: inputAny.productName,
    productVariantName: inputAny.productVariantName,
    productVariantSku: inputAny.productVariantSku,
    search: inputAny.search,
  });

  const fromIso = toDateISO((input as ReportFilters).from);
  const toIso = toDateISO((input as ReportFilters).to);
  if (fromIso) result.from = fromIso;
  if (toIso) result.to = toIso;

  const keys: Array<
    keyof Omit<
      SalesItemsParams,
      "page" | "limit" | "from" | "to" | "paymentMethod"
    >
  > = [
    "orderNumber",
    "branchId",
    "customerId",
    "employeeId",
    "productName",
    "productVariantName",
    "productVariantSku",
    "brandId",
    "productId",
    "productVariantId",
    "locationId",
    "orderStatus",
  ];

  for (const k of keys) {
    const val = (input as any)[k];
    if (val !== undefined && val !== null) result[k] = String(val);
  }

  // Handle paymentMethod separately to preserve its union type
  const paymentMethod = (input as any).paymentMethod;
  if (paymentMethod === "CASH" || paymentMethod === "CREDIT") {
    result.paymentMethod = paymentMethod;
  }

  const search = (input as any).search;
  if (typeof search === "string" && search.trim() !== "") {
    const s = search.trim();
    if (result.productName === undefined) result.productName = s;
    if (result.productVariantName === undefined) result.productVariantName = s;
    if (result.productVariantSku === undefined) result.productVariantSku = s;

    const looksLikeOrderNumber =
      /^[A-Za-z]{2,}\d/.test(s) || /^ORD-/i.test(s) || /^ESL/i.test(s);

    if (looksLikeOrderNumber && result.orderNumber === undefined) {
      result.orderNumber = s;
    }
  }

  const _page = (input as ReportFilters).page;
  if (typeof _page === "number") result.page = _page;
  const _limit = (input as ReportFilters).limit;
  if (typeof _limit === "number") result.limit = _limit;

  return result;
}

export function useSalesByProductExport(options?: { pageSize?: number }) {
  const [preview, setPreview] = useState<SalesItemsResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingExportPdf, setLoadingExportPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPreview = useCallback(
    async (filters: ReportFilters | SalesUiFilters) => {
      setLoadingPreview(true);
      setError(null);
      try {
        const mapped = normalizeSalesByProductFilters(filters);
        const data = await previewSalesByProductReport(mapped);
        setPreview(data);
        return data;
      } catch (e: any) {
        console.error("previewSalesByProductReport failed", e);
        setError(e?.message ?? "Preview error");
        throw e;
      } finally {
        setLoadingPreview(false);
      }
    },
    []
  );

  const exportReportExcel = useCallback(
    async (filters: ReportFilters | SalesUiFilters) => {
      setLoadingExport(true);
      setError(null);
      try {
        const mapped = normalizeSalesByProductFilters(filters);
        console.debug("[useSalesByProductExport] export mapped", mapped);
        const exportFilters =
          !hasActiveFilters(mapped) && options?.pageSize
            ? { ...mapped, maxRows: options.pageSize }
            : mapped;
        const { fileName, base64 } =
          await exportSalesByProductReportExcelBase64(exportFilters);
        downloadBase64(fileName, base64);
        return { fileName };
      } catch (e: any) {
        console.error("exportSalesByProductReportExcelBase64 failed", e);
        setError(e?.message ?? "Export error");
        throw e;
      } finally {
        setLoadingExport(false);
      }
    },
    [options?.pageSize]
  );

  const exportReportPdf = useCallback(
    async (filters: ReportFilters | SalesUiFilters) => {
      setLoadingExportPdf(true);
      setError(null);
      try {
        const mapped = normalizeSalesByProductFilters(filters);
        const exportFilters =
          !hasActiveFilters(mapped) && options?.pageSize
            ? { ...mapped, maxRows: options.pageSize }
            : mapped;
        const meta = getReportExportMeta();
        const { fileName, base64 }: { fileName: string; base64: string } =
          await exportSalesByProductReportPdfBase64({
            ...exportFilters,
            ...meta,
          });
        downloadBase64(fileName, base64, "application/pdf");
        return { fileName };
      } catch (e: any) {
        console.error("exportSalesByProductReportPdfBase64 failed", e);
        setError(e?.message ?? "Export PDF error");
        throw e;
      } finally {
        setLoadingExportPdf(false);
      }
    },
    [options?.pageSize]
  );

  return {
    preview,
    loadingPreview,
    loadingExport,
    loadingExportPdf,
    loadingAnyExport: loadingExport || loadingExportPdf,
    error,
    getPreview,
    exportReportExcel,
    exportReportPdf,
    reset: () => setPreview(null),
  };
}

/** * HELPER: Normalizes UI filters to match Backend API contract
 */
function normalizeStockFilters(
  input: StockMovementsPreviewFilters
): StockMovementsPreviewFilters {
  return {
    ...input,
    // toDateISO must handle strings or Dates
    fromDate: input.fromDate ? toDateISO(input.fromDate) : undefined,
    toDate: input.toDate ? toDateISO(input.toDate) : undefined,

    // Convert empty strings from UI inputs to undefined for the API
    fromLocationId: input.fromLocationId || undefined,
    toLocationId: input.toLocationId || undefined,
    createdBy: input.createdBy || undefined,
    productId: input.productId || undefined,
    productVariantId: input.productVariantId || undefined,
    reference: input.reference?.trim() || undefined,
    movementType: input.movementType || undefined,

    /**
     * If an array of IDs is provided (e.g., for the 8-row audit batch),
     * it is preserved; otherwise, it's set to undefined.
     */
    movementsIds:
      input.movementsIds && input.movementsIds.length > 0
        ? input.movementsIds
        : undefined,
  };
}

/**
 * Manages reactive state for the Stock Movements table including server-side pagination.
 * * @param initial - Optional initial page and limit settings.
 * @returns table items, pagination metadata, and loading/error states.
 */
export function useStockMovementsList(initial?: {
  page?: number;
  limit?: number;
  initialItems?: StockMovementPreviewRow[];
  initialTotal?: number;
  initialTotalPages?: number;
}) {
  const [items, setItems] = useState<StockMovementPreviewRow[]>(
    initial?.initialItems ?? []
  );
  const [fetchedOnce, setFetchedOnce] = useState(!!initial?.initialItems);
  const [pagination, setPagination] = useState({
    page: initial?.page ?? 1,
    limit: initial?.limit ?? 10,
    total: initial?.initialTotal ?? 0,
    totalPages: initial?.initialTotalPages ?? 0,
  });
  const [filters, setFilters] = useState<StockMovementsPreviewFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (override?: {
      filters?: StockMovementsPreviewFilters;
      page?: number;
      limit?: number;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const nextFilters = override?.filters ?? filters;
        const nextPage = override?.page ?? pagination.page;
        const nextLimit = override?.limit ?? pagination.limit;

        const mapped = normalizeStockFilters({
          ...nextFilters,
          page: nextPage,
          limit: nextLimit,
        });

        const res: PaginatedStockMovements =
          await getStockMovementsPreview(mapped);

        setItems(res.data);
        setPagination(res.pagination);
        setFilters(nextFilters);
        setFetchedOnce(true);
        return res;
      } catch (e: any) {
        setError(e?.message ?? "Failed to load movements");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [filters, pagination.page, pagination.limit]
  );

  return {
    items,
    pagination: {
      currentPage: pagination.page,
      totalPages: pagination.totalPages,
      totalItems: pagination.total,
      onPageChange: (page: number) => load({ page }),
    },
    loading,
    error,
    filters,
    fetchedOnce,
    search: (nextFilters: StockMovementsPreviewFilters) =>
      load({ filters: nextFilters, page: 1 }),
    refresh: () => load(),
    setLimit: (limit: number) => load({ limit, page: 1 }),
  };
}

/**
 * Handles logic for generating and downloading the Stock Movement PDF.
 * * @logic Automatically strips 'page' and 'limit' to trigger the full report
 * or batch audit logic on the backend.
 */
export function useStockMovementsExport(options?: { pageSize?: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPdf = useCallback(
    async (filters: StockMovementsPreviewFilters) => {
      setLoading(true);
      setError(null);
      try {
        // 1. Extract pagination keys. Rest of filters (including movementsIds)
        // are sent to the PDF engine.
        const { page, limit, ...exportParams } = normalizeStockFilters(filters);
        const meta = getReportExportMeta();

        // 2. When no filters are active, cap export to current page size
        const exportFilters =
          !hasActiveFilters(exportParams) && options?.pageSize
            ? { ...exportParams, maxRows: options.pageSize }
            : exportParams;

        // 3. Request PDF Buffer (as Base64) from Server Action
        const { fileName, base64 }: ExportFile =
          await exportStockMovementsPdfBase64({ ...exportFilters, ...meta });

        // 4. Trigger native browser download dialog
        downloadBase64(fileName, base64, "application/pdf");

        return { fileName };
      } catch (e: any) {
        console.error("exportStockMovementsPdfBase64 failed", e);
        setError(e?.message ?? "Failed to export PDF");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [options?.pageSize]
  );

  return {
    exportPdf,
    loading,
    error,
  };
}
