/**
 * Shared report types (frontend-safe).
 * These avoid exceljs types and only capture what the UI needs.
 */

import type { StockMovementType } from "./stock";

/** ISO-8601 date string, e.g. "2025-10-31" or "2025-10-31T23:59:59.999Z" */
export type DateISO = string;

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Generic base filters for reports */
export interface BaseReportFilters {
  from?: DateISO;
  to?: DateISO;
  orderNumber?: string;
  branchId?: string;
  customerId?: string;
  employeeId?: string;
  paymentMethod?: "CASH" | "CREDIT";
  locationId?: string;
  orderStatus?: string;
}

export interface ProductReportFilters extends ReportFilters {
  productId?: string;
  variantId?: string;
  productName?: string;
  variantName?: string;
  variantSku?: string;
}

/** Customers-specific filters (extend as needed per entity) */
export interface ReportFilters extends BaseReportFilters {
  page?: number;
  limit?: number;
  maxRows?: number;
}

export type SalesItemsParams = {
  page?: number;
  limit?: number;
  orderNumber?: string;
  from?: string;
  to?: string;
  branchId?: string;
  customerId?: string;
  productName?: string;
  productVariantName?: string;
  productVariantSku?: string;
  employeeId?: string;
  brandId?: string;
  productId?: string;
  productVariantId?: string;
  paymentMethod?: "CASH" | "CREDIT";
  locationId?: string;
  orderStatus?: string;
};

export type SalesUiFilters = {
  search?: string;
  customerName?: string;
  branchId?: string | number;
  brandId?: string | number;
  customerId?: string | number;
  employeeId?: string | number;
  from?: Date | string;
  to?: Date | string;
  paymentMethod?: "CASH" | "CREDIT";
  locationId?: string | number;
  orderStatus?: string;

  // product-related fields
  productId?: string | number;
  productVariantId?: string | number;
  productName?: string;
  productVariantName?: string;
  productVariantSku?: string;

  orderNumber?: string;
  page?: number;
  limit?: number;
};

/** Minimal cell value shape returned to UI in preview */
export type PreviewCellValue = string | number | boolean | null;

/** A row is a simple dictionary of values keyed by field name */
export type PreviewRow = Record<string, PreviewCellValue>;

/** Preview column with inferred width for better rendering */
export interface PreviewColumn {
  key: string;
  header: string;
  width?: number;
}

/** One sheet in a preview response */
export interface ReportPreviewSheet {
  name: string;
  columns: ReadonlyArray<PreviewColumn>;
  rows: ReadonlyArray<PreviewRow>;
}

/** Preview response contract returned by the backend preview endpoint */
export interface ReportPreviewResponse {
  fileName: string;
  sheets: ReadonlyArray<ReportPreviewSheet>;
  pagination?: PaginationMetadata;
  search?: string;
  from?: string;
  to?: string;
  branchId?: string;
  customerId?: string;
  employeeId?: string;
}

export type SalesItemRow = {
  date: string;
  orderNumber: string;
  customer: string;
  branch: string;
  product?: string;
  productName?: string;
  variantName?: string;
  variantSku?: string;
  sku?: string;
  quantity: number;
  orderTotal: number;
  // Additional fields for order-level reports
  sellerName?: string;
  paymentType?: string;
  discountCode?: string;
  orderDiscount?: number;
  orderSubtotal?: number;
  orderTaxes?: number;
  status?: string;
};

export type SalesItemsResponse = {
  data: SalesItemRow[];
  pagination: PaginationMetadata;
};

export type CustomerItemRow = {
  fullName: string;
  email: string;
  phone: string;
  doc: string;
  priceTypes: string;
  createdAt: string;
};

export type CustomerItemsParams = {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
};

export type CustomerItemsResponse = {
  data: CustomerItemRow[];
  pagination: PaginationMetadata;
};

export type ExportFile = {
  fileName: string;
  base64: string;
  mimeType?: string;
};

/**
 * Optional metadata sent with PDF export requests (browser IANA time zone and
 * pre-formatted "now" for footers). Not used for data queries.
 */
export type ReportPdfClientMeta = {
  timeZone?: string;
  generatedAt?: string;
  generatedAtFormatted?: string;
};

/** Matches Backend: StockMovementExportFilters (StockMovementType from ./stock)
 */
export type StockMovementExportFilters = {
  fromDate?: string | undefined;
  toDate?: string | undefined;
  fromLocationId?: string | undefined;
  toLocationId?: string | undefined;
  createdBy?: string | undefined;
  productId?: string | undefined;
  productVariantId?: string | undefined;
  movementType?: StockMovementType | undefined;
  reference?: string | undefined;
  movementsIds?: string[] | undefined;
  maxRows?: number | undefined;
} & ReportPdfClientMeta;

/** * Extension for UI Table logic
 */
export type StockMovementsPreviewFilters = StockMovementExportFilters & {
  page?: number | undefined;
  limit?: number | undefined;
  skip?: number | undefined;
  take?: number | undefined;
};

export type StockMovementPreviewRow = {
  id: string;
  date: string;
  sku: string;
  product: string;
  variant: string;
  type: StockMovementType;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  reference: string;
  createdBy: string;
};

export type PaginatedStockMovements = {
  data: StockMovementPreviewRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export interface StockMovementReportItem {
  id: string;
  productId?: string | null;
  productVariantId?: string | null;
  date: string;
  sku: string;
  description: string;
  type: StockMovementType;
  fromLocation: string;
  toLocation: string;
  quantity: number;
  reference: string;
  product?: any;
  productVariant?: any;
  createdBy?: string;
}

export interface StockMovementReportData {
  companyName: string;
  generatedAt: string;
  generatedAtFormatted?: string;
  timeZone?: string;
  originHeader?: string;
  destinationHeader?: string;
  items: StockMovementReportItem[];
  totalItems: number;
  totalQuantity: number;
}
