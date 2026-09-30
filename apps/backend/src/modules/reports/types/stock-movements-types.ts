import { StockMovementType } from "@prisma/client";

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
  /** When set, shown as "Reporte generado" instead of formatting `generatedAt`. */
  generatedAtFormatted?: string;
  /** IANA time zone for formatting `generatedAt` and row timestamps. */
  timeZone?: string;
  originHeader?: string;
  destinationHeader?: string;
  items: StockMovementReportItem[];
  totalItems: number;
  totalQuantity: number;
}

export type StockMovementExportFilters = {
  fromDate?: string;
  toDate?: string;
  fromLocationId?: string;
  toLocationId?: string;
  createdBy?: string;
  productId?: string;
  productVariantId?: string;
  movementType?: StockMovementType;
  reference?: string;
  movementsIds?: string[];
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
