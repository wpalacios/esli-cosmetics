"use server";

import { serverApiClient as apiClient } from "@/lib/api/server-api-client";
import type {
  ReportFilters,
  ReportPreviewResponse,
  ReportPdfClientMeta,
  SalesItemsParams,
  SalesItemsResponse,
  CustomerItemsParams,
  CustomerItemsResponse,
  ExportFile,
  StockMovementsPreviewFilters,
  PaginatedStockMovements,
  StockMovementExportFilters,
} from "@esli-cosmetics/types";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const CUSTOMERS_REPORT_BASE_PATH = "/reports/customers";
const SALES_BY_CUSTOMER_BASE_PATH = "/reports/sales/customers";
const SALES_BY_PRODUCT_BASE_PATH = "/reports/sales/products";
const STOCK_MOVEMENTS_BASE_PATH = "/reports/stock-movements";
const PRODUCT_CATALOG_PDF_PATH = "/reports/products/catalog/export/pdf";

export async function getSalesItems(
  params: SalesItemsParams = {},
  reportType: "customers" | "products" = "customers"
): Promise<SalesItemsResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (typeof params.page === "number")
      searchParams.append("page", String(params.page));
    if (typeof params.limit === "number")
      searchParams.append("limit", String(params.limit));
    if (params.orderNumber)
      searchParams.append("orderNumber", params.orderNumber);
    if (params.from) searchParams.append("from", params.from);
    if (params.to) searchParams.append("to", params.to);
    if (params.branchId) searchParams.append("branchId", params.branchId);
    if (params.customerId) searchParams.append("customerId", params.customerId);
    if (params.employeeId) searchParams.append("employeeId", params.employeeId);
    if (params.paymentMethod)
      searchParams.append("paymentMethod", params.paymentMethod);
    if (params.locationId) searchParams.append("locationId", params.locationId);
    if (params.orderStatus)
      searchParams.append("orderStatus", params.orderStatus);

    if (params.productName)
      searchParams.append("productName", params.productName);
    if (params.productVariantName)
      searchParams.append("productVariantName", params.productVariantName);
    if (params.productVariantSku)
      searchParams.append("productVariantSku", params.productVariantSku);

    if (params.brandId) searchParams.append("brandId", params.brandId);
    if (params.productId) searchParams.append("productId", params.productId);
    if (params.productVariantId)
      searchParams.append("productVariantId", params.productVariantId);

    const qs = searchParams.toString();

    const endpointBase =
      reportType === "products"
        ? SALES_BY_PRODUCT_BASE_PATH
        : SALES_BY_CUSTOMER_BASE_PATH;
    const endpoint = `${endpointBase}/items${qs ? `?${qs}` : ""}`;

    const response = (await apiClient.get(endpoint)) as SalesItemsResponse;
    return response;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching sales items:", error);
    return {
      data: [],
      pagination: {
        page: params.page || 1,
        limit: params.limit || 10,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

// Customer items (paginated)
export async function getCustomerItems(
  params: CustomerItemsParams = {}
): Promise<CustomerItemsResponse> {
  try {
    const searchParams = new URLSearchParams();

    if (typeof params.page === "number")
      searchParams.append("page", String(params.page));
    if (typeof params.limit === "number")
      searchParams.append("limit", String(params.limit));
    if (params.search) searchParams.append("search", params.search);
    if (params.from) searchParams.append("from", params.from);
    if (params.to) searchParams.append("to", params.to);

    const qs = searchParams.toString();
    const endpoint = `${CUSTOMERS_REPORT_BASE_PATH}/items${qs ? `?${qs}` : ""}`;

    const response = (await apiClient.get(endpoint)) as CustomerItemsResponse;
    return response;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching customer items:", error);
    return {
      data: [],
      pagination: {
        page: params.page || 1,
        limit: params.limit || 10,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

// Customers report preview (delegates to paginated items endpoint)
export async function previewCustomersReport(
  filters: ReportFilters
): Promise<CustomerItemsResponse> {
  const params: CustomerItemsParams = { page: 1, limit: 20 };
  if (filters.orderNumber) params.search = filters.orderNumber;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  return getCustomerItems(params);
}

// Customers report export (Excel)
export async function exportCustomersReportExcelBase64(
  filters: ReportFilters
): Promise<{ fileName: string; base64: string }> {
  const endpoint = `${CUSTOMERS_REPORT_BASE_PATH}/export/excel`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "customers.xlsx";

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { fileName, base64 };
}

// Customers report export (PDF). Same layout as sales report; pass generatedAtFormatted for "Fecha emisión".
export async function exportCustomersReportPdfBase64(
  filters: ReportFilters & ReportPdfClientMeta
): Promise<ExportFile> {
  const endpoint = `${CUSTOMERS_REPORT_BASE_PATH}/export/PDF`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "customers.pdf";

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { fileName, base64 };
}

// Sales by customer report preview (delegates to paginated items endpoint)
export async function previewSalesByCustomerReport(
  filters: ReportFilters
): Promise<SalesItemsResponse> {
  const params: SalesItemsParams = { page: 1, limit: 20 };
  if (filters.orderNumber) params.orderNumber = filters.orderNumber;
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.customerId) params.customerId = filters.customerId;
  if (filters.employeeId) params.employeeId = filters.employeeId;
  if (filters.paymentMethod) params.paymentMethod = filters.paymentMethod;
  if (filters.locationId) params.locationId = filters.locationId;
  if (filters.orderStatus) params.orderStatus = filters.orderStatus;
  return getSalesItems(params);
}

// Sales by customer report export (Excel)
export async function exportSalesByCustomerReportExcelBase64(
  filters: ReportFilters
): Promise<{ fileName: string; base64: string }> {
  const endpoint = `${SALES_BY_CUSTOMER_BASE_PATH}/export/excel`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "reporte-de-ventas.xlsx";

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { fileName, base64 };
}

// Sales by customer report export (PDF). Pass generatedAtFormatted (from browser) to show in PDF footer.
export async function exportSalesByCustomerReportPdfBase64(
  filters: ReportFilters & ReportPdfClientMeta
): Promise<ExportFile> {
  const endpoint = `${SALES_BY_CUSTOMER_BASE_PATH}/export/PDF`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "reporte-de-ventas.pdf";

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { fileName, base64 };
}

function extractFilename(
  contentDisposition: string | null
): string | undefined {
  if (!contentDisposition) return undefined;
  const utf = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (utf) {
    try {
      return decodeURIComponent(utf);
    } catch {}
  }
  const match = contentDisposition.match(/filename="([^"]+)"/i);
  return match?.[1];
}

// Sales by product report preview (delegates to paginated items endpoint)
export async function previewSalesByProductReport(
  filters: ReportFilters
): Promise<SalesItemsResponse> {
  const params: SalesItemsParams = { page: 1, limit: 20 };
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.orderNumber) params.orderNumber = filters.orderNumber;
  if (filters.branchId) params.branchId = filters.branchId;
  if (filters.employeeId) params.employeeId = filters.employeeId;

  // Include product-specific filters if present
  const anyFilters = filters as any;
  if (anyFilters.productName) params.productName = anyFilters.productName;
  if (anyFilters.productVariantName)
    params.productVariantName = anyFilters.productVariantName;
  if (anyFilters.productVariantSku)
    params.productVariantSku = anyFilters.productVariantSku;
  if (anyFilters.brandId) params.brandId = anyFilters.brandId;
  if (anyFilters.productId) params.productId = anyFilters.productId;
  if (anyFilters.productVariantId)
    params.productVariantId = anyFilters.productVariantId;

  return getSalesItems(params, "products");
}

// Sales by product report export (Excel)
export async function exportSalesByProductReportExcelBase64(
  filters: ReportFilters
): Promise<{ fileName: string; base64: string }> {
  const endpoint = `${SALES_BY_PRODUCT_BASE_PATH}/export/excel`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "sales-by-product.xlsx";

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { fileName, base64 };
}

// Sales by product report export (PDF)
export async function exportSalesByProductReportPdfBase64(
  filters: ReportFilters & ReportPdfClientMeta
): Promise<ExportFile> {
  const endpoint = `${SALES_BY_PRODUCT_BASE_PATH}/export/PDF`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "sales-by-product.pdf";

  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { fileName, base64 };
}

/**
 * List stock movements (paginated) for the UI Table preview
 */
export async function getStockMovementsPreview(
  filters: StockMovementsPreviewFilters = {}
): Promise<PaginatedStockMovements> {
  try {
    const searchParams = new URLSearchParams();

    if (typeof filters.page === "number")
      searchParams.append("page", String(filters.page));
    if (typeof filters.limit === "number")
      searchParams.append("limit", String(filters.limit));
    if (filters.fromDate) searchParams.append("fromDate", filters.fromDate);
    if (filters.toDate) searchParams.append("toDate", filters.toDate);
    if (filters.fromLocationId)
      searchParams.append("fromLocationId", filters.fromLocationId);
    if (filters.toLocationId)
      searchParams.append("toLocationId", filters.toLocationId);
    if (filters.createdBy) searchParams.append("createdBy", filters.createdBy);
    if (filters.productId) searchParams.append("productId", filters.productId);
    if (filters.productVariantId)
      searchParams.append("productVariantId", filters.productVariantId);
    if (filters.movementType)
      searchParams.append("movementType", filters.movementType);
    if (filters.reference) searchParams.append("reference", filters.reference);

    if (filters.movementsIds && Array.isArray(filters.movementsIds)) {
      filters.movementsIds.forEach(id => {
        searchParams.append("movementsIds", id);
      });
    }

    const qs = searchParams.toString();
    const endpoint = `${STOCK_MOVEMENTS_BASE_PATH}/items${qs ? `?${qs}` : ""}`;

    const response = (await apiClient.get(endpoint)) as PaginatedStockMovements;
    return response;
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    console.error("Error fetching stock movements preview:", error);
    return {
      data: [],
      pagination: {
        page: filters.page || 1,
        limit: filters.limit || 10,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

/**
 * Export stock movements report to PDF
 */
export async function exportStockMovementsPdfBase64(
  filters: StockMovementExportFilters
): Promise<ExportFile> {
  const endpoint = `${STOCK_MOVEMENTS_BASE_PATH}/export/pdf`;
  const { arrayBuffer, headers } = await apiClient.postBinary(
    endpoint,
    filters
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "movimientos-inventario.pdf";

  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    fileName,
    base64,
    mimeType: "application/pdf",
  };
}

export type ProductCatalogPdfFilters = {
  search?: string;
  brandId?: string;
  categoryId?: string;
};

export async function exportProductCatalogPdf(
  filters: ProductCatalogPdfFilters
): Promise<ExportFile> {
  const { arrayBuffer, headers } = await apiClient.postBinary(
    PRODUCT_CATALOG_PDF_PATH,
    {
      ...(filters.search?.trim() && { search: filters.search.trim() }),
      ...(filters.brandId && { brandId: filters.brandId }),
      ...(filters.categoryId && { categoryId: filters.categoryId }),
    },
    "application/pdf"
  );

  const cd = headers.get("Content-Disposition") ?? null;
  const fileName = extractFilename(cd) ?? "catalogo-productos.pdf";

  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return {
    fileName,
    base64,
    mimeType: "application/pdf",
  };
}
